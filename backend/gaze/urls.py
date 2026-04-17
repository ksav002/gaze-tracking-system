from django.urls import path
from gaze.views import CalibrationView, RegisterView, me
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("auth/register/", RegisterView.as_view()),
    path("auth/login/", TokenObtainPairView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", me),
    path("calibration/", CalibrationView.as_view(), name="calibration"),
]
