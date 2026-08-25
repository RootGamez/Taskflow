from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.services import record_comment_created
from apps.comments.models import Comment
from apps.comments.realtime import send_comment_event
from apps.comments.serializers import CommentCreateSerializer, CommentSerializer, CommentUpdateSerializer
from apps.notifications.services import notify_comment_created
from apps.projects.models import Project
from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.workspaces.models import WorkspaceMember

logger = logging.getLogger(__name__)


def _get_ticket_or_404(project: Project, ticket_id: str):
    ticket = project.tickets.filter(id=ticket_id).first()
    if ticket is None:
        raise NotFound("Ticket no encontrado.")
    return ticket


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _record_comment_activity(comment: Comment) -> None:
    """Llama al motor de actividad de Feature B (`apps.activities`).

    Guard temporal: el stub de Fase 0 de `record_comment_created` levanta
    `NotImplementedError` (todavía no lo implementó Feature B), a pesar de
    que su propio docstring lo describe como no-op mientras tanto. Este
    try/except queda inerte en cuanto Feature B reemplace el stub por la
    implementación real (que no debería levantar `NotImplementedError`).
    """
    try:
        record_comment_created(comment)
    except NotImplementedError:
        pass


class CommentListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        ticket = _get_ticket_or_404(project, ticket_id)

        comments = (
            ticket.comments.filter(deleted_at__isnull=True)
            .select_related("author")
            .prefetch_related("mentions")
        )
        return Response(CommentSerializer(comments, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = _get_ticket_or_404(project, ticket_id)

        serializer = CommentCreateSerializer(data=request.data, context={"project": project})
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear el comentario.")

        with transaction.atomic():
            comment = Comment.objects.create(
                ticket=ticket,
                author=request.user,
                body=serializer.validated_data["body"],
            )
            comment.mentions.set(serializer.validated_data["mention_user_ids"])

            comment = (
                Comment.objects.select_related("author").prefetch_related("mentions").get(id=comment.id)
            )

        serialized_comment = CommentSerializer(comment).data

        # Fuera de la transacción y blindado a propósito: el comentario YA
        # se guardó. Actividad, notificaciones y el aviso por WebSocket son
        # efectos secundarios — un bug ahí no debe revertir ni fallar la
        # creación del comentario en sí.
        try:
            _record_comment_activity(comment)
            notify_comment_created(comment)
            send_comment_event(
                str(ticket.id),
                {
                    "type": "comment.created",
                    "comment": serialized_comment,
                    "source": str(request.user.id),
                },
            )
        except Exception:
            logger.exception("No se pudo propagar efectos del comentario %s", comment.id)

        return Response(serialized_comment, status=status.HTTP_201_CREATED)


class CommentDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, project_id: str, ticket_id: str, comment_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        ticket = _get_ticket_or_404(project, ticket_id)

        comment = (
            ticket.comments.filter(id=comment_id, deleted_at__isnull=True).select_related("author").first()
        )
        if comment is None:
            raise NotFound("Comentario no encontrado.")
        if comment.author_id != request.user.id:
            raise PermissionDenied("Solo el autor puede editar este comentario.")

        serializer = CommentUpdateSerializer(data=request.data, context={"project": project})
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar el comentario.")

        comment.body = serializer.validated_data["body"]
        comment.edited_at = timezone.now()
        comment.save(update_fields=["body", "edited_at"])
        comment.mentions.set(serializer.validated_data["mention_user_ids"])

        comment = (
            Comment.objects.select_related("author").prefetch_related("mentions").get(id=comment.id)
        )
        serialized_comment = CommentSerializer(comment).data

        try:
            send_comment_event(
                str(ticket.id),
                {
                    "type": "comment.updated",
                    "comment": serialized_comment,
                    "source": str(request.user.id),
                },
            )
        except Exception:
            logger.exception("No se pudo emitir el evento realtime del comentario %s", comment.id)

        return Response(serialized_comment, status=status.HTTP_200_OK)

    def delete(self, request: Request, project_id: str, ticket_id: str, comment_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        ticket = _get_ticket_or_404(project, ticket_id)

        comment = ticket.comments.filter(id=comment_id, deleted_at__isnull=True).first()
        if comment is None:
            raise NotFound("Comentario no encontrado.")

        membership = (
            WorkspaceMember.objects.filter(user=request.user, workspace=project.workspace)
            .only("role")
            .first()
        )
        if membership is None:
            raise NotFound("Comentario no encontrado.")

        is_author = comment.author_id == request.user.id
        is_workspace_admin = membership.role in {WorkspaceMember.Role.OWNER, WorkspaceMember.Role.ADMIN}
        if not is_author and not is_workspace_admin:
            raise PermissionDenied("No tenés permisos para eliminar este comentario.")

        comment.deleted_at = timezone.now()
        comment.save(update_fields=["deleted_at"])

        try:
            send_comment_event(
                str(ticket.id),
                {
                    "type": "comment.deleted",
                    "comment_id": str(comment.id),
                    "source": str(request.user.id),
                },
            )
        except Exception:
            logger.exception("No se pudo emitir el evento realtime de borrado del comentario %s", comment.id)

        return Response(status=status.HTTP_204_NO_CONTENT)
