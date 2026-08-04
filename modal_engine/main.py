import modal
import os
import io

app = modal.App("wedding-media-engine")

# Define the Modal image with system OpenCV dependencies and InsightFace + ONNX Runtime.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "insightface",        # SOTA face analysis library code (MIT license)
        "onnxruntime",        # CPU execution engine for ONNX models
        "huggingface_hub",    # CLI/SDK for downloading weights from HF
        "supabase",
        "requests",
        "numpy",
    )
    .run_commands(
        # Download AuraFace weights from fal/AuraFace-v1 to the standard model folder
        "python -c 'from huggingface_hub import snapshot_download; snapshot_download(\"fal/AuraFace-v1\", local_dir=\"/root/.insightface/models/auraface\")'"
    )
)

# Global model caches to persist AuraFace in memory across warm container invocations.
_indexing_model = None
_selfie_model = None

def get_indexing_model():
    """
    Lazy-loads the indexing model (1280x1280) once and keeps it warm.
    """
    global _indexing_model
    if _indexing_model is None:
        from insightface.app import FaceAnalysis
        print("[Container Init] Loading AuraFace Indexing model (1280x1280)...")
        _indexing_model = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        _indexing_model.prepare(ctx_id=-1, det_size=(1280, 1280), det_thresh=0.25)
    return _indexing_model

def get_selfie_model():
    """
    Lazy-loads the selfie matching model (640x640) once and keeps it warm.
    """
    global _selfie_model
    if _selfie_model is None:
        from insightface.app import FaceAnalysis
        print("[Container Init] Loading AuraFace Selfie model (640x640)...")
        _selfie_model = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        _selfie_model.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.25)
    return _selfie_model


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_media_batch(request: dict):
    """
    QStash Webhook Entrypoint.
    Accepts a batch of photos and fans them out to parallel CPU workers.
    """
    import time
    start_time = time.time()

    photos = request.get("photos", [])
    if not photos:
        return {"status": "no photos provided"}

    results = list(process_single_photo.map(photos))

    duration = time.time() - start_time
    cpu_cores = 0.125
    memory_gb = 1.0
    estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
    try:
        from supabase import create_client
        supabase = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        supabase.table("modal_cost_logs").insert({
            "function_name":           "process_media_batch",
            "cpu_cores":               cpu_cores,
            "memory_gb":               memory_gb,
            "execution_time_seconds":  duration,
            "estimated_cost_inr":      estimated_cost_inr,
            "faces_detected":          0
        }).execute()
        print(f"[Batch] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
    except Exception as log_err:
        print(f"[Batch] Cost log failed: {log_err}")

    return {"status": "success", "processed": len(results), "results": results}


@app.function(
    image=image,
    cpu=1.0,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def process_single_photo(photo_data: dict):
    import time
    start_time = time.time()

    import boto3
    from PIL import Image
    from supabase import create_client, Client
    import numpy as np
    import cv2

    # ── 1. Init Supabase and B2 ──────────────────────────────────────────
    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')

    photo_id   = photo_data.get("id")
    object_key = photo_data.get("storage_key") or photo_data.get("object_key")
    event_id   = photo_data.get("event_id")
    original_url = photo_data.get("url", "")

    if not object_key:
        return {"error": "no object key", "id": photo_id}

    try:
        # ── 2. Download preview WebP from B2 ────────────────────────────
        preview_key = f"{object_key}-preview.webp"

        try:
            print(f"[{photo_id}] Downloading preview: {preview_key}")
            response = b2_client.get_object(Bucket=bucket_name, Key=preview_key)
            image_bytes = response['Body'].read()
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_bgr is None:
                raise ValueError("cv2 failed to decode preview WebP image bytes")
            h, w, _ = img_bgr.shape
            print(f"[{photo_id}] Preview loaded: {w}×{h}px")
        except Exception as e:
            print(f"[{photo_id}] Preview not found ({e}). Marking failed.")
            try:
                b2_client.delete_object(Bucket=bucket_name, Key=object_key)
            except Exception:
                pass
            try:
                supabase.table("photos").update({"status": "failed"}).eq("id", photo_id).execute()
            except Exception:
                pass
            return {"status": "error", "photo_id": photo_id, "error": "Preview missing."}

        # ── 3. Face Detection & Alignment & Encoding — AuraFace ─────────
        # Retrieve the global in-memory indexing model instance
        face_analysis = get_indexing_model()
        faces = face_analysis.get(img_bgr)
        print(f"[{photo_id}] AuraFace detector found {len(faces)} face(s).")

        face_encodings = []
        for face in faces:
            embedding = face.normed_embedding
            if embedding is not None:
                face_encodings.append(embedding)

        # ── 4. Save face embeddings to Supabase ─────────────────────────
        if face_encodings:
            face_records = []
            for encoding in face_encodings:
                face_records.append({
                    "event_id":  event_id,
                    "image_id":  photo_id,
                    "image_url": original_url,
                    "width":     w,
                    "height":    h,
                    "descriptor": encoding.tolist()
                })
            supabase.table("faces").insert(face_records).execute()
            print(f"[{photo_id}] Saved {len(face_records)} face record(s) to Supabase.")

        # ── 5. Mark face_indexed status ──────────────────────────────────
        supabase.table("photos").update({"face_indexed": True}).eq("id", photo_id).execute()
        print(f"[{photo_id}] Marked face_indexed=True ({len(face_encodings)} face(s) found).")

        # ── 6. Log infrastructure cost ───────────────────────────────────
        duration = time.time() - start_time
        cpu_cores = 1.0
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase.table("modal_cost_logs").insert({
                "photo_id":                photo_id,
                "event_id":                event_id,
                "function_name":           "process_single_photo",
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          len(face_encodings)
            }).execute()
            print(f"[{photo_id}] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[{photo_id}] Cost log failed: {log_err}")

        return {"status": "success", "photo_id": photo_id, "faces": len(face_encodings)}

    except Exception as e:
        print(f"[{photo_id}] Error: {e}")
        return {"status": "error", "photo_id": photo_id, "error": str(e)}


@app.function(
    image=image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def find_matching_photos(request: dict):
    """
    Guest Selfie Matching endpoint.
    Accepts selfie_base64 + event_ids, returns matched photos.
    Uses AuraFace cosine similarity.
    """
    import time
    start_time = time.time()

    import base64
    import numpy as np
    import cv2
    from supabase import create_client, Client

    selfie_base64 = request.get("selfie_base64", "")
    event_ids     = request.get("event_ids", [])

    if not selfie_base64 or not event_ids:
        return {"error": "Missing selfie_base64 or event_ids", "matches": []}

    try:
        # ── 1. Decode and load selfie ────────────────────────────────────
        selfie_bytes = base64.b64decode(selfie_base64)
        nparr = np.frombuffer(selfie_bytes, np.uint8)
        selfie_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if selfie_bgr is None:
            raise ValueError("cv2 failed to decode selfie image bytes")
            
        print(f"[Selfie] Loaded selfie: {selfie_bgr.shape}")

        # Retrieve the global in-memory selfie model instance
        face_analysis = get_selfie_model()
        
        selfie_faces = face_analysis.get(selfie_bgr)
        if not selfie_faces:
            print("[Selfie] No face detected in selfie.")
            # Log cost even if no face detected
            duration = time.time() - start_time
            cpu_cores = 0.125
            memory_gb = 1.0
            estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
            try:
                supabase: Client = create_client(
                    os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                )
                supabase.table("modal_cost_logs").insert({
                    "function_name":           "find_matching_photos",
                    "cpu_cores":               cpu_cores,
                    "memory_gb":               memory_gb,
                    "execution_time_seconds":  duration,
                    "estimated_cost_inr":      estimated_cost_inr,
                    "faces_detected":          0
                }).execute()
            except Exception as log_err:
                print(f"[Selfie] Cost log failed: {log_err}")
            return {"error": "No face detected in selfie", "matches": []}

        # Sort by box area descending to pick the closest/largest face
        sorted_faces = sorted(selfie_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        selfie_vec = sorted_faces[0].normed_embedding
        if selfie_vec is None:
            print("[Selfie] Failed to generate face vector.")
            # Log cost even if failure
            duration = time.time() - start_time
            cpu_cores = 0.125
            memory_gb = 1.0
            estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
            try:
                supabase: Client = create_client(
                    os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                )
                supabase.table("modal_cost_logs").insert({
                    "function_name":           "find_matching_photos",
                    "cpu_cores":               cpu_cores,
                    "memory_gb":               memory_gb,
                    "execution_time_seconds":  duration,
                    "estimated_cost_inr":      estimated_cost_inr,
                    "faces_detected":          0
                }).execute()
            except Exception as log_err:
                print(f"[Selfie] Cost log failed: {log_err}")
            return {"error": "Failed to generate face vector", "matches": []}
            
        print("[Selfie] Embedding successfully generated.")

        # ── 3. Fetch all indexed face descriptors for these events ───────
        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        response = supabase.table("faces").select("*").in_("event_id", event_ids).execute()
        db_faces = response.data or []
        print(f"[Selfie] Fetched {len(db_faces)} indexed face records to compare.")

        # ── 4. Cosine similarity matching ────────────────────────────────
        # Threshold set to 0.40 (maximum recall for side profiles, group shots).
        THRESHOLD = 0.40
        matches_map = {}

        for face in db_faces:
            db_descriptor = face.get("descriptor")
            if not db_descriptor:
                continue

            try:
                if isinstance(db_descriptor, str):
                    import json
                    db_descriptor = json.loads(db_descriptor)

                db_vec = np.array(db_descriptor, dtype=np.float32)

                if len(db_vec) != 512:
                    print(f"[Match] Skipping old vector {face.get('id')} — incorrect dim ({len(db_vec)})")
                    continue

                # Cosine similarity of L2-normalized vectors
                cosine_sim = float(np.dot(selfie_vec, db_vec))

                print(f"[Match Debug] image_id={face.get('image_id')} cosine_sim={cosine_sim:.4f} (threshold={THRESHOLD})")

                if cosine_sim >= THRESHOLD:
                    image_id = face.get("image_id")
                    if image_id not in matches_map or cosine_sim > matches_map[image_id]["sim"]:
                        matches_map[image_id] = {
                            "id":       image_id,
                            "imageId":  image_id,
                            "imageUrl": face.get("image_url"),
                            "width":    face.get("width"),
                            "height":   face.get("height"),
                            "sim":      cosine_sim
                        }
            except Exception as e:
                print(f"[Match] Error on face {face.get('id')}: {e}")

        matches = []
        for m in matches_map.values():
            del m["sim"]
            matches.append(m)

        print(f"[Selfie] Returning {len(matches)} match(es).")
        
        # Log infrastructure cost
        duration = time.time() - start_time
        cpu_cores = 0.125
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase.table("modal_cost_logs").insert({
                "function_name":           "find_matching_photos",
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          len(selfie_faces)
            }).execute()
            print(f"[Selfie] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[Selfie] Cost log failed: {log_err}")

        return {
            "success": True,
            "matches": matches,
            "debug": {
                "indexedFacesCount": len(db_faces),
                "selfieDetected":    True,
                "matchesCount":      len(matches)
            }
        }

    except Exception as e:
        print(f"[find_matching_photos] Error: {e}")
        # Log cost even on exception
        duration = time.time() - start_time
        cpu_cores = 0.125
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase: Client = create_client(
                os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
                os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            )
            supabase.table("modal_cost_logs").insert({
                "function_name":           "find_matching_photos",
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          0
            }).execute()
        except Exception as log_err:
            print(f"[Selfie] Cost log failed: {log_err}")
        return {"error": str(e), "matches": []}


def run_transcode(request: dict):
    """
    QStash Webhook Entrypoint for Video Transcoding.
    Downloads raw video from B2, runs FFmpeg to generate adaptive HLS renditions (.m3u8 + .ts),
    poster frame, uploads to B2, and updates Supabase database.
    """
    import time
    import subprocess
    import tempfile
    import pathlib
    import boto3
    from supabase import create_client, Client

    start_time = time.time()

    photo_id   = request.get("photo_id") or request.get("id")
    object_key = request.get("storage_key") or request.get("object_key")

    if not object_key or not photo_id:
        return {"error": "Missing storage_key or photo_id", "status": "failed"}

    print(f"[VideoTranscode] Starting HLS encoding for: {object_key} (ID: {photo_id})")

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')
    media_domain = (os.environ.get("MEDIA_DOMAIN") or "media.evebash.com").replace("https://", "").strip("/")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)
        raw_input_path = tmp_path / "input_raw.mp4"
        output_hls_dir = tmp_path / "hls"
        output_hls_dir.mkdir(parents=True, exist_ok=True)

        # 1. Download raw video file from Backblaze B2
        print(f"[VideoTranscode] Downloading raw video from B2 bucket '{bucket_name}' key '{object_key}'...")
        try:
            b2_client.download_file(bucket_name, object_key, str(raw_input_path))
        except Exception as dl_err:
            print(f"[VideoTranscode] Error downloading video from B2: {dl_err}")
            return {"error": f"Failed to download video from B2: {str(dl_err)}", "status": "failed"}

        # 2. Extract Poster Frame (JPEG at 1-second mark)
        poster_path = output_hls_dir / "poster.jpg"
        poster_cmd = [
            "ffmpeg", "-y", "-i", str(raw_input_path),
            "-ss", "00:00:01", "-vframes", "1",
            "-q:v", "2", str(poster_path)
        ]
        subprocess.run(poster_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Check if video has an audio stream using ffprobe
        has_audio = False
        try:
            probe_cmd = [
                "ffprobe", "-v", "error", "-select_streams", "a", 
                "-show_entries", "stream=index", "-of", "csv=p=0", 
                str(raw_input_path)
            ]
            probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
            if probe_res.stdout.strip():
                has_audio = True
                print("[VideoTranscode] Audio stream detected in input video.")
            else:
                print("[VideoTranscode] No audio stream detected in input video (silent video).")
        except Exception as probe_err:
            print(f"[VideoTranscode] Error probing audio: {probe_err}")

        # 3. Transcode to HLS (1080p, 720p, 480p adaptive bitrate streams)
        master_playlist_path = output_hls_dir / "master.m3u8"
        
        if has_audio:
            hls_cmd = [
                "ffmpeg", "-y", "-i", str(raw_input_path),
                "-filter_complex",
                "[0:v]split=3[v1][v2][v3]; "
                "[v1]scale=-2:1080[v1out]; "
                "[v2]scale=-2:720[v2out]; "
                "[v3]scale=-2:480[v3out]",
                "-map", "[v1out]", "-c:v:0", "libx264", "-b:v:0", "4000k", "-maxrate:v:0", "4500k", "-bufsize:v:0", "6000k",
                "-map", "[v2out]", "-c:v:1", "libx264", "-b:v:1", "2500k", "-maxrate:v:1", "2800k", "-bufsize:v:1", "3500k",
                "-map", "[v3out]", "-c:v:2", "libx264", "-b:v:2", "1000k", "-maxrate:v:2", "1200k", "-bufsize:v:2", "1500k",
                "-map", "a:0", "-c:a:0", "aac", "-b:a:0", "128k",
                "-map", "a:0", "-c:a:1", "aac", "-b:a:1", "128k",
                "-map", "a:0", "-c:a:2", "aac", "-b:a:2", "96k",
                "-var_stream_map", "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p",
                "-preset", "veryfast", "-g", "48", "-sc_threshold", "0",
                "-hls_time", "4", "-hls_playlist_type", "vod",
                "-hls_segment_filename", f"{output_hls_dir}/%v/segment_%03d.ts",
                "-master_pl_name", "master.m3u8",
                f"{output_hls_dir}/%v/playlist.m3u8"
            ]
        else:
            hls_cmd = [
                "ffmpeg", "-y", "-i", str(raw_input_path),
                "-filter_complex",
                "[0:v]split=3[v1][v2][v3]; "
                "[v1]scale=-2:1080[v1out]; "
                "[v2]scale=-2:720[v2out]; "
                "[v3]scale=-2:480[v3out]",
                "-map", "[v1out]", "-c:v:0", "libx264", "-b:v:0", "4000k", "-maxrate:v:0", "4500k", "-bufsize:v:0", "6000k",
                "-map", "[v2out]", "-c:v:1", "libx264", "-b:v:1", "2500k", "-maxrate:v:1", "2800k", "-bufsize:v:1", "3500k",
                "-map", "[v3out]", "-c:v:2", "libx264", "-b:v:2", "1000k", "-maxrate:v:2", "1200k", "-bufsize:v:2", "1500k",
                "-var_stream_map", "v:0,name:1080p v:1,name:720p v:2,name:480p",
                "-preset", "veryfast", "-g", "48", "-sc_threshold", "0",
                "-hls_time", "4", "-hls_playlist_type", "vod",
                "-hls_segment_filename", f"{output_hls_dir}/%v/segment_%03d.ts",
                "-master_pl_name", "master.m3u8",
                f"{output_hls_dir}/%v/playlist.m3u8"
            ]

        print(f"[VideoTranscode] Running FFmpeg HLS encoding pipeline (has_audio={has_audio})...")
        ffmpeg_res = subprocess.run(hls_cmd, capture_output=True, text=True)

        if ffmpeg_res.returncode != 0:
            print(f"[VideoTranscode] Multi-rendition FFmpeg failed, running fallback single stream... STDERR: {ffmpeg_res.stderr}")
            fallback_cmd = [
                "ffmpeg", "-y", "-i", str(raw_input_path),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-hls_time", "4", "-hls_playlist_type", "vod",
                "-hls_segment_filename", f"{output_hls_dir}/segment_%03d.ts",
                str(master_playlist_path)
            ]
            subprocess.run(fallback_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 4. Upload HLS files to B2
        hls_prefix = f"hls/{object_key}"
        print(f"[VideoTranscode] Uploading generated HLS package to B2 key prefix '{hls_prefix}'...")

        for file_path in output_hls_dir.glob("**/*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(output_hls_dir)
                b2_key = f"{hls_prefix}/{rel_path}"
                content_type = "application/x-mpegURL" if file_path.suffix == ".m3u8" else \
                               "video/MP2T" if file_path.suffix == ".ts" else \
                               "image/jpeg" if file_path.suffix in [".jpg", ".jpeg"] else \
                               "application/octet-stream"
                b2_client.upload_file(
                    str(file_path),
                    bucket_name,
                    b2_key,
                    ExtraArgs={"ContentType": content_type}
                )

        hls_master_url = f"https://{media_domain}/{hls_prefix}/master.m3u8"
        poster_url = f"https://{media_domain}/{hls_prefix}/poster.jpg" if poster_path.exists() else None

        # 5. Update Supabase record
        update_data = {
            "url": hls_master_url,
            "resource_type": "video",
            "media_type": "video",
        }
        if poster_url:
            update_data["thumbnail_url"] = poster_url

        supabase.table("photos").update(update_data).eq("id", photo_id).execute()
        print(f"[VideoTranscode] Successfully encoded & updated photo {photo_id} with HLS URL: {hls_master_url}")

        # 6. Log infrastructure cost
        duration = time.time() - start_time
        cpu_cores = 2.0
        memory_gb = 2.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase.table("modal_cost_logs").insert({
                "function_name": "process_video_transcode",
                "cpu_cores": cpu_cores,
                "memory_gb": memory_gb,
                "execution_time_seconds": duration,
                "estimated_cost_inr": estimated_cost_inr,
                "faces_detected": 0
            }).execute()
        except Exception as log_err:
            print(f"[VideoTranscode] Cost log failed: {log_err}")

        return {
            "status": "success",
            "photo_id": photo_id,
            "hls_url": hls_master_url,
            "poster_url": poster_url,
            "duration_seconds": duration
        }


@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=300,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_transcode_standard(request: dict):
    return run_transcode(request)


@app.function(
    image=image,
    cpu=2.0,
    memory=4096,
    timeout=600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_transcode_medium(request: dict):
    return run_transcode(request)


@app.function(
    image=image,
    cpu=4.0,
    memory=8192,
    timeout=1200,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_transcode_large(request: dict):
    return run_transcode(request)

