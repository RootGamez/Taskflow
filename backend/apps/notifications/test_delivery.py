"""Cubre `apps.notifications.delivery`: a quien le llega el correo, cuando
sale y por que no sale dos veces.

Dos formas de probar la ventana de agrupacion:

- Con `apply_async` mockeado se prueba el agrupado de verdad, porque Celery
  en modo `eager` ejecuta la tarea al instante e ignora el `countdown` --
  con eager la ventana no existiria y no habria nada que verificar.
- Con eager se prueba el camino completo, desde el disparador de dominio
  hasta la bandeja de salida.
"""

from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.comments.models import Comment
from apps.notifications.delivery import (
    DIGEST_MAX_AGE,
    schedule_digest,
    send_pending_notification_emails,
    wants_email,
)
from apps.notifications.models import Notification
from apps.notifications.services import notify_comment_created, notify_ticket_assigned
from apps.notifications.tasks import send_notification_digest_task
from apps.notifications.test_emails import TicketScenarioMixin
from apps.users.models import UserPreferences

User = get_user_model()

DELIVERY_TEST_SETTINGS = {
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
    # Sin worker en las pruebas: la tarea corre en el mismo proceso.
    "CELERY_TASK_ALWAYS_EAGER": True,
    "CELERY_TASK_EAGER_PROPAGATES": True,
    "NOTIFICATION_EMAILS_ENABLED": True,
    "NOTIFICATION_EMAIL_DIGEST_SECONDS": 300,
    "FRONTEND_URL": "https://app.taskflow.test",
    # La reserva de la ventana vive en la cache. En memoria y limpiada en
    # cada `setUp` para no arrastrar reservas de una prueba a la siguiente
    # (la cache no participa del rollback de la transaccion de prueba).
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "notifications-delivery-tests",
        }
    },
}


@override_settings(**DELIVERY_TEST_SETTINGS)
class EmailPreferenceGateTests(TicketScenarioMixin, TestCase):
    def setUp(self) -> None:
        self.build_scenario()

    def test_user_without_preferences_row_receives_everything(self) -> None:
        """La fila de preferencias solo se crea en el primer PATCH: que no
        exista significa "quiere todo", no "no quiere nada"."""
        self.assertFalse(UserPreferences.objects.filter(user=self.assignee).exists())

        self.assertTrue(wants_email(self.assignee.id, Notification.Type.TICKET_ASSIGNED))

    def test_master_switch_off_silences_every_type(self) -> None:
        UserPreferences.objects.create(user=self.assignee, email_notifications=False)

        for notification_type in (
            Notification.Type.TICKET_ASSIGNED,
            Notification.Type.TICKET_MENTIONED,
            Notification.Type.TICKET_COMMENTED,
        ):
            with self.subTest(notification_type=notification_type):
                self.assertFalse(wants_email(self.assignee.id, notification_type))

    def test_per_type_switch_only_silences_its_own_type(self) -> None:
        UserPreferences.objects.create(user=self.assignee, email_ticket_commented=False)

        self.assertFalse(wants_email(self.assignee.id, Notification.Type.TICKET_COMMENTED))
        self.assertTrue(wants_email(self.assignee.id, Notification.Type.TICKET_ASSIGNED))

    def test_the_switch_of_one_user_does_not_silence_another(self) -> None:
        UserPreferences.objects.create(user=self.owner, email_ticket_mentioned=False)

        self.assertFalse(wants_email(self.owner.id, Notification.Type.TICKET_MENTIONED))
        self.assertTrue(wants_email(self.mentioned.id, Notification.Type.TICKET_MENTIONED))

    def test_an_id_as_string_is_gated_the_same_as_a_uuid(self) -> None:
        """La tarea Celery recibe el id serializado: si el filtro se comiera
        la diferencia, el opt-out no valdria justo en el camino real."""
        UserPreferences.objects.create(user=self.assignee, email_ticket_commented=False)

        self.assertFalse(
            wants_email(str(self.assignee.id), Notification.Type.TICKET_COMMENTED)
        )

    def test_type_that_does_not_travel_by_email_is_never_wanted(self) -> None:
        self.assertFalse(wants_email(self.assignee.id, Notification.Type.WORKSPACE_DELETED))


@override_settings(**DELIVERY_TEST_SETTINGS)
class DigestWindowTests(TicketScenarioMixin, TestCase):
    """La ventana de agrupacion, con la tarea sin ejecutar."""

    def setUp(self) -> None:
        cache.clear()
        self.build_scenario()
        mail.outbox.clear()

    def _comment_from_owner(self, body: str) -> Comment:
        return Comment.objects.create(ticket=self.ticket, author=self.owner, body=body)

    def test_only_the_first_notification_of_the_burst_schedules_the_task(self) -> None:
        with patch.object(send_notification_digest_task, "apply_async") as apply_async:
            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(self._comment_from_owner("Primero"))
            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(self._comment_from_owner("Segundo"))
            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(self._comment_from_owner("Tercero"))

        # Un solo destinatario (la asignada) y una sola tarea agendada para
        # los tres comentarios.
        self.assertEqual(apply_async.call_count, 1)
        self.assertEqual(apply_async.call_args.kwargs["countdown"], 300)

    def test_the_whole_burst_travels_in_a_single_email(self) -> None:
        with patch.object(send_notification_digest_task, "apply_async"):
            for body in ("Primero", "Segundo", "Tercero"):
                with self.captureOnCommitCallbacks(execute=True):
                    notify_comment_created(self._comment_from_owner(body))

        # Se simula el vencimiento de la ventana ejecutando la tarea.
        sent = send_notification_digest_task(str(self.assignee.id))

        self.assertEqual(sent, 3)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("3 novedades", mail.outbox[0].subject)

    def test_a_second_burst_after_the_window_schedules_again(self) -> None:
        with patch.object(send_notification_digest_task, "apply_async") as apply_async:
            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(self._comment_from_owner("Primero"))
            send_notification_digest_task(str(self.assignee.id))
            apply_async.reset_mock()

            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(self._comment_from_owner("Mas tarde"))

        self.assertEqual(apply_async.call_count, 1)

    def test_a_window_that_finds_nothing_pending_sends_nothing(self) -> None:
        self.assertEqual(send_notification_digest_task(str(self.assignee.id)), 0)
        self.assertEqual(mail.outbox, [])

    def test_schedule_digest_reports_whether_it_claimed_the_window(self) -> None:
        with patch.object(send_notification_digest_task, "apply_async"):
            self.assertTrue(schedule_digest(self.assignee.id))
            self.assertFalse(schedule_digest(self.assignee.id))


@override_settings(**DELIVERY_TEST_SETTINGS)
class DigestBookkeepingTests(TicketScenarioMixin, TestCase):
    """El sello `email_sent_at`, que es lo que evita mandar dos veces."""

    def setUp(self) -> None:
        cache.clear()
        self.build_scenario()
        mail.outbox.clear()

    def _pending(self, **overrides) -> Notification:
        return self.build_notification(
            overrides.pop("notification_type", Notification.Type.TICKET_COMMENTED),
            **overrides,
        )

    def test_sending_stamps_the_notifications(self) -> None:
        notification = self._pending()

        send_pending_notification_emails(self.assignee.id)

        notification.refresh_from_db()
        self.assertIsNotNone(notification.email_sent_at)

    def test_running_the_window_twice_does_not_resend(self) -> None:
        self._pending()

        send_pending_notification_emails(self.assignee.id)
        send_pending_notification_emails(self.assignee.id)

        self.assertEqual(len(mail.outbox), 1)

    def test_opting_out_stamps_without_sending(self) -> None:
        """Se sellan igual: si no se sellaran, cada ventana volveria a
        evaluarlas para siempre."""
        UserPreferences.objects.create(user=self.assignee, email_ticket_commented=False)
        notification = self._pending()

        sent = send_pending_notification_emails(self.assignee.id)

        notification.refresh_from_db()
        self.assertEqual(sent, 0)
        self.assertEqual(mail.outbox, [])
        self.assertIsNotNone(notification.email_sent_at)

    def test_stale_notifications_are_stamped_but_not_sent(self) -> None:
        """Si el worker estuvo caido un dia, mandar ese historico es peor
        que callarse: el usuario ya lo vio en la campana."""
        notification = self._pending()
        Notification.objects.filter(id=notification.id).update(
            created_at=timezone.now() - DIGEST_MAX_AGE - timezone.timedelta(minutes=1)
        )

        sent = send_pending_notification_emails(self.assignee.id)

        notification.refresh_from_db()
        self.assertEqual(sent, 0)
        self.assertEqual(mail.outbox, [])
        self.assertIsNotNone(notification.email_sent_at)

    def test_a_failed_send_leaves_everything_pending_for_the_retry(self) -> None:
        notification = self._pending()

        with override_settings(EMAIL_BACKEND="apps.notifications.test_delivery.ExplodingBackend"):
            with self.assertRaises(RuntimeError):
                send_pending_notification_emails(self.assignee.id)

        notification.refresh_from_db()
        self.assertIsNone(notification.email_sent_at)


@override_settings(**DELIVERY_TEST_SETTINGS)
class EndToEndDeliveryTests(TicketScenarioMixin, TestCase):
    """Del disparador de dominio a la bandeja, con Celery en modo eager."""

    def setUp(self) -> None:
        cache.clear()
        self.build_scenario()
        mail.outbox.clear()

    def _comment_with_mention(self) -> Comment:
        comment = Comment.objects.create(
            ticket=self.ticket, author=self.owner, body="Subamos hoy el avance"
        )
        comment.mentions.set([self.mentioned])
        return comment

    def test_comment_emails_the_mentioned_user_and_the_assignee(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            notify_comment_created(self._comment_with_mention())

        recipients = {address for message in mail.outbox for address in message.to}
        self.assertEqual(recipients, {self.mentioned.email, self.assignee.email})

    def test_assignment_emails_the_new_assignee(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            notify_ticket_assigned(self.ticket, self.owner, [self.mentioned.id])

        self.assertEqual([message.to for message in mail.outbox], [[self.mentioned.email]])

    def test_opting_out_removes_the_email_but_keeps_the_in_app_notification(self) -> None:
        UserPreferences.objects.create(user=self.assignee, email_ticket_commented=False)

        with self.captureOnCommitCallbacks(execute=True):
            notify_comment_created(self._comment_with_mention())

        self.assertTrue(
            Notification.objects.filter(
                recipient=self.assignee, notification_type=Notification.Type.TICKET_COMMENTED
            ).exists()
        )
        recipients = {address for message in mail.outbox for address in message.to}
        self.assertEqual(recipients, {self.mentioned.email})

    @override_settings(NOTIFICATION_EMAILS_ENABLED=False)
    def test_global_kill_switch_stops_every_email(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            notify_comment_created(self._comment_with_mention())

        self.assertEqual(mail.outbox, [])
        self.assertTrue(Notification.objects.filter(recipient=self.mentioned).exists())

    def test_a_broken_email_pipeline_does_not_break_the_notification(self) -> None:
        """El correo es un efecto secundario: si el broker o el SMTP fallan,
        la notificacion en la app tiene que quedar igual."""
        with override_settings(EMAIL_BACKEND="apps.notifications.test_delivery.ExplodingBackend"):
            with self.captureOnCommitCallbacks(execute=True):
                notify_comment_created(self._comment_with_mention())

        self.assertTrue(Notification.objects.filter(recipient=self.mentioned).exists())


class ExplodingBackend:
    """Backend de correo que siempre revienta, para probar el blindaje."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    def send_messages(self, email_messages):  # noqa: ARG002
        raise RuntimeError("SMTP caido")
