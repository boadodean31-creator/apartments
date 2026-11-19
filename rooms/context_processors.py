from .access import is_site_admin
from .models import Inquiry, ViewingRequest


def site_admin(request):
    admin = is_site_admin(request)
    from django.conf import settings
    ctx = {"is_site_admin": admin}
    if not admin:   # never count the owner's own visits
        ctx["analytics_domain"] = getattr(settings, "ANALYTICS_DOMAIN", "")
        ctx["ga_id"] = getattr(settings, "GA_MEASUREMENT_ID", "")
    if admin:
        ctx["new_requests"] = ViewingRequest.objects.filter(status="new").count()
        ctx["new_inquiries"] = Inquiry.objects.filter(status="new").count()
    return ctx
