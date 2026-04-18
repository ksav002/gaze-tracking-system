import numpy as np
from cv.calibration import GazeCalibrationModel
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
            gaze_coords = np.array([s["gaze"] for s in samples])
            dot_coords = np.array([s["target"] for s in samples])

            cal = GazeCalibrationModel(degree=2)
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
