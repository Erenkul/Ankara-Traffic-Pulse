import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from services.ego import fetch_ego_buses, _mock_buses


def _make_response(data):
    r = MagicMock()
    r.status_code = 200
    r.json = MagicMock(return_value=data)
    return r


@pytest.mark.asyncio
async def test_returns_mock_when_no_env(monkeypatch):
    monkeypatch.setenv("EGO_API_BASE", "")
    result = await fetch_ego_buses()
    assert isinstance(result, list)
    assert len(result) > 0
    assert "hatNo" in result[0]
    assert "enlem" in result[0]
    assert "boylam" in result[0]


@pytest.mark.asyncio
async def test_returns_mock_on_api_error(monkeypatch):
    monkeypatch.setenv("EGO_API_BASE", "https://servis.ego.gov.tr")
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("bağlantı hatası")
        result = await fetch_ego_buses()
        assert {b["hatNo"] for b in result} == {b["hatNo"] for b in _mock_buses()}
        import services.ego as ego
        assert ego.last_source == "demo"


@pytest.mark.asyncio
async def test_returns_real_data_when_api_ok(monkeypatch):
    monkeypatch.setenv("EGO_API_BASE", "https://servis.ego.gov.tr")
    fake_buses = [{"hatNo": "999", "enlem": 39.93, "boylam": 32.85, "hiz": 30}]
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = _make_response(fake_buses)
        result = await fetch_ego_buses()
        assert result == [{**fake_buses[0], "yon": None}]
        import services.ego as ego
        assert ego.last_source == "ego"
