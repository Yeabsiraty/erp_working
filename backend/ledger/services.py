"""ስሌቶች፦ ክምችት፣ ዕዳ፣ ዳሽቦርድ፣ ፕሮፎርማ፣ ምሳሌ መረጃ።"""
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, IntegerField, Sum

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


def bank_summary(y: int, m: int, d: int) -> dict:
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
    day_sales = _sales_of(y=y, m=m, d=d)
    py, pm, pd = _prev_day(y, m, d)
    prev_day_sales = _sales_of(y=py, m=pm, d=pd)
    prev_month_sales = _sales_of(y=pym, m=pmm)

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
            "day_sales": day_sales, "day_change": _pct(day_sales, prev_day_sales),
            "month_sales": cur["sales"], "month_change": _pct(cur["sales"], prev_month_sales),
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


# ---------------------------------------------------------------- ዱቤ ሽያጭ — ተከፍሏል / አልተከፈለም
def credit_settlement(customer_ids=None) -> dict:
    """{sale_id: {"settled": bool, "balance": Decimal}}

    ክፍያዎች የደንበኛ እንጂ የአንድ ሽያጭ አይደሉም፤ ስለዚህ ከቅድመ ክፍያ በኋላ የተከፈለው ገንዘብ
    ለደንበኛው በጣም አሮጌ ዱቤ ሽያጭ መጀመሪያ ይመደባል (FIFO)።"""
    sales = Sale.objects.filter(type=Sale.CREDIT, customer_id__isnull=False)
    if customer_ids is not None:
        sales = sales.filter(customer_id__in=list(customer_ids))
    sales = sales.order_by("customer_id", "y", "m", "d", "id")
    pays = {r["customer_id"]: r["t"] for r in
            Payment.objects.values("customer_id").order_by().annotate(t=Sum("amount"))}
    pool, out = {}, {}
    for s in sales:
        due = r2(s.qty * s.price) - r2(s.paid)
        avail = pool.setdefault(s.customer_id, r2(pays.get(s.customer_id)))
        take = min(avail, max(due, ZERO))
        pool[s.customer_id] = avail - take
        balance = due - take
        out[s.pk] = {"settled": balance <= 0, "balance": max(balance, ZERO)}
    return out


def debt_details() -> dict:
    """{customer_id: {"unpaid": [...], "settled": [...]}}

    unpaid  -> every unpaid credit sale with its REMAINING balance
               (the sum equals the customer's total balance)
    settled -> every fully paid credit sale with its full amount"""
    sales = (Sale.objects.filter(type=Sale.CREDIT, customer_id__isnull=False)
             .order_by("customer_id", "y", "m", "d", "id"))
    table = credit_settlement()
    out = {}
    for s in sales:
        info = table.get(s.pk, {"settled": False, "balance": ZERO})
        bucket = out.setdefault(s.customer_id, {"unpaid": [], "settled": []})
        row = {"id": s.pk, "y": s.y, "m": s.m, "d": s.d}
        if info["settled"]:
            bucket["settled"].append({**row, "amount": r2(s.qty * s.price)})
        else:
            bucket["unpaid"].append({**row, "amount": info["balance"]})
    return out


# ---------------------------------------------------------------- ሪፖርት
ALL_SECTIONS = ("summary", "sales", "purchases", "stock", "debts", "expenses", "bank")
DKEY = ExpressionWrapper(F("y") * 10000 + F("m") * 100 + F("d"), output_field=IntegerField())


def _between(qs, start, end):
    """ቀኑ start እና end (ሁለቱንም ጨምሮ) መካከል ያሉ መዝገቦች። start/end = (y, m, d) ኢትዮጵያ።"""
    key = lambda t: t[0] * 10000 + t[1] * 100 + t[2]  # noqa: E731
    return qs.annotate(_k=DKEY).filter(_k__gte=key(start), _k__lte=key(end))


def _ymd(o):
    return {"y": o.y, "m": o.m, "d": o.d}


def report(*, start, end, sections, item=None, customer=None, sale_type="", category="",
           bank_kind="", debt_status="") -> dict:
    sales_qs = _between(Sale.objects.select_related("item", "customer"), start, end)
    purchases_qs = _between(Purchase.objects.select_related("item"), start, end)
    expenses_qs = _between(Expense.objects.all(), start, end)
    payments_qs = _between(Payment.objects.select_related("customer"), start, end)
    bank_qs = _between(BankEntry.objects.all(), start, end)
    if item:
        sales_qs, purchases_qs = sales_qs.filter(item_id=item), purchases_qs.filter(item_id=item)
    if customer:
        sales_qs, payments_qs = sales_qs.filter(customer_id=customer), payments_qs.filter(customer_id=customer)
    if sale_type in (Sale.CASH, Sale.CREDIT):
        sales_qs = sales_qs.filter(type=sale_type)
    if category:
        expenses_qs = expenses_qs.filter(cat__icontains=category)
    if bank_kind in (BankEntry.OWN, BankEntry.DEBT):
        bank_qs = bank_qs.filter(kind=bank_kind)

    out = {"period": {"from": dict(zip("ymd", start)), "to": dict(zip("ymd", end))}}

    if "summary" in sections:
        sales_total = _sum(sales_qs, expr=SALE_TOTAL)
        cost = _sum(sales_qs, expr=SALE_COST)
        spent = _sum(expenses_qs, field="amount")
        out["summary"] = {
            "sales": sales_total, "cost": cost, "gross": sales_total - cost,
            "expenses": spent, "net": sales_total - cost - spent,
            "purchases": _sum(purchases_qs, expr=SALE_TOTAL),
            "cash_sales": _sum(sales_qs.filter(type=Sale.CASH), expr=SALE_TOTAL),
            "credit_sales": _sum(sales_qs.filter(type=Sale.CREDIT), expr=SALE_TOTAL),
            "upfront": _sum(sales_qs.filter(type=Sale.CREDIT), field="paid"),
            "collected": _sum(payments_qs, field="amount"),
            "deposits": _sum(bank_qs, field="amount"),
            "sales_count": sales_qs.count(),
            "stock_value": sum((st["value"] for st in item_stats().values()), ZERO),
            "debt_total": sum((c["balance"] for c in customer_stats().values()), ZERO),
        }

    if "sales" in sections:
        rows = list(sales_qs.order_by("y", "m", "d", "id"))
        settle = credit_settlement({s.customer_id for s in rows if s.customer_id})
        out["sales"] = [{
            **_ymd(s), "id": s.pk, "item": s.item.name, "qty": s.qty, "price": s.price,
            "total": r2(s.qty * s.price), "cost": r2(s.qty * s.item.buy),
            "profit": r2(s.qty * s.price - s.qty * s.item.buy), "type": s.type,
            "customer": s.customer.name if s.customer else "", "paid": s.paid,
            "settled": s.type != Sale.CREDIT or settle.get(s.pk, {}).get("settled", False),
            "balance": settle.get(s.pk, {}).get("balance", ZERO) if s.type == Sale.CREDIT else ZERO,
        } for s in rows]

    if "purchases" in sections:
        out["purchases"] = [{
            **_ymd(p), "id": p.pk, "item": p.item.name, "unit": p.item.unit, "qty": p.qty,
            "price": p.price, "total": r2(p.qty * p.price), "supplier": p.supplier,
        } for p in purchases_qs.order_by("y", "m", "d", "id")]

    if "stock" in sections:
        items = Item.objects.all()
        if item:
            items = items.filter(pk=item)
        items = list(items)
        stats = item_stats(items)
        sold_p = {r["item_id"]: r["t"] for r in sales_qs.values("item_id").order_by().annotate(t=Sum("qty"))}
        bought_p = {r["item_id"]: r["t"] for r in purchases_qs.values("item_id").order_by().annotate(t=Sum("qty"))}
        out["stock"] = [{
            "id": i.pk, "name": i.name, "unit": i.unit, "buy": i.buy, "sell": i.sell, "init": i.init,
            **stats[i.pk], "period_sold": sold_p.get(i.pk) or ZERO, "period_bought": bought_p.get(i.pk) or ZERO,
        } for i in items]

    if "debts" in sections:
        cs = Customer.objects.all()
        if customer:
            cs = cs.filter(pk=customer)
        cs = list(cs)
        stats = customer_stats(cs)
        rows = [{"id": c.pk, "name": c.name, "phone": c.phone, **stats[c.pk]} for c in cs]
        if debt_status in ("owes", "clear"):
            rows = [r for r in rows if r["status"] == debt_status]
        out["debts"] = {
            "customers": rows,
            "payments": [{**_ymd(p), "id": p.pk, "customer": p.customer.name, "amount": p.amount, "note": p.note}
                         for p in payments_qs.order_by("y", "m", "d", "id")],
        }

    if "expenses" in sections:
        out["expenses"] = [{**_ymd(e), "id": e.pk, "cat": e.cat, "note": e.note, "amount": e.amount}
                           for e in expenses_qs.order_by("y", "m", "d", "id")]

    if "bank" in sections:
        out["bank"] = [{**_ymd(b), "id": b.pk, "amount": b.amount, "kind": b.kind, "reason": b.reason,
                        "repaid": b.repaid, "rep_y": b.rep_y, "rep_m": b.rep_m, "rep_d": b.rep_d}
                       for b in bank_qs.order_by("y", "m", "d", "id")]
    return out