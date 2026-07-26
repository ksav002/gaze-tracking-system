import asyncio
import json
from collections import deque

import cv2
import numpy as np
import websockets
from calibration import GazeCalibrationModel
from fixation import DwellTimer, FixationDetector
from gaze_processor import process_frame

CV_WS_HOST = "127.0.0.1"
CV_WS_PORT = 8765
SLOW_ALPHA = 0.10
FAST_ALPHA = 0.55
DEAD_ZONE_PX = 20
MEDIAN_WINDOW = 5
EYE_OPEN_THRESHOLD = 0.12


def open_camera(preferred=1):
    cap = cv2.VideoCapture(preferred, cv2.CAP_V4L2)
    if cap.isOpened():
        ok, _ = cap.read()
        if ok:
            return cap
        cap.release()
    for index in range(5):
        if index == preferred:
            continue
        cap = cv2.VideoCapture(index, cv2.CAP_V4L2)
        if cap.isOpened():
            ok, _ = cap.read()
            if ok:
                print(f"[cv_service] using fallback camera {index}")
                return cap
        cap.release()
    raise RuntimeError("No usable camera found")


def load_calibration(data):
    if not data:
        return None
    try:
        return GazeCalibrationModel.from_dict(data)
    except (KeyError, TypeError, ValueError) as error:
        print(f"[cv_service] calibration unavailable: {error}")
        return None


async def serve_browser(websocket):
    """Process camera control for one local browser connection."""
    print("[cv_service] browser connected")
    control_queue = asyncio.Queue()
    fixation_detector = FixationDetector(dispersion_threshold=80)
    dwell_timer = DwellTimer()
    cap = None
    camera_active = False
    calibration = None
    screen_w, screen_h = 1920, 1080
    smoothed_x = smoothed_y = None
    gaze_samples = deque(maxlen=MEDIAN_WINDOW)

    async def receive_controls():
        try:
            async for raw in websocket:
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if message.get("type") in ("start_camera", "stop_camera"):
                    await control_queue.put(message)
        except websockets.ConnectionClosed:
            pass

    receiver = asyncio.create_task(receive_controls())
    try:
        while True:
            if receiver.done() and control_queue.empty():
                break

            while not control_queue.empty():
                message = control_queue.get_nowait()
                if message["type"] == "start_camera" and not camera_active:
                    screen_w = max(1, int(message.get("screen_w", 1920)))
                    screen_h = max(1, int(message.get("screen_h", 1080)))
                    calibration = load_calibration(message.get("calibration"))
                    try:
                        cap = open_camera()
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        camera_active = True
                        smoothed_x = smoothed_y = None
                        gaze_samples.clear()
                        fixation_detector.reset()
                        print(
                            f"[cv_service] camera started at viewport "
                            f"{screen_w}x{screen_h}; calibrated={calibration is not None}"
                        )
                    except RuntimeError as error:
                        await websocket.send(
                            json.dumps({"type": "camera_error", "message": str(error)})
                        )
                elif message["type"] == "stop_camera" and camera_active:
                    cap.release()
                    cap = None
                    camera_active = False
                    smoothed_x = smoothed_y = None
                    gaze_samples.clear()
                    print("[cv_service] camera stopped")

            if not camera_active:
                await asyncio.sleep(0.03)
                continue

            ok, frame = cap.read()
            if not ok:
                await asyncio.sleep(0.01)
                continue
            result = process_frame(frame)
            if result is None or result["eye_openness"] < EYE_OPEN_THRESHOLD:
                await websocket.send(json.dumps({"face_detected": False}))
                await asyncio.sleep(0.033)
                continue

            features = result["features"]
            if calibration is not None:
                sx, sy = calibration.map_gaze_to_screen(features, screen_w, screen_h)
            else:
                # Coordinates are not used during initial calibration.
                sx, sy = screen_w // 2, screen_h // 2

            gaze_samples.append((sx, sy))
            sx, sy = np.median(np.asarray(gaze_samples), axis=0)

            if smoothed_x is None:
                smoothed_x, smoothed_y = float(sx), float(sy)
            else:
                distance = np.hypot(sx - smoothed_x, sy - smoothed_y)
                threshold = 0.08 * min(screen_w, screen_h)
                if distance <= DEAD_ZONE_PX:
                    alpha = 0.0
                else:
                    alpha = FAST_ALPHA if distance > threshold else SLOW_ALPHA
                smoothed_x = alpha * sx + (1 - alpha) * smoothed_x
                smoothed_y = alpha * sy + (1 - alpha) * smoothed_y
            sx, sy = int(smoothed_x), int(smoothed_y)

            is_fixation, centroid = fixation_detector.update(sx, sy)
            should_click, dwell_progress = dwell_timer.update(
                centroid if is_fixation else None
            )
            display_x, display_y = centroid if is_fixation else (sx, sy)
            await websocket.send(
                json.dumps(
                    {
                        "face_detected": True,
                        "x": int(round(display_x)),
                        "y": int(round(display_y)),
                        "is_fixation": is_fixation,
                        "dwell_progress": round(dwell_progress, 3),
                        "should_click": should_click,
                        "pitch": round(result["pitch"], 2),
                        "yaw": round(result["yaw"], 2),
                        "calibrated": calibration is not None,
                        "features": features,
                    }
                )
            )
            await asyncio.sleep(0.033)
    except websockets.ConnectionClosed:
        pass
    finally:
        receiver.cancel()
        if cap is not None:
            cap.release()
        print("[cv_service] browser disconnected")


async def main():
    async with websockets.serve(serve_browser, CV_WS_HOST, CV_WS_PORT):
        print(f"[cv_service] ready at ws://{CV_WS_HOST}:{CV_WS_PORT}")
        print("[cv_service] open the web app and start calibration or tracking")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[cv_service] stopped")
