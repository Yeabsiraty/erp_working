"""የኢትዮጵያ አቆጣጠር (13 ወራት) ስሌቶች። Django አያስፈልገውም።"""
from datetime import date

MONTHS = [
    "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት",
    "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን",
]

# የኢትዮጵያ አቆጣጠር መነሻ (Julian Day Number)
ETHIOPIC_EPOCH = 1723856

MIN_YEAR, MAX_YEAR = 1990, 2100


def gregorian_to_jdn(y: int, m: int, d: int) -> int:
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm = m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045


def from_gregorian(dt: date) -> dict:
    """የግሪጎሪያን ቀንን ወደ ኢትዮጵያ {y, m, d} ይለውጣል።"""
    j = gregorian_to_jdn(dt.year, dt.month, dt.day) - ETHIOPIC_EPOCH
    r = j % 1461
    n = r % 365 + 365 * (r // 1460)
    return {
        "y": 4 * (j // 1461) + r // 365 - r // 1460,
        "m": n // 30 + 1,
        "d": n % 30 + 1,
    }


def today() -> dict:
    from django.utils import timezone

    return from_gregorian(timezone.localdate())


def max_day(y: int, m: int) -> int:
    """ጳጉሜን 5 ቀናት፤ በዓመቱ ከ4 ሲካፈል ቀሪው 3 ሲሆን 6 ቀናት።"""
    if m == 13:
        return 6 if y % 4 == 3 else 5
    return 30


def is_valid(y: int, m: int, d: int) -> bool:
    return MIN_YEAR <= y <= MAX_YEAR and 1 <= m <= 13 and 1 <= d <= max_day(y, m)


def label(y: int, m: int, d: int) -> str:
    return f"{d} {MONTHS[m - 1]} {y}"
