from __future__ import annotations

from django.db import migrations

from apps.tickets.backfill import backfill_ticket_numbers


def forwards(apps, schema_editor):
    ticket_model = apps.get_model("tickets", "Ticket")
    backfill_ticket_numbers(ticket_model)


def reverse(apps, schema_editor):
    ticket_model = apps.get_model("tickets", "Ticket")
    ticket_model.objects.update(number=None)


class Migration(migrations.Migration):

    atomic = True

    dependencies = [
        ("tickets", "0007_ticket_sprint_labels_number"),
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
