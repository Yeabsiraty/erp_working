"""ስሌቶች፦ ክምችት፣ ዕዳ፣ ዳሽቦርድ፣ ፕሮፎርማ፣ ምሳሌ መረጃ።"""
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Sum

from . import ethiopian
from .models import (BankEntry, Customer, DeliveryNote, Expense, Item, Payment, PaymentRequest, Proforma, ProformaItem,
                     Purchase, Sale, ShopSettings)

ZERO = Decimal("0")
CENT = Decimal("0.01")
_DEC = DecimalField(max_digits=28, decimal_places=5)

SALE_TOTAL = ExpressionWrapper(F("qty") * F("price"), output_field=_DEC)
SALE_COST = ExpressionWrapper(F("qty") * F("item__buy"), output_field=_DEC)


def r2(value) -> Decimal:
    """ወደ 2 አስርዮሽ ያጠጋል (ግማሽ ወደ ላይ)።"""
    return Decimal(value or 0).quantize(CENT, rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------- ክምችት
def item_stats(items=None) -> dict:
    """{item_id: {bought, sold, left, status, value, revenue, profit}}"""
    items = list(Item.objects.all() if items is None else items)
    ids = [i.pk for i in items]
    bought = {r["item_id"]: r["t"] for r in
              Purchase.objects.filter(item_id__in=ids).values("item_id").order_by().annotate(t=Sum("qty"))}
    sold = {r["item_id"]: r for r in
            Sale.objects.filter(item_id__in=ids).values("item_id").order_by()
            .annotate(qty_sum=Sum("qty"), rev=Sum(SALE_TOTAL))}
    out = {}
    for it in items:
        b = bought.get(it.pk) or ZERO
        s = sold.get(it.pk) or {}
        sold_qty = s.get("qty_sum") or ZERO
        revenue = s.get("rev") or ZERO
        left = it.init + b - sold_qty
        if left <= 0:
            status = "out"
        elif left <= it.low:
            status = "low"
        else:
            status = "ok"
        out[it.pk] = {
            "bought": b, "sold": sold_qty, "left": left, "status": status,
            "value": r2(left * it.buy), "revenue": r2(revenue),
            "profit": r2(revenue - sold_qty * it.buy),
        }
    return out


# ---------------------------------------------------------------- ዕዳ
def customer_stats(customers=None) -> dict:
    """{customer_id: {credit, upfront, paid, balance, status}}"""
    customers = list(Customer.objects.all() if customers is None else customers)
    ids = [c.pk for c in customers]
    credit = {r["customer_id"]: r for r in
              Sale.objects.filter(type=Sale.CREDIT, customer_id__in=ids).values("customer_id").order_by()
              .annotate(total=Sum(SALE_TOTAL), upfront=Sum("paid"))}
    paid = {r["customer_id"]: r["t"] for r in
            Payment.objects.filter(customer_id__in=ids).values("customer_id").order_by().annotate(t=Sum("amount"))}
    out = {}
    for c in customers:
        cr = credit.get(c.pk) or {}
        total = r2(cr.get("total"))
        upfront = r2(cr.get("upfront"))
        later = r2(paid.get(c.pk))
        balance = total - upfront - later
        out[c.pk] = {"credit": total, "upfront": upfront, "paid": later, "balance": balance,
                     "status": "owes" if balance > 0 else "clear"}
    return out


# ---------------------------------------------------------------- ዳሽቦርድ
def _sum(qs, expr=None, field=None):
    key = "t"
    agg = qs.aggregate(**{key: Sum(expr if expr is not None else field)})
    return r2(agg[key])


def _cash_totals(**flt) -> tuple:
    """(ገቢ, ወጪ) — ገንዘብ በእውነት የገባና የወጣ፦
    ገቢ = የጥሬ ሽያጭ + በዱቤ ሽያጭ ላይ የተከፈለ ቅድመ ክፍያ + የዕዳ ክፍያዎች ፣ ወጪ = ግዢ + ወጪዎች።
    (ዱቤ ገና ያልተከፈለው ገንዘብ አልገባም፤ እንደ "ተቀባይ ዕዳ" በካፒታል ውስጥ ይቆጠራል።)"""
    cash_sales = _sum(Sale.objects.filter(type=Sale.CASH, **flt), expr=SALE_TOTAL)
    upfront = _sum(Sale.objects.filter(type=Sale.CREDIT, **flt), field="paid")
    collected = _sum(Payment.objects.filter(**flt), field="amount")
    bought = _sum(Purchase.objects.filter(**flt), expr=SALE_TOTAL)
    spent = _sum(Expense.objects.filter(**flt), field="amount")
    deposits = _sum(BankEntry.objects.filter(**flt), field="amount")
    return cash_sales + upfront + collected + deposits, bought + spent


def _cash_year(y: int) -> dict:
    """{ወር: (ገቢ, ወጪ)} ለአንድ ዓመት።"""
    def by_month(qs, expr):
        return {r["m"]: r["t"] for r in qs.values("m").order_by().annotate(t=Sum(expr))}
    inc = {}
    for src in (by_month(Sale.objects.filter(y=y, type=Sale.CASH), SALE_TOTAL),
                by_month(Sale.objects.filter(y=y, type=Sale.CREDIT), F("paid")),
                by_month(Payment.objects.filter(y=y), F("amount")),
                by_month(BankEntry.objects.filter(y=y), F("amount"))):
        for k, v in src.items():
            inc[k] = inc.get(k, ZERO) + (v or ZERO)
    out = {}
    for src in (by_month(Purchase.objects.filter(y=y), SALE_TOTAL),
                by_month(Expense.objects.filter(y=y), F("amount"))):
        for k, v in src.items():
            out[k] = out.get(k, ZERO) + (v or ZERO)
    return {mm: (r2(inc.get(mm)), r2(out.get(mm))) for mm in range(1, 14)}


def dashboard(y: int, m: int, d: int) -> dict:
    sales_year = {r["m"]: r for r in
                  Sale.objects.filter(y=y).values("m").order_by()
                  .annotate(sales=Sum(SALE_TOTAL), cost=Sum(SALE_COST))}
    exp_year = {r["m"]: r["t"] for r in
                Expense.objects.filter(y=y).values("m").order_by().annotate(t=Sum("amount"))}

    months, tot = [], {"sales": ZERO, "cost": ZERO, "gross": ZERO, "expenses": ZERO, "net": ZERO}
    for mm in range(1, 14):
        s = r2((sales_year.get(mm) or {}).get("sales"))
        c = r2((sales_year.get(mm) or {}).get("cost"))
        e = r2(exp_year.get(mm))
        row = {"m": mm, "sales": s, "cost": c, "gross": s - c, "expenses": e, "net": s - c - e}
        months.append(row)
        for k in tot:
            tot[k] += row[k]

    cur = months[m - 1] if 1 <= m <= 13 else months[0]
    day_sales = _sum(Sale.objects.filter(y=y, m=m, d=d), expr=SALE_TOTAL)

    stats = item_stats()
    items = {i.pk: i for i in Item.objects.all()}
    rows = [(items[pk], st) for pk, st in stats.items()]
    cust = customer_stats()

    def pack(i, st):
        return {"name": i.name, "unit": i.unit, "sold": st["sold"], "profit": st["profit"],
                "left": st["left"], "status": st["status"]}

    top_qty = sorted([x for x in rows if x[1]["sold"] > 0], key=lambda x: -x[1]["sold"])[:5]
    top_profit = sorted([x for x in rows if x[1]["profit"] > 0], key=lambda x: -x[1]["profit"])[:5]
    low = sorted([x for x in rows if x[1]["status"] != "ok"], key=lambda x: x[1]["left"])[:8]

    # ---- ካፒታልና የገንዘብ ፍሰት ----
    opening_cash = ZERO  # መነሻ ገንዘብ አሁን ከባንክ መዝገብ ነው የሚመጣው
    bank_all = _sum(BankEntry.objects.all(), field="amount")
    bank_debt = _sum(BankEntry.objects.filter(kind=BankEntry.DEBT), field="amount")
    in_all, out_all = _cash_totals()
    cash_balance = opening_cash + in_all - out_all
    stock_value = sum((st["value"] for _, st in rows), ZERO)
    receivables = sum((c["balance"] for c in cust.values()), ZERO)
    opening_stock = r2(sum((i.init * i.buy for i in items.values()), ZERO))
    initial_capital = bank_all + opening_stock
    capital_balance = cash_balance + stock_value + receivables

    in_before, out_before = _cash_totals(y__lt=y)
    running = opening_cash + in_before - out_before
    flows = _cash_year(y)
    cash_months = []
    for mm in range(1, 14):
        cin, cout = flows[mm]
        running += cin - cout
        cash_months.append({"m": mm, "inflow": cin, "outflow": cout, "net": cin - cout, "balance": running})
    year_in = sum((r["inflow"] for r in cash_months), ZERO)
    year_out = sum((r["outflow"] for r in cash_months), ZERO)
    cur_cash = cash_months[m - 1] if 1 <= m <= 13 else cash_months[0]

    return {
        "period": {"y": y, "m": m, "d": d},
        "capital": {
            "opening_cash": bank_all, "opening_stock": opening_stock, "initial": initial_capital,
            "cash": cash_balance, "stock": stock_value, "receivables": receivables,
            "balance": capital_balance, "growth": capital_balance - initial_capital,
        },
        "cashflow": {
            "balance": cash_balance, "opening": opening_cash + in_before - out_before, "bank_debt": bank_debt,
            "month_in": cur_cash["inflow"], "month_out": cur_cash["outflow"], "month_net": cur_cash["net"],
            "year_in": year_in, "year_out": year_out, "year_net": year_in - year_out,
            "months": cash_months,
        },
        "is_empty": not items,
        "kpis": {
            "day_sales": day_sales,
            "month_sales": cur["sales"], "month_gross": cur["gross"],
            "month_expenses": cur["expenses"], "month_net": cur["net"],
            "year_sales": tot["sales"], "year_net": tot["net"],
            "stock_value": sum((st["value"] for _, st in rows), ZERO),
            "debt_total": sum((c["balance"] for c in cust.values()), ZERO),
            "debtors": sum(1 for c in cust.values() if c["balance"] > 0),
            "low_count": sum(1 for _, st in rows if st["status"] != "ok"),
        },
        "months": months,
        "year_total": tot,
        "top_qty": [pack(i, st) for i, st in top_qty],
        "top_profit": [pack(i, st) for i, st in top_profit],
        "low_stock": [pack(i, st) for i, st in low],
    }


# ---------------------------------------------------------------- ፕሮፎርማ
def proforma_totals(items, rate) -> dict:
    """items፦ price እና qty ያላቸው ዕቃዎች። TOT በ 2 አስርዮሽ ይጠጋል።"""
    sub = sum((r2(Decimal(i.price) * Decimal(i.qty)) for i in items), ZERO)
    tot = r2(sub * Decimal(rate) / Decimal(100))
    return {"sub": sub, "tot": tot, "grand": sub + tot}


def next_seq(year: int, model=Proforma) -> int:
    last = model.objects.filter(y=year).order_by("-seq").values_list("seq", flat=True).first()
    return (last or 0) + 1


# ---------------------------------------------------------------- ምሳሌ መረጃ
@transaction.atomic
def load_demo() -> bool:
    """ዳታቤዙ ባዶ ሲሆን ብቻ ምሳሌ መረጃ ይጭናል።"""
    if Item.objects.exists() or Customer.objects.exists():
        return False
    t = ethiopian.today()

    def day(back):
        return max(1, t["d"] - back)

    rice = Item.objects.create(name="ሩዝ", unit="ኪሎ", buy=80, sell=95, init=100, low=20, demo=True)
    oil = Item.objects.create(name="ዘይት", unit="ሊትር", buy=150, sell=180, init=40, low=10, demo=True)
    sugar = Item.objects.create(name="ስኳር", unit="ኪሎ", buy=70, sell=85, init=60, low=15, demo=True)
    abebe = Customer.objects.create(name="አበበ ከበደ", phone="0911-000000", demo=True)

    base = {"y": t["y"], "m": t["m"], "demo": True}
    Purchase.objects.create(**base, d=day(4), item=rice, qty=50, price=80, supplier="ሁሉ ጅምላ")
    Sale.objects.create(**base, d=day(3), item=rice, qty=10, price=95)
    Sale.objects.create(**base, d=day(2), item=oil, qty=5, price=180)
    Sale.objects.create(**base, d=day(1), item=rice, qty=20, price=95, type=Sale.CREDIT, customer=abebe, paid=500)
    Sale.objects.create(**base, d=day(0), item=sugar, qty=8, price=85)
    Payment.objects.create(**base, d=t["d"], customer=abebe, amount=300, note="በከፊል ክፍያ")
    Expense.objects.create(**base, d=1, cat="ኪራይ", note="የሱቅ ኪራይ", amount=3000)
    Expense.objects.create(**base, d=day(1), cat="መብራትና ውሃ", note="የመብራት ክፍያ", amount=450)
    return True


@transaction.atomic
def clear_demo() -> None:
    Payment.objects.filter(demo=True).delete()
    Sale.objects.filter(demo=True).delete()
    Purchase.objects.filter(demo=True).delete()
    Expense.objects.filter(demo=True).delete()
    Proforma.objects.filter(demo=True).delete()
    PaymentRequest.objects.filter(demo=True).delete()
    DeliveryNote.objects.filter(demo=True).delete()
    Customer.objects.filter(demo=True).delete()
    Item.objects.filter(demo=True).delete()
