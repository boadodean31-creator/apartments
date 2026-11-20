from django.db import migrations, models

# Placeholder text so the cards look finished. Edit each room's description in Manage > room > "Short description".
SAMPLES = [
    "Bright, comfortable studio with a cozy bed and plenty of natural light. Quiet and easy to settle into.",
    "Clean, well-kept studio with Wi-Fi and water included. A calm space for rest, work and everyday living.",
    "Cozy studio with a soft, neutral interior and room to relax. Safe building with 24/7 CCTV.",
    "Simple, tidy studio made for comfortable everyday living, close to jeepney routes and shops.",
    "Airy studio with good ventilation and a restful, uncluttered layout. Ready to move in.",
    "Quiet studio inside a gated building. Wi-Fi, water and CCTV are included in the rent.",
    "Warm, practical studio with a comfortable bed and space for your things. Move-in ready.",
    "Peaceful studio with a homey feel and good natural light. Shared laundry area in the building.",
    "Neat, well-lit studio with a comfortable bed, ideal for students and working professionals.",
    "Relaxing studio with a clean, modern look and secure motorcycle parking in the building.",
]


def fill_descriptions(apps, schema_editor):
    Room = apps.get_model("rooms", "Room")
    for i, room in enumerate(Room.objects.filter(description="").order_by("floor", "number")):
        room.description = SAMPLES[i % len(SAMPLES)]
        room.save(update_fields=["description"])


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0014_trust_features"),
    ]

    operations = [
        migrations.AddField(model_name="room", name="description", field=models.CharField(blank=True, max_length=160)),
        migrations.RunPython(fill_descriptions, migrations.RunPython.noop),
    ]
