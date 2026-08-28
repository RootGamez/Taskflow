"""Serializers de `Page` (docs/PHASE_4_PLAN.md seccion 4.2/4.3).

`PageSummarySerializer` (D11) nunca expone `content` -- el listado de un
workspace con cientos de paginas de documentacion no debe devolver el
blob JSON completo de cada una en cada render del sidebar.
`PageDetailSerializer` lo agrega, junto con `breadcrumb` (ancestros,
D12: reusa `resolve_ancestor_ids`).

`PageCreateSerializer`/`PageUpdateSerializer` son `serializers.Serializer`
planos (no `ModelSerializer`), patron ya usado en `apps.labels.serializers`
y `apps.comments.serializers`: la validacion de jerarquia (D12/D13) y de
pertenencia cross-tenant (RP-7/RP-8) vive en `validate()`, nunca en el
modelo.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Max
from rest_framework import serializers

from apps.pages.models import Page
from apps.pages.services import MAX_PAGE_DEPTH, compute_depth, resolve_ancestor_ids, would_create_cycle
from apps.projects.models import Project
from apps.tickets.rich_text import extract_plain_text

User = get_user_model()

# Precedentes de la casa: MAX_ACTIVITIES_RETURNED = 200 (activities/views.py),
# MAX_SUBTASKS_PER_TICKET = 100 (subtasks/views.py). D13 fija 500 paginas
# por workspace ademas del tope de profundidad.
MAX_PAGES_PER_WORKSPACE = 500


class PageAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name")


class PageBreadcrumbEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    icon = serializers.CharField()


class PageSummarySerializer(serializers.ModelSerializer):
    """Forma del listado (D11): sin `content`.

    `order`/`created_at` SI se incluyen aunque no aparezcan en el ejemplo
    JSON ilustrativo de docs/PHASE_4_PLAN.md seccion 4.2: son escalares
    ya cargados de la misma fila (costo cero adicional, a diferencia del
    blob de `content`) y el arbol del sidebar (`buildPageTree.ts`,
    frontend) los necesita para ordenar hermanos sin una segunda llamada
    a `PageDetail` por nodo.
    """

    parent_id = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    child_count = serializers.IntegerField(read_only=True, default=0)
    updated_by = PageAuthorSerializer(read_only=True)

    class Meta:
        model = Page
        fields = (
            "id",
            "parent_id",
            "project_id",
            "title",
            "icon",
            "order",
            "child_count",
            "created_at",
            "updated_at",
            "updated_by",
        )

    def get_parent_id(self, obj: Page) -> str | None:
        return str(obj.parent_id) if obj.parent_id else None

    def get_project_id(self, obj: Page) -> str | None:
        return str(obj.project_id) if obj.project_id else None


class PageDetailSerializer(PageSummarySerializer):
    """Forma del detalle: `PageSummary` + `content` + `breadcrumb`."""

    created_by = PageAuthorSerializer(read_only=True)
    breadcrumb = serializers.SerializerMethodField()

    class Meta(PageSummarySerializer.Meta):
        fields = PageSummarySerializer.Meta.fields + (
            "content",
            "created_by",
            "breadcrumb",
        )

    def get_breadcrumb(self, obj: Page) -> list[dict]:
        workspace = self.context["workspace"]
        parent_by_id = dict(workspace.pages.values_list("id", "parent_id"))
        # Del padre mas cercano al mas lejano (resolve_ancestor_ids) -> se
        # invierte para que el breadcrumb se lea raiz-primero.
        ancestor_ids = list(reversed(resolve_ancestor_ids(obj.id, parent_by_id)))
        if not ancestor_ids:
            return []

        rows = workspace.pages.filter(id__in=ancestor_ids).values("id", "title", "icon")
        by_id = {row["id"]: row for row in rows}

        return [
            {
                "id": str(ancestor_id),
                "title": by_id[ancestor_id]["title"],
                "icon": by_id[ancestor_id]["icon"],
            }
            for ancestor_id in ancestor_ids
            if ancestor_id in by_id
        ]


def _validate_title(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise serializers.ValidationError("El titulo de la pagina es obligatorio.")
    return stripped


def _resolve_parent(workspace, parent_id) -> Page | None:
    """Busca el padre DENTRO del workspace ya scopeado (RP-7): si no
    aparece ahi -- sea porque no existe o porque es de otro workspace --
    el mensaje es identico y no filtra nada del recurso ajeno."""
    if parent_id is None:
        return None

    parent = workspace.pages.filter(id=parent_id).first()
    if parent is None:
        raise serializers.ValidationError("Pagina padre no encontrada.")
    return parent


def _resolve_project(workspace, project_id) -> Project | None:
    if project_id is None:
        return None

    project = Project.objects.filter(id=project_id, workspace=workspace).first()
    if project is None:
        raise serializers.ValidationError("El proyecto no pertenece a este espacio.")
    return project


class PageCreateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "El titulo de la pagina es obligatorio.",
            "blank": "El titulo de la pagina es obligatorio.",
        },
    )
    parent_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    project_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    icon = serializers.CharField(max_length=8, required=False, allow_blank=True, default="")
    content = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_title(self, value: str) -> str:
        return _validate_title(value)

    def validate(self, attrs: dict) -> dict:
        workspace = self.context["workspace"]

        parent = _resolve_parent(workspace, attrs.get("parent_id"))
        project = _resolve_project(workspace, attrs.get("project_id"))

        # D13: tope de recursos, evaluado antes del tope de profundidad
        # (ambos son limites duros independientes del resto del payload).
        if workspace.pages.count() >= MAX_PAGES_PER_WORKSPACE:
            raise serializers.ValidationError("Este espacio no puede tener mas de 500 paginas.")

        parent_by_id = dict(workspace.pages.values_list("id", "parent_id"))
        depth = compute_depth(parent.id if parent else None, parent_by_id)
        if depth >= MAX_PAGE_DEPTH:
            raise serializers.ValidationError("No se pueden anidar mas de 5 niveles de paginas.")

        attrs["parent"] = parent
        attrs["project"] = project
        return attrs

    def create(self, validated_data: dict) -> Page:
        workspace = self.context["workspace"]
        user = self.context["user"]
        parent = validated_data["parent"]
        content = validated_data.get("content", "")

        # D15: `order` de solo lectura, `max(order)+1` entre hermanos
        # (mismo padre, incluido `None` para las paginas raiz).
        siblings_max_order = (
            workspace.pages.filter(parent=parent).aggregate(Max("order"))["order__max"] or 0
        )

        return Page.objects.create(
            workspace=workspace,
            parent=parent,
            project=validated_data["project"],
            title=validated_data["title"],
            icon=validated_data.get("icon", ""),
            content=content,
            content_text=extract_plain_text(content),
            order=siblings_max_order + 1,
            created_by=user,
            updated_by=user,
        )


class PageUpdateSerializer(serializers.Serializer):
    """`partial=True` siempre (D14): cada campo se aplica solo si vino en
    el payload. La concurrencia optimista (`expected_updated_at`) se
    resuelve en la vista, ANTES de instanciar este serializer -- ver
    `views.py` (D14: ~8 lineas, sin infraestructura nueva)."""

    title = serializers.CharField(
        max_length=200,
        required=False,
        error_messages={"blank": "El titulo de la pagina es obligatorio."},
    )
    parent_id = serializers.UUIDField(required=False, allow_null=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    icon = serializers.CharField(max_length=8, required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)

    def validate_title(self, value: str) -> str:
        return _validate_title(value)

    def validate(self, attrs: dict) -> dict:
        workspace = self.context["workspace"]
        instance: Page = self.instance

        if "parent_id" in self.initial_data:
            parent_id = attrs.get("parent_id")

            # RP-3: auto-padre. Chequeo directo (mensaje distinto del de
            # ciclo transitivo) antes de tocar `would_create_cycle`.
            if parent_id == instance.id:
                raise serializers.ValidationError("Una pagina no puede ser su propia sub-pagina.")

            parent = _resolve_parent(workspace, parent_id)

            if parent is not None:
                parent_by_id = dict(workspace.pages.values_list("id", "parent_id"))

                if would_create_cycle(instance.id, parent.id, parent_by_id):
                    raise serializers.ValidationError(
                        "No se puede mover una pagina dentro de una de sus sub-paginas."
                    )

                # D13 tambien aplica al mover una pagina existente, no solo
                # al crearla: un `parent_id` nuevo no puede empujarla mas
                # alla del tope de niveles.
                parent_by_id_without_self = {
                    page_id: parent_id_value
                    for page_id, parent_id_value in parent_by_id.items()
                    if page_id != instance.id
                }
                depth = compute_depth(parent.id, parent_by_id_without_self)
                if depth >= MAX_PAGE_DEPTH:
                    raise serializers.ValidationError(
                        "No se pueden anidar mas de 5 niveles de paginas."
                    )

            attrs["parent"] = parent

        if "project_id" in self.initial_data:
            attrs["project"] = _resolve_project(workspace, attrs.get("project_id"))

        return attrs

    def update(self, instance: Page, validated_data: dict) -> Page:
        workspace = self.context["workspace"]
        user = self.context["user"]
        update_fields: set[str] = set()

        if "title" in validated_data:
            instance.title = validated_data["title"]
            update_fields.add("title")

        if "icon" in validated_data:
            instance.icon = validated_data["icon"]
            update_fields.add("icon")

        if "project" in validated_data:
            instance.project = validated_data["project"]
            update_fields.add("project")

        if "parent" in validated_data:
            new_parent = validated_data["parent"]
            instance.parent = new_parent
            # D15: mover de padre manda la pagina al final de sus nuevos
            # hermanos.
            siblings_max_order = (
                workspace.pages.filter(parent=new_parent)
                .exclude(pk=instance.pk)
                .aggregate(Max("order"))["order__max"]
                or 0
            )
            instance.order = siblings_max_order + 1
            update_fields.update({"parent", "order"})

        if "content" in validated_data:
            instance.content = validated_data["content"]
            instance.content_text = extract_plain_text(validated_data["content"])
            update_fields.update({"content", "content_text"})

        if update_fields:
            instance.updated_by = user
            update_fields.add("updated_by")
            instance.save(update_fields=[*update_fields, "updated_at"])

        return instance
