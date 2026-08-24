from django.contrib import admin

from apps.workspaces.models import Workspace, WorkspaceMember


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
	list_display = ("name", "slug", "owner", "created_at")
	search_fields = ("name", "slug", "owner__email")
	readonly_fields = ("created_at",)


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
	list_display = ("workspace", "user", "role", "is_active", "created_at")
	list_filter = ("role", "is_active")
	search_fields = ("workspace__name", "user__email")
	readonly_fields = ("created_at",)
