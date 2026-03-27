from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.notifications.models import Notification
from apps.notifications.realtime import send_notification_event
from apps.notifications.serializers import NotificationSerializer
from apps.workspaces.models import WorkspaceInvitation, WorkspaceMember
from apps.workspaces.realtime import send_workspace_event
from apps.workspaces.serializers import (
	WorkspaceCreateSerializer,
	WorkspaceInvitationSerializer,
	WorkspaceMemberInviteSerializer,
	WorkspaceMemberRoleUpdateSerializer,
	WorkspaceMemberSerializer,
	WorkspaceSelectActiveSerializer,
	WorkspaceSerializer,
	WorkspaceUpdateSerializer,
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


class WorkspaceDetailView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	EDITABLE_ROLES = {
		WorkspaceMember.Role.OWNER,
		WorkspaceMember.Role.ADMIN,
	}

	def get(self, request: Request, workspace_slug: str) -> Response:
		membership = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		serializer = WorkspaceSerializer(
			membership.workspace,
			context={"membership_by_workspace": {membership.workspace_id: membership}},
		)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def patch(self, request: Request, workspace_slug: str) -> Response:
		membership = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		if membership.role not in self.EDITABLE_ROLES:
			raise PermissionDenied("No tienes permisos para editar este workspace.")

		serializer = WorkspaceUpdateSerializer(
			data=request.data,
			context={"workspace": membership.workspace},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar el workspace."
			raise ValidationError({"detail": message})

		workspace = serializer.save()
		response_serializer = WorkspaceSerializer(
			workspace,
			context={"membership_by_workspace": {membership.workspace_id: membership}},
		)

		send_workspace_event(
			str(workspace.id),
			"workspace.updated",
			{"workspace": response_serializer.data},
		)

		return Response(response_serializer.data, status=status.HTTP_200_OK)

	def delete(self, request: Request, workspace_slug: str) -> Response:
		membership = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		if membership.role != WorkspaceMember.Role.OWNER:
			raise PermissionDenied("Solo el owner puede eliminar el workspace.")

		workspace = membership.workspace
		
		# Obtener todos los miembros del workspace
		members = WorkspaceMember.objects.filter(workspace=workspace).select_related("user")
		
		# Crear notificaciones para cada miembro (excepto quién la eliminó)
		for member in members:
			if member.user_id != request.user.id:
				notification = Notification.objects.create(
					recipient=member.user,
					actor=request.user,
					notification_type=Notification.Type.WORKSPACE_DELETED,
					title=f"Workspace eliminado: {workspace.name}",
					message=f"{request.user.full_name} eliminó el workspace {workspace.name}",
					data={
						"workspace_id": str(workspace.id),
						"workspace_name": workspace.name,
					},
				)
				# Enviar evento en tiempo real
				send_notification_event(
					str(member.user.id),
					{
						"type": "notification.created",
						"notification": NotificationSerializer(notification).data,
					},
				)
		
		send_workspace_event(
			str(workspace.id),
			"workspace.deleted",
			{
				"workspace_id": str(workspace.id),
				"workspace_slug": workspace.slug,
				"workspace_name": workspace.name,
				"deleted_by": str(request.user.id),
			},
		)
		workspace.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


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
		send_workspace_event(
			str(updated_membership.workspace_id),
			"member.updated",
			{"member": WorkspaceMemberSerializer(updated_membership).data},
		)
		return Response(WorkspaceMemberSerializer(updated_membership).data, status=status.HTTP_200_OK)


class WorkspaceInvitationListCancelView(WorkspaceMembersManageMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, workspace_slug: str) -> Response:
		workspace_membership = self.assert_workspace_member_management_access(request, workspace_slug)
		now = timezone.now()
		WorkspaceInvitation.objects.filter(
			workspace=workspace_membership.workspace,
			status=WorkspaceInvitation.Status.PENDING,
			expires_at__lte=now,
		).update(status=WorkspaceInvitation.Status.EXPIRED, responded_at=now)

		invitations = (
			WorkspaceInvitation.objects.select_related("invited_user", "invited_by")
			.filter(
				workspace=workspace_membership.workspace,
				status=WorkspaceInvitation.Status.PENDING,
				expires_at__gt=now,
			)
			.order_by("-created_at")
		)
		return Response(WorkspaceInvitationSerializer(invitations, many=True).data, status=status.HTTP_200_OK)

	def delete(self, request: Request, workspace_slug: str, invitation_id: str) -> Response:
		workspace_membership = self.assert_workspace_member_management_access(request, workspace_slug)
		invitation = (
			WorkspaceInvitation.objects.select_related("notification")
			.filter(id=invitation_id, workspace=workspace_membership.workspace)
			.first()
		)
		if invitation is None:
			raise NotFound("Invitacion no encontrada.")

		now = timezone.now()
		if invitation.status != WorkspaceInvitation.Status.PENDING or invitation.expires_at <= now:
			if invitation.status == WorkspaceInvitation.Status.PENDING and invitation.expires_at <= now:
				invitation.status = WorkspaceInvitation.Status.EXPIRED
				invitation.responded_at = now
				invitation.save(update_fields=["status", "responded_at"])
			raise ValidationError({"detail": "La invitacion ya no esta pendiente."})

		invitation.status = WorkspaceInvitation.Status.CANCELLED
		invitation.responded_at = now
		invitation.save(update_fields=["status", "responded_at"])

		notification = getattr(invitation, "notification", None)
		if notification is not None:
			notification.data = {
				**notification.data,
				"invitation_status": WorkspaceInvitation.Status.CANCELLED,
			}
			notification.title = f"Invitacion cancelada en workspace {invitation.workspace.name}"
			notification.message = f"La invitacion a \"{invitation.workspace.name}\" fue cancelada."
			notification.is_read = True
			notification.read_at = now
			notification.save(update_fields=["data", "title", "message", "is_read", "read_at"])
			send_notification_event(
				str(invitation.invited_user_id),
				{
					"type": "notification.updated",
					"notification": NotificationSerializer(notification).data,
				},
			)

		send_workspace_event(
			str(invitation.workspace_id),
			"invitation.updated",
			{"invitation": WorkspaceInvitationSerializer(invitation).data},
		)

		return Response(WorkspaceInvitationSerializer(invitation).data, status=status.HTTP_200_OK)
