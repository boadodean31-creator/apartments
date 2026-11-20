import re
from urllib.parse import parse_qs, quote_plus, urlparse

from django.conf import settings

from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .forms import ViewingRequestForm
from .models import BuildingPhoto, Landmark, Floor, Payment, Room, SiteSetting, Tenancy, ViewingRequest
from .trust import jsonld, trust_context

# The scrolling strip on the home page. Edit the words or swap the icon names any time.
AMENITIES = [
    {"icon": "wifi", "title": "Free Wi-Fi"}, {"icon": "cctv", "title": "24/7 CCTV"},
    {"icon": "water", "title": "Water included"}, {"icon": "bus", "title": "Near jeepney routes"},
    {"icon": "parking", "title": "Motorcycle parking"}, {"icon": "moon", "title": "Quiet hours at 10 pm"},
    {"icon": "laundry", "title": "Laundry area"}, {"icon": "gate", "title": "Gated entrance"},
]


# "Move-in costs and terms" card on the home page. Fill in your real terms, one line each, e.g.
#   {"title": "Deposit", "text": "..."}, {"title": "Advance", "text": "..."}, {"title": "Contract", "text": "..."}
# While this list is empty, the card is hidden.
MOVE_IN_TERMS = []

# "Questions renters ask" on the home page. Example: {"q": "Can I bring a visitor?", "a": "..."}
# While this list is empty, the section is hidden.
FAQ = []


def floor_groups(rooms, include_empty=False):
    """Group rooms by floor, top floor first. Each floor has a number, a name and a short label."""
    names = dict(Floor.objects.values_list("number", "name"))
    numbers = {r.floor for r in rooms}
    if include_empty:
        numbers |= set(names)
    groups = []
    for n in sorted(numbers, reverse=True):
        name = names.get(n) or f"Floor {n}"
        groups.append({
            "number": n,
            "name": name,
            "label": re.sub(r"\s*floor$", "", name, flags=re.I) or name,
            "rooms": [r for r in rooms if r.floor == n],
        })
    return groups


# Shown in the "Good to know" card on every room page. Edit the words here any time.
ROOM_AMENITIES = [
    {"icon": "cctv", "title": "24/7 CCTV", "text": "Cameras watching day and night"},
    {"icon": "wifi", "title": "Free Wi-Fi", "text": "Included in the rent"},
    {"icon": "water", "title": "Water included", "text": "No separate water bill"},
    {"icon": "gate", "title": "Gated entrance", "text": "Locked at night"},
    {"icon": "parking", "title": "Motorcycle parking", "text": "Shared parking area"},
    {"icon": "laundry", "title": "Laundry area", "text": "Shared with all tenants"},
    {"icon": "bus", "title": "Near jeepney routes", "text": "Easy to get around"},
]
HOUSE_RULES = [
    {"icon": "moon", "title": "Quiet hours", "text": "10 PM to 6 AM. Please keep noise down."},
    {"icon": "people", "title": "Maximum 2 people", "text": "Per room, including the tenant."},
    {"icon": "key", "title": "Keep your key with you", "text": "The gate is locked at night."},
    {"icon": "sparkle", "title": "Keep shared areas tidy", "text": "Laundry and parking are for everyone."},
]


def contact_details():
    """Staff contact card. Values saved by an admin on the room page win; blanks fall back to settings.py."""
    site = SiteSetting.load()
    name = site.contact_name or settings.CONTACT_STAFF
    return {
        "name": name,
        "role": site.contact_role or settings.CONTACT_STAFF_ROLE,
        "phone": site.contact_phone or settings.CONTACT_PHONE,
        "hours": site.contact_hours or settings.VIEWING_HOURS,
        "reply": site.contact_reply or "Within 24 hours",
        "languages": site.contact_languages or "English, Filipino",
        "email": site.contact_email,
        "initials": "".join(w[0] for w in name.split()[:2]).upper(),
    }


def contact_context():
    """Staff contact details for the 'Book a viewing' window and room page (admins can edit them on the room page)."""
    c = contact_details()
    return {
        "contact_phone": c["phone"],
        "contact_tel": re.sub(r"[^0-9+]", "", c["phone"]),
        "contact_staff": c["name"],
        "contact_role": c["role"],
        "contact_initials": c["initials"],
        "viewing_hours": c["hours"],
        "contact_reply": c["reply"],
        "contact_languages": c["languages"],
        "contact_email": c["email"],
    }


def short_address(address):
    """'Blk 134, Lot 9 Kagandahan Street, ..., Cainta, Rizal 1900' -> 'Kagandahan Street, Cainta'."""
    parts = [x.strip() for x in (address or "").split(",") if x.strip()]
    if not parts:
        return ""
    is_street = re.compile(r"\b(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|boulevard|blvd\.?)\b", re.I)
    street = next((x for x in parts if is_street.search(x)), parts[0])
    street = re.sub(r"^((blk|block|lot|unit|bldg|building)\.?\s*\d+[a-z]?\s+)+", "", street, flags=re.I)
    last = parts[-1]
    if len(parts) < 2:
        city = ""
    elif re.search(r"\d", last) and len(parts) >= 3:
        city = parts[-2]
    else:
        city = last
    return f"{street}, {city}" if city and city != street else street


def map_context():
    """Address and Google Maps links for the apartment (set in settings.py)."""
    q = quote_plus(settings.APARTMENT_MAP_QUERY)
    return {
        "address": settings.APARTMENT_ADDRESS,
        "landmark": settings.APARTMENT_LANDMARK,
        "short_address": short_address(settings.APARTMENT_ADDRESS),
        "map_embed": f"https://www.google.com/maps?q={q}&z=17&output=embed",
        "map_link": f"https://www.google.com/maps/search/?api=1&query={q}",
        "map_dir": f"https://www.google.com/maps/dir/?api=1&destination={q}",
    }


def youtube_embed(url):
    """Turn a normal YouTube link into an embeddable one. Returns '' if not YouTube."""
    if not url:
        return ""
    u = urlparse(url)
    host = u.netloc.lower().replace("www.", "")
    vid = ""
    if host == "youtu.be":
        vid = u.path.strip("/")
    elif host in ("youtube.com", "m.youtube.com"):
        if u.path == "/watch":
            vid = parse_qs(u.query).get("v", [""])[0]
        elif u.path.startswith(("/embed/", "/shorts/")):
            vid = u.path.split("/")[2]
    return f"https://www.youtube.com/embed/{vid}" if vid else ""


def step_photo(rooms):
    """Cover photo of the first open room (used on the 'Pick a room' step card)."""
    for r in sorted(rooms, key=lambda r: r.status != "available"):
        photos = list(r.photos.all())
        if photos:
            return photos[0].image.url
    return ""


def bedroom_photo(rooms):
    """A bedroom photo, if any room has one (soft corner picture on the 'House rules' card).
    It looks for 'bed' in the photo's file name; if none is found the card simply has no picture."""
    for r in rooms:
        for p in r.photos.all():
            if "bed" in p.image.name.lower():
                return p.image.url
    return ""


def living_photo(rooms):
    """A living-room photo, if any room has one (soft corner picture on the 'At the apartment' card).
    It looks for 'living' in the photo's file name; if none is found the card simply has no picture."""
    for r in rooms:
        for p in r.photos.all():
            if "living" in p.image.name.lower():
                return p.image.url
    return ""


# Where each building photo goes. Admins fill these slots in the "View the building" window.
BUILDING_SLOTS = [
    {"label": "Front of the building", "hint": "The outside view people see from the street"},
    {"label": "Entrance & hallway", "hint": "The gate, lobby or the way in"},
    {"label": "Parking & shared areas", "hint": "Parking, laundry or the common space"},
    {"label": "Rooftop or view", "hint": "Optional"},
    {"label": "Extra photo 1", "hint": "Optional"},
    {"label": "Extra photo 2", "hint": "Optional"},
]


def home(request):
    rooms = list(Room.objects.prefetch_related("photos").order_by("floor", "number"))
    for r in rooms:   # first two highlights (e.g. "Aircon, Private bath") shown on the room card
        r.card_feat_list = [f["label"] for f in room_features(r)[:2]]
        r.card_feats = ", ".join(r.card_feat_list)
    floors = floor_groups(rooms)
    context = {
        "rooms": rooms,
        "floors": floors,
        "total": len(rooms),
        "available": sum(1 for r in rooms if r.status == "available"),
        "grid_cols": 3 if (len(rooms) % 4 and len(rooms) % 3 == 0) else 4,   # 9 rooms -> 3 x 3, 8 -> 2 x 4, so no lone card on the last row
        "amenities": AMENITIES,
        "landmarks": (lms := nearby_landmarks()),
        "landmark_range": landmark_range(lms),
        "landmark_kinds": Landmark.KINDS,
        "room_amenities": ROOM_AMENITIES,
        "house_rules": HOUSE_RULES,
        "terms": MOVE_IN_TERMS,
        "faq": FAQ,
        "page_url": request.build_absolute_uri(reverse("home")),
        **contact_context(),
        **map_context(),
        **trust_context(),
    }
    site = SiteSetting.load()
    context["step_photo"] = site.step1_image.url if site.step1_image else step_photo(rooms)
    context["living_photo"] = site.apartment_image.url if site.apartment_image else living_photo(rooms)
    context["rules_photo"] = site.rules_image.url if site.rules_image else bedroom_photo(rooms)
    context["step2_img"] = site.step2_image.url if site.step2_image else ""
    context["step3_img"] = site.step3_image.url if site.step3_image else ""
    context["decor_photo"] = site.steps_decor_image.url if site.steps_decor_image else ""
    context["banner_url"] = site.banner.url if site.banner else ""
    context["jsonld"] = jsonld(request, context)
    context["building_title"] = site.building_title or "Cainta, Rizal, Philippines"
    context["building_text"] = site.building_text or "Ribay Apartments: secure, quiet rooms with Wi-Fi, water and 24/7 CCTV."
    own = {b.position: b for b in BuildingPhoto.objects.all()}
    context["building_photos"] = [{"id": b.pk, "url": b.image.url, "label": BUILDING_SLOTS[b.position - 1]["label"] if 0 < b.position <= len(BUILDING_SLOTS) else ""}
                                  for _, b in sorted(own.items())]
    context["building_is_default"] = not own
    first_own = own[min(own)].image.url if own else ""
    context["contact_image_set"] = bool(site.contact_image)
    context["contact_image_url"] = site.contact_image.url if site.contact_image else first_own
    context["building_slots"] = [{**sl, "n": i + 1, "photo": own.get(i + 1)} for i, sl in enumerate(BUILDING_SLOTS)]
    if not own:   # nothing uploaded yet: show a few room photos so the window is never empty
        shots = [r.photos.all()[0].image.url for r in rooms if r.photos.all()][:3]
        context["building_photos"] = [{"id": 0, "url": u, "label": ""} for u in shots]
    context["og_image"] = request.build_absolute_uri(site.banner.url) if site.banner else ""
    return render(request, "rooms/home.html", context)


# Little icons for the highlight tiles on the room page. The first matching word wins.
FEATURE_ICONS = [
    (r"air ?con|a/?c\b|cool", "M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"),
    (r"bath|shower|restroom|toilet|\bcr\b", "M4 20V8a4 4 0 0 1 4-4h3M11 4l7 4M12 12v1M15 12v1M18 12v1M13.5 16v1M16.5 16v1"),
    (r"meter|electric|power|kuryente", "M13 2L4 14h7l-1 8 9-12h-7z"),
    (r"wi-?fi|internet", "M2.5 9a14 14 0 0 1 19 0M5.8 12.4a9.3 9.3 0 0 1 12.4 0M9 15.7a4.7 4.7 0 0 1 6 0M12 19.2v.01"),
    (r"water", "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"),
    (r"park|garage", "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9.5 17V7.5H13a2.7 2.7 0 0 1 0 5.4H9.5"),
    (r"kitchen|cook|stove", "M6 3v8M9 3v8M6 7h3M7.5 11v10M16 3c-2 1.5-2.5 5-2.5 8h2.5v10"),
    (r"furnish|bed|sofa", "M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0 .01"),
]
FEATURE_DEFAULT_ICON = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.3l2.5 2.5 4.5-5"


def room_features(room):
    """Turn the room's comma-separated highlights into [{label, path}] for the small tiles."""
    out = []
    for label in (room.features or "").split(","):
        label = label.strip()
        if not label:
            continue
        path = next((p for rx, p in FEATURE_ICONS if re.search(rx, label, re.I)), FEATURE_DEFAULT_ICON)
        out.append({"label": label, "path": path})
    return out[:6]


# The places in "Everything you need is close by" are stored in the database (Landmark). Admins add, edit and delete them on the home page.


def distance_label(m):
    if not m:
        return ""
    return f"{m} m" if m < 1000 else f"{m / 1000:.1f}".rstrip("0").rstrip(".") + " km"


def landmark_range(items):
    """'150 m – 1.2 km' from the distances admins typed, or '' if none were typed."""
    ds = sorted(i["distance"] for i in items if i.get("distance"))
    if not ds:
        return ""
    return distance_label(ds[0]) if ds[0] == ds[-1] else f"{distance_label(ds[0])} \u2013 {distance_label(ds[-1])}"


def nearby_landmarks():
    """The places shown in "Everything you need is close by". They come from the database (admins add them on the home page).
    The Google Maps button uses the exact link when one was pasted, otherwise it searches the address that was typed."""
    out = []
    for lm in Landmark.objects.all():
        if lm.maps_url:
            url = lm.maps_url
        else:
            place = lm.detail if "cainta" in lm.detail.lower() else f"{lm.detail}, Cainta, Rizal, Philippines"
            url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(place)}"
        out.append({"id": lm.pk, "name": lm.name, "kind": lm.kind, "kind_label": lm.get_kind_display(), "detail": lm.detail,
                    "maps_url": lm.maps_url, "distance": lm.distance or "", "distance_label": distance_label(lm.distance), "travel": lm.travel, "image": lm.image.url if lm.image else "", "url": url})
    return out


AREA_DESCRIPTION = (
    "Ribay Apartments is in Karangalan Village, Barangay San Isidro, a quiet residential part of Cainta, Rizal. "
    "The street is calm and the daily essentials are close by: a school, a chapel and shops are all nearby, "
    "and jeepney routes pass close to the gate, so getting to work or school is easy."
)


def area_description():
    """The text in the room page's Location pop-up. Override with APARTMENT_AREA_DESCRIPTION in settings.py."""
    return getattr(settings, "APARTMENT_AREA_DESCRIPTION", AREA_DESCRIPTION)


def similar_rooms(room, limit=None):
    """All other available rooms, most alike first: same type, then closest rent."""
    rooms = list(Room.objects.filter(status="available").exclude(pk=room.pk).prefetch_related("photos"))
    rooms.sort(key=lambda r: (r.room_type != room.room_type, abs(r.rent - room.rent), r.floor, r.number))
    for r in rooms:
        photos = list(r.photos.all())
        r.cover_url = photos[0].image.url if photos else ""
    return rooms[:limit] if limit else rooms


def other_rooms(room):
    """Every other room for the scrollable list: available ones first (most alike first), then taken ones."""
    rooms = list(Room.objects.exclude(pk=room.pk).prefetch_related("photos"))
    rooms.sort(key=lambda r: (r.status != "available", r.room_type != room.room_type, abs(r.rent - room.rent), r.floor, r.number))
    for r in rooms:
        photos = list(r.photos.all())
        r.cover_url = photos[0].image.url if photos else ""
    return rooms


def room_detail(request, number):
    room = get_object_or_404(Room.objects.prefetch_related("photos"), number=number)
    others = other_rooms(room)
    context = {
        "room": room,
        "photos": list(room.photos.all()),
        "sleep_spaces": [x for x in room.spaces.all() if x.kind == "sleep"],
        "bath_spaces": [x for x in room.spaces.all() if x.kind == "bath"],
        "embed": youtube_embed(room.video_url),
        "similar_rooms": similar_rooms(room),
        "other_rooms": others,
        "other_open": sum(1 for r in others if r.status == "available"),
        "other_taken": sum(1 for r in others if r.status != "available"),
        "landmarks": nearby_landmarks(),
        "area_about": area_description(),
        "room_features": room_features(room),
        "room_amenities": ROOM_AMENITIES,
        "house_rules": HOUSE_RULES,
        "slots": ViewingRequest.SLOTS,
        "book_min": (timezone.localdate() + timedelta(days=1)).isoformat(),
        "book_max": (timezone.localdate() + timedelta(days=60)).isoformat(),
        **contact_context(),
        **map_context(),
        **trust_context(),
    }
    if request.user.is_authenticated:
        last = request.user.viewing_requests.order_by("-id").first()
        context["prefill_name"] = request.user.get_full_name() or (last.name if last else "")
        context["prefill_phone"] = last.phone if last else ""
    return render(request, "rooms/room_detail.html", context)


@require_POST
def book_viewing(request, number):
    """Handles the 'Book a viewing' window. Always answers with JSON."""
    room = get_object_or_404(Room, number=number)
    if not request.user.is_authenticated:
        nxt = f"{reverse('room_detail', args=[room.number])}?book=1"
        return JsonResponse({"ok": False, "login": f"{reverse('login')}?next={quote_plus(nxt)}"}, status=401)
    if room.status != "available":
        return JsonResponse({"ok": False, "errors": {"__all__": ["Sorry, this room was just taken. Please look at our other available rooms."]}}, status=409)

    form = ViewingRequestForm(request.POST)
    if not form.is_valid():
        errors = {f: [e["message"] for e in errs] for f, errs in form.errors.get_json_data().items()}
        return JsonResponse({"ok": False, "errors": errors}, status=422)

    active = ViewingRequest.objects.filter(user=request.user, status__in=ViewingRequest.ACTIVE)
    if active.filter(room=room).exists():
        return JsonResponse({"ok": False, "errors": {"__all__": ["You already sent a viewing request for this room. Our staff will contact you soon."]}}, status=409)
    if active.count() >= 5:
        return JsonResponse({"ok": False, "errors": {"__all__": ["You have several open requests already. Please wait for our staff to reply."]}}, status=409)

    vr = form.save(commit=False)
    vr.user = request.user
    vr.room = room
    vr.room_number = room.number
    vr.email = request.user.email or form.cleaned_data.get("email", "")
    vr.save()
    try:
        from .trust import notify_viewing
        notify_viewing(vr)
    except Exception:
        pass   # emails must never break a booking
    return JsonResponse({"ok": True, "id": vr.pk})


@login_required
def portal(request):
    tenancies = list(Tenancy.objects.filter(tenant=request.user).select_related("room").order_by("-date_in"))
    current = next((t for t in tenancies if t.date_out is None), None)
    payments = (Payment.objects.filter(tenancy__tenant=request.user)
                .select_related("tenancy__room").order_by("-month_covered", "-id"))
    total = payments.aggregate(s=Sum("amount"))["s"] or 0
    # Tenants without a room yet see every room that is open right now
    open_rooms = []
    if not current:
        open_rooms = list(Room.objects.filter(status="available")
                          .prefetch_related("photos").order_by("floor", "number"))
    return render(request, "rooms/portal.html", {
        "tenancies": tenancies, "current": current, "payments": payments,
        "total": total, "open_rooms": open_rooms,
        "viewing_requests": list(request.user.viewing_requests.all()[:6]),
        **contact_context(),
    })


@login_required
def receipt(request, pk):
    # Only the tenant who owns the payment can see it
    payment = get_object_or_404(
        Payment.objects.select_related("tenancy__room", "tenancy__tenant"),
        pk=pk, tenancy__tenant=request.user,
    )
    return render(request, "rooms/receipt.html", {"p": payment})
