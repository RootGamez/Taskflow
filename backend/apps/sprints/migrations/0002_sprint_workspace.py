"""Sprint pasa de pertenecer a un proyecto a pertenecer al espacio.

- `Sprint.project` -> `Sprint.workspace` (via `project.workspace`).
- Si un workspace queda con mas de un sprint `active` (uno por proyecto en
  el modelo viejo), se conserva el mas reciente por `start_date`/`created_at`
  y el resto se degrada a `completed` para no violar el nuevo constraint
  parcial `unique_active_sprint_per_workspace`.
- La M2M `Ticket.sprints` no se toca: la PK de `Sprint` (UUID) no cambia.
"""

from __future__ import annotations

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


def set_workspace_from_project(apps, schema_editor):
    Sprint = apps.get_model("sprints", "Sprint")
    for sprint in Sprint.objects.select_related("project").all():
        sprint.workspace_id = sprint.project.workspace_id
        sprint.save(update_fields=["workspace"])


def dedupe_active_sprints(apps, schema_editor):
    Sprint = apps.get_model("sprints", "Sprint")
    seen_workspaces: set = set()
    active_sprints = Sprint.objects.filter(status="active").order_by(
        "workspace_id", "-start_date", "-created_at"
    )
    for sprint in active_sprints:
        if sprint.workspace_id in seen_workspaces:
            sprint.status = "completed"
            sprint.save(update_fields=["status"])
        else:
            seen_workspaces.add(sprint.workspace_id)


def noop_reverse(apps, schema_editor):
    # Irreversible en la practica (no guardamos el proyecto original).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("sprints", "0001_initial"),
        ("workspaces", "0004_alter_workspaceinvitation_status"),
        ("projects", "0006_seed_workspace_statuses"),
    ]

    operations = [
        migrations.AddField(
            model_name="sprint",
            name="workspace",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sprints",
                to="workspaces.workspace",
            ),
        ),
        migrations.RunPython(set_workspace_from_project, noop_reverse),
        migrations.RunPython(dedupe_active_sprints, noop_reverse),
        migrations.RemoveConstraint(
            model_name="sprint",
            name="unique_active_sprint_per_project",
        ),
        migrations.RemoveField(
            model_name="sprint",
            name="project",
        ),
        migrations.AlterField(
            model_name="sprint",
            name="workspace",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sprints",
                to="workspaces.workspace",
            ),
        ),
        migrations.AddConstraint(
            model_name="sprint",
            constraint=models.UniqueConstraint(
                condition=Q(status="active"),
                fields=("workspace",),
                name="unique_active_sprint_per_workspace",
            ),
        ),
    ]
