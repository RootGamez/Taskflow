from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AuthFlowTests(APITestCase):
	def test_register_login_me_refresh_logout_blacklist(self) -> None:
		register_payload = {
			"email": "test@example.com",
			"full_name": "Usuario Test",
			"password": "Passw0rd!123",
		}

		register_response = self.client.post("/api/v1/auth/register/", register_payload, format="json")
		self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
		self.assertIn("access", register_response.data)
		self.assertIn("refresh", register_response.data)

		self.assertTrue(User.objects.filter(email="test@example.com").exists())

		login_response = self.client.post(
			"/api/v1/auth/login/",
			{"email": register_payload["email"], "password": register_payload["password"]},
			format="json",
		)
		self.assertEqual(login_response.status_code, status.HTTP_200_OK)
		self.assertIn("access", login_response.data)
		self.assertIn("refresh", login_response.data)

		access = login_response.data["access"]
		refresh = login_response.data["refresh"]

		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
		me_response = self.client.get("/api/v1/auth/me/")
		self.assertEqual(me_response.status_code, status.HTTP_200_OK)
		self.assertEqual(me_response.data["email"], register_payload["email"])

		refresh_response = self.client.post(
			"/api/v1/auth/refresh/",
			{"refresh": refresh},
			format="json",
		)
		self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
		self.assertIn("access", refresh_response.data)

		rotated_refresh = refresh_response.data.get("refresh", refresh)

		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh_response.data['access']}")
		logout_response = self.client.post(
			"/api/v1/auth/logout/",
			{"refresh": rotated_refresh},
			format="json",
		)
		self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

		# El token en blacklist no debe poder refrescarse.
		refresh_after_logout = self.client.post(
			"/api/v1/auth/refresh/",
			{"refresh": rotated_refresh},
			format="json",
		)
		self.assertEqual(refresh_after_logout.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_login_with_unregistered_email_returns_backend_message(self) -> None:
		response = self.client.post(
			"/api/v1/auth/login/",
			{"email": "no-existe@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(str(response.data["detail"]), "Correo no registrado.")

	def test_login_with_wrong_password_returns_backend_message(self) -> None:
		User.objects.create_user(
			email="usuario@example.com",
			full_name="Usuario",
			password="Passw0rd!123",
		)

		response = self.client.post(
			"/api/v1/auth/login/",
			{"email": "usuario@example.com", "password": "Incorrecta123"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertEqual(str(response.data["detail"]), "Contraseña incorrecta.")

	def test_register_with_existing_email_returns_backend_message(self) -> None:
		User.objects.create_user(
			email="repetido@example.com",
			full_name="Usuario",
			password="Passw0rd!123",
		)

		response = self.client.post(
			"/api/v1/auth/register/",
			{
				"email": "repetido@example.com",
				"full_name": "Otro Usuario",
				"password": "Passw0rd!123",
			},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(response.data["detail"]), "Ya existe una cuenta con este email.")
