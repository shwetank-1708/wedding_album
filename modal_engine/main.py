import modal
import os
import io

try:
    import fastapi
except ImportError:
    fastapi = None

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

# Lightweight image for Fast Media resizing (Zero AI dependencies, instant cold starts)
media_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "boto3",
        "Pillow",
        "supabase",
        "requests",
    )
)

def verify_qstash_signature(body: bytes, signature: str, url: str) -> bool:
    """
    Verifies Upstash-Signature JWT header against raw body bytes.
    Validates HMAC-SHA256, expiration, not-before, and body SHA-256 hash.
    Checks QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY for key rotation.
    """
    import hmac
    import hashlib
    import base64
    import json
    import time

    current_key = (os.environ.get("QSTASH_CURRENT_SIGNING_KEY") or "").strip().strip("\"'")
    next_key = (os.environ.get("QSTASH_NEXT_SIGNING_KEY") or "").strip().strip("\"'")

    if not current_key and not next_key:
        print("[QStash Auth] Notice: No QStash signing keys configured in env. Skipping signature check.")
        return True

    if not signature:
        print("[QStash Auth] Missing Upstash-Signature header.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Missing Upstash-Signature header")
        raise RuntimeError("Missing Upstash-Signature header")

    parts = signature.strip().split(".")
    if len(parts) != 3:
        print("[QStash Auth] Invalid Upstash-Signature JWT format.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Invalid Upstash-Signature JWT format")
        raise RuntimeError("Invalid Upstash-Signature JWT format")

    def b64url_decode(s: str) -> bytes:
        rem = len(s) % 4
        if rem > 0:
            s += "=" * (4 - rem)
        try:
            return base64.urlsafe_b64decode(s)
        except Exception:
            return base64.b64decode(s)

    signed_content = f"{parts[0]}.{parts[1]}".encode("utf-8")
    provided_sig = b64url_decode(parts[2])

    verified = False
    for key in [current_key, next_key]:
        if not key:
            continue
        expected_sig = hmac.new(key.encode("utf-8"), signed_content, hashlib.sha256).digest()
        if hmac.compare_digest(provided_sig, expected_sig):
            verified = True
            break

    if not verified:
        print("[QStash Auth] HMAC signature verification failed.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature verification failed")
        raise RuntimeError("Upstash-Signature verification failed")

    # Validate JWT claims
    try:
        claims = json.loads(b64url_decode(parts[1]).decode("utf-8"))
    except Exception as e:
        print(f"[QStash Auth] Invalid JWT claims: {e}")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail=f"Invalid JWT claims: {e}")
        raise RuntimeError(f"Invalid JWT claims: {e}")

    now = int(time.time())
    if "exp" in claims and claims["exp"] < now - 60:
        print("[QStash Auth] Upstash-Signature expired.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature expired")
        raise RuntimeError("Upstash-Signature expired")

    if "nbf" in claims and claims["nbf"] > now + 300:
        print("[QStash Auth] Upstash-Signature not yet valid.")
        if fastapi:
            raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature not yet valid")
        raise RuntimeError("Upstash-Signature not yet valid")

    # Validate body hash
    # QStash sends SHA-256 hash encoded as Base64 (or b64url) in claims["body"]
    body_bytes = body if isinstance(body, bytes) else str(body).encode("utf-8")
    raw_digest = hashlib.sha256(body_bytes).digest()
    body_hash_b64 = base64.b64encode(raw_digest).decode("utf-8")
    body_hash_b64url = base64.urlsafe_b64encode(raw_digest).decode("utf-8").rstrip("=")
    body_hash_hex = hashlib.sha256(body_bytes).hexdigest()

    claim_body = claims.get("body")
    if claim_body:
        normalized_claim = claim_body.rstrip("=")
        valid_hashes = {
            body_hash_b64,
            body_hash_b64url,
            body_hash_hex,
            body_hash_b64.rstrip("="),
            body_hash_b64url.rstrip("=")
        }
        if claim_body not in valid_hashes and normalized_claim not in valid_hashes:
            print(f"[QStash Auth] Body hash mismatch: claim={claim_body}, expected_b64={body_hash_b64}")
            if fastapi:
                raise fastapi.HTTPException(status_code=401, detail="Upstash-Signature body hash mismatch")
            raise RuntimeError("Upstash-Signature body hash mismatch")

    return True

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

    user_id = request.get("user_id")
    event_id = request.get("event_id")
    if not event_id and photos and isinstance(photos[0], dict):
        event_id = photos[0].get("event_id")
    if not user_id and photos and isinstance(photos[0], dict):
        user_id = photos[0].get("user_id")

    try:
        from supabase import create_client
        supabase = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
        # Media compute belongs to the event owner (host/creator)
        if event_id:
            try:
                e_res = supabase.table("events").select("created_by").eq("id", event_id).maybe_single().execute()
                if e_res and e_res.data and e_res.data.get("created_by"):
                    user_id = e_res.data.get("created_by")
            except Exception:
                pass

        batch_log_payload = {
            "function_name":           "process_media_batch",
            "worker_type":             "Modal Batch Dispatcher (0.125 vCPU • 1GB RAM)",
            "media_type":              "batch",
            "cpu_cores":               cpu_cores,
            "memory_gb":               memory_gb,
            "execution_time_seconds":  duration,
            "estimated_cost_inr":      estimated_cost_inr,
            "faces_detected":          0
        }
        if event_id:
            batch_log_payload["event_id"] = event_id
        if user_id:
            batch_log_payload["user_id"] = user_id

        supabase.table("modal_cost_logs").insert(batch_log_payload).execute()
        print(f"[Batch] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f} (event: {event_id}, user: {user_id})")
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
        # Generate 1600p Preview WebP (Fast, high-fidelity sweet spot)
        preview_img = pil_img.copy()
        preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        preview_buf = io.BytesIO()
        preview_img.save(preview_buf, format="WEBP", quality=70, method=4)
        preview_bytes = preview_buf.getvalue()

        # Generate 480p Thumbnail WebP (Optimized for Retina feeds)
        thumb_img = pil_img.copy()
        thumb_img.thumbnail((480, 480), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="WEBP", quality=68, method=4)
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
        photo_overhead_bytes = len(preview_bytes) + len(thumb_bytes)
        update_data = {
            "thumbnail_url": thumbnail_url,
            "preview_url": preview_url,
            "width": orig_w,
            "height": orig_h,
            "overhead_size": photo_overhead_bytes,
            "face_indexed": True,
            "status": "processed"
        }
        try:
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()
        except Exception:
            update_data.pop("status", None)
            supabase.table("photos").update(update_data).eq("id", photo_id).execute()

        print(f"[{photo_id}] Updated photos table: face_indexed=True, overhead_size={photo_overhead_bytes}B, thumbnails saved.")

        # ── 8. Log infrastructure cost ───────────────────────────────────
        duration = time.time() - start_time
        cpu_cores = 1.0
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        user_id = photo_data.get("user_id")

        # Resolve user_id / event_id if missing from photo_data
        if (not user_id or not event_id) and photo_id:
            try:
                p_res = supabase.table("photos").select("user_id, event_id").eq("id", photo_id).maybe_single().execute()
                if p_res and p_res.data:
                    if not user_id:
                        user_id = p_res.data.get("user_id")
                    if not event_id:
                        event_id = p_res.data.get("event_id")
            except Exception:
                pass

        # Gallery media compute is always billed to the event owner (host/creator)
        if event_id:
            try:
                e_res = supabase.table("events").select("created_by").eq("id", event_id).maybe_single().execute()
                if e_res and e_res.data and e_res.data.get("created_by"):
                    user_id = e_res.data.get("created_by")
            except Exception:
                pass

        photo_size = len(image_bytes) if 'image_bytes' in locals() and image_bytes else photo_data.get("size")
        try:
            log_payload = {
                "photo_id":                photo_id,
                "event_id":                event_id,
                "function_name":           "process_single_photo",
                "worker_type":             "Modal Photo Worker (1 vCPU • 1GB RAM)",
                "media_type":              "photo",
                "media_size":              photo_size,
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "gpu_type":                "None",
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          len(face_encodings)
            }
            if user_id:
                log_payload["user_id"] = user_id
            supabase.table("modal_cost_logs").insert(log_payload).execute()
            print(f"[{photo_id}] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[{photo_id}] Cost log failed: {log_err}")

        return {"status": "success", "photo_id": photo_id, "faces": len(face_encodings)}

    except Exception as e:
        print(f"[{photo_id}] Error in process_single_photo: {e}")
        return {"status": "error", "photo_id": photo_id, "error": str(e)}


# ==============================================================================
# DECOUPLED 2-STAGE PIPELINE: STAGE 1 - FAST MEDIA PATH
# ==============================================================================

@app.function(
    image=media_image,
    cpu=0.5,
    memory=768,
    max_containers=15,
    scaledown_window=60,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def process_photo_preview(photo_data: dict):
    """
    STAGE 1: FAST MEDIA WORKER
    Resizes raw original from B2 to 1600p preview & 480p thumbnail WebP.
    Zero AI dependencies. Completes in seconds, immediately updating the gallery.
    """
    import time
    import io
    import uuid
    import boto3
    from PIL import Image, ImageOps
    from supabase import create_client, Client

    start_time = time.time()
    photo_id = photo_data.get("id") or photo_data.get("photo_id")
    asset_version = int(photo_data.get("asset_version") or 1)
    storage_key = photo_data.get("storage_key") or photo_data.get("object_key")
    event_id = photo_data.get("event_id")
    user_id = photo_data.get("user_id")

    if not photo_id or not storage_key:
        print(f"[Preview] Missing required parameters: photo_id={photo_id}, storage_key={storage_key}")
        return {"status": "error", "error": "Missing photo_id or storage_key"}

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    token = str(uuid.uuid4())
    claimed = supabase.rpc("claim_media_job", {
        "p_photo_id": photo_id,
        "p_token": token,
        "p_asset_version": asset_version
    }).execute()

    if not claimed.data:
        print(f"[{photo_id}] Media job already claimed or exceeded max retries. Skipping.")
        return {"status": "skipped", "photo_id": photo_id}

    try:
        b2_client = boto3.client(
            's3',
            endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
            aws_access_key_id=os.environ.get('B2_KEY_ID'),
            aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
        )
        bucket_name = os.environ.get('B2_BUCKET_NAME')

        print(f"[{photo_id}] Downloading original photo for preview: {storage_key}")
        resp = b2_client.get_object(Bucket=bucket_name, Key=storage_key)
        raw_bytes = resp['Body'].read()

        # Pillow decompression bomb protection
        Image.MAX_IMAGE_PIXELS = 100_000_000
        pil_img = Image.open(io.BytesIO(raw_bytes))
        try:
            pil_img = ImageOps.exif_transpose(pil_img)
        except Exception:
            pass
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        orig_w, orig_h = pil_img.size

        # 1600p Preview WebP (high-fidelity sweet spot for gallery & face detector)
        preview_img = pil_img.copy()
        preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        preview_buf = io.BytesIO()
        preview_img.save(preview_buf, format="WEBP", quality=70, method=4)
        preview_bytes = preview_buf.getvalue()

        # 480p Thumbnail WebP (Retina-ready gallery feed cards)
        thumb_img = pil_img.copy()
        thumb_img.thumbnail((480, 480), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="WEBP", quality=68, method=4)
        thumb_bytes = thumb_buf.getvalue()

        preview_key = f"{storage_key}-preview.webp"
        thumb_key   = f"{storage_key}-thumbnail.webp"

        b2_client.put_object(Bucket=bucket_name, Key=preview_key, Body=preview_bytes, ContentType="image/webp")
        b2_client.put_object(Bucket=bucket_name, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")

        media_domain = (
            os.environ.get("MEDIA_DOMAIN")
            or os.environ.get("CLOUDFLARE_DOMAIN")
            or os.environ.get("NEXT_PUBLIC_MEDIA_DOMAIN")
            or "media.evebash.com"
        ).strip().replace("https://", "").replace("http://", "").rstrip("/")

        preview_url = f"https://{media_domain}/{preview_key}"
        thumbnail_url = f"https://{media_domain}/{thumb_key}"
        overhead_bytes = len(preview_bytes) + len(thumb_bytes)

        # Atomic completion in database
        supabase.rpc("complete_media_job", {
            "p_photo_id": photo_id,
            "p_token": token,
            "p_asset_version": asset_version,
            "p_thumbnail_url": thumbnail_url,
            "p_preview_url": preview_url,
            "p_width": orig_w,
            "p_height": orig_h,
            "p_overhead_size": overhead_bytes
        }).execute()

        duration = time.time() - start_time
        cpu_cores = 0.5
        memory_gb = 0.75
        rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
        cost_inr = duration * rate_per_sec * 100.0

        try:
            log_payload = {
                "photo_id": photo_id,
                "event_id": event_id,
                "function_name": "generate_photo_preview",
                "worker_type": "Modal Preview Worker (0.5 vCPU • 768MB)",
                "media_type": "photo",
                "media_size": len(raw_bytes),
                "cpu_cores": cpu_cores,
                "memory_gb": memory_gb,
                "gpu_type": "None",
                "execution_time_seconds": duration,
                "estimated_cost_inr": cost_inr,
                "faces_detected": 0
            }
            if user_id:
                log_payload["user_id"] = user_id
            supabase.table("modal_cost_logs").insert(log_payload).execute()
        except Exception as log_err:
            print(f"[{photo_id}] Cost logging failed: {log_err}")

        print(f"[{photo_id}] Fast Preview complete in {duration:.2f}s, ₹{cost_inr:.5f}. Photo is now live in gallery.")

        # Immediately trigger FaceIndexer for fast async indexing
        FaceIndexer().process.spawn({
            "id": photo_id,
            "photo_id": photo_id,
            "asset_version": asset_version,
            "storage_key": storage_key,
            "event_id": event_id,
            "user_id": user_id,
            "preview_url": preview_url
        })

        return {"status": "success", "photo_id": photo_id, "preview_url": preview_url}

    except Exception as e:
        print(f"[{photo_id}] Fast Preview generation failed: {e}")
        try:
            supabase.table("photos").update({
                "media_status": "failed",
                "processing_error": str(e)[:1000]
            }).eq("id", photo_id).execute()
        except Exception:
            pass
        return {"status": "error", "photo_id": photo_id, "error": str(e)}


@app.function(
    image=media_image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
async def generate_photo_preview(request: fastapi.Request):
    """
    QStash webhook endpoint for Fast Media Path.
    Verifies Upstash-Signature and spawns process_photo_preview asynchronously.
    Returns HTTP 202 Accepted in ~10ms. Zero QStash timeout risk.
    """
    import json
    body = await request.body()
    signature = request.headers.get("Upstash-Signature", "")
    url = str(request.url)
    verify_qstash_signature(body, signature, url)

    payload = json.loads(body.decode("utf-8")) if body else {}
    photo_items = payload.get("photos") or ([payload] if payload.get("storage_key") or payload.get("id") or payload.get("photo_id") else [])

    for item in photo_items:
        process_photo_preview.spawn(item)

    return {"accepted": True, "count": len(photo_items)}, 202


# ==============================================================================
# DECOUPLED 2-STAGE PIPELINE: STAGE 2 - ASYNC AI FACE PATH (FaceIndexer)
# ==============================================================================

@app.function(
    image=media_image,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
async def face_index_ingress(request: fastapi.Request):
    """
    Thin HTTP webhook for Stage 2 (Face Indexing).
    Verifies Upstash-Signature and spawns FaceIndexer asynchronously.
    Returns HTTP 202 Accepted in ~10ms. Zero QStash timeout risk.
    """
    import json
    body = await request.body()
    signature = request.headers.get("Upstash-Signature", "")
    url = str(request.url)
    verify_qstash_signature(body, signature, url)

    payload = json.loads(body.decode("utf-8")) if body else {}
    FaceIndexer().process.spawn(payload)
    return {"accepted": True, "photo_id": payload.get("photo_id") or payload.get("id")}, 202


@app.cls(
    image=image,
    cpu=1.0,
    memory=2048,
    max_containers=4,
    scaledown_window=300,
    retries=0,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
class FaceIndexer:
    @modal.enter()
    def load_model(self):
        """AuraFace model loads ONCE per container lifetime and stays warm in RAM."""
        from insightface.app import FaceAnalysis
        print("[FaceIndexer] Warming up AuraFace indexing model (640x640)...")
        self.face_app = FaceAnalysis(
            name="auraface",
            root="/root/.insightface",
            providers=["CPUExecutionProvider"]
        )
        self.face_app.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.25)
        print("[FaceIndexer] AuraFace model warm and ready in container RAM.")

    @modal.method()
    def process(self, photo_data: dict):
        """
        STAGE 2: ASYNCHRONOUS AI FACE VECTOR EXTRACTION
        Processes a single photo's face embeddings with atomic replacement.
        """
        import time
        import io
        import uuid
        import boto3
        import numpy as np
        import cv2
        from PIL import Image
        from supabase import create_client, Client

        start_time = time.time()
        photo_id = photo_data.get("id") or photo_data.get("photo_id")
        asset_version = int(photo_data.get("asset_version") or 1)
        storage_key = photo_data.get("storage_key") or photo_data.get("object_key")
        event_id = photo_data.get("event_id")
        user_id = photo_data.get("user_id")
        preview_url = photo_data.get("preview_url")

        if not photo_id or not storage_key:
            return {"status": "error", "error": "Missing photo_id or storage_key"}

        supabase: Client = create_client(
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )

        token = str(uuid.uuid4())
        claimed = supabase.rpc("claim_face_job", {
            "p_photo_id": photo_id,
            "p_token": token,
            "p_asset_version": asset_version
        }).execute()

        if not claimed.data:
            print(f"[{photo_id}] Face indexing job already claimed or max attempts reached.")
            return {"status": "skipped", "photo_id": photo_id}

        try:
            b2_client = boto3.client(
                's3',
                endpoint_url=f"https://{os.environ.get('B2_ENDPOINT')}",
                aws_access_key_id=os.environ.get('B2_KEY_ID'),
                aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY')
            )
            bucket_name = os.environ.get('B2_BUCKET_NAME')

            preview_key = f"{storage_key}-preview.webp"
            try:
                resp = b2_client.get_object(Bucket=bucket_name, Key=preview_key)
                img_bytes = resp['Body'].read()
            except Exception:
                resp = b2_client.get_object(Bucket=bucket_name, Key=storage_key)
                img_bytes = resp['Body'].read()

            Image.MAX_IMAGE_PIXELS = 100_000_000
            pil_img = Image.open(io.BytesIO(img_bytes))
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            img_rgb = np.array(pil_img)
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            h, w, _ = img_bgr.shape

            faces = self.face_app.get(img_bgr)
            print(f"[{photo_id}] FaceIndexer found {len(faces)} face(s).")

            face_records = []
            for face in faces:
                embedding = face.normed_embedding
                if embedding is not None:
                    face_records.append({
                        "event_id": event_id,
                        "image_url": preview_url or f"https://{os.environ.get('MEDIA_DOMAIN', 'media.evebash.com')}/{preview_key}",
                        "width": w,
                        "height": h,
                        "descriptor": embedding.tolist()
                    })

            # Atomic face replacement protected by token and asset_version
            supabase.rpc("replace_photo_faces", {
                "p_photo_id": photo_id,
                "p_token": token,
                "p_asset_version": asset_version,
                "p_faces": face_records
            }).execute()

            duration = time.time() - start_time
            cpu_cores = 1.0
            memory_gb = 2.0
            rate_per_sec = (cpu_cores * 0.0000131) + (memory_gb * 0.00000222)
            cost_inr = duration * rate_per_sec * 100.0

            try:
                log_payload = {
                    "photo_id": photo_id,
                    "event_id": event_id,
                    "function_name": "FaceIndexer.process",
                    "worker_type": "Modal Face Worker (1 vCPU • 2GB RAM)",
                    "media_type": "photo",
                    "media_size": len(img_bytes),
                    "cpu_cores": cpu_cores,
                    "memory_gb": memory_gb,
                    "gpu_type": "None",
                    "execution_time_seconds": duration,
                    "estimated_cost_inr": cost_inr,
                    "faces_detected": len(face_records)
                }
                if user_id:
                    log_payload["user_id"] = user_id
                supabase.table("modal_cost_logs").insert(log_payload).execute()
            except Exception as log_err:
                print(f"[{photo_id}] Face cost log failed: {log_err}")

            print(f"[{photo_id}] Face indexing finished: {len(face_records)} faces saved in {duration:.2f}s (₹{cost_inr:.5f})")
            return {"status": "success", "photo_id": photo_id, "faces": len(face_records)}

        except Exception as e:
            print(f"[{photo_id}] Face indexing error: {e}")
            try:
                supabase.table("photos").update({
                    "face_status": "failed",
                    "processing_error": str(e)[:1000]
                }).eq("id", photo_id).execute()
            except Exception:
                pass
            return {"status": "error", "photo_id": photo_id, "error": str(e)}


# ==============================================================================
# SELF-HEALING RECONCILER & OUTBOX DISPATCHER
# ==============================================================================

@app.function(
    image=media_image,
    schedule=modal.Cron("* * * * *"),
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def sweep_stuck_jobs():
    """
    SELF-HEALING RECONCILER CRON (Runs every 60 seconds).
    Recovers any stuck or orphaned jobs across both Fast Media and Face AI paths.
    """
    import os
    from datetime import datetime, timezone, timedelta
    from supabase import create_client, Client

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    now = datetime.now(timezone.utc)
    two_min_ago = (now - timedelta(minutes=2)).isoformat()
    five_min_ago = (now - timedelta(minutes=5)).isoformat()

    recovered_media = 0
    recovered_face = 0
    recovered_outbox = 0

    # 1. Sweep stuck media jobs
    try:
        res = (
            supabase.table("photos")
            .select("id, storage_key, event_id, user_id, asset_version, media_status, media_lease_until")
            .in_("media_status", ["pending", "failed", "processing"])
            .lt("media_attempt", 3)
            .lte("uploaded_at", two_min_ago)
            .limit(100)
            .execute()
        )
        for p in (res.data or []):
            lease = p.get("media_lease_until")
            is_expired = lease is None or lease < now.isoformat()
            if p.get("media_status") in ["pending", "failed"] or is_expired:
                print(f"[Reconciler] Recovering stuck media job for photo: {p['id']}")
                process_photo_preview.spawn({
                    "id": p["id"],
                    "photo_id": p["id"],
                    "storage_key": p.get("storage_key"),
                    "event_id": p.get("event_id"),
                    "user_id": p.get("user_id"),
                    "asset_version": p.get("asset_version", 1)
                })
                recovered_media += 1
    except Exception as err:
        print(f"[Reconciler] Media sweep error: {err}")

    # 2. Sweep stuck face jobs
    try:
        res = (
            supabase.table("photos")
            .select("id, storage_key, event_id, user_id, asset_version, preview_url, face_status, face_lease_until")
            .eq("media_status", "ready")
            .in_("face_status", ["pending", "failed", "indexing"])
            .lt("face_attempt", 3)
            .limit(100)
            .execute()
        )
        for p in (res.data or []):
            lease = p.get("face_lease_until")
            is_expired = lease is None or lease < now.isoformat()
            if p.get("face_status") in ["pending", "failed"] or is_expired:
                print(f"[Reconciler] Recovering stuck face job for photo: {p['id']}")
                FaceIndexer().process.spawn({
                    "id": p["id"],
                    "photo_id": p["id"],
                    "storage_key": p.get("storage_key"),
                    "event_id": p.get("event_id"),
                    "user_id": p.get("user_id"),
                    "asset_version": p.get("asset_version", 1),
                    "preview_url": p.get("preview_url")
                })
                recovered_face += 1
    except Exception as err:
        print(f"[Reconciler] Face sweep error: {err}")

    # 3. Sweep stuck outbox rows
    try:
        res = (
            supabase.table("processing_outbox")
            .select("*")
            .in_("status", ["pending", "publishing"])
            .lte("created_at", five_min_ago)
            .limit(100)
            .execute()
        )
        for row in (res.data or []):
            photo_res = supabase.table("photos").select("*").eq("id", row["photo_id"]).maybe_single().execute()
            p = photo_res.data
            if p:
                if row["job_type"] == "media_preview":
                    process_photo_preview.spawn({
                        "id": p["id"],
                        "photo_id": p["id"],
                        "storage_key": p.get("storage_key"),
                        "event_id": p.get("event_id"),
                        "user_id": p.get("user_id"),
                        "asset_version": row.get("asset_version", 1)
                    })
                elif row["job_type"] == "face_index":
                    FaceIndexer().process.spawn({
                        "id": p["id"],
                        "photo_id": p["id"],
                        "storage_key": p.get("storage_key"),
                        "event_id": p.get("event_id"),
                        "user_id": p.get("user_id"),
                        "asset_version": row.get("asset_version", 1),
                        "preview_url": p.get("preview_url")
                    })
                recovered_outbox += 1
    except Exception as err:
        print(f"[Reconciler] Outbox sweep error: {err}")

    if recovered_media > 0 or recovered_face > 0 or recovered_outbox > 0:
        print(f"[Reconciler] Sweep complete: recovered {recovered_media} media, {recovered_face} face, {recovered_outbox} outbox jobs.")


@app.function(
    image=media_image,
    schedule=modal.Cron("*/1 * * * *"),
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
def dispatch_outbox_jobs():
    """
    OUTBOX DISPATCHER CRON (Runs every minute as scheduled backup).
    Claims pending outbox rows atomically and dispatches them to their workers.
    """
    import os
    from supabase import create_client, Client

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    claimed = supabase.rpc("claim_outbox_batch", {"p_batch_size": 50, "p_lease_seconds": 60}).execute()
    rows = claimed.data or []
    if not rows:
        return {"dispatched": 0}

    dispatched = 0
    for row in rows:
        photo_id = row.get("photo_id")
        job_type = row.get("job_type")
        asset_ver = row.get("asset_version", 1)

        photo_res = supabase.table("photos").select("*").eq("id", photo_id).maybe_single().execute()
        photo = photo_res.data
        if not photo:
            continue

        payload = {
            "id": photo["id"],
            "photo_id": photo["id"],
            "asset_version": asset_ver,
            "storage_key": photo.get("storage_key"),
            "event_id": photo.get("event_id"),
            "user_id": photo.get("user_id"),
            "preview_url": photo.get("preview_url"),
            "url": photo.get("url")
        }

        if job_type == "media_preview":
            process_photo_preview.spawn(payload)
            dispatched += 1
        elif job_type == "face_index":
            FaceIndexer().process.spawn(payload)
            dispatched += 1

    print(f"[OutboxDispatcher] Dispatched {dispatched} queued jobs.")
    return {"dispatched": dispatched}


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

    # Resolve primary event_id and user_id (event creator/photographer)
    user_id = request.get("user_id")
    event_id = None
    if event_ids:
        for candidate in event_ids:
            if candidate and isinstance(candidate, str) and candidate.strip():
                event_id = candidate.strip()
                break

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    if not user_id and event_ids:
        try:
            clean_ids = [str(eid).strip() for eid in event_ids if eid and str(eid).strip()]
            # 1. Try matching events table by id
            e_res = supabase.table("events").select("id, created_by").in_("id", clean_ids).limit(1).execute()
            if e_res and e_res.data and len(e_res.data) > 0:
                user_id = e_res.data[0].get("created_by")
                if e_res.data[0].get("id"):
                    event_id = e_res.data[0].get("id")
            else:
                # 2. Try matching by legacy_id
                e_res_leg = supabase.table("events").select("id, created_by").in_("legacy_id", clean_ids).limit(1).execute()
                if e_res_leg and e_res_leg.data and len(e_res_leg.data) > 0:
                    user_id = e_res_leg.data[0].get("created_by")
                    if e_res_leg.data[0].get("id"):
                        event_id = e_res_leg.data[0].get("id")
                else:
                    # 3. Try matching by title (slug fallback)
                    e_res_title = supabase.table("events").select("id, created_by").in_("title", clean_ids).limit(1).execute()
                    if e_res_title and e_res_title.data and len(e_res_title.data) > 0:
                        user_id = e_res_title.data[0].get("created_by")
                        if e_res_title.data[0].get("id"):
                            event_id = e_res_title.data[0].get("id")
        except Exception as lookup_err:
            print(f"[Selfie] Failed to lookup event owner: {lookup_err}")

    def log_selfie_cost(faces_detected_count: int):
        duration = time.time() - start_time
        cpu_cores = 0.125
        memory_gb = 1.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222))
        try:
            log_p = {
                "function_name":           "find_matching_photos",
                "worker_type":             "Modal Selfie Worker (0.125 vCPU • 1GB RAM)",
                "media_type":              "selfie",
                "media_size":              len(selfie_bytes) if 'selfie_bytes' in locals() and selfie_bytes else None,
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "gpu_type":                "None",
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          faces_detected_count
            }
            if user_id: log_p["user_id"] = user_id
            if event_id: log_p["event_id"] = event_id
            supabase.table("modal_cost_logs").insert(log_p).execute()
            print(f"[Selfie] Cost logged: {duration:.2f}s, ₹{estimated_cost_inr:.5f}, user_id={user_id}, event_id={event_id}")
        except Exception as log_err:
            print(f"[Selfie] Cost log failed: {log_err}")

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
            log_selfie_cost(0)
            return {"error": "No face detected in selfie", "matches": []}

        # Sort by box area descending to pick the closest/largest face
        sorted_faces = sorted(selfie_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        selfie_vec = sorted_faces[0].normed_embedding
        if selfie_vec is None:
            print("[Selfie] Failed to generate face vector.")
            log_selfie_cost(0)
            return {"error": "Failed to generate face vector", "matches": []}
            
        print("[Selfie] Embedding successfully generated.")

        # ── 3. Fetch all indexed face descriptors for these events ───────
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
        log_selfie_cost(len(selfie_faces))

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
        log_selfie_cost(0)
        return {"error": str(e), "matches": []}


# ---------------------------------------------------------------------------
# Cloud Video Transcoding & HLS Manifest Assembly
# ---------------------------------------------------------------------------

transcode_image = (
    modal.Image.from_registry("jrottenberg/ffmpeg:7.0-nvidia2204", add_python="3.11")
    # jrottenberg/ffmpeg images have ENTRYPOINT ["ffmpeg"] which intercepts Modal's
    # `python -u worker.py` startup — FFmpeg sees `-u` as an unknown flag and crashes.
    # Clear it so Modal can launch its Python runtime normally.
    .dockerfile_commands(["ENTRYPOINT []", "CMD []"])
    .pip_install("boto3", "supabase", "fastapi[standard]")
)

def _transcode_video_core(request: dict, hardware="cpu"):
    import boto3
    import tempfile
    import pathlib
    import subprocess
    import time
    import concurrent.futures
    import fastapi
    from supabase import create_client, Client

    start_time = time.time()
    storage_key = request.get("storage_key") or request.get("object_key")
    photo_id = request.get("photo_id") or request.get("id")

    if not photo_id and storage_key:
        photo_id = storage_key.replace("/", "_")

    if not storage_key or not photo_id:
        raise fastapi.HTTPException(status_code=400, detail="Missing required storage_key or photo_id")

    supabase: Client = create_client(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    from botocore.config import Config
    endpoint = os.environ.get('B2_ENDPOINT')
    region = endpoint.split(".")[1] if endpoint and "." in endpoint else "us-east-005"

    b2_client = boto3.client(
        's3',
        endpoint_url=f"https://{endpoint}",
        aws_access_key_id=os.environ.get('B2_KEY_ID'),
        aws_secret_access_key=os.environ.get('B2_APPLICATION_KEY'),
        region_name=region,
        config=Config(signature_version='s3v4', max_pool_connections=30)
    )
    bucket_name = os.environ.get('B2_BUCKET_NAME')
    media_domain = (os.environ.get("MEDIA_DOMAIN") or "media.evebash.com").replace("https://", "").strip("/")

    hls_prefix = f"hls/{storage_key}"
    hls_master_url = f"https://{media_domain}/{hls_prefix}/master.m3u8"
    poster_url = f"https://{media_domain}/{hls_prefix}/poster.jpg"
    raw_url = f"https://{media_domain}/{storage_key}"

    print(f"[TranscodeVideo-{hardware.upper()}] Processing video {storage_key}")

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = pathlib.Path(tmp_dir)
            raw_video_path = tmp_path / "input.mp4"
            poster_path = tmp_path / "poster.jpg"

            # 1. Download raw video from B2 to local NVMe SSD
            print(f"[TranscodeVideo-{hardware.upper()}] Downloading {storage_key} to local SSD...")
            b2_client.download_file(bucket_name, storage_key, str(raw_video_path))
            raw_size_mb = raw_video_path.stat().st_size // (1024 * 1024)
            print(f"[TranscodeVideo-{hardware.upper()}] Downloaded {raw_size_mb} MB in {time.time() - start_time:.1f}s")

            if raw_video_path.stat().st_size == 0:
                raise RuntimeError("Downloaded video file is 0 bytes.")

            input_path = str(raw_video_path)

            # 2. Check for audio stream and video height via local file
            has_audio = False
            src_height = 1080  # default
            try:
                probe_audio = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "a",
                    "-show_entries", "stream=index", "-of", "csv=p=0",
                    input_path
                ], capture_output=True, text=True)
                if probe_audio.stdout.strip():
                    has_audio = True

                probe_vid = subprocess.run([
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=height", "-of", "csv=p=0",
                    input_path
                ], capture_output=True, text=True)
                if probe_vid.stdout.strip():
                    src_height = int(probe_vid.stdout.strip())
            except Exception:
                has_audio = True
                src_height = 1080

            video_duration_seconds = None
            try:
                probe_dur = subprocess.run([
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "csv=p=0", input_path
                ], capture_output=True, text=True)
                if probe_dur.stdout.strip():
                    video_duration_seconds = float(probe_dur.stdout.strip())
            except Exception:
                pass
            if not video_duration_seconds and request.get("duration"):
                try:
                    video_duration_seconds = float(request.get("duration"))
                except Exception:
                    pass

            # 3. Extract poster.jpg from local file at 1.0s
            subprocess.run([
                "ffmpeg", "-y", "-i", input_path,
                "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", str(poster_path)
            ], capture_output=True, text=True)

            if poster_path.exists() and poster_path.stat().st_size > 0:
                b2_client.upload_file(
                    str(poster_path),
                    bucket_name,
                    f"{hls_prefix}/poster.jpg",
                    ExtraArgs={
                        "ContentType": "image/jpeg",
                        "CacheControl": "public, max-age=604800, stale-while-revalidate=86400"
                    }
                )

            # 4. Single-Pass Multi-Output FFmpeg Generation
            # Dynamic tiers based on source height (Don't upscale)
            out_dirs = []
            if src_height >= 1080: out_dirs.append("1080p")
            if src_height >= 720:  out_dirs.append("720p")
            out_dirs.append("480p") # Always generate at least 480p
            
            if has_audio:
                out_dirs.append("audio")
                
            for out_dir in out_dirs:
                (tmp_path / out_dir).mkdir(parents=True, exist_ok=True)

            print(f"[TranscodeVideo-{hardware.upper()}] Starting single-pass multi-output FFmpeg...")
            
            cmd = ["ffmpeg", "-y", "-i", input_path]
            
            # Build filter complex dynamically
            split_count = len([d for d in out_dirs if d != "audio"])
            filter_str = f"[0:v]split={split_count}" + "".join(f"[v{i+1}]" for i in range(split_count)) + ";"
                
            idx = 1
            if "1080p" in out_dirs:
                filter_str += f"[v{idx}]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                idx += 1
                
            if "720p" in out_dirs:
                filter_str += f"[v{idx}]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                idx += 1
                
            if "480p" in out_dirs:
                filter_str += f"[v{idx}]scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"

            cmd += ["-filter_complex", filter_str.rstrip(";")]

            vcodec = "h264_nvenc" if hardware == "gpu" else "libx264"
            vpreset = "p4" if hardware == "gpu" else "veryfast"
            
            idx = 1
            map_idx = 0
            var_stream_parts = []
            
            # Codec settings injected into each map
            def add_video_map(out_name, bitrate, maxrate, bufsize):
                nonlocal cmd, idx, map_idx, var_stream_parts
                cmd += ["-map", f"[v{idx}out]", f"-c:v:{map_idx}", vcodec, "-preset", vpreset]
                if hardware == "gpu":
                    cmd += ["-cq", "28", "-force_key_frames", "expr:gte(t,n_forced*6)"]
                else:
                    cmd += ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*6)"]
                cmd += [f"-b:v:{map_idx}", bitrate, f"-maxrate:{map_idx}", maxrate, f"-bufsize:{map_idx}", bufsize]
                if has_audio:
                    var_stream_parts.append(f"v:{map_idx},agroup:audio,name:{out_name}")
                else:
                    var_stream_parts.append(f"v:{map_idx},name:{out_name}")
                idx += 1
                map_idx += 1

            if "1080p" in out_dirs: add_video_map("1080p", "4000k", "4500k", "8000k")
            if "720p" in out_dirs: add_video_map("720p", "2500k", "3000k", "5000k")
            if "480p" in out_dirs: add_video_map("480p", "1000k", "1200k", "2000k")

            # Audio
            if has_audio:
                cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
                var_stream_parts.insert(0, "a:0,agroup:audio,default:yes,name:audio")

            var_stream = " ".join(var_stream_parts)

            # Global HLS Settings
            cmd += [
                "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
                "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
                "-master_pl_name", "master.m3u8",
                "-var_stream_map", var_stream,
                str(tmp_path / "%v/playlist.m3u8")
            ]

            proc = subprocess.run(cmd, capture_output=True, text=True)
            
            # GPU Fallback to CPU if hardware acceleration fails
            if proc.returncode != 0 and hardware == "gpu":
                print(f"[TranscodeVideo-GPU] Hardware pipeline failed. Error: {proc.stderr[-500:]}")
                print(f"[TranscodeVideo-GPU] Falling back to CPU software pipeline...")
                
                # Rebuild cmd for CPU
                cmd = ["ffmpeg", "-y", "-i", input_path]
                
                filter_str = f"[0:v]split={split_count}" + "".join(f"[v{i+1}]" for i in range(split_count)) + ";"
                    
                idx = 1
                if "1080p" in out_dirs:
                    filter_str += f"[v{idx}]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                    idx += 1
                if "720p" in out_dirs:
                    filter_str += f"[v{idx}]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                    idx += 1
                if "480p" in out_dirs:
                    filter_str += f"[v{idx}]scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v{idx}out];"
                    
                cmd += ["-filter_complex", filter_str.rstrip(";")]
                
                idx = 1
                map_idx = 0
                def add_video_map_fallback(bitrate, maxrate, bufsize):
                    nonlocal cmd, idx, map_idx
                    cmd += ["-map", f"[v{idx}out]", f"-c:v:{map_idx}", "libx264", "-preset", "veryfast"]
                    cmd += ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*6)"]
                    cmd += [f"-b:v:{map_idx}", bitrate, f"-maxrate:{map_idx}", maxrate, f"-bufsize:{map_idx}", bufsize]
                    idx += 1; map_idx += 1

                if "1080p" in out_dirs: add_video_map_fallback("4000k", "4500k", "8000k")
                if "720p" in out_dirs: add_video_map_fallback("2500k", "3000k", "5000k")
                if "480p" in out_dirs: add_video_map_fallback("1000k", "1200k", "2000k")

                if has_audio:
                    cmd += ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
                    
                cmd += [
                    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
                    "-hls_flags", "independent_segments",
                    "-hls_segment_filename", str(tmp_path / "%v/seg_%03d.ts"),
                    "-master_pl_name", "master.m3u8",
                    "-var_stream_map", var_stream,
                    str(tmp_path / "%v/playlist.m3u8")
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True)

            if proc.returncode != 0:
                err = proc.stderr[-1000:] if proc.stderr else f"Exit code {proc.returncode}"
                raise RuntimeError(f"FFmpeg failed: {err}")

            # 5. Atomic Parallel Upload Fleet
            print(f"[TranscodeVideo-{hardware.upper()}] Transcode complete. Starting strict-order atomic B2 uploads...")
            def upload_file_worker(args):
                file_path, s3_key, content_type = args
                b2_client.upload_file(
                    str(file_path), bucket_name, s3_key,
                    ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000, immutable"}
                )

            # Phase 1: Upload all .ts chunks
            chunk_tasks = []
            for out_dir in out_dirs:
                res_path = tmp_path / out_dir
                for seg_path in res_path.glob("seg_*.ts"):
                    chunk_tasks.append((seg_path, f"{hls_prefix}/{out_dir}/{seg_path.name}", "video/MP2T"))

            print(f"[TranscodeVideo-{hardware.upper()}] -> Uploading {len(chunk_tasks)} video chunks...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                list(executor.map(upload_file_worker, chunk_tasks))

            # Phase 2: Upload all Variant Playlists
            playlist_tasks = []
            for out_dir in out_dirs:
                pl_file = (tmp_path / out_dir) / "playlist.m3u8"
                if pl_file.exists():
                    playlist_tasks.append((pl_file, f"{hls_prefix}/{out_dir}/playlist.m3u8", "application/x-mpegURL"))
                    
            print(f"[TranscodeVideo-{hardware.upper()}] -> Uploading {len(playlist_tasks)} variant playlists...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                list(executor.map(upload_file_worker, playlist_tasks))
                
            # Phase 3: Upload Master Playlist Last (Atomic swap)
            master_file = tmp_path / "master.m3u8"
            if not master_file.exists():
                raise RuntimeError("FFmpeg did not generate master.m3u8")
                
            print(f"[TranscodeVideo-{hardware.upper()}] -> Uploading master playlist (Atomic swap)...")
            b2_client.upload_file(
                str(master_file), bucket_name, f"{hls_prefix}/master.m3u8",
                ExtraArgs={"ContentType": "application/x-mpegURL", "CacheControl": "public, max-age=3600"}
            )

        # 6. Calculate exact HLS overhead size & update Supabase record
        total_hls_bytes = sum(f.stat().st_size for f in tmp_path.glob("**/*") if f.is_file())
        print(f"[TranscodeVideo-{hardware.upper()}] Calculated exact HLS streaming overhead: {total_hls_bytes} bytes (~{total_hls_bytes / (1024 * 1024):.2f} MB)")

        update_data = {
            "url": hls_master_url,
            "thumbnail_url": poster_url,
            "overhead_size": total_hls_bytes,
            "resource_type": "video",
            "media_type": "video",
            "status": "processed",
            "processing_error": None,
        }
        if video_duration_seconds:
            update_data["duration"] = round(video_duration_seconds, 2)
        supabase.table("photos").update(update_data).eq("id", photo_id).execute()

        # 7. Log infrastructure cost
        duration = time.time() - start_time
        cpu_cores = 4.0
        memory_gb = 8.0 if hardware == "gpu" else 4.0
        gpu_type = "l4" if hardware == "gpu" else "None"
        gpu_cost_rate = 0.0222 if hardware == "gpu" else 0.0
        estimated_cost_inr = duration * ((cpu_cores * 0.00131) + (memory_gb * 0.000222) + gpu_cost_rate)
        event_id = request.get("event_id")
        user_id = request.get("user_id")

        # Resolve user_id / event_id if missing or anonymous from request
        if (not user_id or user_id == "anonymous" or not event_id) and photo_id:
            try:
                p_res = supabase.table("photos").select("user_id, event_id").eq("id", photo_id).maybe_single().execute()
                if p_res and p_res.data:
                    p_user = p_res.data.get("user_id")
                    if not user_id and p_user and p_user != "anonymous":
                        user_id = p_user
                    if not event_id:
                        event_id = p_res.data.get("event_id")
            except Exception:
                pass

        # Gallery video transcode compute is always billed to the event owner (host/creator)
        if event_id:
            try:
                e_res = supabase.table("events").select("created_by").eq("id", event_id).maybe_single().execute()
                if e_res and e_res.data and e_res.data.get("created_by"):
                    user_id = e_res.data.get("created_by")
            except Exception:
                pass

        video_size = raw_video_path.stat().st_size if raw_video_path.exists() else None
        worker_desc = f"Modal {'GPU' if hardware == 'gpu' else 'CPU'} Worker ({'NVIDIA L4 • 4 vCPU • 8GB RAM' if hardware == 'gpu' else '4 vCPU • 4GB RAM'})"

        try:
            video_log_payload = {
                "photo_id":                photo_id,
                "event_id":                event_id,
                "function_name":           f"process_video_{hardware}",
                "worker_type":             worker_desc,
                "media_type":              "video",
                "media_size":              video_size,
                "video_duration_seconds":  video_duration_seconds,
                "cpu_cores":               cpu_cores,
                "memory_gb":               memory_gb,
                "gpu_type":                gpu_type,
                "execution_time_seconds":  duration,
                "estimated_cost_inr":      estimated_cost_inr,
                "faces_detected":          0
            }
            if user_id:
                video_log_payload["user_id"] = user_id

            try:
                supabase.table("modal_cost_logs").insert(video_log_payload).execute()
                print(f"[TranscodeVideo-{hardware.upper()}] Cost logged (full metadata): {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
            except Exception as meta_err:
                print(f"[TranscodeVideo-{hardware.upper()}] Full metadata log failed ({meta_err}), attempting core schema fallback...")
                core_payload = {
                    "photo_id":                photo_id,
                    "event_id":                event_id,
                    "function_name":           f"process_video_{hardware}",
                    "cpu_cores":               cpu_cores,
                    "memory_gb":               memory_gb,
                    "gpu_type":                gpu_type,
                    "execution_time_seconds":  duration,
                    "estimated_cost_inr":      estimated_cost_inr,
                    "faces_detected":          0
                }
                if user_id:
                    core_payload["user_id"] = user_id
                supabase.table("modal_cost_logs").insert(core_payload).execute()
                print(f"[TranscodeVideo-{hardware.upper()}] Cost logged (core fallback): {duration:.2f}s, ₹{estimated_cost_inr:.5f}")
        except Exception as log_err:
            print(f"[TranscodeVideo-{hardware.upper()}] Cost log completely failed: {log_err}")

        print(f"[TranscodeVideo-{hardware.upper()}] completed in {duration:.1f}s")
        return {"status": "success", "hls_master_url": hls_master_url}

    except Exception as e:
        error_details = str(e)
        try:
            supabase.table("photos").update({"status": "failed", "processing_error": error_details[:1000]}).eq("id", photo_id).execute()
        except Exception:
            pass
        raise fastapi.HTTPException(status_code=500, detail=f"Transcoding failed: {error_details}")

@app.function(
    image=transcode_image,
    cpu=4.0,
    memory=4096,
    timeout=3600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_cpu(request: dict):
    return _transcode_video_core(request, hardware="cpu")

@app.function(
    image=transcode_image,
    gpu="l4",
    cpu=4.0,
    memory=8192,
    timeout=3600,
    secrets=[modal.Secret.from_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))]
)
@modal.fastapi_endpoint(method="POST")
def process_video_gpu(request: dict):
    return _transcode_video_core(request, hardware="gpu")





