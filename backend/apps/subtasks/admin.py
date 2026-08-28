from django.contrib import admin

from apps.subtasks.models import SubTask


@admin.register(SubTask)
class SubTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "ticket", "is_done", "order", "assignee", "created_at")
    list_filter = ("is_done",)
    search_fields = ("title", "ticket__title")
