from django.db import models
from django.contrib.auth.models import User

class Floor(models.Model):
    """A floor of the building. The admin can rename floors or add new ones from the website."""
    number = models.IntegerField(unique=True)
    name = models.CharField(max_length=40)

    class Meta:
        ordering = ["number"]

    def __str__(self):
        return self.name


class Room(models.Model):
    STATUS = [("available", "Available"), ("occupied", "Occupied")]

    number = models.CharField(max_length=10, unique=True)
    floor = models.IntegerField()
    room_type = models.CharField(max_length=50)
    rent = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS, default="available")
    video_url = models.URLField(blank=True)
    features = models.CharField(max_length=120, blank=True)  # comma-separated highlights, e.g. "Aircon, Private bath, Submeter"
    description = models.CharField(max_length=160, blank=True)  # one or two short sentences shown under the room name

    def __str__(self):
        return f"Room {self.number}"

    def get_floor_display(self):
        """The floor's name (e.g. '1st floor'). Templates already call this, so they keep working."""
        name = Floor.objects.filter(number=self.floor).values_list("name", flat=True).first()
        return name or f"Floor {self.floor}"

class RoomPhoto(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="rooms/")
    position = models.IntegerField(default=0)  # lowest number = cover photo

    class Meta:
        ordering = ["position", "id"]

class RoomSpace(models.Model):
    """A bedroom or bathroom picture with a short description, shown at the bottom of the room page."""
    KINDS = [("sleep", "Where you'll sleep"), ("bath", "Restroom")]

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="spaces")
    kind = models.CharField(max_length=5, choices=KINDS)
    title = models.CharField(max_length=60)
    detail = models.CharField(max_length=120, blank=True)
    image = models.ImageField(upload_to="spaces/", blank=True)
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ["kind", "position", "id"]


class Tenancy(models.Model):
    tenant = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="tenancies")
    date_in = models.DateField()
    date_out = models.DateField(null=True, blank=True)

class Payment(models.Model):
    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    month_covered = models.DateField()
    method = models.CharField(max_length=30, blank=True)
    reference = models.CharField(max_length=50, blank=True)
    paid_on = models.DateField(auto_now_add=True)


class ViewingRequest(models.Model):
    """Someone (signed in with Google/Facebook/etc.) asked to see a room. Shown to admins as 'Viewing requests'."""
    STATUS = [("new", "New"), ("contacted", "Contacted"), ("confirmed", "Confirmed"),
              ("done", "Done"), ("cancelled", "Cancelled")]
    SLOTS = [("morning", "Morning · 9:00 AM – 12:00 PM"),
             ("afternoon", "Afternoon · 1:00 – 4:00 PM"),
             ("late", "Late afternoon · 4:00 – 6:00 PM")]
    ACTIVE = ("new", "contacted", "confirmed")

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="viewing_requests")
    room = models.ForeignKey(Room, null=True, blank=True, on_delete=models.SET_NULL, related_name="viewing_requests")
    room_number = models.CharField(max_length=10)  # kept even if the room is deleted later
    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    preferred_date = models.DateField()
    preferred_slot = models.CharField(max_length=10, choices=SLOTS)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="new")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name} · Room {self.room_number} · {self.preferred_date}"



class SiteSetting(models.Model):
    """One row only: things the admin can change on the home page (currently the banner photo)."""
    banner = models.ImageField(upload_to="site/", blank=True)

    # Pictures in "How a viewing works" and "What to know before you move in" (admins can replace each one)
    step1_image = models.ImageField(upload_to="site/", blank=True)
    step2_image = models.ImageField(upload_to="site/", blank=True)
    step3_image = models.ImageField(upload_to="site/", blank=True)
    apartment_image = models.ImageField(upload_to="site/", blank=True)
    rules_image = models.ImageField(upload_to="site/", blank=True)
    steps_decor_image = models.ImageField(upload_to="site/", blank=True)

    # Staff contact card on the room page. Admins edit these right on the page; blank = use settings.py
    contact_name = models.CharField(max_length=60, blank=True)
    contact_role = models.CharField(max_length=60, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    contact_hours = models.CharField(max_length=80, blank=True)
    contact_reply = models.CharField(max_length=80, blank=True)
    contact_languages = models.CharField(max_length=80, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_image = models.ImageField(upload_to="site/", blank=True)   # picture on the left of the contact window

    # "View the building" window on the home page (admins edit it right in the window)
    building_title = models.CharField(max_length=120, blank=True)
    building_text = models.CharField(max_length=300, blank=True)

    # Chat buttons (a number or a username; the website builds the links)
    whatsapp = models.CharField(max_length=40, blank=True)
    viber = models.CharField(max_length=40, blank=True)
    messenger = models.CharField(max_length=80, blank=True)   # facebook page username or m.me link

    # Clear costs shown to visitors (blank = not shown)
    cost_deposit = models.CharField(max_length=80, blank=True)
    cost_advance = models.CharField(max_length=80, blank=True)
    cost_utilities = models.CharField(max_length=160, blank=True)
    cost_lease = models.CharField(max_length=80, blank=True)
    cost_notes = models.CharField(max_length=300, blank=True)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class BuildingPhoto(models.Model):
    """Pictures of the building shown in the "View the building" window on the home page."""
    image = models.ImageField(upload_to="site/")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]


class Landmark(models.Model):
    """A place near the apartment, shown in "Everything you need is close by". Admins add these on the home page."""
    KINDS = [("school", "School"), ("church", "Church"), ("shop", "Shop"), ("hospital", "Hospital"), ("store", "Convenience store"),
             ("food", "Restaurant"), ("park", "Park"), ("transport", "Transport"), ("bank", "Bank / ATM"), ("other", "Other")]

    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=12, choices=KINDS, default="other")
    detail = models.CharField(max_length=160)                      # place name / address, also what Google Maps searches for
    maps_url = models.URLField(max_length=500, blank=True)         # optional exact Google Maps link
    image = models.ImageField(upload_to="landmarks/", blank=True)
    distance = models.PositiveIntegerField(null=True, blank=True)   # metres from the apartment
    travel = models.CharField(max_length=4, choices=[("walk", "Walk"), ("car", "Car")], default="walk")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.name



class Inquiry(models.Model):
    """A question sent from the public "Send an inquiry" form. No account needed."""
    STATUS = [("new", "New"), ("replied", "Replied"), ("closed", "Closed")]

    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    message = models.TextField(max_length=1000)
    room_number = models.CharField(max_length=10, blank=True)
    status = models.CharField(max_length=8, choices=STATUS, default="new")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        verbose_name_plural = "inquiries"

    def __str__(self):
        return f"{self.name} ({self.created_at:%Y-%m-%d})"


class Review(models.Model):
    """A real tenant review. Admins add these from Manage > Reviews; only visible ones show on the website."""
    name = models.CharField(max_length=60)
    detail = models.CharField(max_length=80, blank=True)     # e.g. "Tenant since 2024, Room 3A"
    rating = models.PositiveSmallIntegerField(default=5)
    text = models.TextField(max_length=600)
    visible = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "-id"]

    def __str__(self):
        return f"{self.name} ({self.rating}★)"
