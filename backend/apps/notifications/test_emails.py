"""Cubre `apps.notifications.emails`: que dice cada correo y como se arma.

A quien se le manda y cuando sale se prueba aparte, en `test_delivery.py`.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from apps.comments.models import Comment
from apps.notifications.emails import (
    DIGEST_MAX_ITEMS,
    build_digest_email,
    build_notification_email,
)
from apps.notifications.models import Notification
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class TicketScenarioMixin:
    """Workspace + proyecto + ticket con tres personas dentro."""

    def build_scenario(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Olivia Owner", password="Passw0rd!123"
        )
        self.assignee = User.objects.create_user(
            email="assignee@example.com", full_name="Ana Asignada", password="Passw0rd!123"
        )
        self.mentioned = User.objects.create_user(
            email="mentioned@example.com", full_name="Mario Mencionado", password="Passw0rd!123"
        )

        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        for user in (self.owner, self.assignee, self.mentioned):
            WorkspaceMember.objects.create(
                workspace=self.workspace,
                user=user,
                role=WorkspaceMember.Role.MEMBER,
                is_active=True,
            )

        self.project = Project.objects.create(workspace=self.workspace, name="Core")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Disenar la pantalla de facturacion",
            order=1,
        )
        self.ticket.assignees.set([self.assignee])

    def build_notification(
        self,
        notification_type: str,
        data_extra: dict | None = None,
        recipient=None,
    ) -> Notification:
        return Notification.objects.create(
            recipient=recipient or self.assignee,
            actor=self.owner,
            notification_type=notification_type,
            title="Titulo",
            message="Mensaje",
            data={
                "ticket_id": str(self.ticket.id),
                "ticket_title": self.ticket.title,
                "project_id": str(self.project.id),
                "workspace_slug": self.workspace.slug,
                **(data_extra or {}),
            },
        )


@override_settings(FRONTEND_URL="https://app.taskflow.test")
class SingleNotificationEmailTests(TicketScenarioMixin, TestCase):
    def setUp(self) -> None:
        self.build_scenario()

    def test_assignment_email_names_the_actor_and_links_the_ticket(self) -> None:
        message = build_notification_email(
            self.build_notification(Notification.Type.TICKET_ASSIGNED)
        )

        self.assertIn(self.ticket.title, message.subject)
        self.assertEqual(message.to, [self.assignee.email])
        html = message.alternatives[0][0]
        self.assertIn("Olivia Owner", html)
        self.assertIn(f"https://app.taskflow.test/tickets/{self.ticket.id}", html)
        self.assertIn(self.ticket.title, message.body)

    def test_mention_email_subject_leads_with_the_actor(self) -> None:
        message = build_notification_email(
            self.build_notification(Notification.Type.TICKET_MENTIONED)
        )

        self.assertTrue(message.subject.startswith("Olivia Owner te menciono"))

    def test_email_carries_both_a_text_and_an_html_body(self) -> None:
        message = build_notification_email(
            self.build_notification(Notification.Type.TICKET_COMMENTED)
        )

        self.assertEqual(len(message.alternatives), 1)
        self.assertEqual(message.alternatives[0][1], "text/html")
        self.assertNotIn("<table", message.body)

    def test_comment_quote_is_longer_than_the_bell_preview(self) -> None:
        """La campana recorta a 140 caracteres; el correo cita mucho mas,
        porque ahi el usuario no tiene la conversacion al lado."""
        body = "Detalle importante. " * 15  # 300 caracteres
        comment = Comment.objects.create(ticket=self.ticket, author=self.owner, body=body)

        message = build_notification_email(
            self.build_notification(
                Notification.Type.TICKET_COMMENTED,
                {"comment_id": str(comment.id), "comment_preview": body[:140]},
            )
        )

        self.assertIn(body[:280], message.alternatives[0][0])

    def test_footer_links_to_the_preferences_page(self) -> None:
        message = build_notification_email(
            self.build_notification(Notification.Type.TICKET_ASSIGNED)
        )

        self.assertIn("https://app.taskflow.test/settings/account", message.alternatives[0][0])

    def test_deactivated_recipient_gets_no_email(self) -> None:
        self.assignee.is_active = False
        self.assignee.save(update_fields=["is_active"])

        self.assertIsNone(
            build_notification_email(self.build_notification(Notification.Type.TICKET_ASSIGNED))
        )

    def test_type_that_does_not_travel_by_email_builds_nothing(self) -> None:
        notification = Notification.objects.create(
            recipient=self.assignee,
            notification_type=Notification.Type.WORKSPACE_DELETED,
            title="Workspace borrado",
            data={"workspace_name": "Producto"},
        )

        self.assertIsNone(build_notification_email(notification))


@override_settings(FRONTEND_URL="https://app.taskflow.test")
class DigestEmailTests(TicketScenarioMixin, TestCase):
    def setUp(self) -> None:
        self.build_scenario()

    def test_a_single_novelty_uses_the_single_notification_format(self) -> None:
        """Con una sola novedad el formato de lista sobra: se manda la
        ficha con su boton, que es mas util."""
        notification = self.build_notification(Notification.Type.TICKET_ASSIGNED)

        message = build_digest_email(self.assignee, [notification])

        self.assertIn(self.ticket.title, message.subject)
        self.assertNotIn("novedades", message.subject)

    def test_several_novelties_travel_in_one_email(self) -> None:
        notifications = [
            self.build_notification(Notification.Type.TICKET_ASSIGNED),
            self.build_notification(Notification.Type.TICKET_MENTIONED),
            self.build_notification(Notification.Type.TICKET_COMMENTED),
        ]

        message = build_digest_email(self.assignee, notifications)

        self.assertIn("3 novedades", message.subject)
        html = message.alternatives[0][0]
        for eyebrow in ("Asignacion", "Mencion", "Comentario"):
            self.assertIn(eyebrow, html)

    def test_subject_names_the_ticket_when_all_the_novelties_share_one(self) -> None:
        notifications = [
            self.build_notification(Notification.Type.TICKET_COMMENTED),
            self.build_notification(Notification.Type.TICKET_MENTIONED),
        ]

        message = build_digest_email(self.assignee, notifications)

        self.assertIn(self.ticket.title, message.subject)

    def test_subject_stays_generic_when_the_novelties_span_tickets(self) -> None:
        notifications = [
            self.build_notification(Notification.Type.TICKET_COMMENTED),
            self.build_notification(
                Notification.Type.TICKET_MENTIONED,
                {"ticket_id": "00000000-0000-0000-0000-0000000000ff", "ticket_title": "Otro"},
            ),
        ]

        message = build_digest_email(self.assignee, notifications)

        self.assertEqual(message.subject, "2 novedades en TaskFlow")

    def test_long_digests_are_capped_and_say_how_many_are_missing(self) -> None:
        extra = 4
        notifications = [
            self.build_notification(Notification.Type.TICKET_COMMENTED)
            for _ in range(DIGEST_MAX_ITEMS + extra)
        ]

        message = build_digest_email(self.assignee, notifications)

        self.assertIn(f"{DIGEST_MAX_ITEMS + extra} novedades", message.subject)
        self.assertIn(f"+ {extra} novedades mas", message.alternatives[0][0])

    def test_digest_quotes_every_comment_it_lists(self) -> None:
        first = Comment.objects.create(
            ticket=self.ticket, author=self.owner, body="Subamos el avance hoy"
        )
        second = Comment.objects.create(
            ticket=self.ticket, author=self.owner, body="Y revisemos el contraste"
        )
        notifications = [
            self.build_notification(
                Notification.Type.TICKET_COMMENTED, {"comment_id": str(first.id)}
            ),
            self.build_notification(
                Notification.Type.TICKET_COMMENTED, {"comment_id": str(second.id)}
            ),
        ]

        html = build_digest_email(self.assignee, notifications).alternatives[0][0]

        self.assertIn("Subamos el avance hoy", html)
        self.assertIn("Y revisemos el contraste", html)

    def test_types_without_email_never_reach_the_digest(self) -> None:
        emailable = self.build_notification(Notification.Type.TICKET_COMMENTED)
        Notification.objects.create(
            recipient=self.assignee,
            notification_type=Notification.Type.WORKSPACE_DELETED,
            title="Workspace borrado",
            data={"workspace_name": "Producto"},
        )
        silent = Notification.objects.get(notification_type=Notification.Type.WORKSPACE_DELETED)

        message = build_digest_email(self.assignee, [emailable, silent])

        # Queda una sola novedad enviable, asi que vuelve al formato simple.
        self.assertIn(self.ticket.title, message.subject)
        self.assertNotIn("novedades", message.subject)

    def test_nothing_to_send_builds_nothing(self) -> None:
        self.assertIsNone(build_digest_email(self.assignee, []))
