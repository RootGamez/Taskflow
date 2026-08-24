from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0002_ticket_description_progress_notes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TicketFieldLock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("field", models.CharField(max_length=64)),
                ("user_name", models.CharField(max_length=255)),
                ("expires_at", models.DateTimeField()),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "ticket",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="field_locks",
                        to="tickets.ticket",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ticket_field_locks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("ticket", "field"), name="unique_ticket_field_lock")
                ],
            },
        ),
    ]
