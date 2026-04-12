_traffic_data = {"type": "FeatureCollection", "features": []}
_bus_data = []


def get_traffic_data():
    return _traffic_data


def get_bus_data():
    return _bus_data


def update_traffic(data):
    global _traffic_data
    _traffic_data = data


def update_buses(data):
    global _bus_data
    _bus_data = data
