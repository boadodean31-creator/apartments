from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0009_sitesetting_rules_image"),
    ]

    operations = [
        migrations.AddField(model_name="sitesetting", name="contact_email", field=models.EmailField(blank=True, max_length=254)),
        migrations.AddField(model_name="sitesetting", name="building_title", field=models.CharField(blank=True, max_length=120)),
        migrations.AddField(model_name="sitesetting", name="building_text", field=models.CharField(blank=True, max_length=300)),
        migrations.CreateModel(
            name="BuildingPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="site/")),
                ("position", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["position", "id"]},
        ),
    ]
