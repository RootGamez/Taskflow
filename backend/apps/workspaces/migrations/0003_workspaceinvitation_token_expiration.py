from django.db import migrations, models
import uuid

import apps.workspaces.models


def populate_invitation_tokens(apps, schema_editor):
    workspace_invitation_model = apps.get_model("workspaces", "WorkspaceInvitation")
    for invitation in workspace_invitation_model.objects.filter(invitation_token__isnull=True):
        invitation.invitation_token = uuid.uuid4()
        invitation.save(update_fields=["invitation_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("workspaces", "0002_workspaceinvitation"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspaceinvitation",
            name="expires_at",
            field=models.DateTimeField(default=apps.workspaces.models.workspace_invitation_default_expiration),
        ),
        migrations.AddField(
            model_name="workspaceinvitation",
            name="invitation_token",
            field=models.UUIDField(blank=True, editable=False, null=True),
        ),
        migrations.RunPython(populate_invitation_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="workspaceinvitation",
            name="invitation_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
