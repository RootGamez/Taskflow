from django.contrib import admin

from apps.pages.models import Page


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ("title", "workspace", "project", "parent", "order", "updated_at")
    list_filter = ("workspace",)
    search_fields = ("title",)
    autocomplete_fields = ("workspace", "project", "parent")
