from django.contrib import admin

from apps.tickets.models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
	list_display = ("title", "project", "column", "priority", "order", "due_date")
	list_filter = ("priority", "column", "project")
	search_fields = ("title", "project__name")
