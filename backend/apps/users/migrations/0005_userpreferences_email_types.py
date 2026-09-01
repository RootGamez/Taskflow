from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_passwordresettoken"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreferences",
            name="email_ticket_assigned",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="userpreferences",
            name="email_ticket_mentioned",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="userpreferences",
            name="email_ticket_commented",
            field=models.BooleanField(default=True),
        ),
    ]
