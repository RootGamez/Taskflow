from __future__ import annotations

from django.db import migrations

from apps.tickets.backfill import backfill_description_text


def forwards(apps, schema_editor):
    ticket_model = apps.get_model("tickets", "Ticket")
    backfill_description_text(ticket_model)


def reverse(apps, schema_editor):
    ticket_model = apps.get_model("tickets", "Ticket")
    ticket_model.objects.update(description_text="")


class Migration(migrations.Migration):

    atomic = True

    dependencies = [
        ("tickets", "0010_ticket_description_text"),
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
