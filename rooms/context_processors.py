from .access import is_site_admin
from .models import Inquiry, ViewingRequest


def site_admin(request):
    admin = is_site_admin(request)
    from django.conf import settings
    ctx = {"is_site_admin": admin}
    if not admin:   # never count the owner's own visits
        ctx["analytics_domain"] = getattr(settings, "ANALYTICS_DOMAIN", "")
        ctx["ga_id"] = getattr(settings, "GA_MEASUREMENT_ID", "")
    try:   # contact details for the footer (shown on every page)
        import re
        from .views import contact_details
        c = contact_details()
        ctx["foot"] = {"phone": c["phone"], "tel": re.sub(r"[^0-9+]", "", c["phone"]), "hours": c["hours"],
                       "email": c["email"], "address": getattr(settings, "APARTMENT_ADDRESS", "")}
    except Exception:
        pass   # the footer simply shows less; never break a page over it
    if admin:
        ctx["new_requests"] = ViewingRequest.objects.filter(status="new").count()
        ctx["new_inquiries"] = Inquiry.objects.filter(status="new").count()
    return ctx
