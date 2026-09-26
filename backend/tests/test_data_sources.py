"""Metro, demo verisi, saklama süresi ve /meta testleri."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from services import metro
from services.demo import demo_traffic, demo_buses
from services.history import purge_old_snapshots


def test_static_metro_has_correct_lines():
    routes = metro.get_metro_routes()
    ids = {f["properties"]["id"] for f in routes["features"]}
    assert ids == {"M1", "M2", "M3", "M4", "A1"}
    names = {f["properties"]["id"]: f["properties"]["name"] for f in routes["features"]}
    assert "Koru" in names["M2"]
    assert "Şehitler" in names["M4"]


def test_static_stations_know_their_lines():
    stations = {f["properties"]["name"]: f for f in metro.get_metro_stations()["features"]}
    assert set(stations["Kızılay"]["properties"]["lines"]) == {"M1", "M2", "M4", "A1"}
    assert stations["AKM"]["properties"]["lines"] == ["M1", "M4"]


def _way(coords):
    return {"type": "way", "role": "", "geometry": [{"lat": la, "lon": lo} for lo, la in coords]}


def test_parse_overpass_keeps_longest_relation_per_line():
    rel = lambda ref, n: {"type": "relation", "tags": {"ref": ref},
                          "members": [_way([(32.85 + i * 0.001, 39.92) for i in range(n)])]}
    data = {"elements": [
        rel("M1", 3), rel("M1", 10), rel("M2", 4), rel("Ankaray", 5), rel("X9", 5),
        {"type": "node", "lat": 39.92, "lon": 32.851, "tags": {"name": "Kızılay"}},
        {"type": "node", "lat": 40.5, "lon": 33.5, "tags": {"name": "Uzak"}},
    ]}
    routes, stations = metro.parse_overpass(data)
    by_id = {f["properties"]["id"]: f for f in routes["features"]}
    assert set(by_id) == {"M1", "M2", "A1"}
    assert len(by_id["M1"]["geometry"]["coordinates"][0]) == 10
    assert [s["properties"]["name"] for s in stations["features"]] == ["Kızılay"]
    assert routes["source"] == "osm"


def test_parse_overpass_rejects_sparse_response():
    assert metro.parse_overpass({"elements": []}) is None


def test_demo_traffic_covers_all_points_and_follows_rush_hour():
    rush = demo_traffic(datetime(2026, 9, 23, 5, 0, tzinfo=timezone.utc))   # Çarşamba 08:00
    night = demo_traffic(datetime(2026, 9, 23, 0, 0, tzinfo=timezone.utc))  # 03:00
    assert len(rush["features"]) == 32
    avg = lambda fc: sum(f["properties"]["congestionRatio"] for f in fc["features"]) / 32
    assert avg(rush) < avg(night)  # sabah zirvesinde oran (hız/serbest hız) daha düşük


def test_demo_buses_move_over_time():
    a = demo_buses(datetime(2026, 9, 23, 5, 0, tzinfo=timezone.utc))
    b = demo_buses(datetime(2026, 9, 23, 5, 5, tzinfo=timezone.utc))
    assert len(a) == 8
    assert any((x["enlem"], x["boylam"]) != (y["enlem"], y["boylam"]) for x, y in zip(a, b))


@pytest.mark.asyncio
async def test_purge_without_db_is_noop():
    assert await purge_old_snapshots(30) == 0


def test_meta_endpoint():
    from main import app
    r = TestClient(app).get("/api/v1/meta")
    assert r.status_code == 200
    assert set(r.json()["sources"]) == {"traffic", "buses", "metro"}
