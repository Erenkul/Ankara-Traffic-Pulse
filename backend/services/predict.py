"""Trafik tahmini — scikit-learn Ridge regresyon + Ankara heuristic fallback.

Tüm saatler Ankara yerel saatidir (UTC+3); saatlik profil de yerel saate göre kalibre edilmiştir.
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timezone, timedelta

import database
from settings import ANKARA_TZ

logger = logging.getLogger(__name__)

# ── Ankara saatlik yoğunluk profili (0 = serbest akış, 1 = tam tıkanıklık) ──
# Hafta içi için kalibre edilmiş değerler (sabah/öğle/akşam rush hour)
_HOURLY_BASE = [
    0.12, 0.08, 0.07, 0.07, 0.10, 0.22,  # 00–05
    0.42, 0.72, 0.88, 0.74, 0.58, 0.64,  # 06–11
    0.72, 0.62, 0.54, 0.52, 0.68, 0.84,  # 12–17
    0.78, 0.66, 0.55, 0.44, 0.34, 0.22,  # 18–23
]
_WEEKEND_FACTOR = 0.65  # hafta sonu %35 daha az yoğun
_MIN_SAMPLES = 50
_MODEL_TTL_SECONDS = 15 * 60  # model her istekte değil, 15 dk'da bir yeniden eğitilir

_model_cache: dict = {"model": None, "n_samples": 0, "trained_at": None}


def _heuristic_congestion(hour: int, dow: int) -> float:
    base = _HOURLY_BASE[hour]
    return round(base * (_WEEKEND_FACTOR if dow >= 5 else 1.0), 3)


def _features(hour: int, dow: int) -> list[float]:
    """Saat ve gün için döngüsel kodlama."""
    return [
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        math.sin(2 * math.pi * dow / 7),
        math.cos(2 * math.pi * dow / 7),
    ]


def _confidence_label(n_samples: int) -> str:
    if n_samples >= 500:
        return "yüksek"
    if n_samples >= 100:
        return "orta"
    return "heuristic"


async def _fetch_training_data() -> tuple[list, list]:
    """DB'den son 30 günlük snapshot'ları çekip özellik + hedef listesi döner."""
    if not database.DB_AVAILABLE or database.AsyncSessionLocal is None:
        return [], []
    try:
        from sqlalchemy import select
        from db_models import TrafficSnapshot

        since = datetime.now(timezone.utc) - timedelta(days=30)
        async with database.AsyncSessionLocal() as session:
            result = await session.execute(
                select(
                    TrafficSnapshot.recorded_at,
                    TrafficSnapshot.congestion_ratio,
                ).where(TrafficSnapshot.recorded_at >= since)
                .order_by(TrafficSnapshot.recorded_at.desc())
                .limit(10_000)
            )
            rows = result.all()

        X, y = [], []
        for r in rows:
            if r.congestion_ratio is None:
                continue
            local = r.recorded_at.astimezone(ANKARA_TZ)
            X.append(_features(local.hour, local.weekday()))
            y.append(1.0 - float(r.congestion_ratio))  # ratio → congestion yoğunluğu
        return X, y
    except Exception as e:
        logger.warning(f"Eğitim verisi çekilemedi: {e}")
        return [], []


async def _get_model():
    """Önbellekteki modeli döner; süresi dolmuşsa yeniden eğitir."""
    trained_at = _model_cache["trained_at"]
    if trained_at is not None and time.monotonic() - trained_at < _MODEL_TTL_SECONDS:
        return _model_cache["model"], _model_cache["n_samples"]

    model, n_samples = None, 0
    try:
        from sklearn.linear_model import Ridge
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler

        X, y = await _fetch_training_data()
        n_samples = len(X)
        if n_samples >= _MIN_SAMPLES:
            model = Pipeline([("scaler", StandardScaler()), ("reg", Ridge(alpha=1.0))])
            model.fit(X, y)
            logger.info(f"Tahmin modeli eğitildi: {n_samples} örnek")
    except ImportError:
        logger.debug("scikit-learn yok, heuristic kullanılıyor")
    except Exception as e:
        logger.warning(f"Model eğitim hatası: {e}")

    _model_cache.update(model=model, n_samples=n_samples, trained_at=time.monotonic())
    return model, n_samples


async def get_traffic_prediction(hours_ahead: int = 4, now: datetime | None = None) -> list[dict]:
    """Önümüzdeki `hours_ahead` saat için trafik yoğunluk tahmini.

    DB'de yeterli veri varsa Ridge regresyon modeli kullanır,
    yoksa Ankara rush-hour kalibrasyonu döner.
    """
    now = (now or datetime.now(timezone.utc)).astimezone(ANKARA_TZ)
    model, n_samples = await _get_model()

    results = []
    for delta in range(1, hours_ahead + 1):
        target = now + timedelta(hours=delta)
        h = target.hour
        dow = target.weekday()

        if model is not None:
            congestion = float(model.predict([_features(h, dow)])[0])
            congestion = max(0.0, min(1.0, congestion))
            confidence = _confidence_label(n_samples)
        else:
            congestion = _heuristic_congestion(h, dow)
            confidence = "heuristic"

        results.append({
            "deltaHours": delta,
            "hour": h,
            "timestamp": target.isoformat(),
            "predictedCongestion": round(congestion, 3),
            "confidence": confidence,
            "label": _traffic_label(congestion),
        })

    return results


def _traffic_label(congestion: float) -> str:
    if congestion >= 0.75:
        return "Tıkanık"
    if congestion >= 0.55:
        return "Yoğun"
    if congestion >= 0.35:
        return "Orta"
    return "Serbest"
