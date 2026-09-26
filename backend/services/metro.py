"""Ankara raylı sistem hatları (M1–M4, Ankaray).

Öncelik OpenStreetMap: Overpass API'den gerçek hat geometrisi ve istasyonlar
günde bir çekilir. Ağ erişimi yoksa aşağıdaki statik veri kullanılır; bu veri
yalnızca kaynaktan doğrulanmış istasyon koordinatlarını içerir, bu yüzden hat
çizgileri istasyonlar arasında düz çizgidir (yaklaşık).
"""
from __future__ import annotations

import logging
import time

from services.overpass import overpass_query

logger = logging.getLogger(__name__)

_BBOX = "39.80,32.45,40.10,33.00"  # güney, batı, kuzey, doğu
_CACHE_TTL = 24 * 3600

LINE_INFO: dict[str, dict] = {
    "M1": {"name": "M1 Kızılay – Batıkent",          "color": [220, 50, 50]},
    "M2": {"name": "M2 Kızılay – Koru",              "color": [50, 110, 230]},
    "M3": {"name": "M3 Batıkent – OSB-Törekent",     "color": [150, 90, 220]},
    "M4": {"name": "M4 Kızılay – Şehitler",          "color": [245, 140, 30]},
    "A1": {"name": "Ankaray AŞTİ – Dikimevi",        "color": [30, 180, 100]},
}

# ── Statik yedek: doğrulanmış istasyon koordinatları (lng, lat) ─────────────
_S = {
    "Kızılay":      (32.8540, 39.9208),
    "Sıhhiye":      (32.8549, 39.9280),
    "Ulus":         (32.8507, 39.9398),
    "AKM":          (32.8440, 39.9443),
    "Macunköy":     (32.7668, 39.9718),
    "Batıkent":     (32.7270, 39.9679),
    "OSB-Törekent": (32.5589, 39.9876),
    "Koru":         (32.6870, 39.8876),
    "Adliye":       (32.8505, 39.9306),
    "Gar":          (32.8422, 39.9341),
    "Şehitler":     (32.8610, 39.9962),
    "AŞTİ":         (32.8077, 39.9165),
    "Dikimevi":     (32.8775, 39.9323),
}

_STATIC_LINES: dict[str, list[str]] = {
    "M1": ["Kızılay", "Sıhhiye", "Ulus", "AKM", "Macunköy", "Batıkent"],
    "M2": ["Kızılay", "Koru"],
    "M3": ["Batıkent", "OSB-Törekent"],
    "M4": ["Kızılay", "Adliye", "Gar", "AKM", "Şehitler"],
    "A1": ["AŞTİ", "Kızılay", "Dikimevi"],
}


def _static_routes() -> dict:
    return {
        "type": "FeatureCollection",
        "source": "static",
        "features": [
            {
                "type": "Feature",
                "properties": {"id": ref, **LINE_INFO[ref]},
                "geometry": {"type": "LineString", "coordinates": [list(_S[s]) for s in stops]},
            }
            for ref, stops in _STATIC_LINES.items()
        ],
    }


def _static_stations() -> dict:
    lines_by_station: dict[str, list[str]] = {}
    for ref, stops in _STATIC_LINES.items():
        for s in stops:
            lines_by_station.setdefault(s, []).append(ref)
    return {
        "type": "FeatureCollection",
        "source": "static",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": name, "lines": lines_by_station.get(name, [])},
                "geometry": {"type": "Point", "coordinates": list(coord)},
            }
            for name, coord in _S.items()
        ],
    }


# ── OpenStreetMap ────────────────────────────────────────────────────────────
_ROUTES_QUERY = f"""
[out:json][timeout:90];
relation["route"~"^(subway|light_rail)$"]({_BBOX});
out geom;
"""
_STATIONS_QUERY = f"""
[out:json][timeout:60];
node["railway"="station"]["station"~"^(subway|light_rail)$"]({_BBOX});
out;
"""

# Ray parçaları: çoğu hatta rol boş, Ankaray'da "route"; platform/durak rollerini dışla
_TRACK_ROLES = {"", "route", "forward", "backward"}

_cache: dict = {"routes": None, "stations": None, "fetched_at": None}


def _normalize_ref(ref: str) -> str | None:
    ref = ref.strip().upper()
    if ref in LINE_INFO:
        return ref
    if ref in ("A", "ANKARAY") or "ANKARAY" in ref:
        return "A1"
    return None


def parse_overpass(data: dict) -> tuple[dict, dict] | None:
    """Overpass yanıtını hat + istasyon GeoJSON'una çevirir. Yetersizse None."""
    best: dict[str, tuple[int, list]] = {}
    stations = []
    for el in data.get("elements", []):
        if el.get("type") == "relation":
            tags = el.get("tags", {})
            ref = _normalize_ref(tags.get("ref", "") or tags.get("name", ""))
            if not ref:
                continue
            parts = [
                [[p["lon"], p["lat"]] for p in m["geometry"]]
                for m in el.get("members", [])
                if m.get("type") == "way" and m.get("role", "") in _TRACK_ROLES and m.get("geometry")
            ]
            size = sum(len(p) for p in parts)
            # Her yön için ayrı relation var; en ayrıntılısını tut
            if parts and size > best.get(ref, (0, []))[0]:
                best[ref] = (size, parts)
        elif el.get("type") == "node" and el.get("tags", {}).get("name"):
            stations.append({
                "type": "Feature",
                "properties": {"name": el["tags"]["name"], "lines": []},
                "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
            })

    if len(best) < 3:  # beklenmedik yanıt — statik veriye düş
        return None

    # İstasyonu ~300 m içinden geçen hatlara bağla
    for st in stations:
        lng, lat = st["geometry"]["coordinates"]
        st["properties"]["lines"] = sorted(
            ref for ref, (_, parts) in best.items()
            if any((p[0] - lng) ** 2 + (p[1] - lat) ** 2 < 0.003 ** 2 for part in parts for p in part)
        )
    stations = [s for s in stations if s["properties"]["lines"]]

    routes = {
        "type": "FeatureCollection",
        "source": "osm",
        "features": [
            {
                "type": "Feature",
                "properties": {"id": ref, **LINE_INFO[ref]},
                "geometry": {"type": "MultiLineString", "coordinates": parts},
            }
            for ref, (_, parts) in sorted(best.items())
        ],
    }
    return routes, {"type": "FeatureCollection", "source": "osm", "features": stations}


async def refresh_metro_from_osm() -> bool:
    try:
        routes = await overpass_query(_ROUTES_QUERY)
        stations = await overpass_query(_STATIONS_QUERY)
        parsed = parse_overpass({"elements": routes.get("elements", []) + stations.get("elements", [])})
    except Exception as e:
        logger.warning(f"Metro verisi OSM'den alınamadı, statik veri kullanılıyor: {e}")
        return False
    if parsed is None:
        logger.warning("OSM metro yanıtı yetersiz, statik veri kullanılıyor.")
        return False
    _cache["routes"], _cache["stations"] = parsed
    _cache["fetched_at"] = time.monotonic()
    logger.info(f"Metro verisi OSM'den alındı: {len(parsed[0]['features'])} hat, "
                f"{len(parsed[1]['features'])} istasyon")
    return True


def _fresh() -> bool:
    ts = _cache["fetched_at"]
    return ts is not None and time.monotonic() - ts < _CACHE_TTL * 2


def get_metro_routes():
    return _cache["routes"] if _fresh() else _static_routes()


def get_metro_stations():
    return _cache["stations"] if _fresh() else _static_stations()
