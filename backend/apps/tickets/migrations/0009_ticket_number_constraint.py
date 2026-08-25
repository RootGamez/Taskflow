# Separada a proposito de 0007 (esquema) y 0008 (datos): la constraint se
# agrega recien con la tabla ya backfilleada, mismo motivo que
# apps/projects/migrations/0004_project_key_constraint.py.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0008_backfill_ticket_numbers"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="ticket",
            constraint=models.UniqueConstraint(
                condition=models.Q(("number__isnull", False)),
                fields=("project", "number"),
                name="unique_ticket_number_per_project",
            ),
        ),
    ]
