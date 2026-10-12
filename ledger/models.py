from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .ethiopian import label


def money(**kw):
    kw.setdefault("default", 0)
    return models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)], **kw)


def quantity(**kw):
    kw.setdefault("default", 0)
    return models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(0)], **kw)


class Dated(models.Model):
    """በኢትዮጵያ ቀን (ቀን / ወር / ዓ.ም) የሚመዘገብ መዝገብ።"""

    y = models.PositiveSmallIntegerField("ዓ.ም", validators=[MinValueValidator(1990), MaxValueValidator(2100)])
    m = models.PositiveSmallIntegerField("ወር", validators=[MinValueValidator(1), MaxValueValidator(13)])
    d = models.PositiveSmallIntegerField("ቀን", validators=[MinValueValidator(1), MaxValueValidator(30)])
    demo = models.BooleanField(default=False, help_text="ምሳሌ መረጃ ምልክት")

    class Meta:
        abstract = True
        ordering = ["-y", "-m", "-d", "-id"]

    @property
    def date_label(self) -> str:
        return label(self.y, self.m, self.d)


class Item(models.Model):
    name = models.CharField("የዕቃ ስም", max_length=120, unique=True,
                            error_messages={"unique": "ይህ ዕቃ አስቀድሞ ተመዝግቧል።"})
    unit = models.CharField("መለኪያ", max_length=30, blank=True)
    buy = money()
    sell = money()
    init = quantity()
    low = quantity()
    demo = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Customer(models.Model):
    name = models.CharField("የደንበኛ ስም", max_length=120, unique=True,
                            error_messages={"unique": "ይህ ደንበኛ አስቀድሞ ተመዝግቧል።"})
    phone = models.CharField("ስልክ", max_length=40, blank=True)
    demo = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Sale(Dated):
    CASH, CREDIT = "cash", "credit"
    TYPES = [(CASH, "ጥሬ ገንዘብ"), (CREDIT, "ዱቤ")]

    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="sales")
    qty = quantity()
    price = money()
    type = models.CharField(max_length=10, choices=TYPES, default=CASH)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True, related_name="sales")
    paid = money()  # ዱቤ ሲሆን ቅድሚያ የተከፈለ

    def __str__(self):
        return f"{self.date_label} · {self.item}"


class Purchase(Dated):
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="purchases")
    qty = quantity()
    price = money()
    supplier = models.CharField("አቅራቢ", max_length=120, blank=True)


class Expense(Dated):
    cat = models.CharField("የወጪ ዓይነት", max_length=80)
    note = models.CharField("ማብራሪያ", max_length=200, blank=True)
    amount = money()


class Payment(Dated):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="payments")
    amount = money()
    note = models.CharField("ማስታወሻ", max_length=200, blank=True)


class BankEntry(Dated):
    """ወደ ካፒታል የገባ ገንዘብ — ያለ ዕዳ (own) ወይም በዕዳ (debt)።"""

    OWN, DEBT = "own", "debt"
    KINDS = [(OWN, "ያለ ዕዳ"), (DEBT, "በዕዳ")]

    amount = money()
    kind = models.CharField(max_length=10, choices=KINDS, default=OWN)
    reason = models.CharField("ምክንያት", max_length=200, blank=True)
    # በዕዳ የገባ ገንዘብ ሲመለስ
    repaid = models.BooleanField(default=False)
    rep_y = models.PositiveSmallIntegerField(null=True, blank=True)
    rep_m = models.PositiveSmallIntegerField(null=True, blank=True)
    rep_d = models.PositiveSmallIntegerField(null=True, blank=True)




class Proforma(Dated):
    seq = models.PositiveIntegerField("ተራ ቁጥር")
    client = models.CharField("ደንበኛ", max_length=160, blank=True)
    tot_rate = models.DecimalField("TOT %", max_digits=5, decimal_places=2, default=15,
                                   validators=[MinValueValidator(0), MaxValueValidator(100)])
    terms = models.TextField("Terms and conditions", blank=True)

    class Meta(Dated.Meta):
        constraints = [models.UniqueConstraint(fields=["y", "seq"], name="uniq_proforma_year_seq")]

    @property
    def number(self) -> str:
        return f"PF-{self.y}-{self.seq:04d}"

    def __str__(self):
        return self.number


class ProformaItem(models.Model):
    proforma = models.ForeignKey(Proforma, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=200)
    price = money()
    qty = quantity(default=1)

    class Meta:
        ordering = ["id"]


class PaymentRequest(Dated):
    """የክፍያ ጥያቄ (PAYMENT REQUEST) — እንደ ፕሮፎርማ ግን የመክፈያ ቀን እና VAT አለው።"""

    seq = models.PositiveIntegerField("ተራ ቁጥር")
    client = models.CharField("ደንበኛ", max_length=160, blank=True)
    due_y = models.PositiveSmallIntegerField("መክፈያ ዓ.ም", validators=[MinValueValidator(1990), MaxValueValidator(2100)])
    due_m = models.PositiveSmallIntegerField("መክፈያ ወር", validators=[MinValueValidator(1), MaxValueValidator(13)])
    due_d = models.PositiveSmallIntegerField("መክፈያ ቀን", validators=[MinValueValidator(1), MaxValueValidator(30)])
    vat_rate = models.DecimalField("VAT %", max_digits=5, decimal_places=2, default=15,
                                   validators=[MinValueValidator(0), MaxValueValidator(100)])
    terms = models.TextField("Terms and conditions", blank=True)

    class Meta(Dated.Meta):
        constraints = [models.UniqueConstraint(fields=["y", "seq"], name="uniq_payreq_year_seq")]

    @property
    def number(self) -> str:
        return f"PR-{self.y}-{self.seq:04d}"

    def __str__(self):
        return self.number


class PaymentRequestItem(models.Model):
    request = models.ForeignKey(PaymentRequest, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=200)
    price = money()
    qty = quantity(default=1)

    class Meta:
        ordering = ["id"]


class DeliveryNote(Dated):
    """የማድረሻ ሰነድ (DELIVERY NOTE) — ዋጋ የለውም፤ የሚደርሱ ዕቃዎች ዝርዝር ብቻ።"""

    seq = models.PositiveIntegerField("ተራ ቁጥር")
    client = models.CharField("ደንበኛ", max_length=160, blank=True)

    class Meta(Dated.Meta):
        constraints = [models.UniqueConstraint(fields=["y", "seq"], name="uniq_delivery_year_seq")]

    @property
    def number(self) -> str:
        return f"DN-{self.y}-{self.seq:04d}"

    def __str__(self):
        return self.number


class DeliveryNoteItem(models.Model):
    note = models.ForeignKey(DeliveryNote, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=300)

    class Meta:
        ordering = ["id"]


class ShopSettings(models.Model):
    """አንድ ረድፍ ብቻ ያለው የሱቅና የፕሮፎርማ ማስተካከያ።"""

    name = models.CharField("የሱቅ ስም", max_length=120, default="የእኔ ሱቅ")
    title_am = models.CharField(max_length=120, default="አብሮስ ህትመት ስራ", blank=True)
    title_en = models.CharField(max_length=120, default="ABROS PRINTING WORK", blank=True)
    website = models.CharField(max_length=120, default="www.abrosprint.com", blank=True)
    phone = models.CharField(max_length=60, default="+251 955 33 15 33", blank=True)
    handle = models.CharField(max_length=80, default="@abrosdesign", blank=True)
    social = models.CharField(max_length=80, default="@abrsodesign", blank=True)
    signer = models.CharField(max_length=120, default="Yohannes Tadu", blank=True)
    signer_role = models.CharField(max_length=80, default="G.MANAGER", blank=True)
    tot_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15,
                                   validators=[MinValueValidator(0), MaxValueValidator(100)])
    terms = models.TextField(
        default="The price and terms of this offer are valid for 20 days from date of this proposal.",
        blank=True,
    )
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15,
                                   validators=[MinValueValidator(0), MaxValueValidator(100)])
    # የመነሻ ካፒታል፦ ደብተሩን ሲጀምሩ በእጅ/በባንክ ያለ ገንዘብ (የካፒታልና የገንዘብ ፍሰት ሒሳብ መነሻ)
    opening_cash = models.DecimalField(max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    pr_terms = models.TextField(
        default="Payment is requested according to the agreed terms and the amount shown above.",
        blank=True,
    )

    class Meta:
        verbose_name_plural = "shop settings"

    @classmethod
    def load(cls) -> "ShopSettings":
        from django.conf import settings as dj
        obj, _ = cls.objects.get_or_create(pk=1, defaults=getattr(dj, "SHOP_DEFAULTS", {}))
        return obj

    def __str__(self):
        return self.name
