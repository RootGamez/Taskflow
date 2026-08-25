from django.contrib import admin

from apps.activities.models import Activity


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket_id", "actor", "action", "created_at")
    list_filter = ("action",)
    search_fields = ("ticket__title",)
    ordering = ("-created_at",)
