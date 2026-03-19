from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
	list_display = ("email", "full_name", "is_active", "is_staff", "created_at")
	search_fields = ("email", "full_name")
	ordering = ("-created_at",)

	fieldsets = (
		(None, {"fields": ("email", "password")} ),
		("Información personal", {"fields": ("full_name", "avatar_url")} ),
		(
			"Permisos",
			{
				"fields": (
					"is_active",
					"is_staff",
					"is_superuser",
					"groups",
					"user_permissions",
				)
			},
		),
		("Fechas", {"fields": ("last_login", "created_at")} ),
	)

	add_fieldsets = (
		(
			None,
			{
				"classes": ("wide",),
				"fields": ("email", "full_name", "password1", "password2", "is_staff", "is_superuser"),
			},
		),
	)

# Register your models here.
