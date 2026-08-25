from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.comments.services import (
    MAX_MENTIONS_PER_COMMENT,
    MentionValidationError,
    dedupe_mention_ids,
    filter_mentions_by_workspace_membership,
    validate_and_resolve_mentions,
    validate_body_not_empty,
    validate_mention_count,
    validate_mentions_require_at_symbol,
)
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class ValidateBodyNotEmptyTests(TestCase):
    def test_returns_body_when_it_has_content(self) -> None:
        self.assertEqual(validate_body_not_empty("Hola equipo"), "Hola equipo")

    def test_raises_when_body_is_empty_string(self) -> None:
        with self.assertRaises(MentionValidationError):
            validate_body_not_empty("")

    def test_raises_when_body_is_only_whitespace(self) -> None:
        with self.assertRaises(MentionValidationError):
            validate_body_not_empty("   \n\t  ")


class DedupeMentionIdsTests(TestCase):
    def test_removes_duplicates_preserving_order(self) -> None:
        a, b = uuid.uuid4(), uuid.uuid4()
        self.assertEqual(dedupe_mention_ids([a, b, a]), [a, b])

    def test_empty_list_stays_empty(self) -> None:
        self.assertEqual(dedupe_mention_ids([]), [])


class ValidateMentionCountTests(TestCase):
    def test_allows_exactly_the_max(self) -> None:
        ids = [uuid.uuid4() for _ in range(MAX_MENTIONS_PER_COMMENT)]
        validate_mention_count(ids)  # no debe levantar

    def test_raises_when_over_the_max(self) -> None:
        ids = [uuid.uuid4() for _ in range(MAX_MENTIONS_PER_COMMENT + 1)]
        with self.assertRaises(MentionValidationError):
            validate_mention_count(ids)


class ValidateMentionsRequireAtSymbolTests(TestCase):
    def test_passes_when_no_mentions(self) -> None:
        validate_mentions_require_at_symbol("sin menciones", [])  # no debe levantar

    def test_passes_when_mentions_and_at_symbol_present(self) -> None:
        validate_mentions_require_at_symbol("hola @Ana", [uuid.uuid4()])  # no debe levantar

    def test_raises_when_mentions_but_no_at_symbol(self) -> None:
        with self.assertRaises(MentionValidationError):
            validate_mentions_require_at_symbol("hola Ana sin arroba", [uuid.uuid4()])


class FilterMentionsByWorkspaceMembershipTests(TestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        self.member = User.objects.create_user(
            email="member@example.com", full_name="Member", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.member, role=WorkspaceMember.Role.MEMBER, is_active=True
        )
        self.outsider = User.objects.create_user(
            email="outsider@example.com", full_name="Outsider", password="Passw0rd!123"
        )

    def test_returns_empty_list_when_no_mention_ids(self) -> None:
        self.assertEqual(filter_mentions_by_workspace_membership(self.workspace, []), [])

    def test_keeps_only_current_workspace_members(self) -> None:
        result = filter_mentions_by_workspace_membership(
            self.workspace, [self.member.id, self.outsider.id]
        )
        self.assertEqual(result, [self.member.id])

    def test_discards_ids_that_are_not_members_silently(self) -> None:
        result = filter_mentions_by_workspace_membership(self.workspace, [self.outsider.id])
        self.assertEqual(result, [])


class ValidateAndResolveMentionsTests(TestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        self.member = User.objects.create_user(
            email="member@example.com", full_name="Member", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.member, role=WorkspaceMember.Role.MEMBER, is_active=True
        )

    def test_full_pipeline_returns_deduped_and_filtered_ids(self) -> None:
        result = validate_and_resolve_mentions(
            self.workspace, f"hola @{self.member.full_name}", [self.member.id, self.member.id]
        )
        self.assertEqual(result, [self.member.id])

    def test_raises_when_over_the_max_before_hitting_the_database(self) -> None:
        ids = [uuid.uuid4() for _ in range(MAX_MENTIONS_PER_COMMENT + 1)]
        with self.assertRaises(MentionValidationError):
            validate_and_resolve_mentions(self.workspace, "@todos " * (MAX_MENTIONS_PER_COMMENT + 1), ids)

    def test_raises_when_mentions_present_but_body_has_no_at_symbol(self) -> None:
        with self.assertRaises(MentionValidationError):
            validate_and_resolve_mentions(self.workspace, "hola sin arroba", [self.member.id])

    def test_no_mentions_and_no_at_symbol_is_valid(self) -> None:
        self.assertEqual(validate_and_resolve_mentions(self.workspace, "comentario normal", []), [])
