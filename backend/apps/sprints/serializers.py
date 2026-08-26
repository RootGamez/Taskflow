from __future__ import annotations

from rest_framework import serializers

from apps.sprints.models import Sprint


class SprintSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura de respuesta. `ticket_count` y
    `completed_ticket_count` se leen de la anotacion de queryset hecha por
    `apps.sprints.services.annotate_sprint_progress` (D12) -- nunca se
    calculan aca.
    """

    project_id = serializers.UUIDField(read_only=True)
    ticket_count = serializers.IntegerField(read_only=True, default=0)
    completed_ticket_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Sprint
        fields = (
            "id",
            "project_id",
            "name",
            "goal",
            "start_date",
            "end_date",
            "status",
            "ticket_count",
            "completed_ticket_count",
            "created_at",
            "updated_at",
        )


class SprintCreateSerializer(serializers.Serializer):
    """`status` deliberadamente ausente (D13): un sprint siempre nace
    `planned`; el estado solo cambia via los endpoints `activate/` y
    `complete/`, que son los unicos lugares que respetan el constraint
    `unique_active_sprint_per_project`.
    """

    name = serializers.CharField(
        max_length=120,
        error_messages={
            "required": "El nombre del sprint es obligatorio.",
            "blank": "El nombre del sprint es obligatorio.",
        },
    )
    goal = serializers.CharField(max_length=255, required=False, allow_blank=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs: dict) -> dict:
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError("La fecha de fin no puede ser anterior a la de inicio.")
        return attrs

    def create(self, validated_data: dict) -> Sprint:
        project = self.context["project"]
        return Sprint.objects.create(
            project=project,
            name=validated_data["name"],
            goal=validated_data.get("goal", ""),
            start_date=validated_data["start_date"],
            end_date=validated_data["end_date"],
        )


class SprintUpdateSerializer(serializers.Serializer):
    """Todos los campos opcionales (PATCH parcial). `status` tampoco es
    aceptado aca (D13) -- misma razon que en `SprintCreateSerializer`.
    """

    name = serializers.CharField(
        max_length=120,
        required=False,
        error_messages={"blank": "El nombre del sprint es obligatorio."},
    )
    goal = serializers.CharField(max_length=255, required=False, allow_blank=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs: dict) -> dict:
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError("La fecha de fin no puede ser anterior a la de inicio.")
        return attrs

    def update(self, instance: Sprint, validated_data: dict) -> Sprint:
        if not validated_data:
            return instance

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=[*validated_data.keys(), "updated_at"])
        return instance
