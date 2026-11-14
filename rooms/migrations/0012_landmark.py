import os

from django.core.files import File
from django.db import migrations, models

SEED = [
    ("Elementary School", "school", "Karangalan Village Elementary School", "school.jpg"),
    ("Church", "church", "Our Mother of Perpetual Help Chapel", "church.jpg"),
    ("Rizal Auto Zone", "shop", "Rizal Autozone (Honda 3S Shop)", "honda.jpg"),
]


def seed(apps, schema_editor):
    Landmark = apps.get_model("rooms", "Landmark")
    if Landmark.objects.exists():
        return
    folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "rooms", "places")
    for i, (name, kind, detail, fname) in enumerate(SEED, start=1):
        lm = Landmark(name=name, kind=kind, detail=detail, position=i)
        path = os.path.join(folder, fname)
        if os.path.exists(path):
            try:
                with open(path, "rb") as fh:
                    lm.image.save(fname, File(fh), save=False)
            except Exception:
                pass
        lm.save()


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0011_sitesetting_contact_image"),
    ]

    operations = [
        migrations.CreateModel(
            name="Landmark",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("kind", models.CharField(choices=[("school", "School"), ("church", "Church"), ("shop", "Shop"), ("hospital", "Hospital"), ("store", "Convenience store"), ("food", "Restaurant"), ("park", "Park"), ("transport", "Transport"), ("bank", "Bank / ATM"), ("other", "Other")], default="other", max_length=12)),
                ("detail", models.CharField(max_length=160)),
                ("maps_url", models.URLField(blank=True, max_length=500)),
                ("image", models.ImageField(blank=True, upload_to="landmarks/")),
                ("position", models.PositiveIntegerField(default=0)),
            ],
            options={"ordering": ["position", "id"]},
        ),
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
