"""Cubre `apps.notifications.emails`: a quien se le manda, que dice y que
pasa cuando el usuario apaga el switch.

Las pruebas de integracion usan `captureOnCommitCallbacks`: el encolado del
correo cuelga de `transaction.on_commit`, que dentro de un `TestCase` (todo
envuelto en una transaccion que se revierte) no correria nunca solo.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings

from apps.comments.models import Comment
from apps.notifications.emails import (
    build_notification_email,
    recipients_wanting_email,
)
from apps.notifications.models import Notification
from apps.notifications.services import notify_comment_created, notify_ticket_assigned
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.users.models import UserPreferences
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()

EMAIL_TEST_SETTINGS = {
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    # Sin worker en las pruebas: la tarea corre en el mismo proceso.
    "CELERY_TASK_ALWAYS_EAGER": True,
    "CELERY_TASK_EAGER_PROPAGATES": True,
    "NOTIFICATION_EMAILS_ENABLED": True,
    "FRONTEND_URL": "https://app.taskflow.test",
}


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


class RecipientsWantingEmailTests(TicketScenarioMixin, TestCase):
    def setUp(self) -> None:
        self.build_scenario()

    def test_user_without_preferences_row_receives_everything(self) -> None:
        """La fila de preferencias solo se crea en el primer PATCH: que no
        exista significa "quiere todo", no "no quiere nada"."""
        self.assertFalse(UserPreferences.objects.filter(user=self.assignee).exists())

        allowed = recipients_wanting_email(
            Notification.Type.TICKET_ASSIGNED, [self.assignee.id]
        )

        self.assertEqual(allowed, {self.assignee.id})

    def test_master_switch_off_silences_every_type(self) -> None:
        UserPreferences.objects.create(user=self.assignee, email_notifications=False)

        for notification_type in (
            Notification.Type.TICKET_ASSIGNED,
            Notification.Type.TICKET_MENTIONED,
            Notification.Type.TICKET_COMMENTED,
        ):
            with self.subTest(notification_type=notification_type):
                self.assertEqual(
                    recipients_wanting_email(notification_type, [self.assignee.id]), set()
                )

    def test_per_type_switch_only_silences_its_own_type(self) -> None:
        UserPreferences.objects.create(user=self.assignee, email_ticket_commented=False)

        self.assertEqual(
            recipients_wanting_email(Notification.Type.TICKET_COMMENTED, [self.assignee.id]),
            set(),
        )
        self.assertEqual(
            recipients_wanting_email(Notification.Type.TICKET_ASSIGNED, [self.assignee.id]),
            {self.assignee.id},
        )

    def test_filters_only_the_users_who_opted_out(self) -> None:
        UserPreferences.objects.create(user=self.owner, email_ticket_mentioned=False)

        allowed = recipients_wanting_email(
            Notification.Type.TICKET_MENTIONED, [self.owner.id, self.mentioned.id]
        )

        self.assertEqual(allowed, {self.mentioned.id})

    def test_type_that_does_not_travel_by_email_yields_nobody(self) -> None:
        allowed = recipients_wanting_email(
            Notification.Type.WORKSPACE_DELETED, [self.owner.id, self.assignee.id]
        )

        self.assertEqual(allowed, set())


@override_settings(**EMAIL_TEST_SETTINGS)
class NotificationEmailContentTests(TicketScenarioMixin, TestCase):
    def setUp(self) -> None:
        self.build_scenario()

    def _build(self, notification_type: str, data_extra: dict | None = None) -> object:
        notification = Notification.objects.create(
            recipient=self.assignee,
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
        return build_notification_email(notification)

    def test_assignment_email_names_the_actor_and_links_the_ticket(self) -> None:
        message = self._build(Notification.Type.TICKET_ASSIGNED)

        self.assertIn(self.ticket.title, message.subject)
        self.assertEqual(message.to, [self.assignee.email])
        html = message.alternatives[0][0]
        self.assertIn("Olivia Owner", html)
        self.assertIn(f"https://app.taskflow.test/tickets/{self.ticket.id}", html)
        self.assertIn(self.ticket.title, message.body)

    def test_mention_email_subject_leads_with_the_actor(self) -> None:
        message = self._build(Notification.Type.TICKET_MENTIONED)

        self.assertTrue(message.subject.startswith("Olivia Owner te menciono"))

    def test_email_carries_both_a_text_and_an_html_body(self) -> None:
        message = self._build(Notification.Type.TICKET_COMMENTED)

        self.assertEqual(len(message.alternatives), 1)
        self.assertEqual(message.alternatives[0][1], "text/html")
        self.assertNotIn("<table", message.body)

    def test_comment_quote_is_longer_than_the_bell_preview(self) -> None:
        """La campana recorta a 140 caracteres; el correo cita mucho mas,
        porque ahi el usuario no tiene la conversacion al lado."""
        body = "Detalle importante. " * 15  # 300 caracteres
        comment = Comment.objects.create(ticket=self.ticket, author=self.owner, body=body)

        message = self._build(
            Notification.Type.TICKET_COMMENTED,
            {"comment_id": str(comment.id), "comment_preview": body[:140]},
        )

        html = message.alternatives[0][0]
        self.assertIn(body[:280], html)

    def test_footer_links_to_the_preferences_page(self) -> None:
        message = self._build(Notification.Type.TICKET_ASSIGNED)

        self.assertIn("https://app.taskflow.test/settings/account", message.alternatives[0][0])

    def test_deactivated_recipient_gets_no_email(self) -> None:
        self.assignee.is_active = False
        self.assignee.save(update_fields=["is_active"])

        self.assertIsNone(self._build(Notification.Type.TICKET_ASSIGNED))

    def test_type_that_does_not_travel_by_email_builds_nothing(self) -> None:
        notification = Notification.objects.create(
            recipient=self.assignee,
            notification_type=Notification.Type.WORKSPACE_DELETED,
            title="Workspace borrado",
            data={"workspace_name": "Producto"},
        )

        self.assertIsNone(build_notification_email(notification))


@override_settings(**EMAIL_TEST_SETTINGS)
class NotificationEmailDeliveryTests(TicketScenarioMixin, TestCase):
    """Integra desde el disparador de dominio hasta la bandeja de salida."""

    def setUp(self) -> None:
        self.build_scenario()
        mail.outbox.clear()

    def _comment_with_mention(self) -> Comment:
        comment = Comment.objects.create(
            ticket=self.ticket, author=self.owner, body="Subamos hoy el avance"
        )
        comment.mentions.set([self.mentioned])
        return comment

    def test_comment_emails_the_mentioned_user_and_the_assignee(self) -> None:
        comment = self._comment_with_mention()

        with self.captureOnCommitCallbacks(execute=True):
            notify_comment_created(comment)

        recipients = {address for message in mail.outbox for address in message.to}
        self.assertEqual(recipients, {self.mentioned.email, self.assignee.email})

    def test_assignment_emails_the_new_assignee(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            notify_ticket_assigned(self.ticket, self.owner, [self.mentioned.id])

        self.assertEqual([message.to for message in mail.outbox], [[self.mentioned.email]])

    def test_opting_out_removes_the_email_but_keeps_the_in_app_notification(self) -> None:
        UserPreferences.objects.create(user=self.assignee, email_ticket_commented=False)
        comment = self._comment_with_mention()

        with self.captureOnCommitCallbacks(execute=True):
            notify_comment_created(comment)

        self.assertTrue(
            Notification.objects.filter(
                recipient=self.assignee, notification_type=Notification.Type.TICKET_COMMENTED
            ).exists()
        )
        recipients = {address for message in mail.outbox for address in message.to}
        self.assertEqual(recipients, {self.mentioned.email})

    @override_settings(NOTIFICATION_EMAILS_ENABLED=False)
    def test_global_kill_switch_stops_every_email(self) -> None:
        comment = self._comment_with_mention()

        with self.captureOnCommitCallbacks(execute=True):
            notify_comment_created(comment)

        self.assertEqual(mail.outbox, [])
        self.assertTrue(Notification.objects.filter(recipient=self.mentioned).exists())

    def test_a_broken_email_pipeline_does_not_break_the_notification(self) -> None:
        """El correo es un efecto secundario: si el broker o el SMTP fallan,
        la notificacion en la app tiene que quedar igual."""
        with override_settings(EMAIL_BACKEND="apps.notifications.test_emails.ExplodingBackend"):
            comment = self._comment_with_mention()
            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(comment)

        self.assertTrue(Notification.objects.filter(recipient=self.mentioned).exists())


class ExplodingBackend:
    """Backend de correo que siempre revienta, para probar el blindaje."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    def send_messages(self, email_messages):  # noqa: ARG002
        raise RuntimeError("SMTP caido")
