from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import EmailVerification, PasswordResetToken

User = get_user_model()


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthFlowTests(APITestCase):
	def test_register_verify_login_me_refresh_logout_blacklist(self) -> None:
		register_payload = {
			"email": "test@example.com",
			"full_name": "Usuario Test",
		}
		password = "Passw0rd!123"

		request_code_response = self.client.post(
			"/api/v1/auth/register/request-code/",
			register_payload,
			format="json",
		)
		self.assertEqual(request_code_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(mail.outbox), 1)
		code_match = re.search(r"\b(\d{6})\b", mail.outbox[-1].body)
		self.assertIsNotNone(code_match)
		code = code_match.group(1)

		verify_response = self.client.post(
			"/api/v1/auth/register/verify-code/",
			{
				"email": register_payload["email"],
				"code": code,
				"password": password,
			},
			format="json",
		)
		self.assertEqual(verify_response.status_code, status.HTTP_201_CREATED)
		self.assertIn("access", verify_response.data)
		self.assertIn("refresh", verify_response.data)

		self.assertTrue(User.objects.filter(email="test@example.com").exists())
		verification = EmailVerification.objects.get(email="test@example.com")
		self.assertIsNotNone(verification.consumed_at)

		login_response = self.client.post(
			"/api/v1/auth/login/",
			{"email": register_payload["email"], "password": password},
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

	def test_request_code_with_existing_email_returns_backend_message(self) -> None:
		User.objects.create_user(
			email="repetido@example.com",
			full_name="Usuario",
			password="Passw0rd!123",
		)

		response = self.client.post(
			"/api/v1/auth/register/request-code/",
			{
				"email": "repetido@example.com",
				"full_name": "Otro Usuario",
			},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(response.data["detail"]), "Ya existe una cuenta con este email.")

	def test_verify_with_invalid_code_returns_message(self) -> None:
		payload = {
			"email": "nuevo@example.com",
			"full_name": "Usuario Nuevo",
		}
		self.client.post("/api/v1/auth/register/request-code/", payload, format="json")

		response = self.client.post(
			"/api/v1/auth/register/verify-code/",
			{
				"email": payload["email"],
				"code": "000000",
				"password": "Passw0rd!123",
			},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(response.data["detail"]), "Codigo invalido.")

	def test_validate_code_is_successful_before_password_step(self) -> None:
		payload = {
			"email": "pasos@example.com",
			"full_name": "Usuario Pasos",
		}
		self.client.post("/api/v1/auth/register/request-code/", payload, format="json")
		code_match = re.search(r"\b(\d{6})\b", mail.outbox[-1].body)
		self.assertIsNotNone(code_match)

		validate_response = self.client.post(
			"/api/v1/auth/register/validate-code/",
			{
				"email": payload["email"],
				"code": code_match.group(1),
			},
			format="json",
		)
		self.assertEqual(validate_response.status_code, status.HTTP_200_OK)
		self.assertEqual(str(validate_response.data["detail"]), "Codigo validado correctamente.")

		verification = EmailVerification.objects.get(email=payload["email"])
		self.assertIsNone(verification.consumed_at)

	def test_password_reset_request_is_generic_for_registered_and_unregistered(self) -> None:
		User.objects.create_user(
			email="reset@example.com",
			full_name="Reset User",
			password="Passw0rd!123",
		)

		response_registered = self.client.post(
			"/api/v1/auth/password-reset/request/",
			{"email": "reset@example.com"},
			format="json",
		)
		self.assertEqual(response_registered.status_code, status.HTTP_200_OK)
		self.assertIn("Si el correo existe", str(response_registered.data["detail"]))
		self.assertEqual(len(mail.outbox), 1)

		response_unregistered = self.client.post(
			"/api/v1/auth/password-reset/request/",
			{"email": "unknown@example.com"},
			format="json",
		)
		self.assertEqual(response_unregistered.status_code, status.HTTP_200_OK)
		self.assertIn("Si el correo existe", str(response_unregistered.data["detail"]))
		self.assertEqual(len(mail.outbox), 1)

	def test_password_reset_confirm_changes_password_and_consumes_token(self) -> None:
		user = User.objects.create_user(
			email="recover@example.com",
			full_name="Recover User",
			password="OldPassw0rd!123",
		)

		request_response = self.client.post(
			"/api/v1/auth/password-reset/request/",
			{"email": user.email},
			format="json",
		)
		self.assertEqual(request_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(mail.outbox), 1)

		url_match = re.search(r"https?://\S+", mail.outbox[-1].body)
		self.assertIsNotNone(url_match)
		query = parse_qs(urlparse(url_match.group(0)).query)
		token = query.get("token", [None])[0]
		self.assertIsNotNone(token)

		confirm_response = self.client.post(
			"/api/v1/auth/password-reset/confirm/",
			{"token": token, "new_password": "NewPassw0rd!123"},
			format="json",
		)
		self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
		self.assertEqual(str(confirm_response.data["detail"]), "Contraseña restablecida correctamente.")

		user.refresh_from_db()
		self.assertTrue(user.check_password("NewPassw0rd!123"))

		stored_token = PasswordResetToken.objects.get(user=user)
		self.assertIsNotNone(stored_token.used_at)

		# Token de un solo uso.
		reuse_response = self.client.post(
			"/api/v1/auth/password-reset/confirm/",
			{"token": token, "new_password": "AnotherPassw0rd!123"},
			format="json",
		)
		self.assertEqual(reuse_response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(reuse_response.data["detail"]), "El enlace es invalido o ha expirado.")
