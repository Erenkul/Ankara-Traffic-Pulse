import time

from settings import TRAFFIC_STALE_SECONDS

_traffic_features: dict[tuple, tuple[float, dict]] = {}  # (lng, lat) -> (monotonic ts, feature)
_bus_data = []
_last_traffic_update: float | None = None
_last_bus_update: float | None = None


def _prune(now: float):
    stale = [k for k, (ts, _) in _traffic_features.items() if now - ts > TRAFFIC_STALE_SECONDS]
    for k in stale:
        del _traffic_features[k]


def get_traffic_data():
    _prune(time.monotonic())
    return {"type": "FeatureCollection", "features": [f for _, f in _traffic_features.values()]}


def get_bus_data():
    return _bus_data


def update_traffic(data):
    """Yeni noktaları koordinata göre biriktirir; eskiyen noktalar düşülür."""
    global _last_traffic_update
    now = time.monotonic()
    for feature in data.get("features", []):
        coords = feature["geometry"]["coordinates"]
        key = (round(coords[0], 5), round(coords[1], 5))
        _traffic_features[key] = (now, feature)
    _prune(now)
    _last_traffic_update = now


def update_buses(data):
    global _bus_data, _last_bus_update
    _bus_data = data
    _last_bus_update = time.monotonic()


def cache_status() -> dict:
    now = time.monotonic()

    def age(ts):
        return None if ts is None else round(now - ts)

    return {
        "trafficPoints": len(_traffic_features),
        "trafficAgeSeconds": age(_last_traffic_update),
        "busCount": len(_bus_data),
        "busAgeSeconds": age(_last_bus_update),
    }


def clear():
    """Testler için."""
    global _bus_data, _last_traffic_update, _last_bus_update
    _traffic_features.clear()
    _bus_data = []
    _last_traffic_update = _last_bus_update = None
