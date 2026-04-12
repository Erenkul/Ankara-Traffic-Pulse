import httpx
import os


async def fetch_ego_buses():
    base = os.getenv("EGO_API_BASE", "")
    if not base:
        return _mock_buses()
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{base}/araclar", timeout=10)
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        print(f"EGO hata: {e}")
    return _mock_buses()


def _mock_buses():
    return [
        {"hatNo": "135", "enlem": 39.9334, "boylam": 32.8597, "hiz": 35},
        {"hatNo": "Ç1",  "enlem": 39.9010, "boylam": 32.8650, "hiz": 28},
        {"hatNo": "487", "enlem": 39.9490, "boylam": 32.8580, "hiz": 42},
    ]
