"""Siembra de estados por defecto del espacio.

`WorkspaceStatus` es requerido por el tablero de sprint y por el mapeo de
columnas de proyecto. Un `post_save` sobre `Workspace` garantiza que TODOS
los caminos de creacion (serializer, admin, tests, data migrations futuras)
obtengan los 3 estados por defecto, sin depender de que cada call site se
acuerde de llamar a `seed_default_workspace_statuses`.
"""

from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.workspaces.models import Workspace


@receiver(post_save, sender=Workspace, dispatch_uid="seed_workspace_statuses")
def seed_workspace_statuses_on_create(sender, instance, created, **kwargs):
    if not created:
        return
    # Import local: evita tocar apps.projects.serializers en el arranque.
    from apps.projects.serializers import seed_default_workspace_statuses

    seed_default_workspace_statuses(instance)
