from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspaces", "0003_workspaceinvitation_token_expiration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="workspaceinvitation",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("rejected", "Rejected"),
                    ("cancelled", "Cancelled"),
                    ("expired", "Expired"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
