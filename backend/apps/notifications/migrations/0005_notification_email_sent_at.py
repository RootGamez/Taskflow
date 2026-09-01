from django.db import migrations, models
from django.db.models import F


def mark_existing_as_already_sent(apps, schema_editor):
    """Sella las notificaciones que ya existian.

    Sin esto, la primera vez que corra el resumen encontraria todo el
    historico con `email_sent_at` en NULL y le mandaria a cada usuario un
    correo con meses de novedades que ya vio en la campana.
    """
    Notification = apps.get_model("notifications", "Notification")
    Notification.objects.filter(email_sent_at__isnull=True).update(email_sent_at=F("created_at"))


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0004_alter_notification_notification_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="email_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            mark_existing_as_already_sent,
            # Al revertir no hay nada que deshacer: el campo se borra entero.
            migrations.RunPython.noop,
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                condition=models.Q(("email_sent_at__isnull", True)),
                fields=["recipient"],
                name="notif_pending_email_idx",
            ),
        ),
    ]
