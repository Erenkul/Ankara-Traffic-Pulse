import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from services.tomtom import fetch_ankara_traffic


@pytest.fixture(autouse=True)
def _tomtom_key(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", "test-key")


def _make_response(data):
    """httpx response mock: json() senkron, get() asenkron."""
    r = MagicMock()
    r.status_code = 200
    r.json = MagicMock(return_value=data)
    return r


@pytest.mark.asyncio
async def test_fetch_returns_geojson():
    payload = {
        "flowSegmentData": {
            "currentSpeed": 50,
            "freeFlowSpeed": 80,
            "roadClosure": False,
            "confidence": 0.9
        }
    }
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _make_response(payload)
        result = await fetch_ankara_traffic()
        assert result["type"] == "FeatureCollection"
        assert len(result["features"]) > 0
        assert result["features"][0]["properties"]["congestionRatio"] == round(50 / 80, 2)


@pytest.mark.asyncio
async def test_congestion_ratio_heavy_traffic():
    payload = {
        "flowSegmentData": {
            "currentSpeed": 20,
            "freeFlowSpeed": 80,
            "roadClosure": False,
            "confidence": 0.8
        }
    }
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _make_response(payload)
        result = await fetch_ankara_traffic()
        ratio = result["features"][0]["properties"]["congestionRatio"]
        assert ratio < 0.5  # tıkanık olmalı


@pytest.mark.asyncio
async def test_fetch_handles_api_error_gracefully():
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("bağlantı hatası")
        result = await fetch_ankara_traffic()
        assert result["type"] == "FeatureCollection"
        assert result["features"] == []


@pytest.mark.asyncio
async def test_group_rotation():
    """Her çağrıda farklı grup sorgulanmalı."""
    import services.tomtom as tt
    tt._group_index = 0
    payload = {
        "flowSegmentData": {
            "currentSpeed": 60,
            "freeFlowSpeed": 80,
            "roadClosure": False,
            "confidence": 0.95
        }
    }
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _make_response(payload)
        await fetch_ankara_traffic()
        assert tt._group_index == 1
        await fetch_ankara_traffic()
        assert tt._group_index == 2


@pytest.mark.asyncio
async def test_no_api_key_skips_requests(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        result = await fetch_ankara_traffic()
        assert result["features"] == []
        mock_get.assert_not_called()


@pytest.mark.asyncio
async def test_auth_error_stops_group():
    r = MagicMock()
    r.status_code = 403
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = r
        result = await fetch_ankara_traffic()
        assert result["features"] == []
        assert mock_get.call_count == 1
