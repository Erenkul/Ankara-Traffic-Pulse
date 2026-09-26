"""cache, districts, predict ve WebSocket birim testleri."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import cache
from districts import classify_district, district_stats_from_features
from services import predict


def _feature(lng, lat, ratio=0.5):
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {"currentSpeed": 40, "freeFlowSpeed": 80, "congestionRatio": ratio, "closed": False},
    }


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def test_cache_merges_by_coordinate():
    cache.update_traffic({"features": [_feature(32.85, 39.93, 0.4)]})
    cache.update_traffic({"features": [_feature(32.85, 39.93, 0.9), _feature(32.80, 39.95)]})
    features = cache.get_traffic_data()["features"]
    assert len(features) == 2
    assert {f["properties"]["congestionRatio"] for f in features} == {0.9, 0.5}


def test_cache_drops_stale_points(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(cache.time, "monotonic", lambda: now[0])
    cache.update_traffic({"features": [_feature(32.85, 39.93)]})
    now[0] += cache.TRAFFIC_STALE_SECONDS + 1
    assert cache.get_traffic_data()["features"] == []


def test_classify_district_box_and_fallback():
    assert classify_district(39.9334, 32.8597) == "Kızılay"
    # Kutuların dışında → en yakın merkez
    assert classify_district(40.10, 32.95) == "Esenboğa Yolu"


def test_district_stats():
    stats = district_stats_from_features([_feature(32.8597, 39.9334, 0.4), _feature(32.8597, 39.9334, 0.6)])
    assert stats == [{"district": "Kızılay", "avgCongestionRatio": 0.5, "congestionPct": 50.0, "sampleCount": 2}]


@pytest.mark.asyncio
async def test_prediction_uses_ankara_local_time():
    predict._model_cache["trained_at"] = None
    # 04:00 UTC Çarşamba = 07:00 Ankara → +1 saat = 08:00 (sabah zirvesi)
    now = datetime(2026, 9, 23, 4, 0, tzinfo=timezone.utc)
    result = await predict.get_traffic_prediction(hours_ahead=1, now=now)
    assert result[0]["hour"] == 8
    assert result[0]["predictedCongestion"] == predict._HOURLY_BASE[8]
    assert result[0]["confidence"] == "heuristic"
    assert result[0]["timestamp"].endswith("+03:00")


@pytest.mark.asyncio
async def test_prediction_weekend_factor():
    predict._model_cache["trained_at"] = None
    now = datetime(2026, 9, 26, 5, 0, tzinfo=timezone.utc)  # Cumartesi 08:00 Ankara
    result = await predict.get_traffic_prediction(hours_ahead=1, now=now)
    assert result[0]["predictedCongestion"] == round(predict._HOURLY_BASE[9] * predict._WEEKEND_FACTOR, 3)


def test_websocket_snapshot_and_ping():
    from main import app
    cache.update_buses([{"hatNo": "135", "enlem": 39.93, "boylam": 32.85, "hiz": 30}])
    client = TestClient(app)
    with client.websocket_connect("/ws/traffic") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "snapshot"
        assert msg["buses"][0]["hatNo"] == "135"
        ws.send_text("ping")
        assert ws.receive_json() == {"type": "pong"}
