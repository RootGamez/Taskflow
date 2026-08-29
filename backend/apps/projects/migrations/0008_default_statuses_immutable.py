"""Estados por defecto inmutables + columnas espejo completas.

1. Los 3 estados por defecto de cada espacio (Backlog / En progreso /
   Completado) pasan a `is_system=True`. "Hecho" se renombra a "Completado".
   `is_done` queda: Backlog/En progreso = False, Completado = True.
2. Cada proyecto debe tener UNA columna por cada estado del espacio. Si
   falta alguna (proyectos con columnas custom, o menos de 3), se crea.
"""

from __future__ import annotations

from django.db import migrations
from django.db.models import Max

DEFAULTS = [
    ("Backlog", "#64748B", 1, False),
    ("En progreso", "#2563EB", 2, False),
    ("Completado", "#16A34A", 3, True),
]
# Nombres que, si aparecen, son el estado "Completado" por defecto.
DONE_ALIASES = {"completado", "hecho", "done", "finalizado", "listo"}


def forwards(apps, schema_editor):
    Workspace = apps.get_model("workspaces", "Workspace")
    WorkspaceStatus = apps.get_model("projects", "WorkspaceStatus")
    ProjectColumn = apps.get_model("projects", "ProjectColumn")

    for workspace in Workspace.objects.all():
        statuses = list(workspace.statuses.order_by("order", "created_at"))

        # Sin estados: sembrar los 3 por defecto.
        if not statuses:
            statuses = [
                WorkspaceStatus.objects.create(
                    workspace=workspace, name=name, color=color, order=order,
                    is_done=is_done, is_system=True,
                )
                for name, color, order, is_done in DEFAULTS
            ]
        else:
            # Marcar como sistema los primeros 3 (los sembrados por 0006) y
            # normalizar nombre/flags.
            for status, (name, color, order, is_done) in zip(statuses[:3], DEFAULTS):
                status.name = name
                status.color = color
                status.is_done = is_done
                status.is_system = True
                status.save(update_fields=["name", "color", "is_done", "is_system"])
            # Cualquier estado extra cuyo nombre sea alias de "done" se queda
            # como is_done si asi estaba; no lo tocamos.

        # Reconciliar columnas: 1 por (proyecto, estado).
        all_statuses = list(workspace.statuses.order_by("order", "created_at"))
        for project in workspace.projects.all():
            for status in all_statuses:
                if project.columns.filter(workspace_status_id=status.id).exists():
                    continue
                max_order = project.columns.aggregate(m=Max("order"))["m"] or 0
                ProjectColumn.objects.create(
                    project=project,
                    name=status.name,
                    color=status.color,
                    order=max_order + 1,
                    workspace_status=status,
                )


def backwards(apps, schema_editor):
    WorkspaceStatus = apps.get_model("projects", "WorkspaceStatus")
    WorkspaceStatus.objects.update(is_system=False)


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0007_workspace_status_is_system"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
