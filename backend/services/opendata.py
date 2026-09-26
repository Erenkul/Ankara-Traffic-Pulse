"""Ankara açık veri katmanları: otopark, bisiklet istasyonu, bisiklet yolu, teleferik.

Her katman için kaynaklar öncelik sırasıyla denenir:

1. **Yerel dosya** — `backend/data/opendata/` klasörüne konan XLSX / CSV / GeoJSON.
   ULASAV ve Şeffaf Ankara yurt dışı sunuculardan gelen istekleri reddedebildiği
   için en güvenilir yol, veri setini tarayıcıdan indirip bu klasöre koymaktır.
   Dosya, adındaki anahtar kelimelerle katmana eşlenir (ör. "Bisiklet İstasyon
   Verileri.xlsx" → bisiklet istasyonları).
2. **Doğrudan adres** — `<KATMAN>_RESOURCE_URL` ortam değişkeni. Şeffaf Ankara'da
   API başvurusu onaylanınca verilen `.../GetApiFeatures/apiKey=...` adresi de olur.
3. **ULASAV (CKAN)** — Ankara Büyükşehir'in bilinen veri seti adları
   (`06-bisiklet-istasyon-verileri` vb.) üzerinden `package_show`.
4. **OpenStreetMap** — Overpass ile konumlar (doluluk bilgisi yoktur).

Koordinatlar WGS84 derece, Web Mercator (EPSG:3857) veya Türkiye TM 33° (ITRF96/TM,
EPSG:5256 — belediyelerin yaygın kullandığı) olabilir; otomatik tanınıp dereceye
çevrilir. Veri bulunamazsa katman boş kalır, uygulama etkilenmez.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

from services.overpass import overpass_query, ANKARA_BBOX

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.getenv("OPEN_DATA_DIR", Path(__file__).resolve().parent.parent / "data" / "opendata"))
ABB_LICENSE = "Şeffaf Ankara Lisansı — Ankara Büyükşehir Belediyesi, atıf zorunlu"
OSM_LICENSE = "© OpenStreetMap katkıcıları, ODbL"
_MAX_BYTES = 25 * 1024 * 1024
_LAT_RANGE = (39.3, 40.6)
_LNG_RANGE = (31.8, 33.9)

LAYERS: dict[str, dict] = {
    "parking": {
        "title": "Otoparklar",
        "geometry": "point",
        "file_keywords": [["otopark"]],
        "env": "PARKING_RESOURCE_URL",
        "ulasav": [],  # Ankara'nın ULASAV ulaşım grubunda otopark veri seti yok
        "osm": f'nwr["amenity"="parking"]["access"!~"^(private|no|customers)$"]({ANKARA_BBOX});out center tags;',
        "refresh_minutes": 10,
    },
    "bikestations": {
        "title": "Bisiklet istasyonları",
        "geometry": "point",
        "file_keywords": [["bisiklet", "istasyon"]],
        "env": "BIKESTATIONS_RESOURCE_URL",
        "ulasav": ["06-bisiklet-istasyon-verileri", "06-elektrikli-bisiklet-istasyonlari"],
        "osm": f'nwr["amenity"~"^(bicycle_parking|bicycle_rental)$"]({ANKARA_BBOX});out center tags;',
        "refresh_minutes": 60,
    },
    "bike": {
        "title": "Bisiklet yolları",
        "geometry": "line",
        "file_keywords": [["bisiklet", "yol"]],
        "env": "BIKE_RESOURCE_URL",
        "ulasav": ["06-bisiklet-yollari-verileri"],
        "osm": (f'(way["highway"="cycleway"]({ANKARA_BBOX});'
                f'way["cycleway"~"^(lane|track)$"]({ANKARA_BBOX});'
                f'way["cycleway:both"~"^(lane|track)$"]({ANKARA_BBOX}););out geom tags;'),
        "refresh_minutes": 24 * 60,
    },
    "cablecar": {
        "title": "Teleferik",
        "geometry": "point",
        "file_keywords": [["teleferik"]],
        "env": "CABLECAR_RESOURCE_URL",
        "ulasav": ["06-teleferik-durak-verileri"],
        "osm": f'nwr["aerialway"="station"]({ANKARA_BBOX});out center tags;',
        "refresh_minutes": 24 * 60,
    },
}

_cache: dict[str, dict] = {}


def _ulasav_base() -> str:
    return os.getenv("ULASAV_BASE", "https://ulasav.csb.gov.tr").rstrip("/")


def enabled() -> bool:
    return os.getenv("OPEN_DATA", "on").lower() != "off"


# ── Metin ve sayı yardımcıları ───────────────────────────────────────────────
_TR = str.maketrans("çğıöşüÇĞİÖŞÜâîû", "cgiosuCGIOSUaiu")


def _norm(key) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).translate(_TR).lower())


def _num(v) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "")
    if s.count(",") == 1 and s.count(".") == 0:
        s = s.replace(",", ".")
    elif s.count(",") == 1 and s.count(".") >= 1:  # 1.234,5
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


# ── Koordinat dönüşümleri ────────────────────────────────────────────────────
def _in_ankara(lat: float, lng: float) -> bool:
    return _LAT_RANGE[0] <= lat <= _LAT_RANGE[1] and _LNG_RANGE[0] <= lng <= _LNG_RANGE[1]


def _mercator_to_wgs84(x: float, y: float) -> tuple[float, float]:
    lng = x / 6378137.0 * 180 / math.pi
    lat = (2 * math.atan(math.exp(y / 6378137.0)) - math.pi / 2) * 180 / math.pi
    return lat, lng


def _tm_to_wgs84(e: float, n: float, lon0: float = 33.0, k0: float = 1.0,
                 fe: float = 500000.0) -> tuple[float, float]:
    """Transverse Mercator (GRS80) ters dönüşümü — ITRF96/TM33, UTM 36N (k0=0.9996)."""
    a, f = 6378137.0, 1 / 298.257222101
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    m = n / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
            + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu) + (1097 * e1**4 / 512) * math.sin(8 * mu))
    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = (e - fe) / (n1 * k0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720)
    lng = math.radians(lon0) + (
        d - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120) / math.cos(phi1)
    return math.degrees(lat), math.degrees(lng)


def to_wgs84(a: float, b: float) -> tuple[float, float] | None:
    """(x/lng, y/lat) ya da (lat, lng) çiftini Ankara içinde (lat, lng) dereceye çevirir."""
    if _in_ankara(b, a):
        return b, a
    if _in_ankara(a, b):
        return a, b
    for x, y in ((a, b), (b, a)):
        if 3.3e6 < abs(x) < 4.0e6 and 4.5e6 < abs(y) < 5.1e6:  # Web Mercator
            lat, lng = _mercator_to_wgs84(x, y)
            if _in_ankara(lat, lng):
                return lat, lng
        if 250_000 < x < 750_000 and 4.3e6 < y < 4.6e6:  # TM 33° (ITRF96/TM veya UTM 36N)
            k0 = 0.9996 if os.getenv("OPEN_DATA_CRS", "").upper() in ("UTM", "UTM36", "32636") else 1.0
            lat, lng = _tm_to_wgs84(x, y, k0=k0)
            if _in_ankara(lat, lng):
                return lat, lng
    return None


# ── Alan adı tespiti ─────────────────────────────────────────────────────────
_LAT_KEYS = ["lat", "latitude", "enlem", "koordinaty", "ykoordinat", "y", "yenlem", "enlemy"]
_LNG_KEYS = ["lng", "lon", "long", "longitude", "boylam", "koordinatx", "xkoordinat", "x", "xboylam", "boylamx"]
_COORD_PAIR_KEYS = ["koordinat", "koordinatlar", "konum", "coordinates", "location"]
_NAME_KEYS = ["otoparkadi", "istasyonadi", "durakadi", "istasyon", "durak", "yoladi", "guzergahadi",
              "guzergah", "parkadi", "adi", "ad", "isim", "name", "baslik", "tanim"]
_CAPACITY_KEYS = ["kapasite", "toplamkapasite", "aracpakapasitesi", "bisikletkapasitesi",
                  "parkyerisayisi", "parkyeri", "capacity", "toplam"]
_FREE_KEYS = ["bos", "bosalan", "bosyer", "bosparkyeri", "musait", "empty", "available", "emptycapacity"]
_OCCUPIED_KEYS = ["dolu", "doluyer", "occupied"]
_LENGTH_KEYS = ["uzunluk", "uzunlukm", "uzunlukkm", "mesafe", "length"]
_DISTRICT_KEYS = ["ilce", "ilceadi", "district"]
_TYPE_KEYS = ["tur", "tip", "tipi", "turu", "type", "kategori"]


def _pick(normalized: dict, keys) -> object | None:
    for k in keys:
        v = normalized.get(k)
        if v not in (None, ""):
            return v
    return None


def _props(normalized: dict) -> dict:
    props: dict = {}
    for key, keys in (("name", _NAME_KEYS), ("district", _DISTRICT_KEYS), ("kind", _TYPE_KEYS)):
        v = _pick(normalized, keys)
        if v is not None and not isinstance(v, (int, float)):
            props[key] = str(v).strip()
    cap = _num(_pick(normalized, _CAPACITY_KEYS))
    free = _num(_pick(normalized, _FREE_KEYS))
    occ = _num(_pick(normalized, _OCCUPIED_KEYS))
    if cap is not None and cap > 0:
        props["capacity"] = int(cap)
        if free is None and occ is not None:
            free = cap - occ
    if free is not None:
        props["free"] = max(0, int(free))
    length = _num(_pick(normalized, _LENGTH_KEYS))
    if length is not None:
        props["length"] = length
    return props


_WKT_RE = re.compile(r"^\s*(MULTI)?(POINT|LINESTRING)\s*(Z|M|ZM)?\s*\(", re.I)


def _parse_wkt(text: str):
    """POINT / LINESTRING / MULTILINESTRING WKT → (tip, koordinat listeleri)."""
    kind = text.strip().split("(")[0].strip().upper().split()[0]
    groups = re.findall(r"\(([^()]+)\)", text)
    parts = []
    for g in groups:
        pts = []
        for pair in g.split(","):
            nums = [float(n) for n in pair.split()[:2]]
            if len(nums) == 2:
                pts.append(nums)
        if pts:
            parts.append(pts)
    return kind, parts


def _convert_path(path) -> list[list[float]]:
    out = []
    for p in path:
        ll = to_wgs84(p[0], p[1])
        if ll:
            out.append([round(ll[1], 6), round(ll[0], 6)])
    return out


def rows_to_features(rows: list[dict], geometry: str) -> list[dict]:
    """Tablo satırlarını (XLSX/CSV/JSON) GeoJSON'a çevirir."""
    features = []
    line_groups: dict[str, list] = {}
    group_props: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized = {_norm(k): v for k, v in row.items()}
        props = _props(normalized)

        # 1) WKT geometri sütunu
        wkt = next((v for v in normalized.values() if isinstance(v, str) and _WKT_RE.match(v)), None)
        if wkt:
            kind, parts = _parse_wkt(wkt)
            if kind.endswith("LINESTRING") and geometry == "line":
                paths = [p for p in (_convert_path(part) for part in parts) if len(p) >= 2]
                if paths:
                    features.append({"type": "Feature", "properties": props,
                                     "geometry": {"type": "MultiLineString", "coordinates": paths}})
                continue
            if kind.endswith("POINT") and parts:
                ll = to_wgs84(*parts[0][0])
                if ll and geometry == "point":
                    features.append(_point(ll, props))
                continue

        # 2) Enlem/boylam sütunları ya da "39.9, 32.8" gibi tek sütun
        a = _num(_pick(normalized, _LAT_KEYS))
        b = _num(_pick(normalized, _LNG_KEYS))
        if a is None or b is None:
            pair = _pick(normalized, _COORD_PAIR_KEYS)
            nums = re.findall(r"-?\d+(?:\.\d+)?", str(pair).replace(", ", " ; ")) if pair else []
            if len(nums) >= 2:
                a, b = float(nums[0]), float(nums[1])
        if a is None or b is None:
            continue
        ll = to_wgs84(b, a)  # (x, y) sırası; to_wgs84 iki sırayı da dener
        if not ll:
            continue
        if geometry == "point":
            features.append(_point(ll, props))
        else:  # aynı adlı ardışık noktalardan çizgi kur
            key = props.get("name", "_")
            line_groups.setdefault(key, []).append([round(ll[1], 6), round(ll[0], 6)])
            group_props.setdefault(key, props)

    for key, path in line_groups.items():
        if len(path) >= 2:
            features.append({"type": "Feature", "properties": group_props[key],
                             "geometry": {"type": "LineString", "coordinates": path}})
    return features


def _point(ll: tuple[float, float], props: dict) -> dict:
    props.setdefault("major", True)
    return {"type": "Feature", "properties": props,
            "geometry": {"type": "Point", "coordinates": [round(ll[1], 6), round(ll[0], 6)]}}


def geojson_features(fc: dict, geometry: str) -> list[dict]:
    """GeoJSON'dan istenen geometriyi, gerekirse dereceye çevirerek döner."""
    out = []
    for f in fc.get("features", []):
        geom = f.get("geometry") or {}
        props = _props({_norm(k): v for k, v in (f.get("properties") or {}).items()})
        t = geom.get("type")
        if geometry == "point" and t == "Point":
            ll = to_wgs84(*geom["coordinates"][:2])
            if ll:
                out.append(_point(ll, props))
        elif geometry == "line" and t in ("LineString", "MultiLineString"):
            parts = [geom["coordinates"]] if t == "LineString" else geom["coordinates"]
            paths = [p for p in (_convert_path(part) for part in parts) if len(p) >= 2]
            if paths:
                out.append({"type": "Feature", "properties": props,
                            "geometry": {"type": "MultiLineString", "coordinates": paths}})
    return out


def _xlsx_rows(content: bytes) -> list[dict]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    rows: list[dict] = []
    for ws in wb.worksheets:
        header = None
        for values in ws.iter_rows(values_only=True):
            cells = list(values)
            if header is None:
                # Başlık: en az iki metin hücresi olan ilk satır
                if sum(isinstance(c, str) and c.strip() != "" for c in cells) >= 2:
                    header = [str(c).strip() if c is not None else f"col{i}" for i, c in enumerate(cells)]
                continue
            if any(c not in (None, "") for c in cells):
                rows.append(dict(zip(header, cells)))
    wb.close()
    return rows


def parse_resource(content: bytes, fmt: str, geometry: str) -> list[dict]:
    fmt = fmt.lower().strip(".")
    if fmt in ("xlsx", "xlsm") or content[:2] == b"PK":
        return rows_to_features(_xlsx_rows(content), geometry)
    text = content.decode("utf-8-sig", errors="replace")
    if fmt in ("csv", "txt"):
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=";,\t")
        return rows_to_features(list(csv.DictReader(io.StringIO(text), dialect=dialect)), geometry)
    data = json.loads(text)
    if isinstance(data, dict) and data.get("type") == "FeatureCollection":
        return geojson_features(data, geometry)
    if isinstance(data, dict):
        data = (data.get("data") or data.get("records")
                or (data.get("result") or {}).get("records") or [])
    return rows_to_features(data if isinstance(data, list) else [], geometry)


# ── OpenStreetMap ────────────────────────────────────────────────────────────
def osm_features(data: dict, geometry: str) -> list[dict]:
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        props: dict = {}
        if tags.get("name"):
            props["name"] = tags["name"]
        cap = _num(tags.get("capacity"))
        if cap:
            props["capacity"] = int(cap)
        kind = tags.get("parking") or tags.get("amenity") or tags.get("bicycle_parking")
        if kind:
            props["kind"] = kind
        if tags.get("fee"):
            props["fee"] = tags["fee"] != "no"
        # Uzak yakınlaştırmada gösterilecek "önemli" otoparklar
        props["major"] = bool(props.get("name") or props.get("capacity")
                              or tags.get("parking") in ("multi-storey", "underground"))
        if geometry == "point":
            if "lat" in el:
                lat, lng = el["lat"], el["lon"]
            elif "center" in el:
                lat, lng = el["center"]["lat"], el["center"]["lon"]
            else:
                continue
            out.append(_point((lat, lng), props))
        elif el.get("geometry"):
            path = [[round(p["lon"], 6), round(p["lat"], 6)] for p in el["geometry"]]
            if len(path) >= 2:
                out.append({"type": "Feature", "properties": props,
                            "geometry": {"type": "LineString", "coordinates": path}})
    return out


# ── Kaynaklar ────────────────────────────────────────────────────────────────
def _guess_format(name: str, content_type: str = "") -> str:
    low = name.lower().split("?")[0]
    for ext in ("geojson", "json", "csv", "xlsx"):
        if low.endswith("." + ext) or ext in content_type:
            return ext
    if "spreadsheet" in content_type:
        return "xlsx"
    return "json"


def local_files(key: str) -> list[Path]:
    if not DATA_DIR.is_dir():
        return []
    groups = LAYERS[key]["file_keywords"]
    return sorted(
        p for p in DATA_DIR.iterdir()
        if p.suffix.lower() in (".xlsx", ".csv", ".json", ".geojson")
        and any(all(k in _norm(p.stem) for k in group) for group in groups)
    )


async def _from_ulasav(client: httpx.AsyncClient, slug: str, geometry: str) -> tuple[list, dict] | None:
    r = await client.get(f"{_ulasav_base()}/api/3/action/package_show", params={"id": slug})
    r.raise_for_status()
    pkg = r.json()["result"]
    features: list = []
    for res in pkg.get("resources", []):
        fmt = (res.get("format") or "").lower()
        if fmt not in ("xlsx", "csv", "json", "geojson") or not res.get("url"):
            continue
        resp = await client.get(res["url"])
        resp.raise_for_status()
        features += parse_resource(resp.content, fmt, geometry)
    if not features:
        return None
    return features, {"provider": "ulasav", "dataset": pkg.get("title"),
                      "page": f"{_ulasav_base()}/dataset/{slug}", "license": ABB_LICENSE}


async def refresh_layer(key: str) -> dict:
    layer = LAYERS[key]
    geometry = layer["geometry"]
    empty = {"type": "FeatureCollection", "features": [], "source": None}
    if not enabled():
        _cache[key] = empty
        return empty

    features: list = []
    source: dict | None = None

    # 1) Yerel dosyalar
    files = local_files(key)
    for path in files:
        try:
            features += parse_resource(path.read_bytes(), path.suffix, geometry)
        except Exception as e:
            logger.warning(f"Açık veri dosyası okunamadı ({path.name}): {e}")
    if features:
        source = {"provider": "file", "dataset": ", ".join(p.stem for p in files),
                  "page": "https://ulasav.csb.gov.tr/dataset/?organization=ankara-buyuksehir-belediyesi&groups=ulasim",
                  "license": ABB_LICENSE}

    async with httpx.AsyncClient(timeout=40, follow_redirects=True) as client:
        # 2) Doğrudan adres (ör. Şeffaf Ankara API)
        direct = os.getenv(layer["env"])
        if not features and direct:
            try:
                resp = await client.get(direct)
                resp.raise_for_status()
                if len(resp.content) > _MAX_BYTES:
                    raise ValueError("kaynak çok büyük")
                features = parse_resource(resp.content,
                                          _guess_format(direct, resp.headers.get("content-type", "")), geometry)
                provider = "seffaf" if "seffaf" in direct else "url"
                source = {"provider": provider, "dataset": layer["title"],
                          "page": "https://seffaf.ankara.bel.tr/" if provider == "seffaf" else direct,
                          "license": ABB_LICENSE}
            except Exception as e:
                logger.warning(f"Açık veri adresi okunamadı ({key}): {e}")

        # 3) ULASAV
        if not features:
            for slug in layer["ulasav"]:
                try:
                    found = await _from_ulasav(client, slug, geometry)
                except Exception as e:
                    logger.info(f"ULASAV '{slug}' alınamadı: {e}")
                    continue
                if found:
                    features += found[0]
                    source = source or found[1]

    # 4) OpenStreetMap
    if not features and layer.get("osm"):
        try:
            data = await overpass_query(f"[out:json][timeout:90];{layer['osm']}")
            features = osm_features(data, geometry)
            source = {"provider": "osm", "dataset": f"OpenStreetMap — {layer['title']}",
                      "page": "https://www.openstreetmap.org/", "license": OSM_LICENSE}
        except Exception as e:
            logger.warning(f"OSM '{key}' alınamadı: {e}")
            return _cache.get(key, empty)

    fc = {
        "type": "FeatureCollection",
        "features": features,
        "source": {**source, "fetchedAt": datetime.now(timezone.utc).isoformat()} if features and source else None,
    }
    _cache[key] = fc
    logger.info(f"Açık veri '{key}': {len(features)} öğe ({source['provider'] if source else 'yok'})")
    return fc


def get_layer(key: str) -> dict:
    return _cache.get(key, {"type": "FeatureCollection", "features": [], "source": None})


def availability() -> dict[str, int]:
    return {k: len(get_layer(k)["features"]) for k in LAYERS}


def providers() -> dict[str, str | None]:
    return {k: (get_layer(k)["source"] or {}).get("provider") for k in LAYERS}
