from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from rest_framework import exceptions, serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "avatar_url",
            "is_active",
            "created_at",
        )


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={
            "required": "El correo es obligatorio.",
            "blank": "El correo es obligatorio.",
            "invalid": "Ingresa un correo valido.",
        }
    )
    full_name = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "El nombre completo es obligatorio.",
            "blank": "El nombre completo es obligatorio.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "required": "La contraseña es obligatoria.",
            "blank": "La contraseña es obligatoria.",
            "min_length": "La contraseña debe tener al menos 8 caracteres.",
        },
    )

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este email.")
        return value

    def create(self, validated_data: dict[str, Any]):
        return User.objects.create_user(**validated_data)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={
            "required": "El correo es obligatorio.",
            "blank": "El correo es obligatorio.",
            "invalid": "Ingresa un correo valido.",
        }
    )
    password = serializers.CharField(
        write_only=True,
        error_messages={
            "required": "La contraseña es obligatoria.",
            "blank": "La contraseña es obligatoria.",
        },
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, str]:
        email = attrs["email"]
        password = attrs["password"]

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise exceptions.AuthenticationFailed("Correo no registrado.")

        if not user.check_password(password):
            raise exceptions.AuthenticationFailed("Contraseña incorrecta.")

        if not user.is_active:
            raise exceptions.AuthenticationFailed("Tu cuenta esta inactiva.")

        return issue_tokens_for_user(user)


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField(
        error_messages={
            "required": "El refresh token es obligatorio.",
            "blank": "El refresh token es obligatorio.",
        }
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, str]:
        refresh_token = attrs["refresh"]

        try:
            token = RefreshToken(refresh_token)
            return {
                "access": str(token.access_token),
                "refresh": str(token),
            }
        except TokenError as exc:
            raise exceptions.AuthenticationFailed("Refresh token invalido o expirado.") from exc


def issue_tokens_for_user(user: Any) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }
