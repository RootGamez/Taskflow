"""Backfill de estados del espacio (`WorkspaceStatus`) y mapeo de columnas.

1. Cada `Workspace` recibe 3 estados por defecto, espejo de
   `DEFAULT_PROJECT_COLUMNS`: "Backlog" / "En progreso" / "Hecho", con
   `is_done=True` solo en el ultimo.
2. Cada `ProjectColumn` se mapea al estado del espacio por posicion: la
   i-esima columna (ordenada por `order`) al i-esimo estado; cualquier
   columna sobrante (proyectos con mas de 3 columnas) al estado `is_done`.
   Heuristica de v1 -- corregible desde la pantalla de columnas.
"""

from __future__ import annotations

from django.db import migrations

DEFAULT_STATUSES = [
    {"name": "Backlog", "color": "#64748B", "order": 1, "is_done": False},
    {"name": "En progreso", "color": "#2563EB", "order": 2, "is_done": False},
    {"name": "Hecho", "color": "#16A34A", "order": 3, "is_done": True},
]


def seed_statuses(apps, schema_editor):
    Workspace = apps.get_model("workspaces", "Workspace")
    WorkspaceStatus = apps.get_model("projects", "WorkspaceStatus")
    ProjectColumn = apps.get_model("projects", "ProjectColumn")

    for workspace in Workspace.objects.all():
        statuses = [
            WorkspaceStatus.objects.create(workspace=workspace, **payload)
            for payload in DEFAULT_STATUSES
        ]
        done_status = statuses[-1]

        for project in workspace.projects.all():
            columns = list(project.columns.order_by("order", "created_at"))
            for index, column in enumerate(columns):
                column.workspace_status = statuses[index] if index < len(statuses) else done_status
                column.save(update_fields=["workspace_status"])


def unseed_statuses(apps, schema_editor):
    WorkspaceStatus = apps.get_model("projects", "WorkspaceStatus")
    WorkspaceStatus.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0005_workspacestatus_projectcolumn_workspace_status"),
    ]

    operations = [
        migrations.RunPython(seed_statuses, unseed_statuses),
    ]
