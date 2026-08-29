from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.goals.models import WeeklyGoalItem
from apps.goals.serializers import (
    WeeklyBoardSerializer,
    WeeklyGoalItemCreateSerializer,
    WeeklyGoalItemSerializer,
    WeeklyGoalItemUpdateSerializer,
)
from apps.goals.services import (
    apply_goal_item_update,
    create_goal_item,
    get_or_create_current_board,
)
from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.workspaces.models import WorkspaceMember

# --- RD-1 (divergencia deliberada del mixin generico) ---------------------
# `WorkspaceRoleAccessMixin.WRITABLE_ROLES` incluye MEMBER, y
# `assert_workspace_write_access` deja escribir a MEMBER. La pizarra de metas
# NO puede reusar ese helper: el pedido del usuario es que "los ADMINISTRADORES"
# publiquen las metas de la semana. Por eso se chequea el rol explicitamente
# contra {OWNER, ADMIN} aca, usando el mixin SOLO para el lookup de membership
# (`get_workspace_membership_for_user`). Marcar `is_done` si lo puede hacer
# cualquier miembro (RD-2), y eso se resuelve por-body en `WeeklyGoalItemView`.
MANAGE_ROLES = frozenset({WorkspaceMember.Role.OWNER, WorkspaceMember.Role.ADMIN})
EDITORIAL_FIELDS = frozenset({"text", "order"})


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


class _GoalsAccessMixin(WorkspaceRoleAccessMixin):
    def _membership(self, request: Request, workspace_slug: str) -> WorkspaceMember:
        # 404 (no 403) para un no-miembro: no revelamos que el espacio existe.
        return self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)

    def _assert_can_manage(self, membership: WorkspaceMember) -> None:
        if membership.role not in MANAGE_ROLES:
            raise PermissionDenied("Solo OWNER o ADMIN pueden gestionar las metas de la semana.")

    def _get_item_or_404(self, workspace, item_id: str) -> WeeklyGoalItem:
        item = (
            WeeklyGoalItem.objects.select_related("completed_by", "board")
            .filter(id=item_id, board__workspace=workspace)
            .first()
        )
        if item is None:
            raise NotFound("Meta no encontrada.")
        return item


class WeeklyBoardView(_GoalsAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, workspace_slug: str) -> Response:
        membership = self._membership(request, workspace_slug)
        board = get_or_create_current_board(membership.workspace, request.user)
        serializer = WeeklyBoardSerializer(
            board,
            context={"can_manage": membership.role in MANAGE_ROLES},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class WeeklyGoalItemListView(_GoalsAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, workspace_slug: str) -> Response:
        membership = self._membership(request, workspace_slug)
        self._assert_can_manage(membership)  # RD-1: solo OWNER/ADMIN

        board = get_or_create_current_board(membership.workspace, request.user)

        serializer = WeeklyGoalItemCreateSerializer(data=request.data)
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear la meta.")

        item = create_goal_item(board, serializer.validated_data["text"])
        return Response(WeeklyGoalItemSerializer(item).data, status=status.HTTP_201_CREATED)


class WeeklyGoalItemView(_GoalsAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, workspace_slug: str, item_id: str) -> Response:
        membership = self._membership(request, workspace_slug)

        serializer = WeeklyGoalItemUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar la meta.")
        data = serializer.validated_data

        # RD-2: `text`/`order` son editoriales -> OWNER/ADMIN. Un body que solo
        # trae `is_done` es colaborativo -> cualquier miembro (mismo permiso que
        # la lectura del board).
        if EDITORIAL_FIELDS & data.keys():
            self._assert_can_manage(membership)

        item = self._get_item_or_404(membership.workspace, item_id)
        item = apply_goal_item_update(item, data, request.user)
        return Response(WeeklyGoalItemSerializer(item).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, workspace_slug: str, item_id: str) -> Response:
        membership = self._membership(request, workspace_slug)
        self._assert_can_manage(membership)  # RD-1: solo OWNER/ADMIN

        item = self._get_item_or_404(membership.workspace, item_id)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
