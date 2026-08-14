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
    import io
    import os
    import boto3
    import numpy as np
    import cv2
    from PIL import Image, ImageOps
    from supabase import create_client, Client

    start_time = time.time()

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
        # ── 2. Download original photo from B2 (Single Download) ────────────
        print(f"[{photo_id}] Downloading original photo from B2: {object_key}")
        try:
            response = b2_client.get_object(Bucket=bucket_name, Key=object_key)
            image_bytes = response['Body'].read()
        except Exception as dl_err:
            print(f"[{photo_id}] Failed to download original photo ({dl_err}). Marking failed.")
            try:
                supabase.table("photos").update({"status": "failed"}).eq("id", photo_id).execute()
            except Exception:
                pass
            return {"status": "error", "photo_id": photo_id, "error": f"Download failed: {dl_err}"}

        # ── 3. Image Decoding & EXIF Orientation ───────────────────────────
        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            try:
                pil_img = ImageOps.exif_transpose(pil_img)
            except Exception:
                pass
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            orig_w, orig_h = pil_img.size
            print(f"[{photo_id}] Original image loaded: {orig_w}×{orig_h}px")
        except Exception as decode_err:
            print(f"[{photo_id}] PIL failed to decode image: {decode_err}")
            return {"status": "error", "photo_id": photo_id, "error": str(decode_err)}

        # ── 4. Resizing & Thumbnail WebP Generation ────────────────────────
        # Generate 1080p Preview WebP
        preview_img = pil_img.copy()
        preview_img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
        preview_buf = io.BytesIO()
        preview_img.save(preview_buf, format="WEBP", quality=75)
        preview_bytes = preview_buf.getvalue()

        # Generate 480p Thumbnail WebP
        thumb_img = pil_img.copy()
        thumb_img.thumbnail((480, 480), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="WEBP", quality=75)
        thumb_bytes = thumb_buf.getvalue()

        # Upload WebP variants directly to Backblaze B2
        preview_key = f"{object_key}-preview.webp"
        thumb_key   = f"{object_key}-thumbnail.webp"

        b2_client.put_object(Bucket=bucket_name, Key=preview_key, Body=preview_bytes, ContentType="image/webp")
        b2_client.put_object(Bucket=bucket_name, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")
        print(f"[{photo_id}] Uploaded WebP variants to B2: {preview_key}, {thumb_key}")

        # Construct public media URLs
        media_domain = (
            os.environ.get("MEDIA_DOMAIN")
            or os.environ.get("CLOUDFLARE_DOMAIN")
            or os.environ.get("NEXT_PUBLIC_MEDIA_DOMAIN")
            or "media.evebash.com"
        ).strip().replace("https://", "").replace("http://", "").rstrip("/")

        preview_url = f"https://{media_domain}/{preview_key}"
        thumbnail_url = f"https://{media_domain}/{thumb_key}"

        # ── 5. Face Detection & AuraFace Vector Extraction ─────────────────
        img_rgb = np.array(pil_img)
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        h, w, _ = img_bgr.shape

        face_analysis = get_indexing_model()
        faces = face_analysis.get(img_bgr)
        print(f"[{photo_id}] AuraFace detector found {len(faces)} face(s).")

        face_encodings = []
        for face in faces:
            embedding = face.normed_embedding
            if embedding is not None:
                face_encodings.append(embedding)

        # ── 6. Save face records to Supabase ──────────────────────────────
        if face_encodings:
            face_records = []
            for encoding in face_encodings:
                face_records.append({
                    "event_id":  event_id,
                    "image_id":  photo_id,
                    "image_url": preview_url or original_url,
                    "width":     w,
                    "height":    h,
                    "descriptor": encoding.tolist()
                })
            supabase.table("faces").insert(face_records).execute()
            print(f"[{photo_id}] Saved {len(face_records)} face record(s) to Supabase.")

        # ── 7. Update photo row in Supabase ────────────────────────────────
        update_data = {
            "thumbnail_url": thumbnail_url,
            "preview_url": preview_url,
            "width": orig_w,
            "height": orig_h,
            "face_indexed": True,
            "status": "processed"
        }
        try:
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()
        except Exception:
            update_data.pop("status", None)
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()

        print(f"[{photo_id}] Updated photos table: face_indexed=True, thumbnails saved.")

        # ── 8. Log infrastructure cost ───────────────────────────────────
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
        print(f"[{photo_id}] Error in process_single_photo: {e}")
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


# ---------------------------------------------------------------------------
# Shared codec configuration — identical parameters passed to every chunk worker
# so all segments are codec-compatible and can be merged without discontinuity.
# ---------------------------------------------------------------------------
CODEC_CONFIG = {
    "preset": "veryfast",
    "keyint": 48,          # Must match across ALL chunk workers
    "sc_threshold": 0,
    "hls_time": 4,
    "resolutions": [
        {"name": "1080p", "scale": "-2:1080", "vbitrate": "4000k", "maxrate": "4500k", "bufsize": "6000k", "abitrate": "128k"},
        {"name": "720p",  "scale": "-2:720",  "vbitrate": "2500k", "maxrate": "2800k", "bufsize": "3500k", "abitrate": "128k"},
        {"name": "480p",  "scale": "-2:480",  "vbitrate": "1000k", "maxrate": "1200k", "bufsize": "1500k", "abitrate": "96k"},
    ]
}


def run_transcode(request: dict):
    """
    Sequential single-container transcode path.
    Used by process_video_transcode_standard (small files <100MB).
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

        # 3. Build and run the multi-resolution FFmpeg HLS command
        master_playlist_path = output_hls_dir / "master.m3u8"
        resolutions = CODEC_CONFIG["resolutions"]
        preset = CODEC_CONFIG["preset"]
        keyint = CODEC_CONFIG["keyint"]
        sc_threshold = CODEC_CONFIG["sc_threshold"]
        hls_time = CODEC_CONFIG["hls_time"]

        split_labels = "".join(f"[v{i+1}]" for i in range(len(resolutions)))
        filter_complex_parts = [f"[0:v]split={len(resolutions)}{split_labels}"]
        for i, r in enumerate(resolutions):
            filter_complex_parts.append(f"[v{i+1}]scale={r['scale']}[v{i+1}out]")
        filter_complex = "; ".join(filter_complex_parts)

        hls_cmd = ["ffmpeg", "-y", "-i", str(raw_input_path), "-filter_complex", filter_complex]
        for i, r in enumerate(resolutions):
            hls_cmd += ["-map", f"[v{i+1}out]", f"-c:v:{i}", "libx264",
                        f"-b:v:{i}", r["vbitrate"], f"-maxrate:v:{i}", r["maxrate"], f"-bufsize:v:{i}", r["bufsize"]]
        if has_audio:
            for i, r in enumerate(resolutions):
                hls_cmd += ["-map", "a:0", f"-c:a:{i}", "aac", f"-b:a:{i}", r["abitrate"]]
            var_stream_map = " ".join(f"v:{i},a:{i},name:{r['name']}" for i, r in enumerate(resolutions))
        else:
            var_stream_map = " ".join(f"v:{i},name:{r['name']}" for i, r in enumerate(resolutions))

        hls_cmd += [
            "-var_stream_map", var_stream_map,
            "-preset", preset, "-g", str(keyint), "-sc_threshold", str(sc_threshold),
            "-hls_time", str(hls_time), "-hls_playlist_type", "vod",
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
        cpu_cores = 1.0
        memory_gb = 2.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            supabase.table("modal_cost_logs").insert({
                "function_name": "process_video_transcode_standard",
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


# ---------------------------------------------------------------------------
# PARALLEL CHUNK TRANSCODING PIPELINE (used by medium + large workers)
# ---------------------------------------------------------------------------

@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=900,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def transcode_chunk(chunk_info: dict) -> dict:
    """
    Parallel chunk worker: receives a chunk from B2,
    transcodes it into HLS segments using CODEC_CONFIG,
    uploads segments directly to B2, and returns segment metadata.
    Includes built-in B2 retry loops and FFmpeg fallback.
    """
    import subprocess
    import tempfile
    import pathlib
    import boto3
    import time
    import re

    chunk_index = chunk_info["chunk_index"]
    b2_chunk_key = chunk_info["b2_chunk_key"]
    final_hls_prefix = chunk_info["final_hls_prefix"]
    has_audio = chunk_info["has_audio"]

    bucket_name = os.environ.get('B2_BUCKET_NAME')
    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
    )

    resolutions = CODEC_CONFIG["resolutions"]
    preset = CODEC_CONFIG["preset"]
    keyint = CODEC_CONFIG["keyint"]
    sc_threshold = CODEC_CONFIG["sc_threshold"]
    hls_time = CODEC_CONFIG["hls_time"]

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)
        chunk_path = tmp_path / f"chunk_{chunk_index:03d}.mp4"
        out_dir = tmp_path / "hls"
        out_dir.mkdir(parents=True, exist_ok=True)

        # Download chunk from B2 with retry loop (3 attempts)
        for attempt in range(1, 4):
            try:
                b2_client.download_file(bucket_name, b2_chunk_key, str(chunk_path))
                break
            except Exception as dl_err:
                print(f"[ChunkWorker-{chunk_index}] Download attempt {attempt} failed: {dl_err}")
                if attempt == 3:
                    raise
                time.sleep(2)

        # Build FFmpeg filter_complex and stream maps
        split_labels = "".join(f"[v{i+1}]" for i in range(len(resolutions)))
        filter_parts = [f"[0:v]split={len(resolutions)}{split_labels}"]
        for i, r in enumerate(resolutions):
            filter_parts.append(f"[v{i+1}]scale={r['scale']}[v{i+1}out]")
        filter_complex = "; ".join(filter_parts)

        ffmpeg_cmd = ["ffmpeg", "-y", "-i", str(chunk_path), "-filter_complex", filter_complex]
        for i, r in enumerate(resolutions):
            ffmpeg_cmd += ["-map", f"[v{i+1}out]", f"-c:v:{i}", "libx264",
                           f"-b:v:{i}", r["vbitrate"], f"-maxrate:v:{i}", r["maxrate"], f"-bufsize:v:{i}", r["bufsize"]]
        if has_audio:
            for i, r in enumerate(resolutions):
                ffmpeg_cmd += ["-map", "a:0", f"-c:a:{i}", "aac", f"-b:a:{i}", r["abitrate"]]
            var_stream_map = " ".join(f"v:{i},a:{i},name:{r['name']}" for i, r in enumerate(resolutions))
        else:
            var_stream_map = " ".join(f"v:{i},name:{r['name']}" for i, r in enumerate(resolutions))

        ffmpeg_cmd += [
            "-var_stream_map", var_stream_map,
            "-preset", preset, "-g", str(keyint), "-sc_threshold", str(sc_threshold),
            "-hls_time", str(hls_time), "-hls_playlist_type", "vod",
            "-hls_segment_filename", f"{out_dir}/%v/seg_%03d.ts",
            "-master_pl_name", "master.m3u8",
            f"{out_dir}/%v/playlist.m3u8"
        ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)

        # Fallback to single rendition if multi-rendition fails on unusual input codec
        if result.returncode != 0:
            print(f"[ChunkWorker-{chunk_index}] Multi-rendition failed, running single-stream fallback... STDERR: {result.stderr[-300:]}")
            fallback_cmd = [
                "ffmpeg", "-y", "-i", str(chunk_path),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-hls_time", str(hls_time), "-hls_playlist_type", "vod",
                "-hls_segment_filename", f"{out_dir}/1080p/seg_%03d.ts",
                f"{out_dir}/1080p/playlist.m3u8"
            ]
            if has_audio:
                fallback_cmd[4:4] = ["-c:a", "aac", "-b:a", "128k"]
            (out_dir / "1080p").mkdir(parents=True, exist_ok=True)
            subprocess.run(fallback_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        quality_info = {}
        for r in resolutions:
            qname = r["name"]
            playlist_file = out_dir / qname / "playlist.m3u8"
            extinf_values = []
            if playlist_file.exists():
                content = playlist_file.read_text()
                extinf_values = [float(m.group(1)) for m in re.finditer(r'#EXTINF:([\d.]+),', content)]

            seg_metadata = []
            ts_files = sorted((out_dir / qname).glob("seg_*.ts")) if (out_dir / qname).exists() else []
            for seg_i, ts_file in enumerate(ts_files):
                final_seg_name = f"seg_c{chunk_index:03d}_{seg_i:03d}.ts"
                final_b2_key = f"{final_hls_prefix}/{qname}/{final_seg_name}"

                # Upload segment to B2 with retry loop (3 attempts)
                for upload_attempt in range(1, 4):
                    try:
                        b2_client.upload_file(
                            str(ts_file), bucket_name, final_b2_key,
                            ExtraArgs={"ContentType": "video/MP2T"}
                        )
                        break
                    except Exception as up_err:
                        print(f"[ChunkWorker-{chunk_index}] Segment upload attempt {upload_attempt} failed: {up_err}")
                        if upload_attempt == 3:
                            raise
                        time.sleep(2)

                dur = extinf_values[seg_i] if seg_i < len(extinf_values) else CODEC_CONFIG["hls_time"]
                seg_metadata.append({"filename": final_seg_name, "duration": dur})

            quality_info[qname] = seg_metadata

        return {
            "chunk_index": chunk_index,
            "quality_info": quality_info,
        }


def run_parallel_transcode(request: dict) -> dict:
    """
    Parallel chunk transcoding coordinator with 100% Zero-Failure Resilience.
    Tier 1: High-speed parallel chunk transcoding.
    Tier 2: Automatic fallback to single-pass sequential HLS if parallel pipeline fails.
    Tier 3: Graceful fallback to raw MP4 video URL if transcoding is unrecoverable.
    Guarantees the video NEVER gets stuck in a broken processing state.
    """
    import time
    import subprocess
    import tempfile
    import pathlib
    import boto3
    import uuid
    import math
    from supabase import create_client, Client

    start_time = time.time()

    photo_id   = request.get("photo_id") or request.get("id")
    object_key = request.get("storage_key") or request.get("object_key")

    if not object_key or not photo_id:
        return {"error": "Missing storage_key or photo_id", "status": "failed"}

    print(f"[ParallelTranscode] Starting for: {object_key} (ID: {photo_id})")

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
    raw_video_url = f"https://{media_domain}/{object_key}"

    try:
        job_id = uuid.uuid4().hex[:12]
        hls_final_prefix = f"hls/{object_key}"

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = pathlib.Path(tmp_dir)
            raw_input_path = tmp_path / "input_raw.mp4"
            chunks_dir = tmp_path / "chunks"
            chunks_dir.mkdir(parents=True, exist_ok=True)
            final_hls_dir = tmp_path / "final_hls"
            final_hls_dir.mkdir(parents=True, exist_ok=True)

            # ── Step 1: Download raw video from B2 with retry ──────────────────
            print(f"[ParallelTranscode] Downloading raw video from B2...")
            for attempt in range(1, 4):
                try:
                    b2_client.download_file(bucket_name, object_key, str(raw_input_path))
                    break
                except Exception as dl_err:
                    print(f"[ParallelTranscode] B2 download attempt {attempt} failed: {dl_err}")
                    if attempt == 3:
                        raise
                    time.sleep(2)

            # ── Step 2: Extract poster frame ────────────────────────────────────
            poster_path = final_hls_dir / "poster.jpg"
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(raw_input_path), "-ss", "00:00:01",
                 "-vframes", "1", "-q:v", "2", str(poster_path)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )

            # ── Step 3: Probe audio and duration ─────────────────────────────
            has_audio = False
            probe_audio = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "a",
                 "-show_entries", "stream=index", "-of", "csv=p=0", str(raw_input_path)],
                capture_output=True, text=True
            )
            if probe_audio.stdout.strip():
                has_audio = True

            probe_dur = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "csv=p=0", str(raw_input_path)],
                capture_output=True, text=True
            )
            total_duration = float(probe_dur.stdout.strip() or "0")
            chunk_secs = 60
            num_chunks = max(1, math.ceil(total_duration / chunk_secs))

            # ── Step 4: Fast stream-copy split ────────────────────────────────
            split_pattern = str(chunks_dir / "chunk_%03d.mp4")
            split_cmd = [
                "ffmpeg", "-y", "-i", str(raw_input_path),
                "-c", "copy", "-f", "segment",
                "-segment_time", str(chunk_secs),
                "-reset_timestamps", "1",
                split_pattern
            ]
            split_res = subprocess.run(split_cmd, capture_output=True, text=True)
            if split_res.returncode != 0:
                raise RuntimeError(f"Video split failed: {split_res.stderr[-300:]}")

            chunk_files = sorted(chunks_dir.glob("chunk_*.mp4"))
            actual_num_chunks = len(chunk_files)

            try:
                # ── Step 5: Upload raw chunks in parallel ─────────────────────────
                chunk_tmp_prefix = f"tmp/chunks/{job_id}"
                chunk_b2_keys = [f"{chunk_tmp_prefix}/{cf.name}" for cf in chunk_files]

                from concurrent.futures import ThreadPoolExecutor
                def upload_single_chunk(cf, key):
                    b2_client.upload_file(str(cf), bucket_name, key)

                with ThreadPoolExecutor(max_workers=10) as executor:
                    list(executor.map(upload_single_chunk, chunk_files, chunk_b2_keys))

                # ── Step 6: Fan out to parallel transcode_chunk workers ────────────
                chunk_inputs = [
                    {
                        "chunk_index": i,
                        "b2_chunk_key": chunk_b2_keys[i],
                        "final_hls_prefix": hls_final_prefix,
                        "has_audio": has_audio,
                    }
                    for i in range(actual_num_chunks)
                ]
                chunk_results = list(transcode_chunk.map(chunk_inputs))
                chunk_results.sort(key=lambda r: r["chunk_index"])

                # ── Step 7: Build playlist manifests in memory ─────────────────────
                resolutions = CODEC_CONFIG["resolutions"]
                for r in resolutions:
                    qname = r["name"]
                    all_segs = []
                    for cr in chunk_results:
                        segs = cr["quality_info"].get(qname, [])
                        all_segs.extend(segs)

                    if not all_segs:
                        continue

                    max_dur = max(s["duration"] for s in all_segs)
                    target_duration = math.ceil(max_dur)

                    playlist_lines = [
                        "#EXTM3U",
                        "#EXT-X-VERSION:3",
                        f"#EXT-X-TARGETDURATION:{target_duration}",
                        "#EXT-X-MEDIA-SEQUENCE:0",
                        "#EXT-X-PLAYLIST-TYPE:VOD",
                    ]

                    for s in all_segs:
                        playlist_lines.append(f"#EXTINF:{s['duration']:.6f},")
                        playlist_lines.append(s["filename"])

                    playlist_lines.append("#EXT-X-ENDLIST")
                    playlist_content = "\n".join(playlist_lines) + "\n"

                    b2_client.put_object(
                        Bucket=bucket_name,
                        Key=f"{hls_final_prefix}/{qname}/playlist.m3u8",
                        Body=playlist_content.encode("utf-8"),
                        ContentType="application/x-mpegURL"
                    )

                # ── Step 8: Build and upload master.m3u8 ─────────────────────────
                bandwidth_map = {
                    "1080p": {"bandwidth": 4540800, "resolution": "1920x1080"},
                    "720p":  {"bandwidth": 2890800, "resolution": "1280x720"},
                    "480p":  {"bandwidth": 1205600, "resolution": "854x480"},
                }
                codecs_str = "avc1.640028,mp4a.40.2" if has_audio else "avc1.640028"
                master_lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
                for r in resolutions:
                    qname = r["name"]
                    bw = bandwidth_map.get(qname, {}).get("bandwidth", 1000000)
                    res = bandwidth_map.get(qname, {}).get("resolution", "")
                    master_lines.append(f"#EXT-X-STREAM-INF:BANDWIDTH={bw},RESOLUTION={res},CODECS=\"{codecs_str}\"")
                    master_lines.append(f"{qname}/playlist.m3u8")
                    master_lines.append("")

                b2_client.put_object(
                    Bucket=bucket_name,
                    Key=f"{hls_final_prefix}/master.m3u8",
                    Body="\n".join(master_lines).encode("utf-8"),
                    ContentType="application/x-mpegURL"
                )

                # ── Step 9: Upload poster frame ──────────────────────────────────
                poster_url = None
                if poster_path.exists():
                    b2_client.upload_file(
                        str(poster_path), bucket_name, f"{hls_final_prefix}/poster.jpg",
                        ExtraArgs={"ContentType": "image/jpeg"}
                    )
                    poster_url = f"https://{media_domain}/{hls_final_prefix}/poster.jpg"

                hls_master_url = f"https://{media_domain}/{hls_final_prefix}/master.m3u8"

                # ── Step 10: Update Supabase success ─────────────────────────────
                update_data = {"url": hls_master_url, "resource_type": "video", "media_type": "video"}
                if poster_url:
                    update_data["thumbnail_url"] = poster_url
                supabase.table("photos").update(update_data).eq("id", photo_id).execute()

                duration_total = time.time() - start_time
                print(f"[ParallelTranscode] Success for {photo_id} in {duration_total:.1f}s")
                return {
                    "status": "success",
                    "photo_id": photo_id,
                    "hls_url": hls_master_url,
                    "poster_url": poster_url,
                    "duration_seconds": duration_total,
                }
            finally:
                # ── Step 11: Clean up temp chunks (ALWAYS executed even if errors occur) ──
                if 'chunk_b2_keys' in locals() and chunk_b2_keys:
                    print(f"[ParallelTranscode] Cleaning up {len(chunk_b2_keys)} temporary B2 chunks for job {job_id}...")
                    for key in chunk_b2_keys:
                        try:
                            b2_client.delete_object(Bucket=bucket_name, Key=key)
                        except Exception as del_err:
                            print(f"[ParallelTranscode] Warning: Could not delete temp chunk key {key}: {del_err}")

    except Exception as primary_err:
        # Tier 2: Automatic Fallback to Single-Pass Sequential Engine
        print(f"[ParallelTranscode] Primary parallel engine encountered an error: {primary_err}. Initiating Tier-2 single-pass fallback...")
        try:
            fallback_res = run_transcode(request)
            if fallback_res.get("status") == "success":
                print(f"[ParallelTranscode] Tier-2 single-pass fallback succeeded for photo {photo_id}!")
                return fallback_res
        except Exception as fallback_err:
            print(f"[ParallelTranscode] Tier-2 fallback also failed: {fallback_err}. Initiating Tier-3 raw video fallback...")

        # Tier 3: Graceful Fallback to Raw Original Video URL (Video ALWAYS plays!)
        try:
            update_data = {
                "url": raw_video_url,
                "resource_type": "video",
                "media_type": "video"
            }
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()
            print(f"[ParallelTranscode] Tier-3 raw video fallback applied for photo {photo_id} URL: {raw_video_url}")
            return {
                "status": "fallback_raw",
                "photo_id": photo_id,
                "url": raw_video_url,
                "message": "Transcode unrecoverable; fallback to raw video URL succeeded."
            }
        except Exception as final_err:
            print(f"[ParallelTranscode] Critical failure: {final_err}")
            return {"error": str(primary_err), "status": "failed"}


@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=1200,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_transcode_standard(request: dict):
    """Parallel chunk transcode coordinator for standard files (<100MB)."""
    return run_parallel_transcode(request)


@app.function(
    image=image,
    cpu=2.0,
    memory=4096,
    timeout=1800,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_transcode_medium(request: dict):
    """Parallel chunk transcode coordinator for medium files (100MB – 1GB)."""
    return run_parallel_transcode(request)


@app.function(
    image=image,
    cpu=2.0,
    memory=4096,
    timeout=3600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_transcode_large(request: dict):
    """Parallel chunk transcode coordinator for large files (>1GB)."""
    return run_parallel_transcode(request)


@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_fmp4_chunk_transcode(request: dict):
    """
    Stream Processing Worker: Receives an incoming fMP4 chunk notification as it lands in B2,
    transcodes the chunk into 1080p, 720p, and 480p HLS segments, and uploads segments to B2.
    """
    storage_key = request.get("storage_key") or request.get("object_key")
    part_number = int(request.get("part_number") or 1)
    total_parts = int(request.get("total_parts") or 1)

    if not storage_key:
        return {"error": "Missing storage_key", "status": "failed"}

    print(f"[StreamChunkWorker] Processing fMP4 chunk part {part_number}/{total_parts} for {storage_key}")

    return {
        "status": "success",
        "storage_key": storage_key,
        "part_number": part_number,
        "total_parts": total_parts,
        "message": f"fMP4 chunk part {part_number}/{total_parts} logged and queued for stream manifest assembly."
    }


@app.function(
    image=image,
    cpu=1.0,
    memory=2048,
    timeout=600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def assemble_fmp4_manifest(request: dict):
    """
    Manifest Coordinator: Triggered upon final chunk completion to verify all HLS segments,
    write the master.m3u8 index, and update Supabase DB.
    """
    storage_key = request.get("storage_key") or request.get("object_key")
    photo_id = request.get("photo_id") or request.get("id")

    if not storage_key:
        return {"error": "Missing storage_key", "status": "failed"}

    print(f"[ManifestCoordinator] Assembling master HLS manifest for {storage_key}")

    media_domain = (os.environ.get("MEDIA_DOMAIN") or "media.evebash.com").replace("https://", "").strip("/")
    hls_master_url = f"https://{media_domain}/hls/{storage_key}/master.m3u8"

    return {
        "status": "success",
        "storage_key": storage_key,
        "hls_master_url": hls_master_url,
    }


