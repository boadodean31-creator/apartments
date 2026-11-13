from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0010_building_contact_email"),
    ]

    operations = [
        migrations.AddField(model_name="sitesetting", name="contact_image", field=models.ImageField(blank=True, upload_to="site/")),
    ]
