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
# Stream Processing & HLS Manifest Assembly Pipeline
# ---------------------------------------------------------------------------

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
    Stream Processing Worker: Triggered as each fMP4 chunk lands in B2.
    Transcodes the chunk into 1080p, 720p, and 480p HLS segments and uploads segments directly to B2.
    """
    import tempfile
    import pathlib
    import subprocess
    import boto3

    storage_key = request.get("storage_key") or request.get("object_key")
    part_number = int(request.get("part_number") or 1)
    total_parts = int(request.get("total_parts") or 1)

    if not storage_key:
        return {"error": "Missing storage_key", "status": "failed"}

    print(f"[StreamChunkWorker] Transcoding chunk part {part_number}/{total_parts} for {storage_key}")

    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')

    resolutions = [
        {"name": "1080p", "scale": "-2:1080", "vbitrate": "4000k"},
        {"name": "720p",  "scale": "-2:720",  "vbitrate": "2500k"},
        {"name": "480p",  "scale": "-2:480",  "vbitrate": "1000k"},
    ]

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)
        raw_chunk_path = tmp_path / f"part_{part_number}.mp4"
        out_dir = tmp_path / "hls"
        out_dir.mkdir(parents=True, exist_ok=True)

        # Download raw chunk from B2
        try:
            b2_client.download_file(bucket_name, storage_key, str(raw_chunk_path))
        except Exception as dl_err:
            print(f"[StreamChunkWorker] Raw chunk download warning for part {part_number}: {dl_err}")
            return {"status": "chunk_not_ready", "part_number": part_number}

        # Transcode chunk into HLS renditions via FFmpeg
        for res in resolutions:
            qname = res["name"]
            res_dir = out_dir / qname
            res_dir.mkdir(parents=True, exist_ok=True)

            cmd = [
                "ffmpeg", "-y", "-i", str(raw_chunk_path),
                "-vf", f"scale={res['scale']}",
                "-c:v", "libx264", "-b:v", res["vbitrate"],
                "-preset", "veryfast", "-g", "48",
                "-c:a", "aac", "-b:a", "128k",
                "-hls_time", "4", "-hls_playlist_type", "vod",
                "-hls_segment_filename", str(res_dir / f"seg_p{part_number:03d}_%03d.ts"),
                str(res_dir / "playlist.m3u8")
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # Upload generated .ts segments to B2 under hls/{storage_key}/{qname}/
            for seg_file in res_dir.glob("*.ts"):
                b2_seg_key = f"hls/{storage_key}/{qname}/{seg_file.name}"
                b2_client.upload_file(
                    str(seg_file), bucket_name, b2_seg_key,
                    ExtraArgs={"ContentType": "video/MP2T"}
                )

    print(f"[StreamChunkWorker] Successfully processed part {part_number}/{total_parts} for {storage_key}")
    return {
        "status": "success",
        "storage_key": storage_key,
        "part_number": part_number,
        "total_parts": total_parts,
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
    Manifest Coordinator: Triggered upon final chunk completion to generate master.m3u8 index,
    poster JPEG, and update Supabase DB.
    """
    import boto3
    import tempfile
    import pathlib
    import subprocess
    from supabase import create_client, Client

    storage_key = request.get("storage_key") or request.get("object_key")
    photo_id = request.get("photo_id") or request.get("id")

    if not storage_key:
        return {"error": "Missing storage_key", "status": "failed"}

    print(f"[ManifestCoordinator] Assembling master HLS manifest for {storage_key}")

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

    hls_prefix = f"hls/{storage_key}"
    hls_master_url = f"https://{media_domain}/{hls_prefix}/master.m3u8"
    poster_url = f"https://{media_domain}/{hls_prefix}/poster.jpg"

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)

        # 1. Generate master.m3u8 text index
        master_content = "\n".join([
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            "#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080",
            "1080p/playlist.m3u8",
            "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720",
            "720p/playlist.m3u8",
            "#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480",
            "480p/playlist.m3u8",
            ""
        ])

        b2_client.put_object(
            Bucket=bucket_name,
            Key=f"{hls_prefix}/master.m3u8",
            Body=master_content.encode("utf-8"),
            ContentType="application/x-mpegURL"
        )

        # 2. Extract poster JPEG frame at 1-sec mark from original B2 video
        try:
            raw_path = tmp_path / "raw.mp4"
            b2_client.download_file(bucket_name, storage_key, str(raw_path))
            poster_path = tmp_path / "poster.jpg"
            subprocess.run([
                "ffmpeg", "-y", "-i", str(raw_path),
                "-ss", "00:00:01", "-vframes", "1", "-q:v", "2",
                str(poster_path)
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            if poster_path.exists():
                b2_client.upload_file(
                    str(poster_path), bucket_name, f"{hls_prefix}/poster.jpg",
                    ExtraArgs={"ContentType": "image/jpeg"}
                )
        except Exception as poster_err:
            print(f"[ManifestCoordinator] Poster extraction warning: {poster_err}")

    # 3. Update Supabase photos row
    update_data = {
        "url": hls_master_url,
        "thumbnail_url": poster_url,
        "resource_type": "video",
        "media_type": "video",
        "status": "processed"
    }
    if photo_id:
        try:
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()
        except Exception:
            update_data.pop("status", None)
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()

    print(f"[ManifestCoordinator] Successfully assembled HLS manifest for {storage_key}")
    return {
        "status": "success",
        "storage_key": storage_key,
        "hls_master_url": hls_master_url,
        "poster_url": poster_url
    }



