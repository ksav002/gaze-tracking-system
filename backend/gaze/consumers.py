import json

from channels.generic.websocket import AsyncWebsocketConsumer

REQUIRED_KEYS = {"face_detected"}


class GazeConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("gaze_stream", self.channel_name)
        await self.accept()
        print(f"[GazeConsumer] Client connected: {self.channel_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("gaze_stream", self.channel_name)
        print(f"[GazeConsumer] Client disconnected: {self.channel_name}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        # Control messages: broadcast to group so cv_service receives them
        if msg_type in ("start_camera", "stop_camera"):
            await self.channel_layer.group_send(
                "gaze_stream",
                {"type": "gaze.message", "data": data},
            )
            return

        # Gaze packets from cv_service: validate then broadcast to frontend
        if not isinstance(data, dict) or not REQUIRED_KEYS.issubset(data.keys()):
            print(f"[GazeConsumer] Malformed packet dropped: {data}")
            return

        await self.channel_layer.group_send(
            "gaze_stream",
            {"type": "gaze.message", "data": data},
        )

    async def gaze_message(self, event):
        try:
            await self.send(text_data=json.dumps(event["data"]))
        except Exception:
            pass
