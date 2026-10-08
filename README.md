# ዲጂታል የሱቅ ደብተር — Django + React

የኢትዮጵያ አቆጣጠር (13 ወር) ያለው የሱቅ ደብተር፦ ሽያጭ፣ ክምችት፣ ዕዳ፣ ወጪ፣ ትርፍ፣ ዳሽቦርድ እና ABROS ፕሮፎርማ (A4 ህትመት/PDF)።

- `backend/` — Django 5 + Django REST Framework (Token auth, SQLite)
- `frontend/` — React 19 + Vite (minimalist UI፣ ብርሃን/ጨለማ፣ ለስልክ ተስማሚ)

## ማስጀመር (ልማት)

```bash
# 1) Backend
cd backend
cp .env.example .env     # (የልማት .env ተካትቷል፤ ለምርት ዋጋዎቹን ይቀይሩ)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations ledger
python manage.py migrate
python manage.py createsuperuser --noinput             # ስም/የይለፍ ቃል ከ .env (DJANGO_SUPERUSER_*) ይወስዳል
# (ወይም ያለ --noinput በእጅ ይሙሉ)
python manage.py runserver                              # http://127.0.0.1:8000

# 2) Frontend (ሌላ terminal)
cd frontend
npm install
npm run dev                                             # http://localhost:5173  (/api → 8000)
```

ከዚያ በ `createsuperuser` የሠሩትን ስም ይግቡ። ናሙና መረጃ፦ ቅንብር → "ናሙና ጫን" ወይም `python manage.py seed_demo`.

## ሚስጥሮች እና ቅንብር (.env)
ሁሉም ሚስጥራዊ ዋጋዎች በ `backend/.env` ውስጥ ናቸው (ፋይሉ `.gitignore` ውስጥ ነው፤ ናሙናው `backend/.env.example`):
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_DB_PATH`,
`DJANGO_SUPERUSER_USERNAME/EMAIL/PASSWORD`, እና የሱቅ መረጃ `SHOP_*` (ስልክ፣ ድረ-ገጽ፣ ፈራሚ…)።
ምርት ላይ (`DJANGO_DEBUG=0`) `DJANGO_SECRET_KEY` ከሌለ አገልጋዩ አይነሳም። የ frontend ልማት ፕሮክሲ: `frontend/.env` (`VITE_API_PROXY`).
ጥቅሎች: `requirements.txt` (root → backend/requirements.txt) እና `frontend/package.json`.

## ቋንቋ
የጎን ምናሌ (በስልክ ከላይ) ያለው **አማ / EN** ቁልፍ ሁሉንም ገጽ፣ የኢትዮጵያ ወራትንና ቀናትን ይቀይራል (በ"ቅንብር" ውስጥም አለ)። ምርጫው በአሳሹ ይታወሳል።
አዲስ ጽሑፍ ሲጨምሩ `frontend/src/lib/en.js` ላይ ትርጉሙን ይጨምሩ።

## ካፒታልና የገንዘብ ፍሰት (ዳሽቦርድ)
- **የገንዘብ ሒሳብ** = መነሻ ካፒታል (ቅንብር ውስጥ) + ገቢ − ወጪ። ገቢ = ጥሬ ሽያጭ + በዱቤ ሽያጭ ላይ የተከፈለ ቅድመ ክፍያ + የዕዳ ክፍያዎች ፤ ወጪ = ግዢ + ወጪዎች።
- **የካፒታል ሒሳብ** = የገንዘብ ሒሳብ + የክምችት ዋጋ (በመግዣ ዋጋ) + ተቀባይ ዕዳ። **ዕድገት** = የካፒታል ሒሳብ − መነሻ ካፒታል (መነሻ ገንዘብ + መነሻ ክምችት)።
- ወርሃዊ ገቢ/ወጪ ገበታና የወር መጨረሻ የገንዘብ ሒሳብ መስመር ያሳያል። ትክክለኛ እንዲሆን "ቅንብር → የመነሻ ካፒታል" ይሙሉ።

## ሰነዶች
- **ፕሮፎርማ** (`#/proforma`) — `PF-{ዓ.ም}-0001`, TOT
- **የክፍያ ጥያቄ / Payment Request** (`#/payment`) — `PR-{ዓ.ም}-0001`, መክፈያ ቀን (Payment Due), VAT, AMOUNT DUE። 
- **የማድረሻ ሰነድ / Delivery Note** (`#/delivery`) — `DN-{ዓ.ም}-0001`, ዋጋ የሌለው የዕቃዎች ዝርዝር (እስከ 10 መስመር)፣ የፊርማ መስመር

ሦስቱም ራሳቸውን የቻለ ተራ ቁጥር አላቸው።

## Production (አንድ አገልጋይ)

```bash
cd frontend && npm install && npm run build            # frontend/dist
cd ../backend
export DJANGO_SECRET_KEY="<ረጅም ሚስጥር>" DJANGO_DEBUG=0 DJANGO_ALLOWED_HOSTS="example.com"
export DJANGO_CSRF_TRUSTED_ORIGINS="https://example.com"
python manage.py migrate
gunicorn config.wsgi
```
Django `frontend/dist` ን (WhiteNoise) እና SPA ን ራሱ ያቀርባል። ሌሎች env፦ `DJANGO_DB_PATH`, `FRONTEND_DIST`.

## ሙከራ
`cd backend && python manage.py test` — የቀን አቆጣጠር፣ ክምችት፣ ዱቤ/ዕዳ፣ ትርፍ፣ ፕሮፎርማ ቁጥርና ድምር።

## API (ሁሉም `Authorization: Token <t>`)
`POST /api/auth/login|logout/`, `GET /api/auth/me/`, `GET /api/dashboard/`, `GET /api/today/`,
CRUD: `/api/items|customers|sales|purchases|expenses|payments|proformas|payment-requests|delivery-notes/` (ማጣሪያ `?y=&m=&d=&limit=`),
`GET|PUT /api/settings/`, `POST /api/demo/load|clear/`.

## ስሌት
ቀሪ = መጀመሪያ + ግዢ − ሽያጭ · ትርፍ = ሽያጭ − ብዛት×መግዣ ዋጋ · ዕዳ = ዱቤ − ቅድመ ክፍያ − ክፍያዎች ·
የተጣራ ትርፍ = ሽያጭ − የዕቃ ዋጋ − ወጪ (ግዢ ወጪ አይደለም) · ፕሮፎርማ፦ ድምር + TOT (ነባሪ 15%)፣ ቁጥር `PF-{ዓ.ም}-{0001}`።
