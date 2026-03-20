from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.workspaces.models import WorkspaceMember
from apps.workspaces.serializers import (
	WorkspaceCreateSerializer,
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
