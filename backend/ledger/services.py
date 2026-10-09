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
# ---------------------------------------------------------------- ዳሽቦርድ
def _sum(qs, expr=None, field=None):
    agg = qs.aggregate(t=Sum(expr if expr is not None else field))
    return r2(agg["t"])


def _pct(cur, prev):
    """ለውጥ በመቶኛ፤ ቀዳሚው 0 ከሆነ None (UI "—" ያሳያል)።"""
    prev = Decimal(prev or 0)
    if prev == 0:
        return None
    diff = (Decimal(cur or 0) - prev) / abs(prev) * 100
    return float(diff.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _prev_day(y, m, d):
    if d > 1:
        return y, m, d - 1
    if m > 1:
        return y, m - 1, ethiopian.max_day(y, m - 1)
    return y - 1, 13, ethiopian.max_day(y - 1, 13)


def _prev_month(y, m):
    return (y, m - 1) if m > 1 else (y - 1, 13)


def _sales_of(**flt):
    return _sum(Sale.objects.filter(**flt), expr=SALE_TOTAL)


def _net_of(**flt):
    s = _sum(Sale.objects.filter(**flt), expr=SALE_TOTAL)
    c = _sum(Sale.objects.filter(**flt), expr=SALE_COST)
    e = _sum(Expense.objects.filter(**flt), field="amount")
    return s - c - e


def _cash_totals(**flt) -> tuple:
    """(ገቢ, ወጪ) — ገንዘብ በእውነት የገባና የወጣ።
    ገቢ = ጥሬ ሽያጭ + ቅድመ ክፍያ + የዕዳ ክፍያዎች + ባንክ የገባ ገንዘብ
    ወጪ = ግዢ + ወጪዎች + ለአበዳሪ የተመለሰ ገንዘብ"""
    cash_sales = _sum(Sale.objects.filter(type=Sale.CASH, **flt), expr=SALE_TOTAL)
    upfront = _sum(Sale.objects.filter(type=Sale.CREDIT, **flt), field="paid")
    collected = _sum(Payment.objects.filter(**flt), field="amount")
    deposits = _sum(BankEntry.objects.filter(**flt), field="amount")
    bought = _sum(Purchase.objects.filter(**flt), expr=SALE_TOTAL)
    spent = _sum(Expense.objects.filter(**flt), field="amount")
    rflt = {"rep_" + k: v for k, v in flt.items()}
    repaid = _sum(BankEntry.objects.filter(repaid=True, **rflt), field="amount")
    return cash_sales + upfront + collected + deposits, bought + spent + repaid


def _cash_year(y: int) -> dict:
    """{ወር: (ገቢ, ወጪ)} ለአንድ ዓመት።"""
    def by_month(qs, expr, key="m"):
        return {r[key]: r["t"] for r in qs.values(key).order_by().annotate(t=Sum(expr))}
    inc = {}
    for src in (by_month(Sale.objects.filter(y=y, type=Sale.CASH), SALE_TOTAL),
                by_month(Sale.objects.filter(y=y, type=Sale.CREDIT), F("paid")),
                by_month(Payment.objects.filter(y=y), F("amount")),
                by_month(BankEntry.objects.filter(y=y), F("amount"))):
        for k, v in src.items():
            inc[k] = inc.get(k, ZERO) + (v or ZERO)
    out = {}
    for src in (by_month(Purchase.objects.filter(y=y), SALE_TOTAL),
                by_month(Expense.objects.filter(y=y), F("amount")),
                by_month(BankEntry.objects.filter(repaid=True, rep_y=y), F("amount"), "rep_m")):
        for k, v in src.items():
            out[k] = out.get(k, ZERO) + (v or ZERO)
    return {mm: (r2(inc.get(mm)), r2(out.get(mm))) for mm in range(1, 14)}


def dashboard(y: int, m: int, d: int) -> dict:
    """ለዳሽቦርድ — ሽያጭና ክምችት ብቻ። ትርፍ፣ ገንዘብና ካፒታል እዚህ የለም (bank_summary ውስጥ ነው)።"""
    stats = item_stats()
    items = {i.pk: i for i in Item.objects.all()}
    rows = [(items[pk], st) for pk, st in stats.items()]
    cust = customer_stats()
    cust_names = {c.pk: c.name for c in Customer.objects.all()}

    sales_year = {r["m"]: r for r in
                  Sale.objects.filter(y=y).values("m").order_by()
                  .annotate(sales=Sum(SALE_TOTAL), cost=Sum(SALE_COST))}
    months = []
    for mm in range(1, 14):
        s = r2((sales_year.get(mm) or {}).get("sales"))
        c = r2((sales_year.get(mm) or {}).get("cost"))
        months.append({"m": mm, "sales": s, "cost": c})
    cur = months[m - 1]

    daily_raw = {r["d"]: r["t"] for r in
                 Sale.objects.filter(y=y, m=m).values("d").order_by().annotate(t=Sum(SALE_TOTAL))}
    daily = [{"d": dd, "sales": r2(daily_raw.get(dd))} for dd in range(1, ethiopian.max_day(y, m) + 1)]

    day_sales = _sales_of(y=y, m=m, d=d)
    py, pm, pd = _prev_day(y, m, d)
    prev_day_sales = _sales_of(y=py, m=pm, d=pd)
    pym, pmm = _prev_month(y, m)
    prev_month_sales = _sales_of(y=pym, m=pmm)

    cash_m = _sum(Sale.objects.filter(y=y, m=m, type=Sale.CASH), expr=SALE_TOTAL)
    credit_m = _sum(Sale.objects.filter(y=y, m=m, type=Sale.CREDIT), expr=SALE_TOTAL)

    by_rev = sorted([x for x in rows if x[1]["revenue"] > 0], key=lambda x: -x[1]["revenue"])
    share = [{"name": i.name, "value": st["revenue"]} for i, st in by_rev[:5]]
    rest = sum((st["revenue"] for _, st in by_rev[5:]), ZERO)
    if rest > 0:
        share.append({"name": "", "value": rest, "other": True})

    def pack(i, st):
        return {"name": i.name, "unit": i.unit, "sold": st["sold"], "profit": st["profit"],
                "value": st["value"], "left": st["left"], "status": st["status"]}

    top_qty = sorted([x for x in rows if x[1]["sold"] > 0], key=lambda x: -x[1]["sold"])[:5]
    top_profit = sorted([x for x in rows if x[1]["profit"] > 0], key=lambda x: -x[1]["profit"])[:5]
    top_value = sorted([x for x in rows if x[1]["value"] > 0], key=lambda x: -x[1]["value"])[:5]
    low = sorted([x for x in rows if x[1]["status"] != "ok"], key=lambda x: x[1]["left"])[:8]
    top_debtors = sorted([(cust_names[pk], c["balance"]) for pk, c in cust.items() if c["balance"] > 0],
                         key=lambda x: -x[1])[:5]

    recent = [{"id": s.id, "y": s.y, "m": s.m, "d": s.d, "item": s.item.name,
               "total": r2(s.qty * s.price), "type": s.type,
               "customer": s.customer.name if s.customer else ""}
              for s in Sale.objects.select_related("item", "customer")[:6]]

    return {
        "period": {"y": y, "m": m, "d": d},
        "is_empty": not items,
        "kpis": {
            "day_sales": day_sales, "day_change": _pct(day_sales, prev_day_sales),
            "month_sales": cur["sales"], "month_change": _pct(cur["sales"], prev_month_sales),
            "stock_value": sum((st["value"] for _, st in rows), ZERO),
            "debt_total": sum((c["balance"] for c in cust.values()), ZERO),
            "debtors": sum(1 for c in cust.values() if c["balance"] > 0),
            "low_count": sum(1 for _, st in rows if st["status"] != "ok"),
            "out_count": sum(1 for _, st in rows if st["status"] == "out"),
        },
        "months": months,
        "daily": daily,
        "split": {"cash": cash_m, "credit": credit_m},
        "share": share,
        "stock_status": {
            "ok": sum(1 for _, st in rows if st["status"] == "ok"),
            "low": sum(1 for _, st in rows if st["status"] == "low"),
            "out": sum(1 for _, st in rows if st["status"] == "out"),
        },
        "top_qty": [pack(i, st) for i, st in top_qty],
        "top_profit": [pack(i, st) for i, st in top_profit],
        "top_value": [pack(i, st) for i, st in top_value],
        "low_stock": [pack(i, st) for i, st in low],
        "top_debtors": [{"name": n, "balance": b} for n, b in top_debtors],
        "recent": recent,
    }


def bank_summary(y: int, m: int) -> dict:
    """ለባንክ ገጽ — ትርፍ፣ ገንዘብና ካፒታል (በይለፍ ቃል የተጠበቀ)።"""
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
    cur = months[m - 1]
    pym, pmm = _prev_month(y, m)
    prev_net = _net_of(y=pym, m=pmm)
    prev_year_net = _net_of(y=y - 1)

    bank_all = _sum(BankEntry.objects.all(), field="amount")
    bank_debt = _sum(BankEntry.objects.filter(kind=BankEntry.DEBT, repaid=False), field="amount")
    repaid_total = _sum(BankEntry.objects.filter(repaid=True), field="amount")

    stats = item_stats()
    stock_value = sum((st["value"] for st in stats.values()), ZERO)
    opening_stock = r2(sum((i.init * i.buy for i in Item.objects.all()), ZERO))
    receivables = sum((c["balance"] for c in customer_stats().values()), ZERO)

    in_all, out_all = _cash_totals()
    cash_balance = in_all - out_all
    initial = bank_all - repaid_total + opening_stock
    capital_balance = cash_balance + stock_value + receivables

    in_before, out_before = _cash_totals(y__lt=y)
    opening = in_before - out_before
    running = opening
    flows = _cash_year(y)
    cash_months = []
    for mm in range(1, 14):
        cin, cout = flows[mm]
        running += cin - cout
        cash_months.append({"m": mm, "inflow": cin, "outflow": cout, "net": cin - cout, "balance": running})
    year_in = sum((r["inflow"] for r in cash_months), ZERO)
    year_out = sum((r["outflow"] for r in cash_months), ZERO)
    cur_cash = cash_months[m - 1]
    prev_balance = cash_months[m - 2]["balance"] if m > 1 else opening

    return {
        "period": {"y": y, "m": m},
        "profit": {
            "month_net": cur["net"], "month_net_change": _pct(cur["net"], prev_net),
            "month_gross": cur["gross"], "month_expenses": cur["expenses"],
            "year_net": tot["net"], "year_net_change": _pct(tot["net"], prev_year_net),
            "year_sales": tot["sales"],
        },
        "capital": {
            "opening_stock": opening_stock, "initial": initial,
            "cash": cash_balance, "stock": stock_value, "receivables": receivables,
            "balance": capital_balance, "growth": capital_balance - initial,
            "change": _pct(capital_balance, initial),
        },
        "cashflow": {
            "balance": cash_balance, "balance_change": _pct(cash_balance, prev_balance),
            "bank_debt": bank_debt,
            "month_in": cur_cash["inflow"], "month_out": cur_cash["outflow"], "month_net": cur_cash["net"],
            "year_in": year_in, "year_out": year_out, "year_net": year_in - year_out,
            "months": cash_months,
        },
        "months": months,
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
