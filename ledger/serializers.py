from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from . import services
from . import ethiopian
from .models import (BankEntry, Customer, DeliveryNote, DeliveryNoteItem, Expense, Item, Payment, PaymentRequest, PaymentRequestItem, Proforma, ProformaItem,
                     Purchase, Sale, ShopSettings)


# ---------------------------------------------------------------- እገዛ
class DatedSerializer(serializers.ModelSerializer):
    """ቀን / ወር / ዓ.ም ትክክል መሆኑን (ጳጉሜንን ጨምሮ) ያረጋግጣል።"""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        inst = self.instance
        y = attrs.get("y", getattr(inst, "y", None))
        m = attrs.get("m", getattr(inst, "m", None))
        d = attrs.get("d", getattr(inst, "d", None))
        if None not in (y, m, d) and not ethiopian.is_valid(y, m, d):
            if 1 <= m <= 13:
                msg = f"ቀኑ ትክክል አይደለም ({ethiopian.MONTHS[m - 1]} እስከ {ethiopian.max_day(y, m)} ቀን ብቻ አለው)።"
            else:
                msg = "ቀኑ ትክክል አይደለም።"
            raise serializers.ValidationError({"d": msg})
        return attrs


def _name_or_empty(obj, attr):
    related = getattr(obj, attr, None)
    return related.name if related else ""


# ---------------------------------------------------------------- ዕቃ
class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ["id", "name", "unit", "buy", "sell", "init", "low", "demo"]
        read_only_fields = ["demo"]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        stats_map = self.context.get("stats")
        stats = stats_map.get(obj.pk) if stats_map else None
        if stats is None:
            stats = services.item_stats([obj])[obj.pk]
        data.update(stats)
        return data


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "demo"]
        read_only_fields = ["demo"]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        stats_map = self.context.get("stats")
        stats = stats_map.get(obj.pk) if stats_map else None
        if stats is None:
            stats = services.customer_stats([obj])[obj.pk]
        data.update(stats)
        return data


# ---------------------------------------------------------------- ሽያጭ
class SaleSerializer(DatedSerializer):
    item_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    cost = serializers.SerializerMethodField()
    profit = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = ["id", "y", "m", "d", "item", "item_name", "qty", "price", "type",
                  "customer", "customer_name", "paid", "total", "cost", "profit", "demo"]
        read_only_fields = ["demo"]

    def get_item_name(self, obj):
        return obj.item.name

    def get_customer_name(self, obj):
        return _name_or_empty(obj, "customer")

    def validate_qty(self, value):
        if value <= 0:
            raise serializers.ValidationError("ብዛት ከ0 በላይ መሆን አለበት።")
        return value

    def get_total(self, obj):
        return services.r2(obj.qty * obj.price)

    def get_cost(self, obj):
        return services.r2(obj.qty * obj.item.buy)

    def get_profit(self, obj):
        return services.r2(obj.qty * obj.price - obj.qty * obj.item.buy)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        inst = self.instance
        kind = attrs.get("type", inst.type if inst else Sale.CASH)
        qty = attrs.get("qty", inst.qty if inst else Decimal("0"))
        price = attrs.get("price", inst.price if inst else Decimal("0"))
        item = attrs.get("item", inst.item if inst else None)
        if item is not None:
            left = services.item_stats([item])[item.pk]["left"]
            if inst and inst.item_id == item.pk:
                left += inst.qty  # when editing, give back the old quantity of this same sale
            if qty > left:
                raise serializers.ValidationError(
                    {"qty": f"በክምችት ያለው {format(left.normalize(), 'f')} ብቻ ነው።"}
                )
        if kind == Sale.CREDIT:
            customer = attrs.get("customer", inst.customer if inst else None)
            if customer is None:
                raise serializers.ValidationError({"customer": "ዱቤ ሽያጭ ደንበኛ ያስፈልገዋል።"})
            paid = attrs.get("paid", inst.paid if inst else Decimal("0"))
            if paid > qty * price:
                raise serializers.ValidationError({"paid": "ቅድሚያ የተከፈለ ከጠቅላላው መብለጥ የለበትም።"})
        else:
            attrs["customer"] = None
            attrs["paid"] = Decimal("0")
        return attrs


class PurchaseSerializer(DatedSerializer):
    item_name = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = ["id", "y", "m", "d", "item", "item_name", "qty", "price", "supplier", "total", "demo"]
        read_only_fields = ["demo"]

    def get_item_name(self, obj):
        return obj.item.name

    def validate_qty(self, value):
        if value <= 0:
            raise serializers.ValidationError("ብዛት ከ0 በላይ መሆን አለበት።")
        return value

    def get_total(self, obj):
        return services.r2(obj.qty * obj.price)


class ExpenseSerializer(DatedSerializer):
    class Meta:
        model = Expense
        fields = ["id", "y", "m", "d", "cat", "note", "amount", "demo"]
        read_only_fields = ["demo"]


class PaymentSerializer(DatedSerializer):
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ["id", "y", "m", "d", "customer", "customer_name", "amount", "note", "demo"]
        read_only_fields = ["demo"]

    def get_customer_name(self, obj):
        return obj.customer.name

class BankEntrySerializer(DatedSerializer):
    class Meta:
        model = BankEntry
        fields = ["id", "y", "m", "d", "amount", "kind", "reason",
                  "repaid", "rep_y", "rep_m", "rep_d", "demo"]
        read_only_fields = ["repaid", "rep_y", "rep_m", "rep_d", "demo"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("ገንዘቡ ከ0 በላይ መሆን አለበት።")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.repaid:
            raise serializers.ValidationError({"amount": "የተከፈለ ዕዳ ማስተካከል አይቻልም።"})
        return attrs


class ProformaItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProformaItem
        fields = ["id", "name", "price", "qty"]
        read_only_fields = ["id"]


class DocumentSerializer(DatedSerializer):
    """ፕሮፎርማና የክፍያ ጥያቄ የሚጋሩት: ዕቃዎች (nested)፣ ተራ ቁጥር በዓመት፣ ድምር።"""

    item_model = None   # ProformaItem / PaymentRequestItem
    parent_field = None  # "proforma" / "request"
    rate_field = None    # "tot_rate" / "vat_rate"
    number = serializers.CharField(read_only=True)
    totals = serializers.SerializerMethodField()

    def get_totals(self, obj):
        return services.proforma_totals(list(obj.items.all()), getattr(obj, self.rate_field))

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("ቢያንስ አንድ ዕቃ ወይም አገልግሎት ይጻፉ።")
        return value

    def _make_items(self, parent, rows):
        self.item_model.objects.bulk_create([self.item_model(**{self.parent_field: parent}, **r) for r in rows])

    @transaction.atomic
    def create(self, validated):
        rows = validated.pop("items")
        validated["seq"] = services.next_seq(validated["y"], self.Meta.model)
        obj = self.Meta.model.objects.create(**validated)
        self._make_items(obj, rows)
        return obj

    @transaction.atomic
    def update(self, instance, validated):
        rows = validated.pop("items", None)
        new_year = validated.get("y", instance.y)
        if new_year != instance.y:  # ዓመት ከተቀየረ ተራ ቁጥር በአዲሱ ዓመት እንደገና ይሰጣል
            instance.seq = services.next_seq(new_year, self.Meta.model)
        for key, val in validated.items():
            setattr(instance, key, val)
        instance.save()
        if rows is not None:
            instance.items.all().delete()
            self._make_items(instance, rows)
        return instance


class ProformaSerializer(DocumentSerializer):
    items = ProformaItemSerializer(many=True)
    item_model, parent_field, rate_field = ProformaItem, "proforma", "tot_rate"

    class Meta:
        model = Proforma
        fields = ["id", "y", "m", "d", "seq", "number", "client", "tot_rate", "terms", "items", "totals", "demo"]
        read_only_fields = ["seq", "demo"]


# ---------------------------------------------------------------- የክፍያ ጥያቄ
class PaymentRequestItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRequestItem
        fields = ["id", "name", "price", "qty"]
        read_only_fields = ["id"]


class PaymentRequestSerializer(DocumentSerializer):
    items = PaymentRequestItemSerializer(many=True)
    item_model, parent_field, rate_field = PaymentRequestItem, "request", "vat_rate"

    class Meta:
        model = PaymentRequest
        fields = ["id", "y", "m", "d", "seq", "number", "client", "due_y", "due_m", "due_d",
                  "vat_rate", "terms", "items", "totals", "demo"]
        read_only_fields = ["seq", "demo"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        inst = self.instance
        y, m, d = (attrs.get(k, getattr(inst, k, None)) for k in ("due_y", "due_m", "due_d"))
        if None not in (y, m, d) and not ethiopian.is_valid(y, m, d):
            raise serializers.ValidationError({"due_d": "የመክፈያ ቀኑ ትክክል አይደለም።"})
        return attrs


# ---------------------------------------------------------------- የማድረሻ ሰነድ
class DeliveryNoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryNoteItem
        fields = ["id", "name"]
        read_only_fields = ["id"]


class DeliveryNoteSerializer(DocumentSerializer):
    items = DeliveryNoteItemSerializer(many=True)
    totals = None  # ዋጋ የለውም
    item_model, parent_field = DeliveryNoteItem, "note"

    class Meta:
        model = DeliveryNote
        fields = ["id", "y", "m", "d", "seq", "number", "client", "items", "demo"]
        read_only_fields = ["seq", "demo"]


# ---------------------------------------------------------------- ማስተካከያ
class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        exclude = ["id"]
