import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from .models import GazePoint, GazeSession

REQUIRED_KEYS = {"face_detected"}
WRITE_BATCH_SIZE = 30

# Module-level shared session state across all consumer instances
# Key: user_id, Value: GazeSession instance
_active_sessions: dict[int, GazeSession] = {}
_active_batches: dict[int, list] = {}


class GazeConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        await self.channel_layer.group_add("gaze_stream", self.channel_name)
        await self.accept()
        self._user_id: int | None = None
        print(f"[GazeConsumer] Client connected: {self.channel_name}")

    async def disconnect(self, close_code):
        if self._user_id is not None:
            await self._flush_batch(self._user_id)
            await self._end_session(self._user_id)
        await self.channel_layer.group_discard("gaze_stream", self.channel_name)
        print(f"[GazeConsumer] Client disconnected: {self.channel_name}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        # ── Control messages ─────────────────────────────────────────────
        if msg_type == "start_camera":
            user = self.scope.get("user")
            if user and user.is_authenticated:
                self._user_id = user.id
                await self._start_session(user)
            await self.channel_layer.group_send(
                "gaze_stream", {"type": "gaze.message", "data": data}
            )
            return

        if msg_type == "stop_camera":
            if self._user_id is not None:
                await self._flush_batch(self._user_id)
                await self._end_session(self._user_id)
                self._user_id = None
            await self.channel_layer.group_send(
                "gaze_stream", {"type": "gaze.message", "data": data}
            )
            return

        # ── Gaze packets ─────────────────────────────────────────────────
        if not isinstance(data, dict) or not REQUIRED_KEYS.issubset(data.keys()):
            print(f"[GazeConsumer] Malformed packet dropped: {data}")
            return

        # Save gaze point here in receive(), using the active session for
        # the authenticated user — works regardless of which WS client sent it
        if data.get("face_detected"):
            user = self.scope.get("user")
            if user and user.is_authenticated and user.id in _active_sessions:
                uid = user.id
                _active_batches.setdefault(uid, []).append(
                    GazePoint(
                        session=_active_sessions[uid],
                        x=data.get("x", 0),
                        y=data.get("y", 0),
                        is_fixation=bool(data.get("is_fixation", False)),
                    )
                )
                if len(_active_batches[uid]) >= WRITE_BATCH_SIZE:
                    await self._flush_batch(uid)

        await self.channel_layer.group_send(
            "gaze_stream", {"type": "gaze.message", "data": data}
        )

    async def gaze_message(self, event):
        try:
            await self.send(text_data=json.dumps(event["data"]))
        except Exception:
            pass

    # ── DB helpers ───────────────────────────────────────────────────────

    @database_sync_to_async
    def _create_session_db(self, user):
        return GazeSession.objects.create(user=user)

    @database_sync_to_async
    def _close_session_db(self, session):
        session.ended_at = timezone.now()
        session.save(update_fields=["ended_at"])

    @database_sync_to_async
    def _bulk_create_points_db(self, batch):
        GazePoint.objects.bulk_create(batch)

    async def _start_session(self, user):
        uid = user.id
        if uid in _active_sessions:
            return  # already active
        session = await self._create_session_db(user)
        _active_sessions[uid] = session
        _active_batches[uid] = []
        print(f"[GazeConsumer] Session started: {session.id} (user: {uid})")

    async def _end_session(self, uid: int):
        session = _active_sessions.pop(uid, None)
        if session is None:
            return
        _active_batches.pop(uid, None)
        await self._close_session_db(session)
        print(f"[GazeConsumer] Session ended: {session.id}")

    async def _flush_batch(self, uid: int):
        batch = _active_batches.get(uid, [])
        if not batch:
            return
        to_write = batch[:]
        _active_batches[uid] = []
        await self._bulk_create_points_db(to_write)
        print(f"[GazeConsumer] Flushed {len(to_write)} gaze points (user: {uid})")
