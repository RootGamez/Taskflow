from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import ValidationError

from apps.tickets.filters import (
	TicketDateFilters,
	apply_ticket_date_filters,
	parse_ticket_date_filters,
)


class TestParseTicketDateFilters:
	def test_returns_empty_filters_when_no_query_params(self) -> None:
		filters = parse_ticket_date_filters({})

		assert filters == TicketDateFilters(
			due_after=None,
			due_before=None,
			overdue=False,
			no_due_date=False,
		)

	def test_parses_valid_due_after(self) -> None:
		filters = parse_ticket_date_filters({"due_after": "2026-01-15"})

		assert filters.due_after == datetime(2026, 1, 15, 0, 0, 0, tzinfo=dt_timezone.utc)

	def test_parses_valid_due_before(self) -> None:
		filters = parse_ticket_date_filters({"due_before": "2026-01-15"})

		assert filters.due_before == datetime(2026, 1, 15, 23, 59, 59, 999999, tzinfo=dt_timezone.utc)

	def test_due_before_expands_to_end_of_day_inclusive(self) -> None:
		filters = parse_ticket_date_filters({"due_before": "2026-03-01"})

		assert filters.due_before.hour == 23
		assert filters.due_before.minute == 59
		assert filters.due_before.second == 59
		assert filters.due_before.microsecond == 999999

	def test_rejects_malformed_due_after_date(self) -> None:
		with pytest.raises(ValidationError):
			parse_ticket_date_filters({"due_after": "not-a-date"})

	def test_rejects_malformed_due_before_date(self) -> None:
		with pytest.raises(ValidationError):
			parse_ticket_date_filters({"due_before": "2024-13-45"})

	def test_rejects_overdue_and_no_due_date_together(self) -> None:
		with pytest.raises(ValidationError):
			parse_ticket_date_filters({"overdue": "true", "no_due_date": "true"})

	def test_rejects_no_due_date_combined_with_due_before(self) -> None:
		with pytest.raises(ValidationError):
			parse_ticket_date_filters({"no_due_date": "true", "due_before": "2026-01-15"})

	def test_rejects_no_due_date_combined_with_due_after(self) -> None:
		with pytest.raises(ValidationError):
			parse_ticket_date_filters({"no_due_date": "true", "due_after": "2026-01-15"})

	def test_rejects_due_after_later_than_due_before(self) -> None:
		with pytest.raises(ValidationError):
			parse_ticket_date_filters({"due_after": "2026-02-01", "due_before": "2026-01-01"})

	def test_accepts_due_after_equal_to_due_before(self) -> None:
		filters = parse_ticket_date_filters({"due_after": "2026-01-15", "due_before": "2026-01-15"})

		assert filters.due_after is not None
		assert filters.due_before is not None

	@pytest.mark.parametrize("raw_value", ["true", "True", "1"])
	def test_accepts_truthy_overdue_values(self, raw_value: str) -> None:
		filters = parse_ticket_date_filters({"overdue": raw_value})

		assert filters.overdue is True

	@pytest.mark.parametrize("raw_value", ["false", "False", "0", "garbage"])
	def test_ignores_non_truthy_overdue_values(self, raw_value: str) -> None:
		filters = parse_ticket_date_filters({"overdue": raw_value})

		assert filters.overdue is False

	def test_overdue_absent_defaults_to_false(self) -> None:
		filters = parse_ticket_date_filters({})

		assert filters.overdue is False

	@pytest.mark.parametrize("raw_value", ["true", "True", "1"])
	def test_accepts_truthy_no_due_date_values(self, raw_value: str) -> None:
		filters = parse_ticket_date_filters({"no_due_date": raw_value})

		assert filters.no_due_date is True


class TestApplyTicketDateFilters:
	def test_returns_queryset_unchanged_when_no_filters_set(self) -> None:
		queryset = MagicMock()
		filters = TicketDateFilters(due_after=None, due_before=None, overdue=False, no_due_date=False)

		result = apply_ticket_date_filters(queryset, filters)

		queryset.filter.assert_not_called()
		assert result is queryset

	def test_applies_due_after_filter(self) -> None:
		queryset = MagicMock()
		due_after = datetime(2026, 1, 15, tzinfo=dt_timezone.utc)
		filters = TicketDateFilters(due_after=due_after, due_before=None, overdue=False, no_due_date=False)

		apply_ticket_date_filters(queryset, filters)

		queryset.filter.assert_called_once_with(due_date__gte=due_after)

	def test_applies_due_before_filter(self) -> None:
		queryset = MagicMock()
		due_before = datetime(2026, 1, 15, 23, 59, 59, 999999, tzinfo=dt_timezone.utc)
		filters = TicketDateFilters(due_after=None, due_before=due_before, overdue=False, no_due_date=False)

		apply_ticket_date_filters(queryset, filters)

		queryset.filter.assert_called_once_with(due_date__lte=due_before)

	@patch("apps.tickets.filters.timezone.now")
	def test_applies_overdue_filter(self, mock_now: MagicMock) -> None:
		now = datetime(2026, 8, 24, 12, 0, 0, tzinfo=dt_timezone.utc)
		mock_now.return_value = now
		queryset = MagicMock()
		filters = TicketDateFilters(due_after=None, due_before=None, overdue=True, no_due_date=False)

		apply_ticket_date_filters(queryset, filters)

		queryset.filter.assert_called_once_with(due_date__lt=now, due_date__isnull=False)

	def test_applies_no_due_date_filter(self) -> None:
		queryset = MagicMock()
		filters = TicketDateFilters(due_after=None, due_before=None, overdue=False, no_due_date=True)

		apply_ticket_date_filters(queryset, filters)

		queryset.filter.assert_called_once_with(due_date__isnull=True)

	def test_applies_due_after_and_due_before_together(self) -> None:
		queryset = MagicMock()
		filtered_once = queryset.filter.return_value
		due_after = datetime(2026, 1, 1, tzinfo=dt_timezone.utc)
		due_before = datetime(2026, 1, 31, 23, 59, 59, 999999, tzinfo=dt_timezone.utc)
		filters = TicketDateFilters(due_after=due_after, due_before=due_before, overdue=False, no_due_date=False)

		apply_ticket_date_filters(queryset, filters)

		queryset.filter.assert_called_once_with(due_date__gte=due_after)
		filtered_once.filter.assert_called_once_with(due_date__lte=due_before)
