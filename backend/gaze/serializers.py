from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import CalibrationProfile


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["username", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )
        return user


class CalibrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalibrationProfile
        fields = ["coefficients", "updated_at"]


class CalibrationInputSerializer(serializers.Serializer):
    """
    Expects a list of 9 samples, each with:
    - dot_x, dot_y: actual screen position of the calibration dot (0.0 to 1.0 normalized)
    - gaze_x, gaze_y: averaged raw gaze coordinates from CV service
    """

    samples = serializers.ListField(
        child=serializers.DictField(), min_length=9, max_length=9
    )
