# Ankara Traffic Pulse — Tam Proje Dokümantasyonu

## 1. Proje Genel Bakış

Ankara Traffic Pulse, Ankara'nın anlık trafik akışını ve EGO belediye otobüslerinin gerçek zamanlı konumlarını estetik bir dijital ikiz üzerinde sunan web uygulamasıdır. Proje tamamen ücretsiz ve açık kaynak araçlarla inşa edilmiştir — hiçbir API token'ı ücret gerektirmez (TomTom hariç, o da ücretsiz katman).

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend Framework | React 18 + Vite 6 + TypeScript |
| Harita | MapLibre GL JS — ücretsiz, token yok |
| Görselleştirme | Deck.gl v9 — ScatterplotLayer + HeatmapLayer |
| Stil | Tailwind CSS v4 |
| Backend | Python FastAPI + uvicorn |
| Zamanlayıcı | APScheduler — 60s trafik, 30s otobüs |
| HTTP | httpx async |
| Veritabanı | PostgreSQL + SQLAlchemy 2.0 async (opsiyonel) |
| Gerçek Zamanlı | WebSocket push + REST polling fallback |
| Trafik API | TomTom Traffic Flow API — 2.500 req/gün ücretsiz |
| Otobüs API | EGO Cepte gayri resmi endpoint (mock fallback) |
| Harita Tile | CARTO Dark Matter — ücretsiz, token yok |

---

## 3. Klasör Yapısı

```
ankara-traffic-pulse/
├── DOCUMENTATION.md
├── README.md
├── project.md
├── docker-compose.yml
├── .gitignore
├── backend/
│   ├── main.py              ← FastAPI, lifespan, tüm endpoint'ler + WS
│   ├── scheduler.py         ← APScheduler + DB kayıt + WS broadcast
│   ├── cache.py             ← In-memory anlık veri
│   ├── database.py          ← SQLAlchemy async engine, DB_AVAILABLE flag
│   ├── db_models.py         ← TrafficSnapshot ORM
│   ├── districts.py         ← Bölge sınıflandırma (bounding box)
│   ├── ws_manager.py        ← WebSocket ConnectionManager
│   ├── models.py            ← Pydantic response modelleri
│   ├── Procfile             ← Railway: web: uvicorn main:app ...
│   ├── services/
│   │   ├── tomtom.py        ← TomTom API (4'erli grup rotasyonu)
│   │   ├── ego.py           ← EGO otobüs (mock fallback)
│   │   └── history.py       ← DB kayıt, geçmiş sorgu, bölge istatistik
│   ├── tests/
│   │   ├── test_tomtom.py
│   │   ├── test_ego.py
│   │   └── test_api.py
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── tsconfig.node.json
    ├── package.json
    ├── eslint.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── constants.ts
        ├── hooks/
        │   ├── useTrafficData.ts
        │   ├── useWebSocket.ts
        │   └── useHistoricalData.ts
        └── components/
            ├── TrafficMap.tsx
            ├── DistrictSidebar.tsx
            ├── TimeSlider.tsx
            └── BusLayer.tsx
```

---

## 4. API Rehberi

### 4.1. TomTom Traffic Flow API

**Hesap açma:**
1. [developer.tomtom.com](https://developer.tomtom.com) — kredi kartı gerekmez
2. "Get Started for Free" → Dashboard → API Keys
3. `backend/.env` → `TOMTOM_API_KEY=...`

**Endpoint:**
```
GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
    ?point={LAT},{LNG}&unit=KMPH&openLr=false&key={API_KEY}
```

**Ankara koordinatları (8 nokta, 2 grup):**
```
Grup A: Kızılay, Atatürk Blv. Kuzey, Çankaya, Ulus
Grup B: Yenimahalle, Eskişehir Yolu, Esenboğa Yolu, Konya Yolu
```
Her 60 saniyede bir grup sorgulanır → ~720 req/gün (limit: 2.500).

**Yanıt:**
```json
{
  "flowSegmentData": {
    "currentSpeed": 42,
    "freeFlowSpeed": 80,
    "confidence": 0.93,
    "roadClosure": false
  }
}
```

**Yoğunluk:** `congestionRatio = currentSpeed / freeFlowSpeed`

| Değer | Renk | Anlam |
|---|---|---|
| ≥ 0.80 | Yeşil | Serbest |
| 0.50–0.79 | Sarı | Yavaş |
| < 0.50 | Kırmızı | Tıkanık |

---

### 4.2. EGO Cepte Otobüs API

EGO'nun resmi API'sı yoktur. Endpoint gayri resmidir.

**Yöntem A — mitmproxy:**
```bash
pip install mitmproxy
mitmweb --listen-port 8080
```
Android emülatör proxy'sini `127.0.0.1:8080` yap → EGO Cepte uygulamasını aç → mitmweb'de JSON yanıtlı isteği bul.

**Yöntem B — Chrome DevTools:**
`m.ego.gov.tr/otobusnerede` → F12 → Network → XHR

**Beklenen format:**
```json
{ "HatNo": "135", "Araclar": [{ "Enlem": 39.93, "Boylam": 32.86 }] }
```

> `EGO_API_BASE` boşsa veya API hata verirse `_mock_buses()` devreye girer.

---

## 5. Backend API Endpoint'leri

| Method | Endpoint | Açıklama | Güncelleme |
|---|---|---|---|
| GET | `/api/v1/traffic/live` | Anlık trafik (GeoJSON) | 60s cache |
| GET | `/api/v1/buses/live` | EGO otobüs konumları | 30s cache |
| GET | `/api/v1/traffic/history?hour=N` | Son 7 gün, saat N verisi | PostgreSQL |
| GET | `/api/v1/traffic/districts` | Bölge yoğunluk % | DB / anlık fallback |
| GET | `/api/v1/health` | `{"status":"ok","db":bool}` | — |
| WS | `/ws/traffic` | Anlık push (traffic + buses) | Scheduler broadcast |
| GET | `/docs` | Swagger UI | — |

---

## 6. WebSocket Protokolü

```json
// Bağlantı kurulduğunda (type: snapshot)
{ "type": "snapshot", "traffic": {...GeoJSON...}, "buses": [...], "timestamp": "..." }

// Her 60s trafik güncelleme
{ "type": "traffic", "traffic": {...GeoJSON...}, "timestamp": "..." }

// Her 30s otobüs güncelleme
{ "type": "buses", "buses": [...], "timestamp": "..." }
```

Frontend WS bağlanamazsa (`onerror` / `onclose`) otomatik olarak REST polling'e geçer.

---

## 7. Başlatma

### Sadece Backend + Frontend (DB olmadan)
```bash
# Terminal 1
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # TOMTOM_API_KEY'i yaz
uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend
npm install
npm run dev
```

### PostgreSQL ile (geçmiş veri aktif)
```bash
docker compose up postgres -d
# backend/.env içindeki DATABASE_URL satırını aktif et
# uvicorn otomatik yeniden başlar
```

### Tüm servisler Docker ile
```bash
docker compose up --build
```

---

## 8. Test

```bash
cd backend
pytest tests/ -v
# 12/12 PASSED
```

| Test Dosyası | Kapsam |
|---|---|
| `test_api.py` | health (db field), GeoJSON format, CORS, 404 |
| `test_ego.py` | mock fallback, API hatası, gerçek veri |
| `test_tomtom.py` | GeoJSON dönüşü, tıkanık ratio, hata toleransı, grup rotasyonu |

---

## 9. Deployment

### Railway (Backend + PostgreSQL)
1. Yeni proje → GitHub repo bağla
2. `backend/` klasörünü root olarak ayarla
3. PostgreSQL addon ekle → `DATABASE_URL` otomatik inject edilir
4. `Procfile` mevcut: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`

### Vercel (Frontend)
1. `frontend/` klasörünü root olarak ayarla
2. Build: `npm run build`, Output: `dist`
3. Env vars:
   ```
   VITE_API_BASE=https://your-app.railway.app
   VITE_WS_BASE=wss://your-app.railway.app
   ```

---

## 10. Kota Özeti

| Servis | Limit | Günlük Kullanım | Durum |
|---|---|---|---|
| MapLibre GL JS | Sınırsız | — | Ücretsiz |
| CARTO Tiles | Sınırsız | — | Ücretsiz |
| TomTom Traffic | 2.500 req/gün | ~720 req | Güvenli |
| EGO Cepte | Belirsiz | ~2.880 req | Dikkatli |
| PostgreSQL | — | Yerel / Railway | Opsiyonel |

---

## 11. Faz Durumu

### Faz 1 — Tamamlandı
- [x] TomTom anlık trafik noktaları (8 lokasyon, grup rotasyonu)
- [x] EGO otobüs konum katmanı (mock fallback)
- [x] CARTO dark harita, tooltip
- [x] Otomatik yenileme (60s / 30s)
- [x] Yoğunluk renk kodlaması (yeşil / sarı / kırmızı)
- [x] 12 backend unit testi

### Faz 2 — Tamamlandı
- [x] PostgreSQL + SQLAlchemy async (graceful degradation)
- [x] `TrafficSnapshot` tablosu — her güncelleme kaydedilir
- [x] `GET /api/v1/traffic/history?hour=N` — son 7 gün
- [x] `GET /api/v1/traffic/districts` — 7 bölge istatistik
- [x] Time Slider — 00:00–23:00 saat seçici
- [x] HeatmapLayer toggle (Nokta / Isı Haritası)
- [x] DistrictSidebar — progress bar, 60s auto-refresh
- [x] WebSocket push + REST polling fallback
- [x] Docker Compose (postgres servisi)
- [x] Procfile (Railway)

### Faz 3 — Planlanan
- [ ] Metro/Ankaray güzergah katmanı (statik GeoJSON)
- [ ] EGO gerçek endpoint entegrasyonu
- [ ] Deployment: Vercel + Railway
- [ ] Haftalık yoğunluk heat map (son 7 gün agregasyonu)
