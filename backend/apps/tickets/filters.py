from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone as dt_timezone

from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.exceptions import ValidationError

TRUTHY_VALUES = {"true", "1"}


@dataclass(frozen=True)
class TicketDateFilters:
	"""Filtros de fecha ya parseados y validados para la lista de tickets."""

	due_after: datetime | None = None
	due_before: datetime | None = None
	overdue: bool = False
	no_due_date: bool = False


def _parse_boolean_flag(raw_value: str | None) -> bool:
	if raw_value is None:
		return False
	return raw_value.strip().lower() in TRUTHY_VALUES


def _parse_date_param(raw_value: str, param_name: str) -> date:
	try:
		return date.fromisoformat(raw_value)
	except (TypeError, ValueError) as exc:
		raise ValidationError(
			{"detail": f"El parametro '{param_name}' debe tener formato YYYY-MM-DD."}
		) from exc


def parse_ticket_date_filters(query_params) -> TicketDateFilters:
	"""Parsea y valida los query params de filtrado por fecha de un ticket.

	Lanza `rest_framework.exceptions.ValidationError` ante cualquier combinacion
	invalida, nunca deja escapar un ValueError sin capturar.
	"""
	raw_due_after = query_params.get("due_after")
	raw_due_before = query_params.get("due_before")
	overdue = _parse_boolean_flag(query_params.get("overdue"))
	no_due_date = _parse_boolean_flag(query_params.get("no_due_date"))

	if overdue and no_due_date:
		raise ValidationError(
			{"detail": "Los filtros 'overdue' y 'no_due_date' son mutuamente excluyentes."}
		)

	if no_due_date and (raw_due_after or raw_due_before):
		raise ValidationError(
			{"detail": "'no_due_date' no puede combinarse con 'due_after' o 'due_before'."}
		)

	due_after = None
	if raw_due_after:
		due_after_date = _parse_date_param(raw_due_after, "due_after")
		due_after = datetime.combine(due_after_date, time.min, tzinfo=dt_timezone.utc)

	due_before = None
	if raw_due_before:
		due_before_date = _parse_date_param(raw_due_before, "due_before")
		due_before = datetime.combine(due_before_date, time.max, tzinfo=dt_timezone.utc)

	if due_after is not None and due_before is not None and due_after > due_before:
		raise ValidationError({"detail": "'due_after' no puede ser posterior a 'due_before'."})

	return TicketDateFilters(
		due_after=due_after,
		due_before=due_before,
		overdue=overdue,
		no_due_date=no_due_date,
	)


def apply_ticket_date_filters(queryset: QuerySet, filters: TicketDateFilters) -> QuerySet:
	"""Aplica los filtros de fecha ya validados a un queryset de tickets.

	No modifica el ordenamiento existente del queryset.
	"""
	if filters.due_after is not None:
		queryset = queryset.filter(due_date__gte=filters.due_after)
	if filters.due_before is not None:
		queryset = queryset.filter(due_date__lte=filters.due_before)
	if filters.overdue:
		queryset = queryset.filter(due_date__lt=timezone.now(), due_date__isnull=False)
	if filters.no_due_date:
		queryset = queryset.filter(due_date__isnull=True)
	return queryset
