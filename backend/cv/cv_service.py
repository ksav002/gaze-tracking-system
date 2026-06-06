import argparse
import asyncio
import json

import cv2
import requests
import websockets
from calibration import GazeCalibrationModel
from fixation import DwellTimer, FixationDetector
from gaze_processor import process_frame

DJANGO_API_BASE = "http://localhost:8000/api"
DJANGO_WS_URL = "ws://localhost:8000/ws/gaze/"

EMA_ALPHA = 0.08  # Very smooth — raise to 0.15 if it feels too laggy
EAR_BLINK_THRESHOLD = 0.015  # EAR below this = eyes closed, suppress gaze


def fetch_calibration(token: str):
    try:
        resp = requests.get(
            f"{DJANGO_API_BASE}/calibration/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=3,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("calibrated"):
                model = GazeCalibrationModel.from_dict(data["coefficients"])
                print("[cv_service] calibration loaded OK")
                return model
            else:
                print("[cv_service] no calibration on server yet")
        else:
            print(f"[cv_service] calibration fetch HTTP {resp.status_code}")
    except Exception as e:
        print("[cv_service] calibration fetch error:", e)
    return None


def open_camera(preferred=1):
    cap = cv2.VideoCapture(preferred, cv2.CAP_V4L2)
    if cap.isOpened():
        ret, _ = cap.read()
        if ret:
            return cap
        cap.release()

    for i in range(5):
        if i == preferred:
            continue
        cap = cv2.VideoCapture(i, cv2.CAP_V4L2)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"[cv] fallback camera {i}")
                return cap
        cap.release()

    raise RuntimeError("No usable camera found")


async def run_gaze_pipeline(token: str, screen_w: int, screen_h: int):
    ws_url = f"{DJANGO_WS_URL}?token={token}"

    fixation_detector = FixationDetector(dispersion_threshold=80)
    dwell_timer = DwellTimer()

    cap = None
    camera_active = False
    cal_model = None

    smoothed_x: float | None = None
    smoothed_y: float | None = None

    control_queue = asyncio.Queue()

    async def receiver(ws):
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    if msg.get("type") in ("start_camera", "stop_camera"):
                        print(f"[cv_service] queued control: {msg.get('type')}")
                        await control_queue.put(msg)
                except json.JSONDecodeError:
                    pass
        except websockets.ConnectionClosed:
            pass

    async with websockets.connect(ws_url) as ws:
        print("[cv_service] connected, waiting for start_camera...")
        recv_task = asyncio.create_task(receiver(ws))

        try:
            while True:
                while not control_queue.empty():
                    msg = control_queue.get_nowait()
                    msg_type = msg.get("type")

                    if msg_type == "start_camera" and not camera_active:
                        print("[cv_service] start_camera — opening camera")
                        cal_model = fetch_calibration(token)
                        cap = open_camera()
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                        camera_active = True
                        smoothed_x = None
                        smoothed_y = None
                        print(
                            "[cv_service] camera STARTED, calibrated:",
                            cal_model is not None,
                        )

                    elif msg_type == "stop_camera" and camera_active:
                        cap.release()
                        cap = None
                        camera_active = False
                        smoothed_x = None
                        smoothed_y = None
                        print("[cv_service] camera STOPPED")

                if not camera_active:
                    await asyncio.sleep(0.05)
                    continue

                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.01)
                    continue

                result = process_frame(frame)

                if result is None:
                    await ws.send(json.dumps({"face_detected": False}))
                    await asyncio.sleep(0.033)
                    continue

                gaze_vec = result["features"]
                ear = gaze_vec[5]  # Eye Aspect Ratio is the 6th feature

                # ── Blink suppression ────────────────────────────────────
                # When EAR is very low the eye is closed — iris landmarks
                # jump wildly so we suppress the packet entirely
                if ear < EAR_BLINK_THRESHOLD:
                    await ws.send(json.dumps({"face_detected": False}))
                    await asyncio.sleep(0.033)
                    continue

                # ── Map to screen coords ─────────────────────────────────
                if cal_model is not None:
                    sx, sy = cal_model.map_gaze_to_screen(gaze_vec, screen_w, screen_h)
                else:
                    sx = int((gaze_vec[0] + 1) / 2 * screen_w)
                    sy = int((gaze_vec[1] + 1) / 2 * screen_h)

                # ── EMA smoothing ────────────────────────────────────────
                if smoothed_x is None:
                    smoothed_x = float(sx)
                    smoothed_y = float(sy)
                else:
                    smoothed_x = EMA_ALPHA * sx + (1 - EMA_ALPHA) * smoothed_x
                    smoothed_y = EMA_ALPHA * sy + (1 - EMA_ALPHA) * smoothed_y

                sx = int(smoothed_x)
                sy = int(smoothed_y)

                # ── Fixation & dwell ─────────────────────────────────────
                is_fixation, centroid = fixation_detector.update(sx, sy)
                should_click, dwell_progress = dwell_timer.update(
                    centroid if is_fixation else None
                )

                packet = {
                    "face_detected": True,
                    "x": sx,
                    "y": sy,
                    "is_fixation": is_fixation,
                    "dwell_progress": round(dwell_progress, 3),
                    "should_click": should_click,
                    "pitch": round(result["pitch"], 2),
                    "yaw": round(result["yaw"], 2),
                    "calibrated": cal_model is not None,
                    "features": gaze_vec,
                }

                await ws.send(json.dumps(packet))
                await asyncio.sleep(0.033)

        finally:
            recv_task.cancel()
            try:
                await recv_task
            except asyncio.CancelledError:
                pass
            if cap is not None:
                cap.release()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", required=True)
    parser.add_argument("--screen-w", type=int, default=1920)
    parser.add_argument("--screen-h", type=int, default=1080)
    args = parser.parse_args()

    asyncio.run(run_gaze_pipeline(args.token, args.screen_w, args.screen_h))
