# Ankara Traffic Pulse

Ankara'nın anlık trafik yoğunluğunu ve EGO otobüs konumlarını gösteren web uygulaması.

## Teknolojiler

- **Frontend:** React + Vite, Deck.gl, MapLibre GL, Tailwind CSS v4
- **Backend:** Python FastAPI + APScheduler
- **Veri:** TomTom Traffic Flow API + EGO Cepte (gayri resmi)
- **Harita:** CARTO dark tiles (token gerekmez)

## Kurulum

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env
# .env içine TomTom API key'ini yaz

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Tarayıcı: http://localhost:5173
```

## API Endpoint'leri

| Endpoint | Açıklama |
|---|---|
| `GET /api/v1/traffic/live` | Anlık trafik yoğunluk noktaları (GeoJSON) |
| `GET /api/v1/buses/live` | EGO otobüs konumları |
| `GET /api/v1/health` | Servis sağlık durumu |

## TomTom API Key Alma

1. [developer.tomtom.com](https://developer.tomtom.com) adresine git (kredi kartı gerekmez)
2. Ücretsiz hesap oluştur
3. Key'i `backend/.env` → `TOMTOM_API_KEY=...` satırına yaz

**Günlük limit:** 2.500 istek → 8 noktalı sorgulama ile ~200 istek/gün

## EGO Bus API

EGO endpoint'i gayri resmi olup değişebilir. Tespit yöntemleri:
- Chrome DevTools → `m.ego.gov.tr/otobusnerede` → Network → XHR
- mitmproxy + Android emülatör + EGO Cepte uygulaması

## Faz 2 Yol Haritası

- [ ] PostgreSQL + PostGIS — geçmiş trafik verisi
- [ ] Time Slider — saate göre geçmiş oynatma
- [ ] Haftalık ısı haritası (Deck.gl HeatmapLayer)
- [ ] Bölge yoğunluk sidebar (Çankaya, Yenimahalle, Kızılay %)
- [ ] WebSocket ile push model
- [ ] Deployment: Vercel (frontend) + Railway (backend)
