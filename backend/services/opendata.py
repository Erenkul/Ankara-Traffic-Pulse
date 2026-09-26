"""Ankara açık veri katmanları — ULASAV (CKAN) ve Şeffaf Ankara.

ULASAV (ulasav.csb.gov.tr) bir CKAN portalıdır; Ankara Büyükşehir Belediyesi'nin
veri setleri `ankara-buyuksehir-belediyesi` organizasyonu altındadır. Bu modül
CKAN arama API'siyle ilgili veri setini bulur, GeoJSON / JSON / CSV kaynağını
indirir ve koordinat alanlarını esnek biçimde tespit ederek GeoJSON'a çevirir.

Veri setinin tam adresi biliniyorsa (ör. Şeffaf Ankara'dan kopyalanan indirme
bağlantısı) `PARKING_RESOURCE_URL` / `BIKE_RESOURCE_URL` ile doğrudan verilebilir;
bu durumda arama yapılmaz.

Veri yoksa ya da portala erişilemezse katman boş kalır, uygulama etkilenmez.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

ORGANIZATION = "ankara-buyuksehir-belediyesi"
LICENSE_NOTE = "Ankara Büyükşehir Belediyesi açık veri lisansı — atıf zorunlu"
_MAX_BYTES = 15 * 1024 * 1024
# Ankara ili sınırlarını kaba kapsayan kutu — projeksiyonlu/bozuk koordinatları eler
_LAT_RANGE = (39.3, 40.6)
_LNG_RANGE = (31.8, 33.9)

LAYERS: dict[str, dict] = {
    "parking": {"query": "otopark", "geometry": "point", "env": "PARKING_RESOURCE_URL",
                "title": "Otoparklar"},
    "bike":    {"query": "bisiklet", "geometry": "line", "env": "BIKE_RESOURCE_URL",
                "title": "Bisiklet yolları"},
}

_cache: dict[str, dict] = {}


def _base() -> str:
    return os.getenv("ULASAV_BASE", "https://ulasav.csb.gov.tr").rstrip("/")


def enabled() -> bool:
    return os.getenv("OPEN_DATA", "on").lower() != "off"


# ── Alan adı tespiti ─────────────────────────────────────────────────────────
_TR = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


def _norm(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).translate(_TR).lower())


_LAT_KEYS = {"lat", "latitude", "enlem", "koordinaty", "ykoordinat", "y"}
_LNG_KEYS = {"lng", "lon", "long", "longitude", "boylam", "koordinatx", "xkoordinat", "x"}
_NAME_KEYS = ["otoparkadi", "parkadi", "adi", "ad", "isim", "name", "baslik", "tanim"]
_CAPACITY_KEYS = ["kapasite", "toplamkapasite", "capacity", "toplam"]
_FREE_KEYS = ["bos", "bosalan", "bosyer", "musait", "empty", "available", "emptycapacity"]
_OCCUPIED_KEYS = ["dolu", "doluluk", "occupied"]


def _pick(row: dict, keys) -> object | None:
    normalized = {_norm(k): v for k, v in row.items()}
    for k in keys:
        if k in normalized and normalized[k] not in (None, ""):
            return normalized[k]
    return None


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def _in_ankara(lat: float, lng: float) -> bool:
    return _LAT_RANGE[0] <= lat <= _LAT_RANGE[1] and _LNG_RANGE[0] <= lng <= _LNG_RANGE[1]


def _point_props(row: dict) -> dict:
    props: dict = {}
    name = _pick(row, _NAME_KEYS)
    if name:
        props["name"] = str(name).strip()
    cap, free, occ = (_num(_pick(row, ks)) for ks in (_CAPACITY_KEYS, _FREE_KEYS, _OCCUPIED_KEYS))
    if cap is not None:
        props["capacity"] = int(cap)
        if free is None and occ is not None and occ > 1:
            free = cap - occ
    if free is not None:
        props["free"] = max(0, int(free))
    return props


def rows_to_points(rows: list[dict]) -> list[dict]:
    """Tablo satırlarını (JSON/CSV) nokta GeoJSON'una çevirir."""
    features = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized = {_norm(k): v for k, v in row.items()}
        lat = next((_num(normalized[k]) for k in _LAT_KEYS if k in normalized), None)
        lng = next((_num(normalized[k]) for k in _LNG_KEYS if k in normalized), None)
        if lat is None or lng is None:
            continue
        if not _in_ankara(lat, lng) and _in_ankara(lng, lat):
            lat, lng = lng, lat  # enlem/boylam yer değiştirmiş
        if not _in_ankara(lat, lng):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": _point_props(row),
        })
    return features


def geojson_features(fc: dict, geometry: str) -> list[dict]:
    """GeoJSON'dan istenen geometri tipini (point/line) Ankara içinde kalanlarla döner."""
    wanted = {"point": {"Point"}, "line": {"LineString", "MultiLineString"}}[geometry]
    out = []
    for f in fc.get("features", []):
        geom = f.get("geometry") or {}
        if geom.get("type") not in wanted:
            continue
        first = geom["coordinates"]
        while isinstance(first, list) and first and isinstance(first[0], list):
            first = first[0]
        if not (isinstance(first, list) and len(first) >= 2 and _in_ankara(first[1], first[0])):
            continue
        props = f.get("properties") or {}
        out.append({
            "type": "Feature",
            "geometry": geom,
            "properties": _point_props(props) if geometry == "point" else
                          {"name": str(_pick(props, _NAME_KEYS) or "").strip()},
        })
    return out


def parse_resource(content: bytes, fmt: str, geometry: str) -> list[dict]:
    fmt = fmt.lower()
    text = content.decode("utf-8-sig", errors="replace")
    if fmt in ("csv", "text/csv"):
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=";,\t")
        return rows_to_points(list(csv.DictReader(io.StringIO(text), dialect=dialect))) \
            if geometry == "point" else []
    data = json.loads(text)
    if isinstance(data, dict) and data.get("type") == "FeatureCollection":
        return geojson_features(data, geometry)
    if geometry != "point":
        return []
    if isinstance(data, dict):  # {"data": [...]} ya da {"result": {"records": [...]}}
        data = data.get("data") or data.get("records") or (data.get("result") or {}).get("records") or []
    return rows_to_points(data if isinstance(data, list) else [])


# ── CKAN ─────────────────────────────────────────────────────────────────────
_FORMAT_RANK = {"geojson": 0, "json": 1, "csv": 2}


async def _find_resource(client: httpx.AsyncClient, query: str) -> tuple[str, str, dict] | None:
    r = await client.get(
        f"{_base()}/api/3/action/package_search",
        params={"q": query, "fq": f"organization:{ORGANIZATION}", "rows": 20},
    )
    r.raise_for_status()
    candidates = []
    for pkg in r.json().get("result", {}).get("results", []):
        for res in pkg.get("resources", []):
            fmt = (res.get("format") or "").lower().strip(".")
            if fmt in _FORMAT_RANK and res.get("url"):
                candidates.append((_FORMAT_RANK[fmt], fmt, res["url"], pkg))
    if not candidates:
        return None
    _, fmt, url, pkg = min(candidates, key=lambda c: c[0])
    return url, fmt, {"dataset": pkg.get("title"), "page": f"{_base()}/dataset/{pkg.get('name')}"}


def _guess_format(url: str, content_type: str) -> str:
    for ext in ("geojson", "json", "csv"):
        if url.lower().split("?")[0].endswith("." + ext) or ext in content_type:
            return ext
    return "json"


async def refresh_layer(key: str) -> dict:
    layer = LAYERS[key]
    empty = {"type": "FeatureCollection", "features": [], "source": None}
    if not enabled():
        _cache[key] = empty
        return empty
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            direct = os.getenv(layer["env"])
            if direct:
                url, fmt, source = direct, "", {"dataset": layer["title"], "page": direct}
            else:
                found = await _find_resource(client, layer["query"])
                if not found:
                    logger.info(f"Açık veri: '{layer['query']}' için Ankara veri seti bulunamadı.")
                    _cache[key] = empty
                    return empty
                url, fmt, source = found
            resp = await client.get(url)
            resp.raise_for_status()
            if len(resp.content) > _MAX_BYTES:
                raise ValueError("kaynak çok büyük")
            fmt = fmt or _guess_format(url, resp.headers.get("content-type", ""))
            features = parse_resource(resp.content, fmt, layer["geometry"])
    except Exception as e:
        logger.warning(f"Açık veri katmanı '{key}' alınamadı: {e}")
        return _cache.get(key, empty)

    fc = {
        "type": "FeatureCollection",
        "features": features,
        "source": {**source, "license": LICENSE_NOTE,
                   "fetchedAt": datetime.now(timezone.utc).isoformat()} if features else None,
    }
    _cache[key] = fc
    logger.info(f"Açık veri katmanı '{key}': {len(features)} öğe")
    return fc


async def refresh_parking():
    await refresh_layer("parking")


async def refresh_bike():
    await refresh_layer("bike")


def get_layer(key: str) -> dict:
    return _cache.get(key, {"type": "FeatureCollection", "features": [], "source": None})


def availability() -> dict[str, int]:
    return {k: len(get_layer(k)["features"]) for k in LAYERS}
