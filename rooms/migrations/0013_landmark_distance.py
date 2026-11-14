from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0012_landmark"),
    ]

    operations = [
        migrations.AddField(model_name="landmark", name="distance", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="landmark", name="travel", field=models.CharField(choices=[("walk", "Walk"), ("car", "Car")], default="walk", max_length=4)),
    ]
