import numpy as np
from gaze.serializers import RegisterSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures

from .models import CalibrationProfile
from .serializers import CalibrationInputSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            return Response({"message": "User created"}, status=201)

        return Response(serializer.errors, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
    )


class CalibrationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CalibrationInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        samples = serializer.validated_data["samples"]

        try:
            # Build input (raw gaze) and output (screen dot) arrays
            gaze_coords = np.array([[s["gaze_x"], s["gaze_y"]] for s in samples])
            dot_coords = np.array([[s["dot_x"], s["dot_y"]] for s in samples])

            # Fit two separate models: one for X, one for Y
            model_x = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
            model_y = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())

            model_x.fit(gaze_coords, dot_coords[:, 0])
            model_y.fit(gaze_coords, dot_coords[:, 1])

            # Extract coefficients to store as JSON
            coefficients = {
                "x": {
                    "coef": model_x.named_steps["linearregression"].coef_.tolist(),
                    "intercept": float(
                        model_x.named_steps["linearregression"].intercept_
                    ),
                },
                "y": {
                    "coef": model_y.named_steps["linearregression"].coef_.tolist(),
                    "intercept": float(
                        model_y.named_steps["linearregression"].intercept_
                    ),
                },
                "poly_degree": 2,
            }

            # Save or update CalibrationProfile for this user
            profile, created = CalibrationProfile.objects.update_or_create(
                user=request.user, defaults={"coefficients": coefficients}
            )

            return Response(
                {
                    "message": "Calibration saved successfully.",
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
        """Return current user's calibration coefficients."""
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
