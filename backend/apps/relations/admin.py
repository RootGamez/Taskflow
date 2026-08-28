from django.contrib import admin

from apps.relations.models import TicketRelation


@admin.register(TicketRelation)
class TicketRelationAdmin(admin.ModelAdmin):
    list_display = ("id", "from_ticket", "relation_type", "to_ticket", "created_by", "created_at")
    list_filter = ("relation_type",)
    search_fields = ("from_ticket__title", "to_ticket__title")
