from django.contrib import admin

from apps.tickets.models import Ticket, TicketFieldLock


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
	list_display = ("title", "project", "column", "priority", "order", "due_date")
	list_filter = ("priority", "column", "project")
	search_fields = ("title", "project__name")


@admin.register(TicketFieldLock)
class TicketFieldLockAdmin(admin.ModelAdmin):
	list_display = ("ticket", "field", "user", "expires_at", "updated_at")
	list_filter = ("field",)
	search_fields = ("ticket__title", "user__email", "user_name")
