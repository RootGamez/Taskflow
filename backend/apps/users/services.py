from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import exceptions

from apps.users.models import EmailVerification


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
