import uuid

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
	user = models.OneToOneField(
		User,
		on_delete=models.CASCADE,
		related_name="preferences",
	)
	email_notifications = models.BooleanField(default=True)
	push_notifications = models.BooleanField(default=True)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name_plural = "User preferences"

	def __str__(self):
		return f"Preferences for {self.user.email}"
