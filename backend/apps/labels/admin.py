from django.contrib import admin

from apps.labels.models import Label


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ("name", "color", "project", "created_at")
    list_filter = ("project",)
    search_fields = ("name", "project__name")
