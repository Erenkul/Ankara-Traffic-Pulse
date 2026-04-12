# Ankara Traffic Pulse

Ankara'nın anlık trafik yoğunluğunu ve EGO otobüs konumlarını gösteren full-stack web uygulaması.

## Teknolojiler

- **Frontend:** React 18 + TypeScript + Vite, Deck.gl v9, MapLibre GL, Tailwind CSS v4
- **Backend:** Python FastAPI + APScheduler + SQLAlchemy async
- **Veritabanı:** PostgreSQL (opsiyonel — olmadan da çalışır)
- **Gerçek Zamanlı:** WebSocket push, REST polling fallback
- **Veri:** TomTom Traffic Flow API + EGO Cepte (gayri resmi)
- **Harita:** CARTO dark tiles (token gerekmez)

## Kurulum

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt

cp .env.example .env
# .env içine TOMTOM_API_KEY değerini yaz

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Tarayıcı: http://localhost:5173
```

### PostgreSQL (opsiyonel — geçmiş veri için)

```bash
docker compose up postgres -d
# backend/.env içine DATABASE_URL satırını ekle
```

## API Endpoint'leri

| Endpoint | Açıklama |
|---|---|
| `GET /api/v1/traffic/live` | Anlık trafik noktaları (GeoJSON) |
| `GET /api/v1/buses/live` | EGO otobüs konumları |
| `GET /api/v1/traffic/history?hour=N` | Son 7 günde o saatin verisi |
| `GET /api/v1/traffic/districts` | Bölge bazında yoğunluk % |
| `GET /api/v1/health` | Servis + DB durum kontrolü |
| `WS  /ws/traffic` | Anlık push (WebSocket) |
| `GET /docs` | Swagger UI |

## Arayüz Kontrolleri

| Kontrol | Açıklama |
|---|---|
| Nokta / Isı Haritası | Katman seçimi |
| Canlı / Geçmiş | Veri modu — geçmişte TimeSlider açılır |
| Bölgeler | Sağ panel aç/kapat |
| ● WS / ● REST | Bağlantı durumu göstergesi |

## TomTom API Key

1. [developer.tomtom.com](https://developer.tomtom.com) — kredi kartı gerekmez
2. Ücretsiz hesap → Dashboard → API Keys
3. `backend/.env` → `TOMTOM_API_KEY=...`

**Günlük limit:** 2.500 istek — 4'erli grup rotasyonu ile ~720 req/gün

## EGO Otobüs API

Endpoint gayri resmi, değişebilir. API tespit edilmezse mock veri devreye girer.

- Chrome DevTools → `m.ego.gov.tr/otobusnerede` → Network → XHR
- mitmproxy + Android emülatör + EGO Cepte uygulaması

## Faz Durumu

### Faz 1 — MVP
- [x] TomTom anlık trafik noktaları (8 lokasyon)
- [x] EGO otobüs konum katmanı (mock fallback)
- [x] CARTO dark harita
- [x] Otomatik yenileme (trafik 60s, otobüs 30s)
- [x] Yoğunluk renk kodlaması + tooltip
- [x] 12 backend unit testi

### Faz 2 — Tamamlandı
- [x] PostgreSQL + SQLAlchemy async (graceful degradation)
- [x] Time Slider — saate göre son 7 gün oynatma
- [x] HeatmapLayer — ısı haritası modu
- [x] Bölge sidebar — 7 bölge için yoğunluk progress bar
- [x] WebSocket push — REST polling fallback ile
- [x] Docker Compose (backend + frontend + postgres)
- [x] Procfile — Railway deployment

### Faz 3 — Planlanan
- [ ] Metro/Ankaray güzergah katmanı
- [ ] EGO gerçek endpoint entegrasyonu
- [ ] Deployment: Vercel + Railway
