"""Cubre `/api/v1/users/me/preferences/`.

El endpoint es el que alimenta el panel de "que correos quiero recibir" del
perfil, asi que el contrato relevante es: leer sin haber guardado nunca
devuelve todo activado, y guardar un switch no pisa los demas.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import UserPreferences

User = get_user_model()

PREFERENCES_URL = "/api/v1/users/me/preferences/"


class UserPreferencesApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="pref@example.com", full_name="Preferente", password="Passw0rd!123"
        )
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "Passw0rd!123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_requires_authentication(self) -> None:
        self.client.credentials()

        self.assertEqual(self.client.get(PREFERENCES_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_defaults_to_everything_enabled(self) -> None:
        response = self.client.get(PREFERENCES_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "email_notifications": True,
                "push_notifications": True,
                "email_ticket_assigned": True,
                "email_ticket_mentioned": True,
                "email_ticket_commented": True,
            },
        )

    def test_get_does_not_create_the_row(self) -> None:
        """Un GET no debe escribir: la fila se crea recien al guardar."""
        self.client.get(PREFERENCES_URL)

        self.assertFalse(UserPreferences.objects.filter(user=self.user).exists())

    def test_patch_persists_only_the_switches_sent(self) -> None:
        response = self.client.patch(
            PREFERENCES_URL, {"email_ticket_commented": False}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        preferences = UserPreferences.objects.get(user=self.user)
        self.assertFalse(preferences.email_ticket_commented)
        self.assertTrue(preferences.email_ticket_assigned)
        self.assertTrue(preferences.email_ticket_mentioned)
        self.assertTrue(preferences.email_notifications)

    def test_get_reflects_a_previous_patch(self) -> None:
        self.client.patch(PREFERENCES_URL, {"email_ticket_mentioned": False}, format="json")

        response = self.client.get(PREFERENCES_URL)

        self.assertFalse(response.data["email_ticket_mentioned"])
        self.assertTrue(response.data["email_ticket_assigned"])

    def test_preferences_are_per_user(self) -> None:
        other = User.objects.create_user(
            email="other@example.com", full_name="Otra", password="Passw0rd!123"
        )
        UserPreferences.objects.create(user=other, email_notifications=False)

        response = self.client.get(PREFERENCES_URL)

        self.assertTrue(response.data["email_notifications"])
