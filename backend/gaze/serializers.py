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
    Expects raw samples from at least 12 calibration targets:
    - target: normalised screen position in the 0..1 range
    - gaze: ten eye/head features from the local CV service
    """

    samples = serializers.ListField(
        child=serializers.DictField(), min_length=80, max_length=1000
    )

    def validate_samples(self, samples):
        cleaned = []
        for index, sample in enumerate(samples):
            gaze, target = sample.get("gaze"), sample.get("target")
            if not isinstance(gaze, list) or len(gaze) != 10:
                raise serializers.ValidationError(
                    f"Sample {index} must contain 10 gaze features."
                )
            if not isinstance(target, list) or len(target) != 2:
                raise serializers.ValidationError(
                    f"Sample {index} must contain a two-value target."
                )
            try:
                gaze = [float(value) for value in gaze]
                target = [float(value) for value in target]
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    f"Sample {index} contains non-numeric data."
                )
            if not all(0 <= value <= 1 for value in target):
                raise serializers.ValidationError("Targets must be normalised to 0..1.")
            cleaned.append({"gaze": gaze, "target": target})
        return cleaned
