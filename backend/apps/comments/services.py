"""Validación pura de comentarios y menciones (D2), sin dependencias de DRF.

Se extrae de `CommentCreateSerializer`/`CommentUpdateSerializer` para poder
testear las reglas de negocio (dedupe, límite, requisito de "@", filtrado
por membership vigente del workspace) de forma aislada, sin necesitar
montar un serializer completo con contexto de request.
"""

from __future__ import annotations

from uuid import UUID

from apps.workspaces.models import Workspace, WorkspaceMember

MAX_MENTIONS_PER_COMMENT = 20


class MentionValidationError(Exception):
    """Error de validación de negocio, independiente de DRF."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def validate_body_not_empty(body: str) -> str:
    if not body.strip():
        raise MentionValidationError("El comentario no puede estar vacío.")
    return body


def dedupe_mention_ids(mention_ids: list[UUID]) -> list[UUID]:
    return list(dict.fromkeys(mention_ids))


def validate_mention_count(mention_ids: list[UUID]) -> None:
    if len(mention_ids) > MAX_MENTIONS_PER_COMMENT:
        raise MentionValidationError(
            f"No podés mencionar a más de {MAX_MENTIONS_PER_COMMENT} personas en un comentario."
        )


def validate_mentions_require_at_symbol(body: str, mention_ids: list[UUID]) -> None:
    if mention_ids and "@" not in body:
        raise MentionValidationError(
            'El comentario debe incluir "@" para poder mencionar a alguien.'
        )


def filter_mentions_by_workspace_membership(
    workspace: Workspace, mention_ids: list[UUID]
) -> list[UUID]:
    """Descarta silenciosamente los ids que no son miembros vigentes del workspace.

    No es un error: puede ser una carrera con una expulsión del workspace
    entre que el usuario tipeó la mención y envió el comentario.
    """
    if not mention_ids:
        return []

    valid_ids = set(
        WorkspaceMember.objects.filter(workspace=workspace, user_id__in=mention_ids).values_list(
            "user_id", flat=True
        )
    )
    return [mention_id for mention_id in mention_ids if mention_id in valid_ids]


def validate_and_resolve_mentions(
    workspace: Workspace, body: str, mention_ids: list[UUID]
) -> list[UUID]:
    """Pipeline completo: dedupe -> límite -> requiere "@" -> filtra por membership."""
    deduped = dedupe_mention_ids(mention_ids)
    validate_mention_count(deduped)
    validate_mentions_require_at_symbol(body, deduped)
    return filter_mentions_by_workspace_membership(workspace, deduped)
