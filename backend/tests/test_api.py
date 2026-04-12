import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_traffic_live_returns_geojson():
    r = client.get("/api/v1/traffic/live")
    assert r.status_code == 200
    data = r.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)


def test_buses_live_returns_list():
    r = client.get("/api/v1/buses/live")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_cors_header():
    r = client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173"}
    )
    assert "access-control-allow-origin" in r.headers


def test_unknown_route_returns_404():
    r = client.get("/api/v999/nonexistent")
    assert r.status_code == 404
