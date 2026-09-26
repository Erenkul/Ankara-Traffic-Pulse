"""Açık veri ayrıştırma ve kaynak önceliği testleri — ağ erişimi gerektirmez."""
import io
import json

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from openpyxl import Workbook

from services import opendata


def _xlsx(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_xlsx_bike_stations_with_title_row_and_turkish_headers():
    content = _xlsx([
        ["Bisiklet İstasyon Verileri"],             # başlık satırı — atlanmalı
        ["İSTASYON ADI", "İLÇE", "ENLEM", "BOYLAM", "KAPASİTE"],
        ["ODTÜ", "Çankaya", 39.8917, 32.7836, 20],
        ["Bozuk", "Çankaya", None, None, 5],
    ])
    features = opendata.parse_resource(content, "xlsx", "point")
    assert len(features) == 1
    assert features[0]["geometry"]["coordinates"] == [32.7836, 39.8917]
    assert features[0]["properties"] == {"name": "ODTÜ", "district": "Çankaya", "capacity": 20, "major": True}


def test_xlsx_bike_paths_from_wkt_in_web_mercator():
    content = _xlsx([
        ["GÜZERGAH ADI", "UZUNLUK", "GEOMETRI"],
        ["Kampüsler yolu", 1250, "LINESTRING (3657300 4854800, 3658300 4855300)"],
    ])
    features = opendata.parse_resource(content, "xlsx", "line")
    assert len(features) == 1
    path = features[0]["geometry"]["coordinates"][0]
    assert abs(path[0][0] - 32.854) < 0.001 and abs(path[0][1] - 39.923) < 0.001
    assert features[0]["properties"] == {"name": "Kampüsler yolu", "length": 1250.0}


def test_points_grouped_into_lines_when_no_wkt():
    rows = [{"YOL ADI": "A", "ENLEM": 39.90, "BOYLAM": 32.80},
            {"YOL ADI": "A", "ENLEM": 39.91, "BOYLAM": 32.81},
            {"YOL ADI": "B", "ENLEM": 39.92, "BOYLAM": 32.82}]
    features = opendata.rows_to_features(rows, "line")
    assert len(features) == 1 and features[0]["properties"]["name"] == "A"


def test_tm33_coordinates_are_converted():
    lat, lng = opendata.to_wgs84(487530, 4419500)
    assert 39.85 < lat < 39.95 and 32.83 < lng < 32.88


def test_csv_parking_occupancy_and_decimal_commas():
    csv_bytes = ("OTOPARK ADI;ENLEM;BOYLAM;KAPASİTE;DOLU\n"
                 "Ulus;39,9420;32,8560;850;700\n").encode()
    f = opendata.parse_resource(csv_bytes, "csv", "point")[0]
    assert f["properties"] == {"name": "Ulus", "capacity": 850, "free": 150, "major": True}


def test_osm_elements_to_features():
    data = {"elements": [
        {"type": "way", "center": {"lat": 39.93, "lon": 32.85},
         "tags": {"amenity": "parking", "parking": "multi-storey", "name": "Kızılay Katlı", "capacity": "400"}},
        {"type": "node", "lat": 39.9, "lon": 32.8, "tags": {"amenity": "bicycle_parking"}},
    ]}
    pts = opendata.osm_features(data, "point")
    assert pts[0]["properties"] == {"name": "Kızılay Katlı", "capacity": 400, "kind": "multi-storey", "major": True}
    assert pts[1]["properties"] == {"kind": "bicycle_parking", "major": False}


@pytest.mark.asyncio
async def test_local_file_has_priority(tmp_path, monkeypatch):
    (tmp_path / "Bisiklet İstasyon Verileri.xlsx").write_bytes(
        _xlsx([["ADI", "ENLEM", "BOYLAM"], ["Kızılay", 39.92, 32.85]]))
    monkeypatch.setattr(opendata, "DATA_DIR", tmp_path)
    with patch("services.opendata.overpass_query", new_callable=AsyncMock) as osm, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as get:
        fc = await opendata.refresh_layer("bikestations")
    osm.assert_not_called()
    get.assert_not_called()
    assert fc["source"]["provider"] == "file"
    assert fc["features"][0]["properties"]["name"] == "Kızılay"


@pytest.mark.asyncio
async def test_ulasav_then_osm_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(opendata, "DATA_DIR", tmp_path)
    monkeypatch.delenv("BIKE_RESOURCE_URL", raising=False)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as get, \
         patch("services.opendata.overpass_query", new_callable=AsyncMock) as osm:
        get.side_effect = Exception("503")
        osm.return_value = {"elements": [{"type": "way", "tags": {"highway": "cycleway"},
                                          "geometry": [{"lat": 39.9, "lon": 32.8}, {"lat": 39.91, "lon": 32.81}]}]}
        fc = await opendata.refresh_layer("bike")
    assert fc["source"]["provider"] == "osm"
    assert fc["features"][0]["geometry"]["type"] == "LineString"


@pytest.mark.asyncio
async def test_ulasav_package_show(tmp_path, monkeypatch):
    monkeypatch.setattr(opendata, "DATA_DIR", tmp_path)
    monkeypatch.delenv("CABLECAR_RESOURCE_URL", raising=False)
    pkg = {"result": {"title": "Teleferik Durak Verileri", "resources": [
        {"format": "XLSX", "url": "https://x/teleferik.xlsx"}]}}
    xlsx = _xlsx([["DURAK ADI", "ENLEM", "BOYLAM"], ["Yenimahalle", 39.968, 32.81]])

    async def fake_get(self, url, **kw):
        r = MagicMock()
        r.raise_for_status = MagicMock()
        r.json = MagicMock(return_value=pkg)
        r.content = xlsx
        return r

    with patch("httpx.AsyncClient.get", new=fake_get):
        fc = await opendata.refresh_layer("cablecar")
    assert fc["source"]["provider"] == "ulasav"
    assert fc["source"]["page"].endswith("06-teleferik-durak-verileri")
    assert fc["features"][0]["properties"]["name"] == "Yenimahalle"


def test_opendata_endpoint():
    from main import app
    client = TestClient(app)
    assert client.get("/api/v1/opendata/bikestations").json()["type"] == "FeatureCollection"
    assert client.get("/api/v1/opendata/nope").status_code == 404
    meta = client.get("/api/v1/meta").json()
    assert set(meta["openData"]) == {"parking", "bikestations", "bike", "cablecar"}
