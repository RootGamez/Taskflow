from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.workspaces.models import WorkspaceMember
from apps.workspaces.serializers import (
	WorkspaceCreateSerializer,
	WorkspaceInvitationSerializer,
	WorkspaceMemberInviteSerializer,
	WorkspaceMemberRoleUpdateSerializer,
	WorkspaceMemberSerializer,
	WorkspaceSelectActiveSerializer,
	WorkspaceSerializer,
)


class WorkspaceListCreateView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request) -> Response:
		memberships = (
			WorkspaceMember.objects.filter(user=request.user)
			.select_related("workspace")
			.order_by("-is_active", "-created_at")
		)
		workspaces = [membership.workspace for membership in memberships]
		membership_by_workspace = {membership.workspace_id: membership for membership in memberships}

		serializer = WorkspaceSerializer(
			workspaces,
			many=True,
			context={"membership_by_workspace": membership_by_workspace},
		)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def post(self, request: Request) -> Response:
		serializer = WorkspaceCreateSerializer(data=request.data, context={"request": request})
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo crear el workspace."
			raise ValidationError({"detail": message})

		workspace = serializer.save()
		membership = WorkspaceMember.objects.get(user=request.user, workspace=workspace)
		response_serializer = WorkspaceSerializer(
			workspace,
			context={"membership_by_workspace": {workspace.id: membership}},
		)
		return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class WorkspaceSelectActiveView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		serializer = WorkspaceSelectActiveSerializer(data=request.data, context={"request": request})
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo seleccionar el workspace."
			raise ValidationError({"detail": message})

		membership = serializer.save()
		response_serializer = WorkspaceSerializer(
			membership.workspace,
			context={"membership_by_workspace": {membership.workspace_id: membership}},
		)
		return Response(response_serializer.data, status=status.HTTP_200_OK)


class WorkspaceMembersManageMixin(WorkspaceRoleAccessMixin):
	MANAGE_MEMBER_ROLES = {
		WorkspaceMember.Role.OWNER,
		WorkspaceMember.Role.ADMIN,
	}

	def assert_workspace_member_management_access(self, request: Request, workspace_slug: str):
		membership = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		if membership.role not in self.MANAGE_MEMBER_ROLES:
			raise PermissionDenied("No tienes permisos para gestionar miembros en este workspace.")
		return membership

	def get_workspace_member_or_404(self, workspace_slug: str, member_id: str) -> WorkspaceMember:
		membership = (
			WorkspaceMember.objects.select_related("workspace", "user")
			.filter(id=member_id, workspace__slug=workspace_slug)
			.first()
		)
		if membership is None:
			raise NotFound("Miembro no encontrado.")
		return membership


class WorkspaceMemberListInviteView(WorkspaceMembersManageMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, workspace_slug: str) -> Response:
		_ = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		memberships = (
			WorkspaceMember.objects.select_related("user", "workspace")
			.filter(workspace__slug=workspace_slug)
			.order_by("-created_at")
		)
		serializer = WorkspaceMemberSerializer(memberships, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def post(self, request: Request, workspace_slug: str) -> Response:
		requester_membership = self.assert_workspace_member_management_access(request, workspace_slug)
		serializer = WorkspaceMemberInviteSerializer(
			data=request.data,
			context={"workspace": requester_membership.workspace, "request": request},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo invitar al miembro."
			raise ValidationError({"detail": message})

		invitation = serializer.save()
		return Response(WorkspaceInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)


class WorkspaceMemberDetailView(WorkspaceMembersManageMixin, APIView):
	permission_classes = [IsAuthenticated]

	def patch(self, request: Request, workspace_slug: str, member_id: str) -> Response:
		requester_membership = self.assert_workspace_member_management_access(request, workspace_slug)
		target_membership = self.get_workspace_member_or_404(workspace_slug, member_id)

		if target_membership.role == WorkspaceMember.Role.OWNER:
			raise PermissionDenied("No se puede modificar el rol del owner.")

		if requester_membership.role == WorkspaceMember.Role.ADMIN and target_membership.role == WorkspaceMember.Role.ADMIN:
			raise PermissionDenied("No tienes permisos para modificar este rol.")

		serializer = WorkspaceMemberRoleUpdateSerializer(
			data=request.data,
			context={"membership": target_membership},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar el rol del miembro."
			raise ValidationError({"detail": message})

		updated_membership = serializer.save()
		return Response(WorkspaceMemberSerializer(updated_membership).data, status=status.HTTP_200_OK)
