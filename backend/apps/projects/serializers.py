from __future__ import annotations

from django.db import transaction
from django.db.models import F, Max
from rest_framework import serializers

from apps.projects.models import Project, ProjectColumn

DEFAULT_PROJECT_COLUMNS = [
    {"name": "Backlog", "color": "#64748B", "order": 1},
    {"name": "En progreso", "color": "#2563EB", "order": 2},
    {"name": "Hecho", "color": "#16A34A", "order": 3},
]


class ProjectColumnSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = ProjectColumn
        fields = ("id", "project_id", "name", "color", "order", "created_at")


class ProjectSerializer(serializers.ModelSerializer):
    workspace_id = serializers.UUIDField(read_only=True)
    columns = ProjectColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "workspace_id",
            "name",
            "description",
            "color",
            "is_archived",
            "created_at",
            "updated_at",
            "columns",
        )


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

    def create(self, validated_data: dict) -> Project:
        workspace = self.context["workspace"]

        with transaction.atomic():
            project = Project.objects.create(
                workspace=workspace,
                name=validated_data["name"],
                description=validated_data.get("description", ""),
                color=validated_data.get("color", "#2563EB"),
            )
            ProjectColumn.objects.bulk_create(
                [
                    ProjectColumn(
                        project=project,
                        name=column["name"],
                        color=column["color"],
                        order=column["order"],
                    )
                    for column in DEFAULT_PROJECT_COLUMNS
                ]
            )

        return project


class ProjectUpdateSerializer(serializers.ModelSerializer):
    color = serializers.RegexField(
        regex=r"^#[0-9A-Fa-f]{6}$",
        required=False,
        error_messages={"invalid": "El color debe tener formato hexadecimal #RRGGBB."},
    )

    class Meta:
        model = Project
        fields = ("name", "description", "color", "is_archived")


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

    class Meta:
        model = ProjectColumn
        fields = ("name", "color", "order")

    def update(self, instance: ProjectColumn, validated_data: dict) -> ProjectColumn:
        requested_order = validated_data.pop("order", None)

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
