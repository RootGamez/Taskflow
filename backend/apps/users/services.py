from __future__ import annotations

import secrets
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import EmailMultiAlternatives, send_mail
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import exceptions

from apps.users.models import EmailVerification, PasswordResetToken, User


def generate_verification_code(length: int = 6) -> str:
    upper_bound = 10 ** length
    return str(secrets.randbelow(upper_bound)).zfill(length)


def create_or_refresh_email_verification(email: str, full_name: str) -> str:
    code = generate_verification_code()

    expires_at = timezone.now() + timezone.timedelta(
        minutes=settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES
    )

    EmailVerification.objects.update_or_create(
        email=email,
        defaults={
            "full_name": full_name,
            "code_hash": make_password(code),
            "expires_at": expires_at,
            "attempts_remaining": settings.EMAIL_VERIFICATION_MAX_ATTEMPTS,
            "consumed_at": None,
        },
    )

    return code


def send_verification_email(email: str, code: str) -> None:
    subject = "Codigo de verificacion - TaskFlow"
    message = (
        "Tu codigo de verificacion es: "
        f"{code}\n\n"
        f"Este codigo expira en {settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES} minutos."
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        raise exceptions.APIException("No se pudo enviar el correo de verificacion.") from exc


def create_password_reset_token(user: User) -> str:
    raw_token = secrets.token_urlsafe(48)
    token_hash = PasswordResetToken.build_token_hash(raw_token)
    expires_at = timezone.now() + timezone.timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_TTL_MINUTES
    )

    # Revoca tokens anteriores activos para minimizar superficie de ataque.
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())

    PasswordResetToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    return raw_token


def build_password_reset_link(raw_token: str) -> str:
    encoded_token = quote(raw_token, safe="")
    return f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={encoded_token}"


def send_password_reset_email(email: str, reset_link: str) -> None:
    from datetime import datetime

    subject = "Recuperación de contraseña - TaskFlow"

    # Context para los templates
    context = {
        "reset_link": reset_link,
        "token_ttl_minutes": settings.PASSWORD_RESET_TOKEN_TTL_MINUTES,
        "frontend_url": settings.FRONTEND_URL.rstrip("/"),
        "current_year": datetime.now().year,
    }

    # Renderizar plantillas
    text_message = render_to_string("emails/password_reset.txt", context)
    html_message = render_to_string("emails/password_reset.html", context)

    try:
        # EmailMultiAlternatives permite enviar tanto texto como HTML
        email_message = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        email_message.attach_alternative(html_message, "text/html")
        email_message.send(fail_silently=False)
    except Exception as exc:
        raise exceptions.APIException("No se pudo enviar el correo de recuperación.") from exc


def consume_password_reset_token(raw_token: str) -> PasswordResetToken | None:
    token_hash = PasswordResetToken.build_token_hash(raw_token)

    with transaction.atomic():
        reset_token = PasswordResetToken.objects.select_for_update().select_related("user").filter(
            token_hash=token_hash
        ).first()

        if reset_token is None:
            return None

        if not reset_token.is_active():
            return None

        reset_token.used_at = timezone.now()
        reset_token.save(update_fields=["used_at"])

    return reset_token
