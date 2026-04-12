from django.contrib.auth import authenticate
from gaze.serializers import RegisterSerializer
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            return Response({"message": "User created"}, status=201)

        return Response(serializer.errors, status=400)
