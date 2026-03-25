from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="ticket",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="ticket",
            name="progress_notes",
            field=models.TextField(blank=True),
        ),
    ]
