"""Admin pages for the trust features: inquiries, reviews, costs & chat, backup download."""
import io
import json
import zipfile
from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.core.management import call_command
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST

from .access import site_admin_required
from .models import Inquiry, Review, SiteSetting
from .trust import _intl, chat_links


@site_admin_required
def inquiries(request):
    counts = dict(Inquiry.objects.values_list("status").annotate(c=Count("id")))
    total = sum(counts.values())
    status = request.GET.get("status")
    if status not in ("new", "replied", "closed", "all"):
        status = "new" if counts.get("new") else "all"
    qs = Inquiry.objects.all()
    if status != "all":
        qs = qs.filter(status=status)
    items = list(qs[:200])
    for i in items:
        i.tel = "".join(c for c in i.phone if c.isdigit() or c == "+")
        if i.email:
            from urllib.parse import quote
            i.gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={quote(i.email)}&su={quote('Your question about Ribay Apartments')}"
    tabs = [{"key": k, "label": l, "count": total if k == "all" else counts.get(k, 0)}
            for k, l in (("new", "New"), ("replied", "Replied"), ("closed", "Closed"), ("all", "All"))]
    return render(request, "rooms/manage/inquiries.html", {"items": items, "tabs": tabs, "status": status, "tab": "inquiries",
                                                           "status_choices": Inquiry.STATUS})


@site_admin_required
@require_POST
def inquiry_status(request, pk):
    inq = get_object_or_404(Inquiry, pk=pk)
    st = request.POST.get("status")
    if st in dict(Inquiry.STATUS):
        inq.status = st
        inq.save(update_fields=["status"])
        messages.success(request, f"Marked as {inq.get_status_display().lower()}.")
    return redirect(_next(request, "manage_inquiries"))


@site_admin_required
@require_POST
def inquiry_delete(request, pk):
    inq = get_object_or_404(Inquiry, pk=pk)
    inq.delete()
    messages.success(request, "Inquiry deleted.")
    return redirect(_next(request, "manage_inquiries"))


def _next(request, default):
    nxt = request.POST.get("next", "")
    return nxt if url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}) else default


# ---------- reviews ----------
@site_admin_required
def reviews(request):
    return render(request, "rooms/manage/reviews.html", {"items": Review.objects.all(), "tab": "reviews"})


@site_admin_required
@require_POST
def review_save(request):
    pk = request.POST.get("id")
    name = request.POST.get("name", "").strip()[:60]
    text = request.POST.get("text", "").strip()[:600]
    detail = request.POST.get("detail", "").strip()[:80]
    try:
        rating = max(1, min(5, int(request.POST.get("rating", "5"))))
    except ValueError:
        rating = 5
    if not name or len(text) < 10:
        messages.error(request, "Please add the tenant's name and what they said (at least a sentence).")
        return redirect("manage_reviews")
    obj = get_object_or_404(Review, pk=pk) if pk else Review()
    obj.name, obj.text, obj.detail, obj.rating = name, text, detail, rating
    obj.save()
    messages.success(request, "Review saved." if pk else "Review added.")
    return redirect("manage_reviews")


@site_admin_required
@require_POST
def review_toggle(request, pk):
    r = get_object_or_404(Review, pk=pk)
    r.visible = not r.visible
    r.save(update_fields=["visible"])
    messages.success(request, "Review is now shown." if r.visible else "Review is now hidden.")
    return redirect("manage_reviews")


@site_admin_required
@require_POST
def review_delete(request, pk):
    get_object_or_404(Review, pk=pk).delete()
    messages.success(request, "Review deleted.")
    return redirect("manage_reviews")


# ---------- costs and chat buttons ----------
@site_admin_required
def info(request):
    site = SiteSetting.load()
    if request.method == "POST":
        for f, n in (("cost_deposit", 80), ("cost_advance", 80), ("cost_utilities", 160), ("cost_lease", 80), ("cost_notes", 300),
                     ("whatsapp", 40), ("viber", 40), ("messenger", 80)):
            setattr(site, f, request.POST.get(f, "").strip()[:n])
        bad = [lbl for f, lbl in (("whatsapp", "WhatsApp"), ("viber", "Viber")) if getattr(site, f) and len(_intl(getattr(site, f))) < 10]
        if bad:
            messages.error(request, f"The {' and '.join(bad)} number looks too short. Use a full mobile number like 0917 123 4567.")
            return redirect("manage_info")
        site.save()
        messages.success(request, "Saved. Visitors see the changes right away.")
        return redirect("manage_info")
    return render(request, "rooms/manage/info.html", {"site": site, "tab": "info", "links": chat_links(site)})


# ---------- backup ----------
@never_cache
@site_admin_required
def backup(request):
    """One .zip with every record (JSON) and every uploaded picture. Restore: manage.py loaddata data.json."""
    buf = io.StringIO()
    call_command("dumpdata", "--natural-foreign", "--natural-primary", "--indent", "1",
                 exclude=["contenttypes", "auth.permission", "sessions", "admin.logentry"], stdout=buf)
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("data.json", buf.getvalue())
        root = Path(settings.MEDIA_ROOT)
        if root.exists():
            for f in root.rglob("*"):
                if f.is_file():
                    z.write(f, "media/" + f.relative_to(root).as_posix())
        z.writestr("README.txt", "Ribay Apartments backup.\nRestore records: python manage.py loaddata data.json\nPictures: copy the media folder back next to manage.py\n")
    resp = HttpResponse(mem.getvalue(), content_type="application/zip")
    resp["Content-Disposition"] = f'attachment; filename="ribay-backup-{timezone.localdate():%Y-%m-%d}.zip"'
    return resp
