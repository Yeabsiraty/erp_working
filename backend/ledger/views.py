from django.contrib.auth import authenticate
from django.db.models import ProtectedError
from rest_framework import permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from . import ethiopian, services
from .models import (BankEntry, Customer, DeliveryNote, Expense, Item, Payment, PaymentRequest, Proforma, Purchase,
                     Sale, ShopSettings)
from .serializers import (BankEntrySerializer, CustomerSerializer, DeliveryNoteSerializer, ExpenseSerializer, ItemSerializer,
                          PaymentRequestSerializer, PaymentSerializer, ProformaSerializer, PurchaseSerializer,
                          SaleSerializer, ShopSettingsSerializer)


# ---------------------------------------------------------------- መግቢያ
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = authenticate(
            username=str(request.data.get("username", "")).strip(),
            password=str(request.data.get("password", "")),
        )
        if user is None or not user.is_active:
            return Response({"detail": "የተጠቃሚ ስም ወይም የይለፍ ቃል ትክክል አይደለም።"}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "username": user.get_username()})


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response({"username": request.user.get_username()})


# ---------------------------------------------------------------- መሠረታዊ ViewSets
class ProtectedDeleteMixin:
    """ሌላ መዝገብ የሚጠቀመውን ዕቃ/ደንበኛ መሰረዝን በግልጽ መልዕክት ይከለክላል።"""

    protected_message = "ይህ መዝገብ በሌሎች መዝገቦች ጥቅም ላይ ስለዋለ መሰረዝ አይቻልም።"

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({"detail": self.protected_message}, status=status.HTTP_409_CONFLICT)


class DatedViewSet(viewsets.ModelViewSet):
    """?y= ?m= ?d= ?limit= ማጣሪያዎችን ይቀበላል።"""

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        params = self.request.query_params
        for key in ("y", "m", "d"):
            if params.get(key, "").isdigit():
                qs = qs.filter(**{key: int(params[key])})
        if self.action == "list" and params.get("limit", "").isdigit():
            qs = qs[: int(params["limit"])]
        return qs


class ItemViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    protected_message = "ይህ ዕቃ ሽያጭ ወይም ግዢ ስላለው መሰረዝ አይቻልም። መጀመሪያ እነዚያን ይሰርዙ።"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            ctx["stats"] = services.item_stats()
        return ctx


class CustomerViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    protected_message = "ይህ ደንበኛ ሽያጭ ወይም ክፍያ ስላለው መሰረዝ አይቻልም።"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            ctx["stats"] = services.customer_stats()
        return ctx


class SaleViewSet(DatedViewSet):
    queryset = Sale.objects.select_related("item", "customer")
    serializer_class = SaleSerializer


class PurchaseViewSet(DatedViewSet):
    queryset = Purchase.objects.select_related("item")
    serializer_class = PurchaseSerializer


class ExpenseViewSet(DatedViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer


class PaymentViewSet(DatedViewSet):
    queryset = Payment.objects.select_related("customer")
    serializer_class = PaymentSerializer

class BankEntryViewSet(DatedViewSet):
    queryset = BankEntry.objects.all()
    serializer_class = BankEntrySerializer

    
class ProformaViewSet(DatedViewSet):
    queryset = Proforma.objects.prefetch_related("items")
    serializer_class = ProformaSerializer


class DeliveryNoteViewSet(DatedViewSet):
    queryset = DeliveryNote.objects.prefetch_related("items")
    serializer_class = DeliveryNoteSerializer


class PaymentRequestViewSet(DatedViewSet):
    queryset = PaymentRequest.objects.prefetch_related("items")
    serializer_class = PaymentRequestSerializer


# ---------------------------------------------------------------- ሌሎች
@api_view(["GET"])
def dashboard(request):
    t = ethiopian.today()

    def num(key, default):
        raw = request.query_params.get(key, "")
        return int(raw) if raw.isdigit() else default

    y, m, d = num("y", t["y"]), num("m", t["m"]), num("d", t["d"])
    if not 1 <= m <= 13:
        m = t["m"]
    return Response(services.dashboard(y, m, d))


@api_view(["GET"])
def today(request):
    return Response(ethiopian.today())


class SettingsView(APIView):
    def get(self, request):
        return Response(ShopSettingsSerializer(ShopSettings.load()).data)

    def put(self, request):
        ser = ShopSettingsSerializer(ShopSettings.load(), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    patch = put


@api_view(["POST"])
def demo_load(request):
    if not services.load_demo():
        return Response({"detail": "ምሳሌ መረጃ የሚጫነው ዳታቤዙ ባዶ ሲሆን ብቻ ነው።"}, status=status.HTTP_409_CONFLICT)
    return Response({"detail": "ok"}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def demo_clear(request):
    services.clear_demo()
    return Response(status=status.HTTP_204_NO_CONTENT)
