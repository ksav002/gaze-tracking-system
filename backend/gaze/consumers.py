import json

from channels.generic.websocket import AsyncWebsocketConsumer


class GazeConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("gaze_stream", self.channel_name)
        await self.accept()
        print(f"[GazeConsumer] Client connected: {self.channel_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("gaze_stream", self.channel_name)
        print(f"[GazeConsumer] Client disconnected: {self.channel_name}")

    async def receive(self, text_data):
        """Forward messages from CV service to all frontend clients."""
        try:
            data = json.loads(text_data)
            await self.channel_layer.group_send(
                "gaze_stream",
                {
                    "type": "gaze.message",
                    "data": data,
                },
            )
        except json.JSONDecodeError:
            pass

    async def gaze_message(self, event):
        """Send gaze data to WebSocket client (frontend)."""
        await self.send(text_data=json.dumps(event["data"]))
