from __future__ import annotations

from django.db.models import Exists, OuterRef
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request

from apps.projects.models import Project
from apps.workspaces.models import Workspace, WorkspaceMember


class WorkspaceRoleAccessMixin:
	WRITABLE_ROLES = {
		WorkspaceMember.Role.OWNER,
		WorkspaceMember.Role.ADMIN,
		WorkspaceMember.Role.MEMBER,
	}

	def get_workspace_membership_for_user(
		self,
		request: Request,
		workspace_slug: str | None = None,
		workspace_id: str | None = None,
	) -> WorkspaceMember:
		filters = {"user": request.user}
		if workspace_slug is not None:
			filters["workspace__slug"] = workspace_slug
		if workspace_id is not None:
			filters["workspace_id"] = workspace_id

		membership = WorkspaceMember.objects.select_related("workspace").filter(**filters).first()
		if membership is None:
			raise NotFound("Workspace no encontrado.")
		return membership

	def get_workspace_for_user(self, request: Request, workspace_slug: str) -> Workspace:
		membership = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		return membership.workspace

	def assert_workspace_write_access(self, request: Request, workspace_slug: str) -> Workspace:
		membership = self.get_workspace_membership_for_user(request, workspace_slug=workspace_slug)
		if membership.role not in self.WRITABLE_ROLES:
			raise PermissionDenied("No tienes permisos para modificar recursos en este workspace.")
		return membership.workspace

	def get_project_for_user(self, request: Request, project_id: str) -> Project:
		# BUG que hubo aca: `.filter(workspace__memberships__user=X).exclude(
		# workspace__memberships__user=X, workspace__memberships__role=REMOVED)`
		# se ve razonable pero Django NO lo arma como "un solo row cumple
		# ambas condiciones" -- lo parte en dos EXISTS independientes
		# (uno "hay un member con role=removed", otro "hay un member con
		# user=X", sin correlacionar), asi que bloqueaba a TODO el workspace
		# apenas alguien quedaba removido, sin importar quien pedia el
		# proyecto. `Exists(OuterRef(...))` arma una subquery unica y
		# correlacionada, sin esa ambiguedad -- y usa `WorkspaceMember.objects`
		# (el manager por defecto, que ya excluye role=removed) para no
		# repetir esa condicion a mano.
		has_active_membership = WorkspaceMember.objects.filter(
			workspace_id=OuterRef("workspace_id"),
			user=request.user,
		)
		project = (
			Project.objects.select_related("workspace")
			.prefetch_related("columns")
			.filter(id=project_id)
			.filter(Exists(has_active_membership))
			.first()
		)
		if project is None:
			raise NotFound("Proyecto no encontrado.")
		return project

	def assert_project_write_access(self, request: Request, project: Project) -> None:
		membership = (
			WorkspaceMember.objects.filter(user=request.user, workspace=project.workspace)
			.only("role")
			.first()
		)
		if membership is None:
			raise NotFound("Proyecto no encontrado.")
		if membership.role not in self.WRITABLE_ROLES:
			raise PermissionDenied("No tienes permisos para modificar recursos en este workspace.")
