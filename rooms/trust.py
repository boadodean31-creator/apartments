"""Trust features: public inquiry form, chat links, costs, reviews, policy pages, robots/sitemap, health check."""
import json
import re
from urllib.parse import quote

from django.conf import settings
from django.core.cache import cache
from django.core.mail import EmailMessage, send_mail
from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .models import Inquiry, Review, Room, SiteSetting


# ---------- chat buttons ----------
def _intl(number):
    """0917-123-4567 / +63 917 123 4567 -> 639171234567"""
    d = re.sub(r"\D", "", number or "")
    if d.startswith("0"):
        d = "63" + d[1:]
    return d


def chat_links(site=None):
    """Only the chats the admin filled in. Each: {key, label, url}."""
    site = site or SiteSetting.load()
    out = []
    wa = _intl(site.whatsapp)
    if len(wa) >= 10:
        out.append({"key": "whatsapp", "label": "WhatsApp", "url": f"https://wa.me/{wa}"})
    vb = _intl(site.viber)
    if len(vb) >= 10:
        out.append({"key": "viber", "label": "Viber", "url": f"viber://chat?number=%2B{vb}"})
    ms = (site.messenger or "").strip()
    if ms:
        if ms.lower().startswith(("http://", "https://")):
            url = ms
        else:
            url = "https://m.me/" + quote(ms.lstrip("@/").split("facebook.com/")[-1].strip("/"))
        out.append({"key": "messenger", "label": "Messenger", "url": url})
    return out


def costs(site=None):
    site = site or SiteSetting.load()
    rows = [
        ("Security deposit", site.cost_deposit, "deposit"),
        ("Advance rent", site.cost_advance, "advance"),
        ("Utilities", site.cost_utilities, "utilities"),
        ("Lease length", site.cost_lease, "lease"),
    ]
    return [{"label": a, "value": b, "key": c} for a, b, c in rows if b]


def trust_context():
    site = SiteSetting.load()
    reviews = list(Review.objects.filter(visible=True)[:12])
    avg = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else None
    return {
        "chat_links": chat_links(site),
        "cost_rows": costs(site),
        "cost_notes": site.cost_notes,
        "reviews": reviews,
        "review_avg": avg,
        "review_count": len(reviews),
        "analytics_domain": getattr(settings, "ANALYTICS_DOMAIN", ""),
        "ga_id": getattr(settings, "GA_MEASUREMENT_ID", ""),
    }


# ---------- public inquiry form (no account needed) ----------
def _client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (fwd.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")) or "unknown"


def _notify(inq):
    to = []
    site = SiteSetting.load()
    if site.contact_email:
        to.append(site.contact_email)
    elif getattr(settings, "ADMIN_EMAILS", None):
        to.append(settings.ADMIN_EMAILS[0])
    if not to:
        return
    body = (f"New inquiry on the Ribay Apartments website\n\nName: {inq.name}\nPhone: {inq.phone or '-'}\n"
            f"Email: {inq.email or '-'}\nRoom: {inq.room_number or '-'}\n\n{inq.message}\n")
    try:
        send_mail(f"New inquiry from {inq.name}", body, getattr(settings, "DEFAULT_FROM_EMAIL", None), to, fail_silently=True)
    except Exception:
        pass   # the inquiry is already saved; never fail the visitor because email is down


# ---------- viewing requests: alert the staff, answer the renter, send a calendar file once confirmed ----------
SLOT_TIMES = {"morning": ((9, 0), (12, 0)), "afternoon": ((13, 0), (16, 0)), "late": ((16, 0), (18, 0))}


def _staff_recipients():
    site = SiteSetting.load()
    if site.contact_email:
        return [site.contact_email]
    if getattr(settings, "ADMIN_EMAILS", None):
        return [settings.ADMIN_EMAILS[0]]
    return []


def _ics_text(s):
    return str(s).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def viewing_ics(vr):
    """A small calendar file for the renter's phone. Times are Philippine time (UTC+8), written as UTC."""
    import datetime as dt

    (sh, sm), (eh, em) = SLOT_TIMES.get(vr.preferred_slot, SLOT_TIMES["morning"])
    start = dt.datetime.combine(vr.preferred_date, dt.time(sh, sm)) - dt.timedelta(hours=8)
    end = dt.datetime.combine(vr.preferred_date, dt.time(eh, em)) - dt.timedelta(hours=8)
    stamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    where = getattr(settings, "APARTMENT_ADDRESS", "")
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ribay Apartments//Viewing//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "BEGIN:VEVENT", f"UID:viewing-{vr.pk}@ribay-apartments", f"DTSTAMP:{stamp}",
        f"DTSTART:{start:%Y%m%dT%H%M%SZ}", f"DTEND:{end:%Y%m%dT%H%M%SZ}",
        "SUMMARY:" + _ics_text(f"Room {vr.room_number} viewing at Ribay Apartments"),
        "LOCATION:" + _ics_text(where),
        "DESCRIPTION:" + _ics_text("Free viewing, no obligation. Please call our staff if you need to change the time."),
        "END:VEVENT", "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


def _viewing_when(vr):
    return f"{vr.preferred_date:%A, %B %d, %Y} ({vr.get_preferred_slot_display()})"


def _send(subject, body, to, attach=None):
    if not to:
        return
    try:
        msg = EmailMessage(subject, body, getattr(settings, "DEFAULT_FROM_EMAIL", None), to)
        if attach:
            msg.attach(*attach)
        msg.send(fail_silently=True)
    except Exception:
        pass   # the request is already saved; never fail the visitor because email is down


def notify_viewing(vr):
    """New viewing request: tell the staff, and tell the renter we got it."""
    _send(f"New viewing request: Room {vr.room_number} ({vr.name})",
          f"A new viewing request came in on the Ribay Apartments website.\n\nName: {vr.name}\nPhone: {vr.phone}\n"
          f"Email: {vr.email or '-'}\nRoom: {vr.room_number}\nWants to visit: {_viewing_when(vr)}\n\n"
          f"Message: {vr.message or '-'}\n\nOpen Manage > Viewing requests to reply.\n", _staff_recipients())
    if vr.email:
        from .views import contact_details
        c = contact_details()
        _send(f"We got your viewing request for Room {vr.room_number}",
              f"Hi {vr.name},\n\nThank you for your interest in Room {vr.room_number} at Ribay Apartments.\n"
              f"We received your request to visit on {_viewing_when(vr)}.\n\n"
              f"{c['name']} will contact you at {vr.phone} to confirm. You can also call or text {c['phone']}.\n"
              f"Viewing is free and there is no obligation.\n\nRibay Apartments\n", [vr.email])


def email_viewing_confirmed(vr):
    """Staff marked the request as confirmed: email the renter with a calendar file."""
    if not vr.email:
        return
    from .views import contact_details
    c = contact_details()
    _send(f"Your viewing is confirmed: Room {vr.room_number}",
          f"Hi {vr.name},\n\nYour viewing of Room {vr.room_number} is confirmed for {_viewing_when(vr)}.\n\n"
          f"Address: {getattr(settings, 'APARTMENT_ADDRESS', '')}\n"
          f"Need to change it? Call or text {c['name']} at {c['phone']}.\n\nSee you soon,\nRibay Apartments\n",
          [vr.email], attach=("viewing.ics", viewing_ics(vr), "text/calendar"))


@require_POST
def send_inquiry(request):
    wants_json = request.headers.get("x-requested-with") == "fetch"

    def reply(ok, msg, status=200, field=None):
        if wants_json:
            return JsonResponse({"ok": ok, "message": msg, "field": field}, status=status)
        return redirect(reverse("home") + ("?inquiry=sent" if ok else "?inquiry=error") + "#inquiry")

    if request.POST.get("website"):           # hidden trap field: bots fill it, people never see it
        return reply(True, "Thank you!")
    ip = _client_ip(request)
    key = f"inq:{ip}"
    n = cache.get(key, 0)
    if n >= 5:
        return reply(False, "Too many messages from this connection. Please try again in an hour, or call us.", 429)
    name = request.POST.get("name", "").strip()[:80]
    phone = request.POST.get("phone", "").strip()[:30]
    email = request.POST.get("email", "").strip()[:254]
    message = request.POST.get("message", "").strip()[:1000]
    room = request.POST.get("room", "").strip()[:10]
    if not name:
        return reply(False, "Please tell us your name.", 422, "name")
    if len(re.sub(r"\D", "", phone)) < 7 and "@" not in email:
        return reply(False, "Please add a phone number or an email so we can reply.", 422, "phone")
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return reply(False, "That email doesn't look right.", 422, "email")
    if len(message) < 5:
        return reply(False, "Please write your question (a few words is fine).", 422, "message")
    if room and not Room.objects.filter(number=room).exists():
        room = ""
    inq = Inquiry.objects.create(name=name, phone=phone, email=email, message=message, room_number=room)
    cache.set(key, n + 1, 3600)
    _notify(inq)
    return reply(True, "Thank you! We got your message and will reply as soon as we can.")


# ---------- policy pages ----------
def _policy(request, template, title):
    ctx = {"page_title": title, "policy_email": SiteSetting.load().contact_email or (settings.ADMIN_EMAILS[0] if getattr(settings, "ADMIN_EMAILS", None) else "")}
    from .views import contact_context
    ctx.update(contact_context())
    return render(request, template, ctx)


def privacy(request):
    return _policy(request, "rooms/privacy.html", "Privacy Policy")


def terms(request):
    return _policy(request, "rooms/terms.html", "Terms of Use")


# ---------- search engines ----------
@require_GET
def robots_txt(request):
    base = request.build_absolute_uri("/").rstrip("/")
    body = ("User-agent: *\nDisallow: /manage/\nDisallow: /admin/\nDisallow: /accounts/\nDisallow: /social/\nDisallow: /portal/\n"
            f"Allow: /\n\nSitemap: {base}/sitemap.xml\n")
    return HttpResponse(body, content_type="text/plain")


@require_GET
def sitemap_xml(request):
    urls = [reverse("home"), reverse("privacy"), reverse("terms")]
    urls += [reverse("room_detail", args=[n]) for n in Room.objects.order_by("floor", "number").values_list("number", flat=True)]
    items = "".join(f"<url><loc>{request.build_absolute_uri(u)}</loc></url>" for u in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>'
    return HttpResponse(xml, content_type="application/xml")


@never_cache
@require_GET
def healthz(request):
    """For uptime monitors (UptimeRobot etc.): 200 'ok' when the site and database both work."""
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception:
        return HttpResponse("database down", status=503, content_type="text/plain")
    return HttpResponse("ok", content_type="text/plain")


def jsonld(request, ctx):
    """Search-engine description of the business (shown in Google results). Ratings only appear when real reviews exist."""
    data = {
        "@context": "https://schema.org",
        "@type": "ApartmentComplex",
        "name": "Ribay Apartments",
        "url": request.build_absolute_uri(reverse("home")),
        "telephone": ctx.get("contact_phone", ""),
        "address": {"@type": "PostalAddress", "addressLocality": "Cainta", "addressRegion": "Rizal", "addressCountry": "PH"},
    }
    if ctx.get("banner_url"):
        data["image"] = request.build_absolute_uri(ctx["banner_url"])
    if ctx.get("review_count"):
        data["aggregateRating"] = {"@type": "AggregateRating", "ratingValue": ctx["review_avg"], "reviewCount": ctx["review_count"], "bestRating": 5}
    return json.dumps(data).replace("</", "<\\/")
