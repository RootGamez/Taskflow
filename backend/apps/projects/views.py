from __future__ import annotations

from django.db import transaction
from django.db.models import F, Max
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project, ProjectColumn, WorkspaceStatus
from apps.projects.serializers import (
	ProjectColumnCreateSerializer,
	ProjectColumnSerializer,
	ProjectColumnUpdateSerializer,
	ProjectCreateSerializer,
	ProjectSerializer,
	ProjectUpdateSerializer,
	WorkspaceStatusCreateSerializer,
	WorkspaceStatusSerializer,
	WorkspaceStatusUpdateSerializer,
	seed_default_workspace_statuses,
)
from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.workspaces.models import Workspace


def _first_serializer_error(errors: dict, fallback: str) -> str:
	first_error = next(iter(errors.values()), None)
	if isinstance(first_error, list) and first_error:
		return str(first_error[0])
	return fallback


class ProjectListCreateView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, workspace_slug: str) -> Response:
		workspace = self.get_workspace_for_user(request, workspace_slug)
		projects = Project.objects.filter(workspace=workspace).prefetch_related("columns")
		serializer = ProjectSerializer(projects, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def post(self, request: Request, workspace_slug: str) -> Response:
		workspace = self.assert_workspace_write_access(request, workspace_slug)
		serializer = ProjectCreateSerializer(
			data=request.data,
			context={"workspace": workspace},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo crear el proyecto."
			raise ValidationError({"detail": message})

		project = serializer.save()
		response_serializer = ProjectSerializer(project)
		return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class ProjectDetailView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, workspace_slug: str, project_id: str) -> Response:
		workspace = self.get_workspace_for_user(request, workspace_slug)
		project = (
			Project.objects.filter(id=project_id, workspace=workspace)
			.prefetch_related("columns")
			.first()
		)   
		if project is None:
			raise NotFound("Proyecto no encontrado.")
		serializer = ProjectSerializer(project)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def patch(self, request: Request, workspace_slug: str, project_id: str) -> Response:
		workspace = self.assert_workspace_write_access(request, workspace_slug)
		project = Project.objects.filter(id=project_id, workspace=workspace).first()
		if project is None:
			raise NotFound("Proyecto no encontrado.")

		serializer = ProjectUpdateSerializer(project, data=request.data, partial=True)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar el proyecto."
			raise ValidationError({"detail": message})

		serializer.save()
		return Response(ProjectSerializer(project).data, status=status.HTTP_200_OK)

	def delete(self, request: Request, workspace_slug: str, project_id: str) -> Response:
		workspace = self.assert_workspace_write_access(request, workspace_slug)
		project = Project.objects.filter(id=project_id, workspace=workspace).first()
		if project is None:
			raise NotFound("Proyecto no encontrado.")

		project.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceStatusListCreateView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, workspace_slug: str) -> Response:
		workspace = self.get_workspace_for_user(request, workspace_slug)
		statuses = seed_default_workspace_statuses(workspace)
		return Response(WorkspaceStatusSerializer(statuses, many=True).data, status=status.HTTP_200_OK)

	def post(self, request: Request, workspace_slug: str) -> Response:
		workspace = self.assert_workspace_write_access(request, workspace_slug)
		serializer = WorkspaceStatusCreateSerializer(data=request.data, context={"workspace": workspace})
		if not serializer.is_valid():
			raise ValidationError({"detail": _first_serializer_error(serializer.errors, "No se pudo crear el estado.")})
		created = serializer.save()
		return Response(WorkspaceStatusSerializer(created).data, status=status.HTTP_201_CREATED)


class WorkspaceStatusDetailView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def patch(self, request: Request, workspace_slug: str, status_id: str) -> Response:
		workspace = self.assert_workspace_write_access(request, workspace_slug)
		instance = workspace.statuses.filter(id=status_id).first()
		if instance is None:
			raise NotFound("Estado no encontrado.")
		if instance.is_system:
			raise ValidationError({"detail": "Los estados por defecto no se pueden modificar."})

		serializer = WorkspaceStatusUpdateSerializer(instance, data=request.data, partial=True)
		if not serializer.is_valid():
			raise ValidationError({"detail": _first_serializer_error(serializer.errors, "No se pudo actualizar el estado.")})
		serializer.save()
		return Response(WorkspaceStatusSerializer(instance).data, status=status.HTTP_200_OK)

	def delete(self, request: Request, workspace_slug: str, status_id: str) -> Response:
		workspace = self.assert_workspace_write_access(request, workspace_slug)
		instance = workspace.statuses.filter(id=status_id).first()
		if instance is None:
			raise NotFound("Estado no encontrado.")
		if instance.is_system:
			raise ValidationError({"detail": "Los estados por defecto no se pueden eliminar."})

		# Al borrar un estado extra, sus columnas espejo en cada proyecto se
		# van con el (los tickets que hubiera ahi se mueven al Backlog del
		# proyecto para no perderlos).
		backlog_status = workspace.statuses.filter(is_system=True).order_by("order").first()
		with transaction.atomic():
			for column in ProjectColumn.objects.filter(workspace_status=instance).select_related("project"):
				fallback = (
					column.project.columns.filter(workspace_status=backlog_status)
					.exclude(id=column.id)
					.first()
				)
				if fallback is not None:
					next_order = fallback.ticket_set.aggregate(m=Max("order"))["m"] or 0
					for i, ticket in enumerate(column.ticket_set.order_by("order", "created_at"), start=1):
						ticket.column = fallback
						ticket.order = next_order + i
						ticket.save(update_fields=["column", "order", "updated_at"])
				column.delete()

			deleted_order = instance.order
			instance.delete()
			workspace.statuses.filter(order__gt=deleted_order).update(order=F("order") - 1)

		return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectColumnListCreateView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, project_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		serializer = ProjectColumnSerializer(project.columns.all(), many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)

	def post(self, request: Request, project_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		serializer = ProjectColumnCreateSerializer(
			data=request.data,
			context={"project": project},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo crear la columna."
			raise ValidationError({"detail": message})

		column = serializer.save()
		return Response(ProjectColumnSerializer(column).data, status=status.HTTP_201_CREATED)


class ProjectColumnDetailView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def patch(self, request: Request, project_id: str, column_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		column = project.columns.filter(id=column_id).first()
		if column is None:
			raise NotFound("Columna no encontrada.")

		serializer = ProjectColumnUpdateSerializer(column, data=request.data, partial=True)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar la columna."
			raise ValidationError({"detail": message})

		serializer.save()
		return Response(ProjectColumnSerializer(column).data, status=status.HTTP_200_OK)

	def delete(self, request: Request, project_id: str, column_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		column = project.columns.filter(id=column_id).first()
		if column is None:
			raise NotFound("Columna no encontrada.")

		total_columns = project.columns.count()
		if total_columns <= 1:
			raise ValidationError({"detail": "El proyecto debe tener al menos una columna."})

		fallback_column = project.columns.exclude(id=column.id).order_by("order", "created_at").first()
		if fallback_column is None:
			raise ValidationError({"detail": "No hay una columna destino disponible."})

		with transaction.atomic():
			next_order = fallback_column.ticket_set.aggregate(max_order=Max("order"))["max_order"] or 0
			tickets_to_move = list(column.ticket_set.order_by("order", "created_at"))
			for index, ticket in enumerate(tickets_to_move, start=1):
				ticket.column = fallback_column
				ticket.order = next_order + index
				ticket.save(update_fields=["column", "order", "updated_at"])

			deleted_order = column.order
			column.delete()
			project.columns.filter(order__gt=deleted_order).update(order=F("order") - 1)

		return Response(status=status.HTTP_204_NO_CONTENT)
