"""Endpoint de vista previa de enlaces.

GET /api/v1/link-preview/?url=https://ejemplo.com

Requiere autenticacion: sin ella seria un proxy HTTP abierto que
cualquiera podria usar para escanear desde nuestra IP.
"""

from __future__ import annotations

import hashlib

from django.core.cache import cache
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.linkpreview.services import (
    CACHE_TTL_REDIRECTED_SECONDS,
    CACHE_TTL_SECONDS,
    UnsafeUrlError,
    build_link_preview,
)


class LinkPreviewThrottle(UserRateThrottle):
    """Limite propio: cada peticion abre una conexion saliente.

    Sin esto, un cliente podria usar el endpoint para barrer hosts a
    ritmo libre, aunque las IPs privadas ya esten bloqueadas.
    """

    scope = "link_preview"


class LinkPreviewView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [LinkPreviewThrottle]

    def get(self, request: Request) -> Response:
        url = request.query_params.get("url", "").strip()
        if not url:
            raise ValidationError({"detail": "Falta el parametro 'url'."})

        # La clave va hasheada: una URL puede superar el limite de longitud
        # de clave de memcached y traer caracteres que Redis no admite.
        cache_key = f"linkpreview:{hashlib.sha256(url.encode()).hexdigest()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        try:
            preview = build_link_preview(url)
        except UnsafeUrlError as exc:
            # `public_message`, no `str(exc)`: el detalle distingue "no
            # resuelve" de "resuelve a una IP interna", y eso le diria a
            # cualquiera que hosts existen dentro de la red.
            raise ValidationError({"detail": exc.public_message}) from exc

        payload = preview.as_dict()
        ttl = CACHE_TTL_REDIRECTED_SECONDS if preview.redirected else CACHE_TTL_SECONDS
        cache.set(cache_key, payload, ttl)
        return Response(payload, status=status.HTTP_200_OK)
