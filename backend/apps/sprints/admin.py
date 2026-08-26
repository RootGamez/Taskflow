from django.contrib import admin

from apps.sprints.models import Sprint


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "status", "start_date", "end_date", "created_at")
    list_filter = ("status",)
    search_fields = ("name",)
