from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0013_landmark_distance"),
    ]

    operations = [
        migrations.AddField(model_name="sitesetting", name="whatsapp", field=models.CharField(blank=True, max_length=40)),
        migrations.AddField(model_name="sitesetting", name="viber", field=models.CharField(blank=True, max_length=40)),
        migrations.AddField(model_name="sitesetting", name="messenger", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="sitesetting", name="cost_deposit", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="sitesetting", name="cost_advance", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="sitesetting", name="cost_utilities", field=models.CharField(blank=True, max_length=160)),
        migrations.AddField(model_name="sitesetting", name="cost_lease", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="sitesetting", name="cost_notes", field=models.CharField(blank=True, max_length=300)),
        migrations.CreateModel(
            name="Inquiry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("message", models.TextField(max_length=1000)),
                ("room_number", models.CharField(blank=True, max_length=10)),
                ("status", models.CharField(choices=[("new", "New"), ("replied", "Replied"), ("closed", "Closed")], default="new", max_length=8)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"verbose_name_plural": "inquiries", "ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=60)),
                ("detail", models.CharField(blank=True, max_length=80)),
                ("rating", models.PositiveSmallIntegerField(default=5)),
                ("text", models.TextField(max_length=600)),
                ("visible", models.BooleanField(default=True)),
                ("position", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["position", "-id"]},
        ),
    ]
