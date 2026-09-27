import modal
import os

app = modal.App("test-selfie-app")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install("insightface", "onnxruntime", "huggingface_hub", "numpy", "opencv-python-headless")
    .run_commands(
        "python -c 'from huggingface_hub import snapshot_download; snapshot_download(\"fal/AuraFace-v1\", local_dir=\"/root/.insightface/models/auraface\")'"
    )
)

@app.function(image=image)
def test_selfie(image_bytes: bytes):
    import cv2
    import numpy as np
    from insightface.app import FaceAnalysis

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return "Failed to decode image bytes!"

    h, w, _ = img.shape
    results = []

    # Test sizes
    test_sizes = [
        (640, 640),
        (1280, 1280),
        (896, 1280),
        (576, 1280),
        (320, 320),
    ]

    for size in test_sizes:
        app = FaceAnalysis(name="auraface", root="/root/.insightface", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=size, det_thresh=0.25)
        faces = app.get(img)
        results.append(f"det_size={size} -> Found {len(faces)} face(s)")
        
    return f"Image size: {w}x{h}. Results: " + " | ".join(results)

@app.local_entrypoint()
def main():
    img_path = "/Users/sarthak/.gemini/antigravity/brain/95565a11-5604-472a-8fcc-b4197bfaea95/.user_uploaded/media__1784278389016.png"
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return

    with open(img_path, "rb") as f:
        img_bytes = f.read()

    print("Running remote test on Modal container...")
    res = test_selfie.remote(img_bytes)
    print(res)
