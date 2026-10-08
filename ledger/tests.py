from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from . import ethiopian, services
from .models import Customer, Item


class EthiopianCalendarTests(APITestCase):
    def test_gregorian_to_ethiopian(self):
        cases = {
            date(2026, 9, 11): (2019, 1, 1),
            date(2026, 10, 4): (2019, 1, 24),
            date(2023, 9, 12): (2016, 1, 1),   # ከሊፕ ዓመት (2015) በኋላ ጳጉሜን 6 ቀን ነበር
            date(2023, 9, 11): (2015, 13, 6),
            date(2024, 9, 10): (2016, 13, 5),
        }
        for greg, expected in cases.items():
            got = ethiopian.from_gregorian(greg)
            self.assertEqual((got["y"], got["m"], got["d"]), expected, greg)

    def test_pagume_length(self):
        self.assertEqual(ethiopian.max_day(2019, 13), 6)   # 2019 % 4 == 3
        self.assertEqual(ethiopian.max_day(2018, 13), 5)
        self.assertEqual(ethiopian.max_day(2019, 5), 30)
        self.assertTrue(ethiopian.is_valid(2019, 13, 6))
        self.assertFalse(ethiopian.is_valid(2018, 13, 6))
        self.assertFalse(ethiopian.is_valid(2019, 14, 1))


class ApiTestCase(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("owner", password="s3cret-pass")
        self.client.force_authenticate(self.user)

    def post(self, url, data, status=201):
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status, res.content)
        return res.json()

    def make_item(self, name="ሩዝ", buy=80, sell=95, init=100, low=20):
        return self.post("/api/items/", {"name": name, "unit": "ኪሎ", "buy": buy, "sell": sell, "init": init, "low": low})


class AuthTests(APITestCase):
    def test_requires_token(self):
        self.assertEqual(self.client.get("/api/items/").status_code, 401)

    def test_login_and_token_use(self):
        get_user_model().objects.create_user("owner", password="s3cret-pass")
        bad = self.client.post("/api/auth/login/", {"username": "owner", "password": "nope"}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post("/api/auth/login/", {"username": "owner", "password": "s3cret-pass"}, format="json")
        self.assertEqual(ok.status_code, 200)
        token = ok.json()["token"]
        res = self.client.get("/api/items/", HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(res.status_code, 200)


class StockAndSalesTests(ApiTestCase):
    def test_stock_follows_purchases_and_sales(self):
        item = self.make_item()
        self.post("/api/purchases/", {"y": 2019, "m": 1, "d": 20, "item": item["id"], "qty": 50, "price": 80})
        self.post("/api/sales/", {"y": 2019, "m": 1, "d": 22, "item": item["id"], "qty": 10, "price": 95})
        row = self.client.get("/api/items/").json()[0]
        self.assertEqual(row["bought"], 50)
        self.assertEqual(row["sold"], 10)
        self.assertEqual(row["left"], 140)
        self.assertEqual(row["status"], "ok")
        self.assertAlmostEqual(row["value"], 140 * 80)
        self.assertAlmostEqual(row["profit"], 10 * (95 - 80))

    def test_low_and_out_status(self):
        item = self.make_item(init=25, low=20)
        self.post("/api/sales/", {"y": 2019, "m": 1, "d": 1, "item": item["id"], "qty": 10, "price": 95})
        self.assertEqual(self.client.get("/api/items/").json()[0]["status"], "low")
        self.post("/api/sales/", {"y": 2019, "m": 1, "d": 2, "item": item["id"], "qty": 15, "price": 95})
        self.assertEqual(self.client.get("/api/items/").json()[0]["status"], "out")

    def test_credit_sale_needs_customer_and_tracks_debt(self):
        item = self.make_item()
        sale = {"y": 2019, "m": 1, "d": 24, "item": item["id"], "qty": 20, "price": 95, "type": "credit", "paid": 500}
        self.post("/api/sales/", sale, status=400)  # ደንበኛ የለም
        cust = self.post("/api/customers/", {"name": "አበበ ከበደ", "phone": "0911"})
        self.post("/api/sales/", {**sale, "customer": cust["id"]})
        self.post("/api/payments/", {"y": 2019, "m": 1, "d": 24, "customer": cust["id"], "amount": 300})
        row = self.client.get("/api/customers/").json()[0]
        self.assertAlmostEqual(row["credit"], 1900)
        self.assertAlmostEqual(row["upfront"], 500)
        self.assertAlmostEqual(row["paid"], 300)
        self.assertAlmostEqual(row["balance"], 1100)
        self.assertEqual(row["status"], "owes")

    def test_prepaid_cannot_exceed_total(self):
        item = self.make_item()
        cust = self.post("/api/customers/", {"name": "ዮሐንስ"})
        self.post("/api/sales/", {"y": 2019, "m": 1, "d": 1, "item": item["id"], "qty": 1, "price": 95,
                                   "type": "credit", "customer": cust["id"], "paid": 500}, status=400)

    def test_cash_sale_clears_customer_and_paid(self):
        item = self.make_item()
        cust = self.post("/api/customers/", {"name": "ዮሐንስ"})
        sale = self.post("/api/sales/", {"y": 2019, "m": 1, "d": 1, "item": item["id"], "qty": 1, "price": 95,
                                         "type": "cash", "customer": cust["id"], "paid": 50})
        self.assertIsNone(sale["customer"])
        self.assertEqual(sale["paid"], 0)

    def test_quantity_must_be_positive(self):
        item = self.make_item()
        self.post("/api/sales/", {"y": 2019, "m": 1, "d": 1, "item": item["id"], "qty": 0, "price": 95}, status=400)

    def test_item_and_customer_in_use_cannot_be_deleted(self):
        item = self.make_item()
        self.post("/api/sales/", {"y": 2019, "m": 1, "d": 1, "item": item["id"], "qty": 1, "price": 95})
        res = self.client.delete(f"/api/items/{item['id']}/")
        self.assertEqual(res.status_code, 409)
        self.assertTrue(Item.objects.filter(pk=item["id"]).exists())

        cust = self.post("/api/customers/", {"name": "ዮሐንስ"})
        self.post("/api/payments/", {"y": 2019, "m": 1, "d": 1, "customer": cust["id"], "amount": 10})
        self.assertEqual(self.client.delete(f"/api/customers/{cust['id']}/").status_code, 409)
        self.assertTrue(Customer.objects.filter(pk=cust["id"]).exists())

    def test_duplicate_item_name_rejected(self):
        self.make_item()
        self.post("/api/items/", {"name": "ሩዝ", "buy": 1, "sell": 2}, status=400)

    def test_ethiopian_date_validation(self):
        base = {"cat": "ኪራይ", "amount": 5, "y": 2019, "m": 13}
        self.post("/api/expenses/", {**base, "d": 6})                 # 2019 ከሊፕ ዓመት ነው
        self.post("/api/expenses/", {**base, "d": 7}, status=400)
        self.post("/api/expenses/", {**base, "y": 2018, "d": 6}, status=400)
        self.post("/api/expenses/", {**base, "m": 14, "d": 1}, status=400)

    def test_list_filters(self):
        self.post("/api/expenses/", {"y": 2019, "m": 1, "d": 1, "cat": "ኪራይ", "amount": 5})
        self.post("/api/expenses/", {"y": 2019, "m": 2, "d": 1, "cat": "ኪራይ", "amount": 6})
        self.assertEqual(len(self.client.get("/api/expenses/?y=2019&m=2").json()), 1)
        self.assertEqual(len(self.client.get("/api/expenses/?limit=1").json()), 1)


class CapitalCashflowTests(ApiTestCase):
    """ካፒታል = ጥሬ ገንዘብ + የክምችት ዋጋ + ተቀባይ ዕዳ ፣ የገንዘብ ፍሰት = ገቢ(ጥሬ+ቅድመ ክፍያ+ክፍያዎች) − ወጪ(ግዢ+ወጪ)።"""

    def test_numbers(self):
        self.assertEqual(self.client.put("/api/settings/", {"opening_cash": 10000}, format="json").status_code, 200)
        item = self.post("/api/items/", {"name": "A", "unit": "pcs", "buy": 10, "sell": 20, "init": 100, "low": 5})
        cust = self.post("/api/customers/", {"name": "C", "phone": ""})
        day = {"y": 2019, "m": 1, "d": 5}
        self.post("/api/purchases/", {**day, "item": item["id"], "qty": 30, "price": 10, "supplier": ""})
        self.post("/api/sales/", {**day, "item": item["id"], "qty": 50, "price": 20, "type": "cash"})
        self.post("/api/sales/", {**day, "item": item["id"], "qty": 25, "price": 20, "type": "credit",
                                  "customer": cust["id"], "paid": 100})
        self.post("/api/payments/", {**day, "customer": cust["id"], "amount": 200, "note": ""})
        self.post("/api/expenses/", {**day, "cat": "rent", "note": "", "amount": 50})
        data = self.client.get("/api/dashboard/?y=2019&m=1&d=5").json()
        cap, cf = data["capital"], data["cashflow"]
        self.assertAlmostEqual(cf["balance"], 10950)          # 10000+1000+100+200-300-50
        self.assertAlmostEqual(cap["stock"], 550)             # (100+30-75)*10
        self.assertAlmostEqual(cap["receivables"], 200)       # 500-100-200
        self.assertAlmostEqual(cap["balance"], 11700)
        self.assertAlmostEqual(cap["initial"], 11000)         # 10000 + 100*10
        self.assertAlmostEqual(cap["growth"], 700)            # = የተጣራ ትርፍ (1500-750-50)
        self.assertAlmostEqual(data["kpis"]["year_net"], 700)
        self.assertAlmostEqual(cf["month_in"], 1300)
        self.assertAlmostEqual(cf["month_out"], 350)
        self.assertAlmostEqual(cf["months"][0]["balance"], 10950)
        self.assertAlmostEqual(cf["months"][12]["balance"], 10950)

    def test_opening_balance_carries_over_from_previous_year(self):
        self.client.put("/api/settings/", {"opening_cash": 1000}, format="json")
        self.post("/api/expenses/", {"y": 2018, "m": 3, "d": 1, "cat": "x", "note": "", "amount": 400})
        cf = self.client.get("/api/dashboard/?y=2019&m=1&d=1").json()["cashflow"]
        self.assertAlmostEqual(cf["opening"], 600)
        self.assertAlmostEqual(cf["months"][0]["balance"], 600)

    def test_empty(self):
        data = self.client.get("/api/dashboard/?y=2019&m=1&d=1").json()
        self.assertEqual(data["capital"]["balance"], 0)
        self.assertEqual(data["cashflow"]["balance"], 0)


class DashboardTests(ApiTestCase):
    def test_empty_dashboard(self):
        data = self.client.get("/api/dashboard/?y=2019&m=1&d=24").json()
        self.assertTrue(data["is_empty"])
        self.assertEqual(len(data["months"]), 13)
        self.assertEqual(data["kpis"]["month_sales"], 0)

    def test_demo_numbers(self):
        self.assertEqual(self.client.post("/api/demo/load/").status_code, 201)
        self.assertEqual(self.client.post("/api/demo/load/").status_code, 409)  # ባዶ ካልሆነ አይጫንም
        t = ethiopian.today()
        data = self.client.get(f"/api/dashboard/?y={t['y']}&m={t['m']}&d={t['d']}").json()
        k = data["kpis"]
        self.assertAlmostEqual(k["month_sales"], 4430)
        self.assertAlmostEqual(k["month_gross"], 720)
        self.assertAlmostEqual(k["month_expenses"], 3450)
        self.assertAlmostEqual(k["month_net"], -2730)
        self.assertAlmostEqual(k["year_net"], -2730)
        self.assertAlmostEqual(k["stock_value"], 18490)
        self.assertAlmostEqual(k["debt_total"], 1100)
        self.assertEqual(k["debtors"], 1)
        self.assertEqual(k["low_count"], 0)
        self.assertAlmostEqual(k["day_sales"], 4430 if t["d"] == 1 else 680)
        self.assertEqual(data["top_qty"][0]["name"], "ሩዝ")
        self.assertEqual(data["top_profit"][0]["name"], "ሩዝ")

        total_row = data["year_total"]
        self.assertAlmostEqual(total_row["sales"], 4430)
        self.assertAlmostEqual(sum(r["sales"] for r in data["months"]), 4430)

        self.assertEqual(self.client.post("/api/demo/clear/").status_code, 204)
        self.assertFalse(Item.objects.exists())
        self.assertFalse(Customer.objects.exists())

    def test_load_demo_service_is_idempotent(self):
        self.assertTrue(services.load_demo())
        self.assertFalse(services.load_demo())


class ProformaTests(ApiTestCase):
    payload = {
        "y": 2019, "m": 1, "d": 24, "client": "አበበ ከበደ", "tot_rate": 15, "terms": "",
        "items": [{"name": "Roll-up banner", "price": 1800, "qty": 2}, {"name": "DTF T-shirt print", "price": 350, "qty": 25}],
    }

    def test_create_totals_and_numbering(self):
        first = self.post("/api/proformas/", self.payload)
        self.assertEqual(first["number"], "PF-2019-0001")
        self.assertAlmostEqual(first["totals"]["sub"], 12350)
        self.assertAlmostEqual(first["totals"]["tot"], 1852.5)
        self.assertAlmostEqual(first["totals"]["grand"], 14202.5)
        second = self.post("/api/proformas/", self.payload)
        self.assertEqual(second["number"], "PF-2019-0002")
        other_year = self.post("/api/proformas/", {**self.payload, "y": 2020})
        self.assertEqual(other_year["number"], "PF-2020-0001")

    def test_requires_items(self):
        self.post("/api/proformas/", {**self.payload, "items": []}, status=400)

    def test_update_replaces_items_and_recomputes(self):
        created = self.post("/api/proformas/", self.payload)
        body = {**self.payload, "tot_rate": 0, "items": [{"name": "Banner", "price": 100.5, "qty": 3}]}
        res = self.client.put(f"/api/proformas/{created['id']}/", body, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertAlmostEqual(data["totals"]["grand"], 301.5)
        self.assertEqual(data["number"], "PF-2019-0001")

    def test_changing_year_renumbers(self):
        created = self.post("/api/proformas/", self.payload)
        res = self.client.put(f"/api/proformas/{created['id']}/", {**self.payload, "y": 2020}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["number"], "PF-2020-0001")

    def test_delete_cascades_items(self):
        created = self.post("/api/proformas/", self.payload)
        self.assertEqual(self.client.delete(f"/api/proformas/{created['id']}/").status_code, 204)
        self.assertEqual(self.client.get("/api/proformas/").json(), [])


class PaymentRequestTests(ApiTestCase):
    payload = {
        "y": 2019, "m": 1, "d": 24, "client": "አበበ ከበደ", "vat_rate": 15, "terms": "",
        "due_y": 2019, "due_m": 2, "due_d": 10,
        "items": [{"name": "Design work", "price": 1000, "qty": 3}],
    }

    def test_create_totals_and_numbering(self):
        first = self.post("/api/payment-requests/", self.payload)
        self.assertEqual(first["number"], "PR-2019-0001")
        self.assertAlmostEqual(first["totals"]["sub"], 3000)
        self.assertAlmostEqual(first["totals"]["tot"], 450)
        self.assertAlmostEqual(first["totals"]["grand"], 3450)
        self.assertEqual(self.post("/api/payment-requests/", self.payload)["number"], "PR-2019-0002")

    def test_numbering_independent_from_proforma(self):
        self.post("/api/proformas/", ProformaTests.payload)
        self.assertEqual(self.post("/api/payment-requests/", self.payload)["number"], "PR-2019-0001")

    def test_invalid_due_date_and_empty_items(self):
        self.post("/api/payment-requests/", {**self.payload, "due_m": 13, "due_d": 6}, status=400)  # 2019 ጳጉሜን 5 ቀን ብቻ
        self.post("/api/payment-requests/", {**self.payload, "items": []}, status=400)

    def test_update_and_delete(self):
        created = self.post("/api/payment-requests/", self.payload)
        res = self.client.put(f"/api/payment-requests/{created['id']}/",
                              {**self.payload, "vat_rate": 0, "items": [{"name": "X", "price": 10, "qty": 2}]}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertAlmostEqual(res.json()["totals"]["grand"], 20)
        self.assertEqual(self.client.delete(f"/api/payment-requests/{created['id']}/").status_code, 204)


class DeliveryNoteTests(ApiTestCase):
    payload = {"y": 2019, "m": 1, "d": 24, "client": "አበበ ከበደ",
               "items": [{"name": "Roll-up banner x2"}, {"name": "DTF T-shirt print x25"}]}

    def test_create_numbering_and_no_totals(self):
        first = self.post("/api/delivery-notes/", self.payload)
        self.assertEqual(first["number"], "DN-2019-0001")
        self.assertNotIn("totals", first)
        self.assertEqual([i["name"] for i in first["items"]], ["Roll-up banner x2", "DTF T-shirt print x25"])
        self.assertEqual(self.post("/api/delivery-notes/", self.payload)["number"], "DN-2019-0002")
        self.assertEqual(self.post("/api/delivery-notes/", {**self.payload, "y": 2020})["number"], "DN-2020-0001")

    def test_validation(self):
        self.post("/api/delivery-notes/", {**self.payload, "items": []}, status=400)
        self.post("/api/delivery-notes/", {**self.payload, "m": 13, "d": 6}, status=400)  # 2019 ጳጉሜን 5 ቀን ብቻ

    def test_update_and_delete(self):
        created = self.post("/api/delivery-notes/", self.payload)
        res = self.client.put(f"/api/delivery-notes/{created['id']}/", {**self.payload, "items": [{"name": "X"}]}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(len(res.json()["items"]), 1)
        self.assertEqual(self.client.delete(f"/api/delivery-notes/{created['id']}/").status_code, 204)


class SettingsTests(ApiTestCase):
    def test_settings_roundtrip(self):
        res = self.client.get("/api/settings/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "የእኔ ሱቅ")
        res = self.client.put("/api/settings/", {"name": "አብሮስ", "tot_rate": 10}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self.client.get("/api/settings/").json()["name"], "አብሮስ")
