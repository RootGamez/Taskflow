import uuid
from hashlib import sha256

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
	def create_user(self, email, password=None, **extra_fields):
		if not email:
			raise ValueError("El email es obligatorio")

		email = self.normalize_email(email)
		user = self.model(email=email, **extra_fields)
		user.set_password(password)
		user.save(using=self._db)
		return user

	def create_superuser(self, email, password=None, **extra_fields):
		extra_fields.setdefault("is_staff", True)
		extra_fields.setdefault("is_superuser", True)
		extra_fields.setdefault("is_active", True)

		if extra_fields.get("is_staff") is not True:
			raise ValueError("Superuser must have is_staff=True")
		if extra_fields.get("is_superuser") is not True:
			raise ValueError("Superuser must have is_superuser=True")

		return self.create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	email = models.EmailField(unique=True)
	full_name = models.CharField(max_length=255)
	avatar_url = models.URLField(blank=True)
	is_active = models.BooleanField(default=True)
	is_staff = models.BooleanField(default=False)
	created_at = models.DateTimeField(default=timezone.now)

	USERNAME_FIELD = "email"
	REQUIRED_FIELDS = ["full_name"]

	objects = UserManager()

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return self.email


class UserSession(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(
		User,
		on_delete=models.CASCADE,
		related_name="sessions",
	)
	user_agent = models.CharField(max_length=500)
	ip_address = models.CharField(max_length=45)
	last_activity = models.DateTimeField(default=timezone.now)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-last_activity"]

	def __str__(self):
		return f"{self.user.email} - {self.user_agent}"


class UserPreferences(models.Model):
	"""Preferencias de la cuenta. La fila es opcional: si no existe, valen
	los `default` de abajo (todo activado). Por eso el codigo que lee estas
	preferencias nunca debe asumir que la fila esta creada -- ver
	`apps.notifications.emails.recipients_wanting_email`, que trata la
	ausencia de fila como "quiere recibir todo".
	"""

	user = models.OneToOneField(
		User,
		on_delete=models.CASCADE,
		related_name="preferences",
	)
	# Interruptor maestro: si esta en False no sale ningun correo de
	# notificacion, sin importar los switches por tipo de mas abajo.
	email_notifications = models.BooleanField(default=True)
	push_notifications = models.BooleanField(default=True)
	# Un switch por tipo de notificacion que puede viajar por correo. El
	# nombre del campo lo mapea `apps.notifications.emails.EMAIL_PREFERENCE_FIELD`
	# contra `Notification.Type`; si agregas un tipo emailable nuevo, agrega
	# aca su campo (default=True: el usuario opta por salir, no por entrar).
	email_ticket_assigned = models.BooleanField(default=True)
	email_ticket_mentioned = models.BooleanField(default=True)
	email_ticket_commented = models.BooleanField(default=True)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name_plural = "User preferences"

	def __str__(self):
		return f"Preferences for {self.user.email}"


class EmailVerification(models.Model):
	email = models.EmailField(unique=True)
	full_name = models.CharField(max_length=255)
	code_hash = models.CharField(max_length=128)
	expires_at = models.DateTimeField()
	attempts_remaining = models.PositiveSmallIntegerField(default=5)
	consumed_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"Verification for {self.email}"

	def set_code(self, raw_code: str) -> None:
		self.code_hash = make_password(raw_code)

	def check_code(self, raw_code: str) -> bool:
		return check_password(raw_code, self.code_hash)

	def is_expired(self) -> bool:
		return timezone.now() >= self.expires_at


class PasswordResetToken(models.Model):
	user = models.ForeignKey(
		User,
		on_delete=models.CASCADE,
		related_name="password_reset_tokens",
	)
	token_hash = models.CharField(max_length=64, unique=True)
	expires_at = models.DateTimeField()
	used_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"Password reset for {self.user.email}"

	@staticmethod
	def build_token_hash(raw_token: str) -> str:
		return sha256(raw_token.encode("utf-8")).hexdigest()

	def is_expired(self) -> bool:
		return timezone.now() >= self.expires_at

	def is_active(self) -> bool:
		return self.used_at is None and not self.is_expired()
