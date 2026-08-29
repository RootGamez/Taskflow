from __future__ import annotations

from django.db import transaction
from django.db.models import F, Max
from rest_framework import serializers

from apps.projects.key_utils import derive_project_key
from apps.projects.models import Project, ProjectColumn, WorkspaceStatus

PROJECT_KEY_REGEX = r"^[A-Za-z][A-Za-z0-9]{0,9}$"
PROJECT_KEY_ERROR_MESSAGES = {
    "invalid": "El identificador debe empezar con una letra y tener hasta 10 caracteres alfanumericos.",
}

DEFAULT_PROJECT_COLUMNS = [
    {"name": "Backlog", "color": "#64748B", "order": 1},
    {"name": "En progreso", "color": "#2563EB", "order": 2},
    {"name": "Hecho", "color": "#16A34A", "order": 3},
]

# Paso T-4 (opcional, D23 de docs/PHASE_4_PLAN.md): en vez de un modelo
# `ProjectTemplate` nuevo (segunda superficie CRUD completa para cubrir un
# caso que se resuelve con un array), `ProjectCreateSerializer` acepta un
# `columns` opcional. Mismo tope de "cuantas columnas puede tener un
# proyecto" que ya usa la UI de columnas (`ProjectColumnCreateSerializer` no
# declara limite propio porque hoy solo se agregan de a una).
MAX_PROJECT_CREATE_COLUMNS = 12
DEFAULT_COLUMN_COLOR = "#64748B"

# Los 3 estados por defecto de todo espacio. Son `is_system=True`:
# siempre existen, no se renombran ni se eliminan. "Completado" es el
# unico `is_done`. La gente puede crear estados EXTRA (is_system=False).
DEFAULT_WORKSPACE_STATUSES = [
    {"name": "Backlog", "color": "#64748B", "order": 1, "is_done": False, "is_system": True},
    {"name": "En progreso", "color": "#2563EB", "order": 2, "is_done": False, "is_system": True},
    {"name": "Completado", "color": "#16A34A", "order": 3, "is_done": True, "is_system": True},
]


class WorkspaceStatusSerializer(serializers.ModelSerializer):
    workspace_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = WorkspaceStatus
        fields = ("id", "workspace_id", "name", "color", "order", "is_done", "is_system", "created_at")


class WorkspaceStatusCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=120,
        error_messages={
            "required": "El nombre del estado es obligatorio.",
            "blank": "El nombre del estado es obligatorio.",
        },
    )
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )
    is_done = serializers.BooleanField(required=False)

    def create(self, validated_data: dict) -> WorkspaceStatus:
        workspace = self.context["workspace"]
        with transaction.atomic():
            max_order = workspace.statuses.aggregate(max_order=Max("order"))["max_order"] or 0
            status = WorkspaceStatus.objects.create(
                workspace=workspace,
                name=validated_data["name"],
                color=validated_data.get("color", DEFAULT_COLUMN_COLOR),
                is_done=validated_data.get("is_done", False),
                order=max_order + 1,
            )
            # Cada estado del espacio se refleja como una columna en TODOS
            # los proyectos: la gente no elige el mapeo, es automatico.
            sync_status_to_project_columns(status)
        return status


class WorkspaceStatusUpdateSerializer(serializers.ModelSerializer):
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )
    order = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        model = WorkspaceStatus
        fields = ("name", "color", "order", "is_done")

    def update(self, instance: WorkspaceStatus, validated_data: dict) -> WorkspaceStatus:
        requested_order = validated_data.pop("order", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        with transaction.atomic():
            if requested_order is not None:
                siblings = instance.workspace.statuses.exclude(id=instance.id)
                max_order = siblings.aggregate(max_order=Max("order"))["max_order"] or 0
                target_order = max(1, min(requested_order, max_order + 1))

                if target_order > instance.order:
                    siblings.filter(order__gt=instance.order, order__lte=target_order).update(order=F("order") - 1)
                elif target_order < instance.order:
                    siblings.filter(order__gte=target_order, order__lt=instance.order).update(order=F("order") + 1)

                instance.order = target_order

            instance.save()
            # Mantener el nombre de la columna espejo alineado.
            if "name" in validated_data:
                instance.project_columns.update(name=instance.name)

        return instance


def sync_status_to_project_columns(status: WorkspaceStatus) -> None:
    """Garantiza que cada proyecto del espacio tenga UNA columna mapeada a
    `status`. No toca proyectos que ya la tengan (idempotente)."""
    for project in status.workspace.projects.all():
        if project.columns.filter(workspace_status=status).exists():
            continue
        max_order = project.columns.aggregate(m=Max("order"))["m"] or 0
        ProjectColumn.objects.create(
            project=project,
            name=status.name,
            color=status.color,
            order=max_order + 1,
            workspace_status=status,
        )


def project_columns_for_statuses(project, statuses: list[WorkspaceStatus]) -> list[ProjectColumn]:
    """Crea las columnas de un proyecto NUEVO: una por cada estado del
    espacio, en el mismo orden."""
    return ProjectColumn.objects.bulk_create(
        [
            ProjectColumn(
                project=project,
                name=status.name,
                color=status.color,
                order=index,
                workspace_status=status,
            )
            for index, status in enumerate(statuses, start=1)
        ]
    )


def seed_default_workspace_statuses(workspace) -> list[WorkspaceStatus]:
    """Crea los 3 `WorkspaceStatus` por defecto de un workspace y los
    devuelve ordenados por `order`. Idempotente: si el workspace ya tiene
    estados, no crea nada y devuelve los existentes.
    """
    existing = list(workspace.statuses.order_by("order", "created_at"))
    if existing:
        return existing
    return [
        WorkspaceStatus.objects.create(workspace=workspace, **payload)
        for payload in DEFAULT_WORKSPACE_STATUSES
    ]


class ProjectColumnSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(read_only=True)
    workspace_status_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = ProjectColumn
        fields = ("id", "project_id", "workspace_status_id", "name", "color", "order", "created_at")


class ProjectSerializer(serializers.ModelSerializer):
    workspace_id = serializers.UUIDField(read_only=True)
    columns = ProjectColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "workspace_id",
            "name",
            "key",
            "description",
            "color",
            "is_archived",
            "created_at",
            "updated_at",
            "columns",
        )


class ProjectColumnInputSerializer(serializers.Serializer):
    """Forma de cada entrada de `ProjectCreateSerializer.columns` (T-4,
    D23). Deliberadamente separado de `ProjectColumnCreateSerializer`
    (que crea una columna sobre un proyecto YA existente, con `order`
    reordenable): aca `order` no se acepta -- las columnas de un proyecto
    nuevo se numeran por su posicion en la lista, igual que
    `DEFAULT_PROJECT_COLUMNS`.
    """

    name = serializers.CharField(
        max_length=120,
        error_messages={
            "required": "El nombre de la columna es obligatorio.",
            "blank": "El nombre de la columna es obligatorio.",
        },
    )
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El nombre de la columna es obligatorio.")
        return stripped


class ProjectCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "El nombre del proyecto es obligatorio.",
            "blank": "El nombre del proyecto es obligatorio.",
        },
    )
    description = serializers.CharField(required=False, allow_blank=True)
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )
    key = serializers.RegexField(
        regex=PROJECT_KEY_REGEX,
        required=False,
        error_messages=PROJECT_KEY_ERROR_MESSAGES,
    )

    def validate_key(self, value: str) -> str:
        return value.upper()

    def create(self, validated_data: dict) -> Project:
        workspace = self.context["workspace"]
        requested_key = validated_data.get("key")

        with transaction.atomic():
            # Bloqueo implicito de lecturas repetibles dentro de la
            # transaccion: se calcula `taken_keys` aca adentro (no antes en
            # `validate_key`) para que la derivacion/validacion de unicidad
            # vea el estado mas reciente posible antes del INSERT.
            taken_keys = set(
                Project.objects.filter(workspace=workspace, key__isnull=False).values_list("key", flat=True)
            )

            if requested_key:
                if requested_key in taken_keys:
                    raise serializers.ValidationError(
                        {"key": "Ese identificador ya esta en uso en este workspace."}
                    )
                key = requested_key
            else:
                key = derive_project_key(validated_data["name"], taken_keys)

            project = Project.objects.create(
                workspace=workspace,
                name=validated_data["name"],
                description=validated_data.get("description", ""),
                color=validated_data.get("color", "#2563EB"),
                key=key,
            )
            # Las columnas del proyecto son SIEMPRE espejo de los estados del
            # espacio (una por estado, mismo orden). La gente no las elige.
            statuses = seed_default_workspace_statuses(workspace)
            project_columns_for_statuses(project, statuses)

        return project


class ProjectUpdateSerializer(serializers.ModelSerializer):
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )
    key = serializers.RegexField(
        regex=PROJECT_KEY_REGEX,
        required=False,
        error_messages=PROJECT_KEY_ERROR_MESSAGES,
    )

    class Meta:
        model = Project
        fields = ("name", "description", "color", "is_archived", "key")

    def validate_key(self, value: str) -> str:
        normalized = value.upper()
        already_taken = (
            Project.objects.filter(workspace_id=self.instance.workspace_id, key=normalized)
            .exclude(id=self.instance.id)
            .exists()
        )
        if already_taken:
            raise serializers.ValidationError("Ese identificador ya esta en uso en este workspace.")
        return normalized


class ProjectColumnCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=120,
        error_messages={
            "required": "El nombre de la columna es obligatorio.",
            "blank": "El nombre de la columna es obligatorio.",
        },
    )
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )
    order = serializers.IntegerField(required=False, min_value=1)

    def create(self, validated_data: dict) -> ProjectColumn:
        project = self.context["project"]
        requested_order = validated_data.get("order")

        with transaction.atomic():
            count = project.columns.count()
            target_order = requested_order if requested_order is not None else count + 1
            target_order = max(1, min(target_order, count + 1))

            project.columns.filter(order__gte=target_order).update(order=F("order") + 1)

            return ProjectColumn.objects.create(
                project=project,
                name=validated_data["name"],
                color=validated_data.get("color", "#64748B"),
                order=target_order,
            )


class ProjectColumnUpdateSerializer(serializers.ModelSerializer):
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )
    order = serializers.IntegerField(required=False, min_value=1)
    workspace_status_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = ProjectColumn
        fields = ("name", "color", "order", "workspace_status_id")

    def validate_workspace_status_id(self, value):
        if value is None:
            return value
        workspace_id = self.instance.project.workspace_id
        if not WorkspaceStatus.objects.filter(id=value, workspace_id=workspace_id).exists():
            raise serializers.ValidationError("El estado no pertenece a este espacio.")
        return value

    def update(self, instance: ProjectColumn, validated_data: dict) -> ProjectColumn:
        requested_order = validated_data.pop("order", None)
        if "workspace_status_id" in validated_data:
            instance.workspace_status_id = validated_data.pop("workspace_status_id")

        for field, value in validated_data.items():
            setattr(instance, field, value)

        with transaction.atomic():
            if requested_order is not None:
                siblings = instance.project.columns.exclude(id=instance.id)
                max_order = siblings.aggregate(max_order=Max("order"))["max_order"] or 0
                target_order = max(1, min(requested_order, max_order + 1))

                if target_order > instance.order:
                    siblings.filter(order__gt=instance.order, order__lte=target_order).update(order=F("order") - 1)
                elif target_order < instance.order:
                    siblings.filter(order__gte=target_order, order__lt=instance.order).update(order=F("order") + 1)

                instance.order = target_order

            instance.save()

        return instance
