"""Açık veri ayrıştırma testleri — ağ erişimi gerektirmez."""
import json

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

from services import opendata


def test_csv_with_turkish_headers_and_decimal_commas():
    csv_bytes = (
        "OTOPARK ADI;ENLEM;BOYLAM;KAPASİTE;BOŞ\n"
        "Ulus 100. Yıl;39,9420;32,8560;850;120\n"
        "Bozuk satır;;;10;1\n"
        "Uzak;41,0;29,0;10;5\n"
    ).encode("utf-8")
    features = opendata.parse_resource(csv_bytes, "csv", "point")
    assert len(features) == 1
    f = features[0]
    assert f["geometry"]["coordinates"] == [32.856, 39.942]
    assert f["properties"] == {"name": "Ulus 100. Yıl", "capacity": 850, "free": 120}


def test_json_records_with_swapped_coordinates_and_occupied_count():
    data = {"data": [{"name": "Kızılay", "lat": 32.854, "lng": 39.920, "capacity": 200, "dolu": 150}]}
    features = opendata.parse_resource(json.dumps(data).encode(), "json", "point")
    assert features[0]["geometry"]["coordinates"] == [32.854, 39.920]
    assert features[0]["properties"]["free"] == 50


def test_geojson_lines_filtered_to_ankara():
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"ADI": "ODTÜ yolu"},
         "geometry": {"type": "LineString", "coordinates": [[32.78, 39.89], [32.79, 39.90]]}},
        {"type": "Feature", "properties": {},
         "geometry": {"type": "LineString", "coordinates": [[3650000, 4850000], [3650100, 4850100]]}},
        {"type": "Feature", "properties": {},
         "geometry": {"type": "Point", "coordinates": [32.8, 39.9]}},
    ]}
    features = opendata.parse_resource(json.dumps(fc).encode(), "geojson", "line")
    assert len(features) == 1
    assert features[0]["properties"]["name"] == "ODTÜ yolu"


def _resp(payload=None, content=b"", status=200):
    r = MagicMock()
    r.status_code = status
    r.json = MagicMock(return_value=payload)
    r.content = content
    r.headers = {"content-type": "application/json"}
    r.raise_for_status = MagicMock()
    return r


@pytest.mark.asyncio
async def test_refresh_layer_via_ckan_prefers_geojson(monkeypatch):
    monkeypatch.delenv("PARKING_RESOURCE_URL", raising=False)
    search = {"result": {"results": [{"title": "Otoparklar", "name": "otoparklar", "resources": [
        {"format": "CSV", "url": "https://x/otopark.csv"},
        {"format": "GeoJSON", "url": "https://x/otopark.geojson"},
    ]}]}}
    geo = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"ADI": "Ulus", "KAPASITE": 100},
         "geometry": {"type": "Point", "coordinates": [32.85, 39.94]}}]}
    calls = []

    async def fake_get(self, url, **kw):
        calls.append(url)
        return _resp(search) if "package_search" in url else _resp(content=json.dumps(geo).encode())

    with patch("httpx.AsyncClient.get", new=fake_get):
        fc = await opendata.refresh_layer("parking")
    assert calls[1] == "https://x/otopark.geojson"
    assert fc["features"][0]["properties"] == {"name": "Ulus", "capacity": 100}
    assert fc["source"]["dataset"] == "Otoparklar"
    assert "atıf" in fc["source"]["license"]


@pytest.mark.asyncio
async def test_refresh_layer_survives_network_error(monkeypatch):
    opendata._cache.pop("bike", None)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as g:
        g.side_effect = Exception("engelli")
        fc = await opendata.refresh_layer("bike")
    assert fc["features"] == [] and fc["source"] is None


def test_opendata_endpoint():
    from main import app
    client = TestClient(app)
    assert client.get("/api/v1/opendata/parking").json()["type"] == "FeatureCollection"
    assert client.get("/api/v1/opendata/nope").status_code == 404
    assert set(client.get("/api/v1/meta").json()["openData"]) == {"parking", "bike"}
