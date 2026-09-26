# Ankara Traffic Pulse — Proje Dokümanı

## Genel Bakış

Ankara'nın anlık trafik akışını ve EGO belediye otobüslerinin gerçek zamanlı konumlarını harita üzerinde sunan full-stack web uygulaması.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend Framework | React 18 + Vite 6 + TypeScript |
| Harita Motoru | MapLibre GL (react-map-gl) |
| Veri Görselleştirme | Deck.gl v9 — ScatterplotLayer + HeatmapLayer |
| Stil | Tailwind CSS v4 |
| Backend Framework | Python FastAPI + uvicorn |
| Zamanlayıcı | APScheduler (trafik 60s, otobüs 30s) |
| HTTP İstemcisi | httpx async |
| Veritabanı | PostgreSQL + SQLAlchemy async (opsiyonel) |
| Gerçek Zamanlı | WebSocket (fallback: REST polling) |
| Trafik Verisi | TomTom Traffic Flow API v4 |
| Otobüs Verisi | EGO Cepte gayri resmi endpoint |
| Harita Tile | CARTO Dark (token gerekmez, ücretsiz) |

## Klasör Yapısı

```
ankara-traffic-pulse/
├── DOCUMENTATION.md
├── README.md
├── project.md
├── docker-compose.yml       ← backend + frontend + postgres
├── .gitignore
├── backend/
│   ├── settings.py          ← .env yükleme, ANKARA_TZ, yenileme aralıkları
│   ├── main.py              ← FastAPI, CORS, lifespan, tüm endpoint'ler
│   ├── scheduler.py         ← APScheduler + DB kayıt + WS broadcast
│   ├── cache.py             ← In-memory anlık veri deposu
│   ├── database.py          ← SQLAlchemy async engine, DB_AVAILABLE flag
│   ├── db_models.py         ← TrafficSnapshot ORM tablosu
│   ├── districts.py         ← Bölge sınıflandırma (bounding box)
│   ├── ws_manager.py        ← WebSocket connection manager
│   ├── models.py            ← Pydantic response modelleri
│   ├── Procfile             ← Railway deployment
│   ├── Dockerfile
│   ├── services/
│   │   ├── tomtom.py        ← TomTom API (4'erli grup rotasyonu)
│   │   ├── ego.py           ← EGO otobüs (mock fallback)
│   │   ├── history.py       ← DB kayıt + geçmiş sorgu + bölge stats
│   │   ├── metro.py         ← Statik metro/Ankaray GeoJSON
│   │   └── predict.py       ← Ridge regresyon tahmini + heuristic
│   ├── tests/
│   │   ├── test_tomtom.py   ← 4 unit test
│   │   ├── test_ego.py      ← 3 unit test
│   │   ├── test_api.py      ← 5 endpoint testi
│   │   └── test_core.py     ← cache, bölge, tahmin, WS testleri
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
    ├── package.json
    ├── eslint.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── constants.ts     ← API_BASE, WS_URL, ANKARA_CENTER, CARTO_STYLE
        ├── types.ts         ← TrafficPoint, BusPoint + GeoJSON dönüştürücüler
        ├── hooks/
        │   ├── useWebSocket.ts      ← WS + yeniden bağlanma + REST fallback
        │   ├── useHistoricalData.ts ← Saate göre geçmiş veri
        │   ├── useWeeklyHeatmap.ts  ← Haftalık ortalama
        │   ├── useMetroData.ts      ← Metro hatları
        │   └── usePrediction.ts     ← Tahmin (5 dk'da bir)
        └── components/
            ├── TrafficMap.tsx       ← Ana harita, tüm kontroller
            ├── DistrictSidebar.tsx  ← Bölge yoğunluk paneli (Faz 2)
            ├── TimeSlider.tsx       ← Saat seçici (Faz 2)
            └── PredictionPanel.tsx  ← Tahmin paneli (Faz 3)
```

## API Endpoint'leri

| Method | Endpoint | Açıklama | Kaynak |
|---|---|---|---|
| GET | `/api/v1/traffic/live` | Anlık trafik (GeoJSON) | TomTom, 60s cache |
| GET | `/api/v1/buses/live` | EGO otobüs konumları | EGO / mock, 30s cache |
| GET | `/api/v1/traffic/history?hour=N` | Son 7 gün, saat N'e ait veriler | PostgreSQL |
| GET | `/api/v1/traffic/districts` | Bölge yoğunluk istatistikleri | DB / anlık fallback |
| GET | `/api/v1/health` | Servis + DB durum | — |
| WS | `/ws/traffic` | Anlık trafik + otobüs push | APScheduler broadcast |
| GET | `/docs` | Swagger UI | — |

## İzlenen Ankara Noktaları (TomTom)

8 nokta 2 gruba bölünür, her 60 saniyede bir grup sorgulanır (~720 req/gün).

| Koordinat | Bölge | Grup |
|---|---|---|
| 39.9334, 32.8597 | Kızılay | A |
| 39.9560, 32.8598 | Atatürk Blv. Kuzey | A |
| 39.9010, 32.8650 | Çankaya | A |
| 39.9490, 32.8580 | Ulus | A |
| 39.9750, 32.8150 | Yenimahalle | B |
| 39.8700, 32.7500 | Eskişehir Yolu | B |
| 40.0300, 32.9000 | Esenboğa Yolu | B |
| 39.8600, 32.8200 | Konya Yolu | B |

## Renk Kodlaması

| Renk | congestionRatio | Anlam |
|---|---|---|
| Yeşil `[0, 208, 132]` | ≥ 0.80 | Serbest |
| Sarı `[255, 195, 0]` | 0.50 – 0.79 | Yavaş |
| Kırmızı `[255, 77, 77]` | < 0.50 | Tıkanık |
| Mavi `[0, 194, 255]` | — | EGO Otobüs |

> `congestionRatio = currentSpeed / freeFlowSpeed`

## Ortam Değişkenleri

### backend/.env

```env
TOMTOM_API_KEY=buraya_tomtom_anahtarinizi_yazin
EGO_API_BASE=https://servis.ego.gov.tr
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql+asyncpg://traffic:traffic_pass@localhost:5432/ankara_traffic
```

### frontend (production)

```env
VITE_API_BASE=https://your-railway-app.railway.app
VITE_WS_BASE=wss://your-railway-app.railway.app
```

## Geliştirme Ortamı

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### PostgreSQL (opsiyonel)

```bash
docker compose up postgres -d
# backend/.env içinde DATABASE_URL satırının yorumunu kaldır
```

### Tüm servisler (Docker)

```bash
docker compose up --build
```

## Test

```bash
cd backend
pytest tests/ -v
# 12/12 test
```

## Bölge Sınıflandırması

`districts.py` — bounding box önce, en yakın merkez fallback:

| Bölge | Lat aralığı | Lng aralığı |
|---|---|---|
| Kızılay | 39.920 – 39.950 | 32.840 – 32.880 |
| Çankaya | 39.880 – 39.920 | 32.850 – 32.890 |
| Ulus | 39.930 – 39.970 | 32.840 – 32.870 |
| Yenimahalle | 39.960 – 40.000 | 32.780 – 32.860 |
| Eskişehir Yolu | 39.850 – 39.900 | 32.700 – 32.800 |
| Esenboğa Yolu | 40.000 – 40.060 | 32.850 – 32.960 |
| Konya Yolu | 39.830 – 39.880 | 32.760 – 32.850 |

## Kota Özeti

| Servis | Limit | Günlük Kullanım | Durum |
|---|---|---|---|
| MapLibre GL JS | Sınırsız | — | Ücretsiz |
| CARTO Tiles | Sınırsız | — | Ücretsiz |
| TomTom Traffic | 2.500 req/gün | ~720 req | Güvenli |
| EGO Cepte | Belirsiz | ~2.880 req | Dikkatli |
| PostgreSQL | — | Yerel / Railway | Opsiyonel |

## Faz Durumu

### Faz 1 — Tamamlandı
- [x] TomTom anlık trafik noktaları
- [x] EGO otobüs konum katmanı (mock fallback)
- [x] CARTO dark harita
- [x] Otomatik yenileme (60s / 30s)
- [x] Yoğunluk renk kodlaması + tooltip
- [x] 12 backend unit testi

### Faz 2 — Tamamlandı
- [x] PostgreSQL + SQLAlchemy async (graceful degradation)
- [x] Time Slider — saate göre son 7 gün
- [x] HeatmapLayer — ısı haritası modu toggle
- [x] Bölge sidebar — 7 bölge, progress bar, 60s auto-refresh
- [x] WebSocket push + REST polling fallback
- [x] Docker Compose (postgres servisi eklendi)
- [x] Procfile (Railway)

### Faz 3 — Planlanan
- [ ] Metro/Ankaray güzergah katmanı
- [ ] EGO gerçek endpoint entegrasyonu
- [ ] Deployment: Vercel (frontend) + Railway (backend + postgres)

## Bilinen Kısıtlar

- EGO endpoint'i resmi değil; servis güncellemelerinde kırılabilir
- TomTom ücretsiz tier'da günlük 2.500 istek limiti var
- Trafik noktaları nokta verisi döner, tam yol ağı değil
- PostgreSQL olmadan geçmiş/bölge endpoint'leri boş döner
