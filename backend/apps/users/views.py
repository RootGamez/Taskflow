from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
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
	UserUpdateSerializer,
	ChangePasswordSerializer,
	UserSessionSerializer,
	UserPreferencesSerializer,
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

	def patch(self, request: Request) -> Response:
		serializer = UserUpdateSerializer(
			request.user,
			data=request.data,
			partial=True,
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar el perfil."
			raise ValidationError({"detail": message})

		serializer.save()
		return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		serializer = ChangePasswordSerializer(
			data=request.data,
			context={"request": request},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo cambiar la contraseña."
			raise ValidationError({"detail": message})

		request.user.set_password(serializer.validated_data["new_password"])
		request.user.save()
		
		# Retornar nuevos tokens
		return Response(issue_tokens_for_user(request.user), status=status.HTTP_200_OK)


class UserSessionListView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request) -> Response:
		from apps.users.models import UserSession
		sessions = UserSession.objects.filter(user=request.user)
		
		data = []
		for session in sessions:
			session_data = {
				"id": str(session.id),
				"user_agent": session.user_agent,
				"ip_address": session.ip_address,
				"last_activity": session.last_activity.isoformat(),
				"created_at": session.created_at.isoformat(),
				"is_current": False,  # Simplificado
			}
			data.append(session_data)
		
		return Response(data, status=status.HTTP_200_OK)


class UserSessionDetailView(APIView):
	permission_classes = [IsAuthenticated]

	def delete(self, request: Request, session_id: str) -> Response:
		from apps.users.models import UserSession
		
		try:
			session = UserSession.objects.get(id=session_id, user=request.user)
			session.delete()
			return Response(status=status.HTTP_204_NO_CONTENT)
		except UserSession.DoesNotExist:
			raise NotFound("Sesión no encontrada.")


class UserSessionRevokeOthersView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		from apps.users.models import UserSession

		# Sin identificador de sesión actual, se revocan todas las sesiones registradas.
		UserSession.objects.filter(user=request.user).delete()
		
		return Response(status=status.HTTP_204_NO_CONTENT)


class UserPreferencesView(APIView):
	permission_classes = [IsAuthenticated]

	def patch(self, request: Request) -> Response:
		from apps.users.models import UserPreferences
		
		preferences, created = UserPreferences.objects.get_or_create(user=request.user)
		
		serializer = UserPreferencesSerializer(
			preferences,
			data=request.data,
			partial=True,
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar preferencias."
			raise ValidationError({"detail": message})

		serializer.save()
		return Response(serializer.data, status=status.HTTP_200_OK)


class UserDeactivateView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		request.user.is_active = False
		request.user.save()
		
		# Retornar una respuesta vacía
		return Response(status=status.HTTP_204_NO_CONTENT)
