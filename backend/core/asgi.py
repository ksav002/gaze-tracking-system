"""
ASGI config for core project.
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Django setup must happen before any app imports
from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.routing import ProtocolTypeRouter, URLRouter
from django.contrib.auth.models import AnonymousUser
from django.urls import path
from gaze.consumers import GazeConsumer
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


class JWTAuthMiddleware:
    """
    Reads a JWT access token from the ?token= query parameter and
    populates scope["user"] so GazeConsumer._create_session() works.

    Falls back to AnonymousUser if the token is absent or invalid.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope["user"] = await self._get_user(scope)
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, scope):
        from django.contrib.auth.models import User

        query_params = parse_qs(scope.get("query_string", b"").decode())
        token_list = query_params.get("token", [])

        if not token_list:
            return AnonymousUser()

        try:
            token = AccessToken(token_list[0])
            return User.objects.get(id=token["user_id"])
        except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
            return AnonymousUser()


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            URLRouter(
                [
                    path("ws/gaze/", GazeConsumer.as_asgi()),
                ]
            )
        ),
    }
)
