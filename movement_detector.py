
import cv2
import mediapipe as mp
import time
import math

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = "models/pose_landmarker_lite.task"

options = vision.PoseLandmarkerOptions(
    base_options=python.BaseOptions(
        model_asset_path=MODEL_PATH
    ),
    running_mode=vision.RunningMode.VIDEO
)

def distance(a, b):
    return math.sqrt(
        (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    )

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Webcam not found!")
    raise SystemExit

previous_left_wrist = None
previous_right_wrist = None
start = time.monotonic()
last_timestamp = -1

with vision.PoseLandmarker.create_from_options(options) as detector:
    while True:
        success, frame = cap.read()

        if not success:
            break

        frame = cv2.flip(frame, 1)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb
        )

        timestamp = int((time.monotonic() - start) * 1000)
        timestamp = max(timestamp, last_timestamp + 1)
        last_timestamp = timestamp

        result = detector.detect_for_video(image, timestamp)

        movement = "No body detected"

        if result.pose_landmarks:
            points = result.pose_landmarks[0]

            # MediaPipe pose landmark indices
            left_wrist = points[15]
            right_wrist = points[16]

            left_shoulder = points[11]
            right_shoulder = points[12]

            height, width = frame.shape[:2]

            for point in points:
                x = int(point.x * width)
                y = int(point.y * height)

                if 0 <= x < width and 0 <= y < height:
                    cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)

            if (
                left_wrist.y < left_shoulder.y
                and right_wrist.y < right_shoulder.y
            ):
                movement = "Both hands raised"
            elif left_wrist.y < left_shoulder.y:
                movement = "Left hand raised"
            elif right_wrist.y < right_shoulder.y:
                movement = "Right hand raised"
            else:
                movement = "Hands below shoulders"

            # Estimate wrist movement between frames
            if previous_left_wrist is not None:
                left_speed = distance(left_wrist, previous_left_wrist)
                right_speed = distance(right_wrist, previous_right_wrist)

                if left_speed + right_speed > 0.025:
                    movement += " | Hands moving"

            previous_left_wrist = left_wrist
            previous_right_wrist = right_wrist

        cv2.putText(
            frame,
            movement,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2
        )

        cv2.imshow("GarbaAI Movement Detector", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

cap.release()
cv2.destroyAllWindows()
