"""Ortak ayarlar — .env diğer modüller import edilmeden önce yüklenir."""
import os
from datetime import timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

# Türkiye 2016'dan beri sabit UTC+3 (yaz saati uygulaması yok)
ANKARA_TZ = timezone(timedelta(hours=3), name="Europe/Istanbul")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


# TomTom ücretsiz katman: 2.500 istek/gün. Her turda 4 nokta sorgulanır:
# 180 sn → 480 tur/gün × 4 = 1.920 istek/gün (limitin altında).
TRAFFIC_REFRESH_SECONDS = _int_env("TRAFFIC_REFRESH_SECONDS", 180)
BUS_REFRESH_SECONDS = _int_env("BUS_REFRESH_SECONDS", 30)

# 8 grup × 180 sn = 24 dk'da tam tur; bu süreyi aşan noktalar bayat sayılır.
TRAFFIC_STALE_SECONDS = _int_env("TRAFFIC_STALE_SECONDS", 45 * 60)

# TomTom anahtarı yokken demo trafik üretilsin mi? (portfolyo/demo yayınları için)
TRAFFIC_DEMO = os.getenv("TRAFFIC_DEMO", "auto").lower()  # auto | on | off

# Geçmiş kayıtların saklama süresi (tahmin modeli son 30 günü kullanır)
RETENTION_DAYS = _int_env("RETENTION_DAYS", 30)

CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGIN", "http://localhost:5173").split(",") if o.strip()
]
