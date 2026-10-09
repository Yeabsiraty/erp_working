from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("items", views.ItemViewSet)
router.register("customers", views.CustomerViewSet)
router.register("sales", views.SaleViewSet)
router.register("purchases", views.PurchaseViewSet)
router.register("expenses", views.ExpenseViewSet)
router.register("payments", views.PaymentViewSet)
router.register("bank", views.BankEntryViewSet)
router.register("proformas", views.ProformaViewSet)
router.register("payment-requests", views.PaymentRequestViewSet)
router.register("delivery-notes", views.DeliveryNoteViewSet)

urlpatterns = [
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("dashboard/", views.dashboard),
    path("today/", views.today),
    path("settings/", views.SettingsView.as_view()),
    path("demo/load/", views.demo_load),
    path("demo/clear/", views.demo_clear),
    path("", include(router.urls)),
]
