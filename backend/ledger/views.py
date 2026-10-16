from django.contrib.auth import authenticate
from django.core import signing
from django.db.models import ProtectedError
from rest_framework import permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from . import services
from . import ethiopian
from .models import (BankEntry, Customer, DeliveryNote, Expense, Item, Payment, PaymentRequest, Proforma, Purchase,
                     Sale, ShopSettings)
from .serializers import (BankEntrySerializer, CustomerSerializer, DeliveryNoteSerializer, ExpenseSerializer, ItemSerializer,
                          PaymentRequestSerializer, PaymentSerializer, ProformaSerializer, PurchaseSerializer,
                          SaleSerializer, ShopSettingsSerializer)
from .models import Attachment, AttachmentItem
from .serializers import AttachmentSerializer

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
        u = request.user
        return Response({"username": u.get_username(), "is_superuser": u.is_superuser, "is_staff": u.is_staff})


# ---------------------------------------------------------------- የይለፍ ቃል መቆለፊያዎች
BANK_SALT, BANK_MAX_AGE = "bank-access", 15 * 60          # 15 ደቂቃ
REPORT_SALT, REPORT_MAX_AGE = "report-access", 15 * 60    # 15 ደቂቃ
ACTION_SALT, ACTION_MAX_AGE = "action-password", 30 * 60  # ለማስተካከል/ለመሰረዝ — 30 ደቂቃ


def _valid_token(request, param, salt, max_age) -> bool:
    raw = request.query_params.get(param, "")
    try:
        data = signing.loads(raw, salt=salt, max_age=max_age)
    except signing.BadSignature:  # SignatureExpired ን ጨምሮ
        return False
    return data.get("u") == request.user.pk


class IsSuperuser(permissions.BasePermission):
    message = "ይህ ክፍል ለዋና አስተዳዳሪ (superuser) ብቻ ነው።"

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_superuser)


class _TokenGate(IsSuperuser):
    param, salt, max_age = "", "", 0

    def has_permission(self, request, view):
        return super().has_permission(request, view) and _valid_token(request, self.param, self.salt, self.max_age)


class BankUnlocked(_TokenGate):
    message = "የባንክ ይለፍ ቃል ያስፈልጋል።"
    param, salt, max_age = "bt", BANK_SALT, BANK_MAX_AGE


class ReportUnlocked(_TokenGate):
    message = "የሪፖርት ይለፍ ቃል ያስፈልጋል።"
    param, salt, max_age = "rt", REPORT_SALT, REPORT_MAX_AGE


class PasswordRequiredForChange(permissions.BasePermission):
    """PUT / PATCH / DELETE የሚፈቀዱት በቅርብ ጊዜ ይለፍ ቃል ካረጋገጠ ተጠቃሚ ብቻ ነው (?at=<token>)።"""

    message = "ለማስተካከል ወይም ለመሰረዝ የይለፍ ቃል ያስፈልጋል።"

    def has_permission(self, request, view):
        if request.method in ("PUT", "PATCH", "DELETE"):
            return _valid_token(request, "at", ACTION_SALT, ACTION_MAX_AGE)
        return True
    
class PasswordRequiredForPayment(PasswordRequiredForChange):
    """Recording a new payment (POST) also needs a fresh password check."""

    message = "ክፍያ ለመመዝገብ የይለፍ ቃል ያስፈልጋል።"

    def has_permission(self, request, view):
        if request.method == "POST":
            return _valid_token(request, "at", ACTION_SALT, ACTION_MAX_AGE)
        return super().has_permission(request, view)

BASE_PERMS = [permissions.IsAuthenticated, PasswordRequiredForChange]


class PasswordCheckThrottle(UserRateThrottle):
    scope = "password_check"
    rate = "10/min"


class _PasswordView(APIView):
    throttle_classes = [PasswordCheckThrottle]
    salt = ""
    require_superuser = False

    def post(self, request):
        if self.require_superuser and not request.user.is_superuser:
            return Response({"detail": IsSuperuser.message}, status=status.HTTP_403_FORBIDDEN)
        user = authenticate(
            username=request.user.get_username(),
            password=str(request.data.get("password", "")),
        )
        if user is None or user.pk != request.user.pk:
            return Response({"detail": "የይለፍ ቃሉ ትክክል አይደለም።"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"token": signing.dumps({"u": user.pk}, salt=self.salt)})


class BankUnlockView(_PasswordView):
    salt, require_superuser = BANK_SALT, True


class ReportUnlockView(_PasswordView):
    salt, require_superuser = REPORT_SALT, True


class VerifyPasswordView(_PasswordView):
    salt = ACTION_SALT


# ---------------------------------------------------------------- መሠረታዊ ViewSets
class ProtectedDeleteMixin:
    protected_message = "ይህ መዝገብ በሌሎች መዝገቦች ጥቅም ላይ ስለዋለ መሰረዝ አይቻልም።"

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({"detail": self.protected_message}, status=status.HTTP_409_CONFLICT)


class DatedViewSet(viewsets.ModelViewSet):
    """?y= ?m= ?d= ?limit= ማጣሪያዎችን ይቀበላል።"""

    permission_classes = BASE_PERMS

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
    permission_classes = BASE_PERMS
    protected_message = "ይህ ዕቃ ሽያጭ ወይም ግዢ ስላለው መሰረዝ አይቻልም። መጀመሪያ እነዚያን ይሰርዙ።"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            ctx["stats"] = services.item_stats()
        return ctx


class CustomerViewSet(ProtectedDeleteMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = BASE_PERMS
    protected_message = "ይህ ደንበኛ ሽያጭ ወይም ክፍያ ስላለው መሰረዝ አይቻልም።"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list": 
            ctx["stats"] = services.customer_stats()
        return ctx


    @action(detail=False, methods=["get"], url_path="debt-details")
    def debt_details(self, request):
        return Response(services.debt_details())


class SaleViewSet(DatedViewSet):
    queryset = Sale.objects.select_related("item", "customer")
    serializer_class = SaleSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == "list":
            ctx["settle"] = services.credit_settlement()
        return ctx


class PurchaseViewSet(DatedViewSet):
    queryset = Purchase.objects.select_related("item")
    serializer_class = PurchaseSerializer


class ExpenseViewSet(DatedViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer


class PaymentViewSet(DatedViewSet):
    queryset = Payment.objects.select_related("customer")
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, PasswordRequiredForPayment]


class BankEntryViewSet(DatedViewSet):
    queryset = BankEntry.objects.all()
    serializer_class = BankEntrySerializer
    permission_classes = [permissions.IsAuthenticated, BankUnlocked, PasswordRequiredForChange]

    def destroy(self, request, *args, **kwargs):
        if self.get_object().kind == BankEntry.DEBT:
            return Response({"detail": "በዕዳ የገባ ገንዘብ አይሰረዝም፤ በ “ክፈል” ይዝጉት።"}, status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        entry = self.get_object()
        if entry.kind != BankEntry.DEBT or entry.repaid:
            return Response({"detail": "ይህ ዕዳ አስቀድሞ ተከፍሏል።"}, status=status.HTTP_400_BAD_REQUEST)
        now = ethiopian.today()
        entry.repaid = True
        entry.rep_y, entry.rep_m, entry.rep_d = now["y"], now["m"], now["d"]
        entry.save(update_fields=["repaid", "rep_y", "rep_m", "rep_d"])
        return Response(BankEntrySerializer(entry).data)


class ProformaViewSet(DatedViewSet):
    queryset = Proforma.objects.select_related("attachment").prefetch_related("items")
    serializer_class = ProformaSerializer


class DeliveryNoteViewSet(DatedViewSet):
    queryset = DeliveryNote.objects.prefetch_related("items")
    serializer_class = DeliveryNoteSerializer


class PaymentRequestViewSet(DatedViewSet):
    queryset = PaymentRequest.objects.prefetch_related("items")
    serializer_class = PaymentRequestSerializer




class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.select_related("proforma").prefetch_related("items")
    serializer_class = AttachmentSerializer
    permission_classes = BASE_PERMS   # PUT / PATCH / DELETE need the password token

    @action(detail=False, methods=["get"], url_path="next-ids")
    def next_ids(self, request):
        """For the editor preview: the ids the next saved attachment / line will most likely get."""
        last = Attachment.objects.order_by("-id").values_list("id", flat=True).first() or 0
        last_item = AttachmentItem.objects.order_by("-id").values_list("id", flat=True).first() or 0
        return Response({"next_id": last + 1, "next_item_id": last_item + 1})


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
    # saving settings needs a fresh password check (?at=<token>)
    permission_classes = [permissions.IsAuthenticated, PasswordRequiredForChange]

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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, BankUnlocked])
def bank_summary(request):
    t = ethiopian.today()

    def num(key, default):
        raw = request.query_params.get(key, "")
        return int(raw) if raw.isdigit() else default

    y, m, d = num("y", t["y"]), num("m", t["m"]), num("d", t["d"])
    if not 1 <= m <= 13:
        m = t["m"]
    return Response(services.bank_summary(y, m, d))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, ReportUnlocked])
def report_view(request):
    p = request.query_params
    t = ethiopian.today()

    def parse(key, default):
        try:
            y, m, d = (int(x) for x in p.get(key, "").split("-"))
        except ValueError:
            return default
        return (y, m, d) if ethiopian.is_valid(y, m, d) else default

    def pk(key):
        raw = p.get(key, "")
        return int(raw) if raw.isdigit() else None

    start = parse("from", (t["y"], 1, 1))
    end = parse("to", (t["y"], t["m"], t["d"]))
    if start > end:
        start, end = end, start
    wanted = {s for s in p.get("sections", "").split(",") if s in services.ALL_SECTIONS}
    return Response(services.report(
        start=start, end=end, sections=wanted or set(services.ALL_SECTIONS),
        item=pk("item"), customer=pk("customer"), sale_type=p.get("type", ""),
        category=p.get("category", "").strip(), bank_kind=p.get("bank_kind", ""),
        debt_status=p.get("debt_status", ""),
    ))