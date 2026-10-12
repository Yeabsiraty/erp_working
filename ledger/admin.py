from django.contrib import admin

from .models import (Customer, DeliveryNote, DeliveryNoteItem, Expense, Item, Payment, PaymentRequest, PaymentRequestItem, Proforma, ProformaItem,
                     Purchase, Sale, ShopSettings)


class ProformaItemInline(admin.TabularInline):
    model = ProformaItem
    extra = 0


@admin.register(Proforma)
class ProformaAdmin(admin.ModelAdmin):
    list_display = ("number", "client", "y", "m", "d")
    inlines = [ProformaItemInline]


class PaymentRequestItemInline(admin.TabularInline):
    model = PaymentRequestItem
    extra = 0


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = ("number", "client", "y", "m", "d")
    inlines = [PaymentRequestItemInline]


class DeliveryNoteItemInline(admin.TabularInline):
    model = DeliveryNoteItem
    extra = 0


@admin.register(DeliveryNote)
class DeliveryNoteAdmin(admin.ModelAdmin):
    list_display = ("number", "client", "y", "m", "d")
    inlines = [DeliveryNoteItemInline]


admin.site.register([Item, Customer, Sale, Purchase, Expense, Payment, ShopSettings])
