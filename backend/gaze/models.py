import uuid

from django.contrib.auth.models import User
from django.db import models


class CalibrationProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="calibration_profile"
    )
    coefficients = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CalibrationProfile for {self.user.username}"


class GazeSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="gaze_sessions"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    page_url = models.CharField(max_length=500, blank=True)

    def __str__(self):
        return f"GazeSession {self.id} — {self.user.username}"


class GazePoint(models.Model):
    session = models.ForeignKey(
        GazeSession, on_delete=models.CASCADE, related_name="gaze_points"
    )
    x = models.FloatField()
    y = models.FloatField()
    is_fixation = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"GazePoint ({self.x}, {self.y}) — fixation={self.is_fixation}"
