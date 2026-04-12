import httpx
import os
import asyncio

ANKARA_GROUPS = [
    # Grup 1 — Kızılay / Atatürk Bulvarı / Çankaya merkez
    [(39.9334, 32.8597), (39.9200, 32.8558), (39.9100, 32.8530), (39.9000, 32.8510)],
    # Grup 2 — Eskişehir Yolu (D-260) doğu-batı ekseni
    [(39.9560, 32.8598), (39.9540, 32.8200), (39.9520, 32.7850), (39.9500, 32.7400)],
    # Grup 3 — E90 / TEM otoyolu koridor
    [(39.9750, 32.8150), (39.9800, 32.8600), (39.9820, 32.9100), (39.9700, 32.9500)],
    # Grup 4 — Konya Yolu (D-750) güney ekseni
    [(39.8700, 32.7500), (39.8900, 32.8000), (39.9010, 32.8350), (39.9150, 32.8480)],
    # Grup 5 — Esenboğa Yolu / Çevre Yolu kuzey
    [(40.0300, 32.9000), (40.0000, 32.8900), (39.9850, 32.8800), (39.9700, 32.8700)],
    # Grup 6 — Mevlana Bulvarı / Yenimahalle-Merkez
    [(39.9490, 32.8580), (39.9450, 32.8500), (39.9400, 32.8480), (39.9360, 32.8530)],
    # Grup 7 — Cemal Gürsel Cad. / Ulus / Etlik
    [(39.9600, 32.8700), (39.9650, 32.8620), (39.9580, 32.8550), (39.9520, 32.8480)],
    # Grup 8 — İç Çevre Yolu batı-doğu
    [(39.8600, 32.8200), (39.8700, 32.8500), (39.8750, 32.8800), (39.8800, 32.9100)],
]
_group_index = 0
BASE = "https://api.tomtom.com/traffic/services/4/flowSegmentData"


async def fetch_ankara_traffic():
    global _group_index
    key = os.getenv("TOMTOM_API_KEY")
    group = ANKARA_GROUPS[_group_index % len(ANKARA_GROUPS)]
    _group_index += 1
    features = []
    async with httpx.AsyncClient() as client:
        for lat, lng in group:
            url = f"{BASE}/absolute/10/json?point={lat},{lng}&unit=KMPH&key={key}"
            try:
                r = await client.get(url, timeout=10)
                if r.status_code == 200:
                    d = r.json()["flowSegmentData"]
                    ratio = d["currentSpeed"] / max(d["freeFlowSpeed"], 1)
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lng, lat]},
                        "properties": {
                            "currentSpeed": d["currentSpeed"],
                            "freeFlowSpeed": d["freeFlowSpeed"],
                            "congestionRatio": round(ratio, 2),
                            "closed": d["roadClosure"]
                        }
                    })
            except Exception as e:
                print(f"TomTom hata ({lat},{lng}): {e}")
            await asyncio.sleep(0.5)
    return {"type": "FeatureCollection", "features": features}
