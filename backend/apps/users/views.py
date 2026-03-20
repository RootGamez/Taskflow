from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.serializers import (
	LoginSerializer,
	RefreshSerializer,
	RegisterSerializer,
	UserSerializer,
	issue_tokens_for_user,
)

User = get_user_model()


class RegisterView(APIView):
	permission_classes = [AllowAny]

	def post(self, request: Request) -> Response:
		serializer = RegisterSerializer(data=request.data)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo registrar la cuenta."
			raise ValidationError({"detail": message})
		user = serializer.save()
		return Response(issue_tokens_for_user(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
	permission_classes = [AllowAny]

	def post(self, request: Request) -> Response:
		serializer = LoginSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RefreshView(APIView):
	permission_classes = [AllowAny]

	def post(self, request: Request) -> Response:
		serializer = RefreshSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		refresh_token = request.data.get("refresh")
		if not refresh_token:
			return Response(
				{"detail": "El refresh token es obligatorio."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		try:
			token = RefreshToken(refresh_token)
			token.blacklist()
		except TokenError:
			return Response(
				{"detail": "Refresh token invalido o expirado."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request) -> Response:
		return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
