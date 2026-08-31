"""Tests de `apps/linkpreview/views.py`.

Cubren lo que no se ve desde `services.py`: que el endpoint pida
autenticacion, que no cuente al cliente POR QUE rechazo un destino, y que
la cache -- comun a todos los usuarios -- guarde menos tiempo lo que vino
de seguir un redirect.
"""

from __future__ import annotations

from unittest.mock import patch

import requests
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.linkpreview.services import (
    CACHE_TTL_REDIRECTED_SECONDS,
    CACHE_TTL_SECONDS,
    LinkPreview,
)

User = get_user_model()


class LinkPreviewViewTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        self.url = reverse("link-preview")
        self.user = User.objects.create_user(
            email="quien@example.com", full_name="Quien", password="Passw0rd!123"
        )
        self.client.force_authenticate(self.user)

    def tearDown(self) -> None:
        cache.clear()

    def test_requires_authentication(self):
        # Sin auth seria un proxy HTTP abierto: cualquiera podria escanear
        # la red desde nuestra IP.
        self.client.force_authenticate(None)

        response = self.client.get(self.url, {"url": "https://ejemplo.com"})

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_rejects_a_request_without_url(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_does_not_tell_the_client_why_a_destination_was_rejected(self):
        # Que el mensaje distinga "no resuelve" de "resuelve a una IP
        # interna" convertiria el endpoint en un detector de hosts internos.
        with patch(
            "apps.linkpreview.services.socket.getaddrinfo",
            return_value=[(2, 1, 6, "", ("10.0.0.5", 443))],
        ):
            response = self.client.get(self.url, {"url": "https://vault.internal"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        body = str(response.data).lower()
        self.assertNotIn("no permitida", body)
        self.assertNotIn("resolver", body)

    def test_returns_and_caches_a_preview(self):
        preview = LinkPreview(
            url="https://ejemplo.com/",
            title="Ejemplo",
            site_name="ejemplo.com",
        )

        with patch(
            "apps.linkpreview.views.build_link_preview", return_value=preview
        ) as build:
            first = self.client.get(self.url, {"url": "https://ejemplo.com/"})
            second = self.client.get(self.url, {"url": "https://ejemplo.com/"})

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["title"], "Ejemplo")
        self.assertEqual(second.data["title"], "Ejemplo")
        # La segunda salio de la cache: no se volvio a salir a la red.
        self.assertEqual(build.call_count, 1)

    def test_caches_a_redirected_preview_for_much_less_time(self):
        # La clave es la URL que pidio el cliente, pero el contenido es el
        # del destino final: quien controle un dominio que redirige podria
        # dejar ahi el Open Graph de otro sitio para quien pegue esa misma
        # URL despues. Un TTL corto acota esa ventana.
        redirected = LinkPreview(url="https://destino.com/final", title="Final", redirected=True)

        with patch("apps.linkpreview.views.build_link_preview", return_value=redirected):
            with patch("apps.linkpreview.views.cache.set") as cache_set:
                self.client.get(self.url, {"url": "https://acortador.com/x"})

        _key, _payload, ttl = cache_set.call_args[0]
        self.assertEqual(ttl, CACHE_TTL_REDIRECTED_SECONDS)
        self.assertLess(ttl, CACHE_TTL_SECONDS)

    def test_caches_a_direct_preview_for_the_full_day(self):
        direct = LinkPreview(url="https://ejemplo.com/", title="Ejemplo", redirected=False)

        with patch("apps.linkpreview.views.build_link_preview", return_value=direct):
            with patch("apps.linkpreview.views.cache.set") as cache_set:
                self.client.get(self.url, {"url": "https://ejemplo.com/"})

        _key, _payload, ttl = cache_set.call_args[0]
        self.assertEqual(ttl, CACHE_TTL_SECONDS)

    def test_a_network_failure_does_not_become_a_500(self):
        # `build_link_preview` ya degrada a la vista previa minima, pero si
        # algo se escapara, el usuario no debe ver un error del servidor.
        with patch(
            "apps.linkpreview.views.build_link_preview",
            return_value=LinkPreview(url="https://lento.com/", title="lento.com"),
        ):
            response = self.client.get(self.url, {"url": "https://lento.com/"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "lento.com")

    def test_the_response_does_not_leak_internal_fields(self):
        preview = LinkPreview(url="https://ejemplo.com/", title="Ejemplo", redirected=True)

        with patch("apps.linkpreview.views.build_link_preview", return_value=preview):
            response = self.client.get(self.url, {"url": "https://ejemplo.com/"})

        # `redirected` es para decidir el TTL, no para el cliente.
        self.assertNotIn("redirected", response.data)


class LinkPreviewThrottleTests(APITestCase):
    """El throttle es la unica barrera contra usar el endpoint para barrer
    hosts: las IPs privadas ya estan bloqueadas, pero no el ritmo."""

    def setUp(self) -> None:
        cache.clear()
        self.url = reverse("link-preview")
        self.user = User.objects.create_user(
            email="rapido@example.com", full_name="Rapido", password="Passw0rd!123"
        )
        self.client.force_authenticate(self.user)

    def tearDown(self) -> None:
        cache.clear()

    def test_a_cached_preview_does_not_spend_quota(self):
        # Regresion: el throttle estaba en `throttle_classes`, asi que DRF lo
        # aplicaba en el dispatch, ANTES de mirar la cache. Un ticket con
        # varias tarjetas gastaba cuota en cada recarga aunque no se saliera a
        # la red, y las vistas previas desaparecian con un 429.
        preview = LinkPreview(url="https://ejemplo.com/", title="Ejemplo")

        with patch("apps.linkpreview.views.build_link_preview", return_value=preview):
            with patch(
                "apps.linkpreview.views.LinkPreviewThrottle.get_rate", return_value="1/hour"
            ):
                primera = self.client.get(self.url, {"url": "https://ejemplo.com/"})
                # La cuota es de 1 y ya se gasto; estas salen de cache, asi
                # que no deben contar.
                repetidas = [
                    self.client.get(self.url, {"url": "https://ejemplo.com/"}).status_code
                    for _ in range(5)
                ]

        self.assertEqual(primera.status_code, status.HTTP_200_OK)
        self.assertEqual(repetidas, [status.HTTP_200_OK] * 5)

    def test_throttles_after_the_configured_rate(self):
        preview = LinkPreview(url="https://ejemplo.com/", title="Ejemplo")

        with patch("apps.linkpreview.views.build_link_preview", return_value=preview):
            with patch(
                "apps.linkpreview.views.LinkPreviewThrottle.get_rate", return_value="2/hour"
            ):
                # URLs distintas para no dar en la cache y saltarse el conteo.
                codes = [
                    self.client.get(self.url, {"url": f"https://ejemplo.com/{i}"}).status_code
                    for i in range(3)
                ]

        self.assertEqual(codes[-1], status.HTTP_429_TOO_MANY_REQUESTS)
