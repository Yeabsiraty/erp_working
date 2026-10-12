from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path


def spa(request, *args, **kwargs):
    """React ፊትን (frontend/dist/index.html) ያቀርባል።"""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "<h3>የ React ፊት አልተገነባም።</h3>"
            "<p><code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code> ያሂዱ፤ "
            "ወይም ለልማት <code>npm run dev</code> ይጠቀሙ።</p>",
            content_type="text/html; charset=utf-8",
        )
    return FileResponse(open(index, "rb"), content_type="text/html; charset=utf-8")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("ledger.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", spa),
]
