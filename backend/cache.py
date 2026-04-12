_traffic_features: dict[tuple, dict] = {}  # (lng, lat) -> feature
_bus_data = []


def get_traffic_data():
    return {"type": "FeatureCollection", "features": list(_traffic_features.values())}


def get_bus_data():
    return _bus_data


def update_traffic(data):
    """Merge new features into the accumulated map (keyed by coordinate)."""
    for feature in data.get("features", []):
        coords = feature["geometry"]["coordinates"]
        key = (round(coords[0], 5), round(coords[1], 5))
        _traffic_features[key] = feature


def update_buses(data):
    global _bus_data
    _bus_data = data
