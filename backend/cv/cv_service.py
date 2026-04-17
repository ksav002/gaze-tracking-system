import argparse
import asyncio
import json
import time

import cv2
import requests
import websockets
from calibration import GazeCalibrationModel
from fixation import DwellTimer, FixationDetector
from gaze_processor import process_frame

DJANGO_API_BASE = "http://localhost:8000/api"
DJANGO_WS_URL = "ws://localhost:8000/ws/gaze/"


def fetch_calibration(token: str):
    try:
        resp = requests.get(
            f"{DJANGO_API_BASE}/calibration/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=3,
        )

        if resp.status_code == 200:
            return GazeCalibrationModel.from_dict(resp.json())

        return None

    except Exception as e:
        print("[cv_service] calibration fetch error:", e)
        return None


def open_camera(preferred=0):
    cap = cv2.VideoCapture(preferred, cv2.CAP_V4L2)

    if cap.isOpened():
        ret, _ = cap.read()
        if ret:
            return cap

    # fallback scan
    for i in range(5):
        cap = cv2.VideoCapture(i, cv2.CAP_V4L2)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                print(f"[cv] fallback camera {i}")
                return cap
        cap.release()

    raise RuntimeError("No usable camera")


async def run_gaze_pipeline(token: str, screen_w: int, screen_h: int):

    cap = open_camera()
    if not cap.isOpened():
        raise RuntimeError("Camera failed to open")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    fixation_detector = FixationDetector()
    dwell_timer = DwellTimer()

    ws_url = f"{DJANGO_WS_URL}?token={token}"

    cal_model = None
    last_calibration_fetch = 0

    async with websockets.connect(ws_url) as ws:
        print("[cv_service] connected to websocket")

        while True:

            # -------------------------
            # 1. periodic calibration reload
            # -------------------------
            if time.time() - last_calibration_fetch > 5:
                new_model = fetch_calibration(token)
                if new_model:
                    cal_model = new_model
                    print("[cv_service] calibration loaded/updated")

                last_calibration_fetch = time.time()

            # -------------------------
            # 2. camera frame
            # -------------------------
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.01)
                continue

            result = process_frame(frame)

            if result is None:
                await ws.send(json.dumps({"face_detected": False}))
                await asyncio.sleep(0.03)
                continue

            gaze_vec = result["features"]

            # -------------------------
            # 3. SAFE mapping
            # -------------------------
            if cal_model:
                sx, sy = cal_model.map_gaze_to_screen(gaze_vec, screen_w, screen_h)
            else:
                # fallback: raw normalized output
                sx, sy = gaze_vec[0], gaze_vec[1]

            # -------------------------
            # 4. fixation logic
            # -------------------------
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
            }

            await ws.send(json.dumps(packet))
            await asyncio.sleep(0.033)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", required=True)
    parser.add_argument("--screen-w", type=int, default=1920)
    parser.add_argument("--screen-h", type=int, default=1080)

    args = parser.parse_args()

    asyncio.run(run_gaze_pipeline(args.token, args.screen_w, args.screen_h))
