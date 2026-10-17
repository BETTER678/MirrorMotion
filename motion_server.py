"""
MotionMirror - Real-Time Pose Server
======================================
- Uses MediaPipe Pose Landmarker in VIDEO mode
- Streams both image + world landmarks over WebSocket
- Sends skeleton connections for debug overlay
- Auto-reconnect handling on browser side
- Streams a compact camera preview to the browser
- Sends "no_pose" signal when body lost
"""

import asyncio
import json
import time
import cv2
import mediapipe as mp
import websockets
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = "models/pose_landmarker_lite.task"
HOST = "localhost"
PORT = 8765

# MediaPipe Pose skeleton connections (pairs of landmark indices)
POSE_CONNECTIONS = [
    (11, 12),  # shoulders
    (11, 13), (13, 15),  # left arm
    (12, 14), (14, 16),  # right arm
    (11, 23), (12, 24),  # torso sides
    (23, 24),            # hips
    (23, 25), (25, 27),  # left leg
    (24, 26), (26, 28),  # right leg
    (27, 29), (29, 31),  # left foot
    (28, 30), (30, 32),  # right foot
    (0, 1), (1, 2), (2, 3), (3, 7),   # face left
    (0, 4), (4, 5), (5, 6), (6, 8),   # face right
]

clients: set = set()
last_broadcast_log = 0.0


async def handle_client(websocket):
    clients.add(websocket)
    print(f"[WS] Browser connected  ->  Total: {len(clients)}")
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        print(f"[WS] Browser disconnected  ->  Total: {len(clients)}")


async def broadcast(payload: dict | bytes):
    global last_broadcast_log
    if not clients:
        return
    message = json.dumps(payload, separators=(",", ":")) if isinstance(payload, dict) else payload
    dead = set()
    recipients = list(clients)
    results = await asyncio.gather(
        *(ws.send(message) for ws in recipients),
        return_exceptions=True,
    )
    for ws, result in zip(recipients, results):
        if isinstance(result, Exception):
            print(f"[WS] Send failed: {result}")
            dead.add(ws)
    clients.difference_update(dead)
    now = time.monotonic()
    if now - last_broadcast_log >= 2:
        message_type = payload.get("type", "preview") if isinstance(payload, dict) else "preview"
        print(f"[WS] Sent {message_type} to {len(recipients) - len(dead)} client(s)")
        last_broadcast_log = now


def convert_landmarks(points):
    if not points:
        return []
    return [
        {
            "x": float(p.x),
            "y": float(p.y),
            "z": float(p.z),
            "v": float(getattr(p, "visibility", 1.0) or 0.0),
        }
        for p in points
    ]


async def main():
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.45,
        min_pose_presence_confidence=0.45,
        min_tracking_confidence=0.45,
    )

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap.release()
        cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Webcam unavailable.")
        print("Check Windows Settings > Privacy & security > Camera.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print(f"[Server] ws://{HOST}:{PORT} — ready")
    print("Stand ~2m back so full body is visible. Close this window to quit.")

    start_time = time.monotonic()
    frame_count = 0
    fps = 0.0
    fps_timer = time.monotonic()
    last_read_error = 0.0
    last_preview = 0.0

    try:
        async with websockets.serve(handle_client, HOST, PORT):
            with vision.PoseLandmarker.create_from_options(options) as landmarker:
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        now = time.monotonic()
                        if now - last_read_error >= 5:
                            print("[Camera] No frames received. Close other camera apps and check the webcam.")
                            await broadcast({"type": "camera_error"})
                            last_read_error = now
                        await asyncio.sleep(0.1)
                        continue
                    last_read_error = 0.0

                    frame = cv2.flip(frame, 1)
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                    mp_image = mp.Image(
                        image_format=mp.ImageFormat.SRGB,
                        data=rgb
                    )

                    timestamp_ms = int((time.monotonic() - start_time) * 1000)
                    result = landmarker.detect_for_video(mp_image, timestamp_ms)

                    # ── FPS counter ──────────────────────────────────────────
                    frame_count += 1
                    now = time.monotonic()
                    if now - fps_timer >= 1.0:
                        fps = frame_count / (now - fps_timer)
                        frame_count = 0
                        fps_timer = now

                    h, w = frame.shape[:2]

                    if result.pose_landmarks:
                        img_pts = result.pose_landmarks[0]
                        world_pts = (
                            result.pose_world_landmarks[0]
                            if result.pose_world_landmarks
                            else []
                        )

                        lm = convert_landmarks(img_pts)
                        wlm = convert_landmarks(world_pts)

                        # ── Draw skeleton ────────────────────────────────────
                        for a, b in POSE_CONNECTIONS:
                            if a < len(img_pts) and b < len(img_pts):
                                pa = img_pts[a]
                                pb = img_pts[b]
                                va = getattr(pa, "visibility", 1.0) or 0.0
                                vb = getattr(pb, "visibility", 1.0) or 0.0
                                if va > 0.4 and vb > 0.4:
                                    x1, y1 = int(pa.x * w), int(pa.y * h)
                                    x2, y2 = int(pb.x * w), int(pb.y * h)
                                    cv2.line(frame, (x1, y1), (x2, y2), (0, 200, 255), 2)

                        for p in img_pts:
                            v = getattr(p, "visibility", 1.0) or 0.0
                            if v > 0.4:
                                cx, cy = int(p.x * w), int(p.y * h)
                                cv2.circle(frame, (cx, cy), 5, (0, 255, 0), -1)

                        cv2.putText(frame, f"TRACKING  {fps:.0f} fps", (12, 32),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

                        await broadcast({
                            "type": "pose",
                            "ts": timestamp_ms,
                            "lm": lm,
                            "wlm": wlm,
                        })
                    else:
                        cv2.putText(frame, "No body — step back", (12, 32),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 80, 255), 2)
                        await broadcast({"type": "no_pose"})

                    cv2.putText(frame, f"Clients: {len(clients)}", (12, h - 12),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                    if clients and now - last_preview >= 0.1:
                        preview = cv2.resize(frame, (320, 240), interpolation=cv2.INTER_AREA)
                        encoded_ok, encoded = cv2.imencode(
                            ".jpg", preview, [cv2.IMWRITE_JPEG_QUALITY, 65]
                        )
                        if encoded_ok:
                            await broadcast(encoded.tobytes())
                        last_preview = now

                    # yield to asyncio event loop every frame
                    await asyncio.sleep(0)

    except Exception as e:
        print(f"[Server] Error: {e}")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[Server] Stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Server] Keyboard interrupt — stopped.")
