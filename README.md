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

### Tamamı Docker ile

```bash
cp backend/.env.example backend/.env   # TOMTOM_API_KEY'i doldur
docker compose up --build
# Frontend: http://localhost:5173 · API: http://localhost:8000/docs
```

### Testler

```bash
cd backend && python -m pytest -q      # 21 test
cd frontend && npm run lint && npm run build
```

## API Endpoint'leri

| Endpoint | Açıklama |
|---|---|
| `GET /api/v1/traffic/live` | Anlık trafik noktaları (GeoJSON) |
| `GET /api/v1/buses/live` | EGO otobüs konumları |
| `GET /api/v1/traffic/history?hour=N` | Son 7 günde o saatin verisi (Ankara saati) |
| `GET /api/v1/traffic/weekly` | Son 7 günün nokta bazlı ortalaması |
| `GET /api/v1/traffic/predict?hours=N` | Önümüzdeki N saat tahmini (Ridge / heuristic) |
| `GET /api/v1/metro/routes` · `/metro/stations` | M1, M2, M3, Ankaray GeoJSON |
| `GET /api/v1/traffic/districts` | Bölge bazında yoğunluk % |
| `GET /api/v1/health` | Servis, DB, TomTom anahtarı, cache yaşı, WS istemci sayısı |
| `WS  /ws/traffic` | Anlık push (WebSocket, `ping` → `pong`) |
| `GET /docs` | Swagger UI |

## Arayüz Kontrolleri

| Kontrol | Açıklama |
|---|---|
| Nokta / Isı Haritası | Katman seçimi |
| Canlı / Geçmiş | Veri modu — geçmişte TimeSlider açılır |
| Bölgeler | Sağ panel aç/kapat |
| Haftalık | Son 7 günün ortalama yoğunluğu |
| Metro / Tahmin | Metro hatları ve 4 saatlik tahmin paneli |
| ● WS / ● REST | Bağlantı durumu — WS koparsa REST'e düşer ve otomatik yeniden bağlanır |

## TomTom API Key

1. [developer.tomtom.com](https://developer.tomtom.com) — kredi kartı gerekmez
2. Ücretsiz hesap → Dashboard → API Keys
3. `backend/.env` → `TOMTOM_API_KEY=...`

**Günlük limit:** 2.500 istek. Her turda 4 nokta sorgulanır; varsayılan `TRAFFIC_REFRESH_SECONDS=180`
ile günde 480 tur × 4 = **1.920 istek** (limitin altında). 8 grubun tam turu 24 dakika sürer.

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

### Faz 3 — Kısmen tamamlandı
- [x] Metro/Ankaray güzergah katmanı
- [x] Haftalık ısı haritası
- [x] ML trafik tahmini (Ridge regresyon + Ankara heuristic fallback)
- [x] Animasyonlu otobüs hareketi
- [ ] EGO gerçek endpoint entegrasyonu
- [ ] Deployment: Vercel + Railway

### Bakım / Sağlamlaştırma
- [x] TomTom kotası: yenileme 60 sn → 180 sn (5.760 → 1.920 istek/gün)
- [x] Saat dilimi: tahmin ve geçmiş sorgusu Ankara yerel saatine göre
- [x] `.env` artık `DATABASE_URL` okunmadan önce yükleniyor
- [x] Bayat trafik noktaları 45 dk sonra cache'den düşülüyor
- [x] Tahmin modeli 15 dk önbellekleniyor (her istekte yeniden eğitim yok)
- [x] WebSocket: otomatik yeniden bağlanma, heartbeat, eşzamanlı yayın
- [x] Backend/frontend Dockerfile + nginx; compose içinde DB host düzeltmesi
- [x] Frontend build düzeltmesi (`vite-env.d.ts`), `greenlet` bağımlılığı
