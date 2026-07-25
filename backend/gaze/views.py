import numpy as np
from cv.calibration import (
    GazeCalibrationModel,
    cross_validated_error,
    reject_target_outliers,
)
from gaze.serializers import RegisterSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CalibrationProfile
from .serializers import CalibrationInputSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User created"}, status=201)
        return Response(serializer.errors, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({"id": user.id, "username": user.username, "email": user.email})


class CalibrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CalibrationInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        samples = serializer.validated_data["samples"]

        try:
            gaze_coords = np.array([s["gaze"] for s in samples], dtype=np.float64)
            dot_coords = np.array([s["target"] for s in samples], dtype=np.float64)
            gaze_coords, dot_coords = reject_target_outliers(gaze_coords, dot_coords)
            if len(gaze_coords) < 80:
                return Response(
                    {"error": "Too many unstable samples were rejected. Please recalibrate."},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )
            if len(np.unique(dot_coords, axis=0)) < 12:
                return Response(
                    {"error": "At least 12 distinct calibration targets are required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            quality = cross_validated_error(gaze_coords, dot_coords)
            if quality["mean_error"] > 0.22:
                return Response(
                    {
                        "error": "Calibration quality is too low. Improve lighting, keep your head steady, and retry.",
                        "quality": quality,
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            cal = GazeCalibrationModel(alpha=8.0)
            cal.fit(gaze_coords, dot_coords)

            coefficients = cal.to_dict()

            profile, created = CalibrationProfile.objects.update_or_create(
                user=request.user, defaults={"coefficients": coefficients}
            )

            return Response(
                {
                    "message": "Calibration saved.",
                    "created": created,
                    "updated_at": profile.updated_at,
                    "quality": quality,
                    "samples_used": len(gaze_coords),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Calibration fitting failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get(self, request):
        try:
            profile = CalibrationProfile.objects.get(user=request.user)
            return Response(
                {
                    "calibrated": True,
                    "coefficients": profile.coefficients,
                    "updated_at": profile.updated_at,
                }
            )
        except CalibrationProfile.DoesNotExist:
            return Response({"calibrated": False})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def calibration_status(request):
    exists = CalibrationProfile.objects.filter(user=request.user).exists()
    return Response({"active": exists})


import numpy as np
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GazePoint, GazeSession

# ── Session list / create ────────────────────────────────────────────────────


class SessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Returns a summary list of all gaze sessions for the authenticated user.
        Includes point_count so the frontend can filter sessions without a heatmap."""
        from django.db.models import Count

        sessions = (
            GazeSession.objects.filter(user=request.user)
            .annotate(point_count=Count("gaze_points"))
            .order_by("-started_at")
            .values("id", "started_at", "ended_at", "page_url", "point_count")
        )
        return Response(list(sessions))


# ── KDE Heatmap ──────────────────────────────────────────────────────────────


class SessionHeatmapView(APIView):
    """
    GET /api/sessions/<session_id>/heatmap/?grid=100&screen_w=1920&screen_h=1080

    Returns a 2-D JSON grid of KDE-smoothed gaze density values.
    Each cell value is in [0, 1], normalised to the peak density.

    Query params:
        grid      — number of grid cells per axis (default 100)
        screen_w  — screen width used during the session (default 1920)
        screen_h  — screen height used during the session (default 1080)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        # Ownership check
        try:
            session = GazeSession.objects.get(id=session_id, user=request.user)
        except GazeSession.DoesNotExist:
            return Response(
                {"error": "Session not found."}, status=status.HTTP_404_NOT_FOUND
            )

        grid_size = int(request.query_params.get("grid", 100))
        screen_w = int(request.query_params.get("screen_w", 1920))
        screen_h = int(request.query_params.get("screen_h", 1080))

        points = list(GazePoint.objects.filter(session=session).values_list("x", "y"))

        if len(points) < 5:
            return Response(
                {"error": "Not enough gaze points to compute heatmap (need ≥ 5)."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        xs = np.array([p[0] for p in points], dtype=np.float64)
        ys = np.array([p[1] for p in points], dtype=np.float64)

        # Build the evaluation grid
        grid_x = np.linspace(0, screen_w, grid_size)
        grid_y = np.linspace(0, screen_h, grid_size)
        gx, gy = np.meshgrid(grid_x, grid_y)  # both (grid_size, grid_size)
        eval_points = np.vstack([gx.ravel(), gy.ravel()])  # (2, grid_size²)

        density = _kde(xs, ys, eval_points, screen_w, screen_h)
        density_grid = density.reshape(grid_size, grid_size)

        # Normalise to [0, 1]
        peak = density_grid.max()
        if peak > 0:
            density_grid /= peak

        return Response(
            {
                "session_id": str(session.id),
                "grid_size": grid_size,
                "screen_w": screen_w,
                "screen_h": screen_h,
                "n_points": len(points),
                # Row-major 2-D list; row 0 = top of screen
                "density": density_grid.tolist(),
            }
        )


# ── KDE implementation ───────────────────────────────────────────────────────


def _kde(
    xs: np.ndarray, ys: np.ndarray, eval_pts: np.ndarray, screen_w: int, screen_h: int
) -> np.ndarray:
    """
    Gaussian KDE using Silverman's rule of thumb for bandwidth selection.

    eval_pts : (2, M) array of (x, y) positions to evaluate density at
    Returns  : (M,) density array
    """
    n = len(xs)
    data = np.vstack([xs, ys])  # (2, n)

    # Silverman bandwidth scaled to screen dimensions
    bw_x = 1.06 * xs.std() * n ** (-1 / 5)
    bw_y = 1.06 * ys.std() * n ** (-1 / 5)

    # Clamp to sensible fraction of screen so sparse data stays visible
    bw_x = max(bw_x, screen_w * 0.02)
    bw_y = max(bw_y, screen_h * 0.02)

    # Vectorised Gaussian kernel:  sum_i exp(-0.5 * ((x-xi/bw)^2 + (y-yi/bw)^2))
    # eval_pts: (2, M), data: (2, n)  → diff: (2, M, n)
    diff = eval_pts[:, :, np.newaxis] - data[:, np.newaxis, :]
    diff[0] /= bw_x
    diff[1] /= bw_y
    kernel = np.exp(-0.5 * (diff**2).sum(axis=0))  # (M, n)
    density = kernel.sum(axis=1)  # (M,)
    return density
