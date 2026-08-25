"""Backfill de datos para `Project.key` (migracion 0003_backfill_project_key).

`backfill_project_keys` recibe la CLASE de modelo como parametro en vez de
importar `Project` directamente: la migracion le pasa el modelo historico
(`apps.get_model("projects", "Project")`, congelado en el estado de esa
migracion) y los tests le pasan el modelo real. Mismo patron que
`apps.tickets.backfill.backfill_ticket_numbers`.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from apps.projects.key_utils import derive_project_key


def backfill_project_keys(project_model: Any) -> int:
    """Asigna `key` a todos los proyectos que todavia no lo tienen.

    Idempotente: proyectos que ya tienen `key` se cuentan como "tomados"
    dentro de su workspace y nunca se tocan, asi que correr esta funcion
    dos veces seguidas no cambia nada en la segunda corrida. Dos proyectos
    del mismo workspace nunca terminan con el mismo key (desambiguacion vs
    `taken` dentro de cada grupo); proyectos de workspaces distintos pueden
    compartir el key derivado sin problema (la unicidad es por workspace).

    Devuelve la cantidad de proyectos efectivamente actualizados.
    """
    projects_by_workspace: dict[Any, list[Any]] = defaultdict(list)
    for project in project_model.objects.all().order_by("workspace_id", "created_at", "id"):
        projects_by_workspace[project.workspace_id].append(project)

    to_update: list[Any] = []
    for workspace_projects in projects_by_workspace.values():
        taken = {project.key for project in workspace_projects if project.key}
        for project in workspace_projects:
            if project.key:
                continue
            new_key = derive_project_key(project.name, taken)
            project.key = new_key
            taken.add(new_key)
            to_update.append(project)

    if to_update:
        project_model.objects.bulk_update(to_update, ["key"])

    return len(to_update)
