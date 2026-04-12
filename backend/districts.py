"""Bölge sınıflandırması — bounding box + mesafe fallback."""

# (lat_min, lat_max, lng_min, lng_max)
DISTRICT_BOXES: dict[str, tuple[float, float, float, float]] = {
    "Kızılay":        (39.920, 39.950, 32.840, 32.880),
    "Çankaya":        (39.880, 39.920, 32.850, 32.890),
    "Ulus":           (39.930, 39.970, 32.840, 32.870),
    "Yenimahalle":    (39.960, 40.000, 32.780, 32.860),
    "Eskişehir Yolu": (39.850, 39.900, 32.700, 32.800),
    "Esenboğa Yolu":  (40.000, 40.060, 32.850, 32.960),
    "Konya Yolu":     (39.830, 39.880, 32.760, 32.850),
}

_CENTER_POINTS: dict[str, tuple[float, float]] = {
    "Kızılay":        (39.9334, 32.8597),
    "Çankaya":        (39.9010, 32.8650),
    "Ulus":           (39.9490, 32.8580),
    "Yenimahalle":    (39.9750, 32.8150),
    "Eskişehir Yolu": (39.8700, 32.7500),
    "Esenboğa Yolu":  (40.0300, 32.9000),
    "Konya Yolu":     (39.8600, 32.8200),
}


def classify_district(lat: float, lng: float) -> str:
    for name, (la, lb, lna, lnb) in DISTRICT_BOXES.items():
        if la <= lat <= lb and lna <= lng <= lnb:
            return name
    # Nearest center fallback
    nearest, min_d = "Diğer", float("inf")
    for name, (dlat, dlng) in _CENTER_POINTS.items():
        d = (lat - dlat) ** 2 + (lng - dlng) ** 2
        if d < min_d:
            min_d, nearest = d, name
    return nearest


def district_stats_from_features(features: list[dict]) -> list[dict]:
    """Anlık trafik verilerinden bölge bazında istatistik üretir."""
    buckets: dict[str, list[float]] = {}
    for f in features:
        ratio = f["properties"].get("congestionRatio")
        if ratio is None:
            continue
        lat = f["geometry"]["coordinates"][1]
        lng = f["geometry"]["coordinates"][0]
        name = classify_district(lat, lng)
        buckets.setdefault(name, []).append(ratio)

    result = []
    for name, ratios in sorted(buckets.items()):
        avg = sum(ratios) / len(ratios)
        result.append({
            "district": name,
            "avgCongestionRatio": round(avg, 3),
            "congestionPct": round((1 - avg) * 100, 1),
            "sampleCount": len(ratios),
        })
    return result
