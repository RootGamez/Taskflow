"""FK `ticket.sprint` (un sprint) -> M2M `ticket.sprints` (varios).

Un ticket puede arrastrar de un sprint al siguiente sin perder de que sprint
salio. La migracion de datos copia el sprint actual de cada ticket a la nueva
relacion antes de borrar la columna vieja.

El M2M se agrega primero con un `related_name` temporal para no chocar con el
reverse accessor `tickets` del FK viejo mientras ambos coexisten; una vez
borrado el FK, se renombra al definitivo.
"""

from django.db import migrations, models


def copy_fk_to_m2m(apps, schema_editor):
    Ticket = apps.get_model("tickets", "Ticket")
    through = Ticket.sprints.through
    rows = [
        through(ticket_id=ticket_id, sprint_id=sprint_id)
        for ticket_id, sprint_id in Ticket.objects.filter(sprint__isnull=False).values_list(
            "id", "sprint_id"
        )
    ]
    if rows:
        through.objects.bulk_create(rows, ignore_conflicts=True)


def copy_m2m_to_fk(apps, schema_editor):
    """Reverso best-effort: el primer sprint de cada ticket vuelve al FK."""
    Ticket = apps.get_model("tickets", "Ticket")
    for ticket in Ticket.objects.prefetch_related("sprints").all():
        first = ticket.sprints.order_by("start_date", "created_at").first()
        if first is not None:
            ticket.sprint_id = first.id
            ticket.save(update_fields=["sprint"])


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0011_backfill_ticket_description_text"),
        ("sprints", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="sprints",
            field=models.ManyToManyField(
                blank=True, related_name="tickets_tmp", to="sprints.sprint"
            ),
        ),
        migrations.RunPython(copy_fk_to_m2m, copy_m2m_to_fk),
        migrations.RemoveField(model_name="ticket", name="sprint"),
        migrations.AlterField(
            model_name="ticket",
            name="sprints",
            field=models.ManyToManyField(
                blank=True, related_name="tickets", to="sprints.sprint"
            ),
        ),
    ]
