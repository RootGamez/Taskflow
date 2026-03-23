from django.contrib import admin

from apps.projects.models import Project, ProjectColumn


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
	list_display = ("name", "workspace", "is_archived", "created_at")
	list_filter = ("is_archived", "created_at")
	search_fields = ("name", "workspace__name")


@admin.register(ProjectColumn)
class ProjectColumnAdmin(admin.ModelAdmin):
	list_display = ("name", "project", "order", "created_at")
	list_filter = ("project",)
	search_fields = ("name", "project__name")
