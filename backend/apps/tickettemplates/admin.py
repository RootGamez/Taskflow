from django.contrib import admin

from apps.tickettemplates.models import TicketTemplate, TicketTemplateItem


class TicketTemplateItemInline(admin.TabularInline):
    model = TicketTemplateItem
    extra = 0


@admin.register(TicketTemplate)
class TicketTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "priority", "created_at")
    list_filter = ("priority",)
    search_fields = ("name",)
    inlines = [TicketTemplateItemInline]
