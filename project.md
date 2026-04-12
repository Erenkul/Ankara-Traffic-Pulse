# Ankara Traffic Pulse — Proje Dokümanı

## Genel Bakış

Ankara'nın anlık trafik yoğunluğunu ve EGO otobüs konumlarını harita üzerinde gösteren full-stack web uygulaması.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend Framework | React 18 + Vite 6 |
| Harita Motoru | MapLibre GL (react-map-gl) |
| Veri Görselleştirme | Deck.gl v9 (ScatterplotLayer) |
| Stil | Tailwind CSS v4 |
| Backend Framework | Python FastAPI 0.115 |
| Zamanlayıcı | APScheduler 3.10 |
| HTTP İstemcisi | httpx (async) |
| Trafik Verisi | TomTom Traffic Flow API v4 |
| Otobüs Verisi | EGO Cepte (gayri resmi endpoint) |
| Harita Tile | CARTO Dark (token gerekmez, ücretsiz) |

## Klasör Yapısı

```
ankara-traffic-pulse/
├── backend/
│   ├── main.py              ← FastAPI uygulaması, CORS, startup
│   ├── scheduler.py         ← APScheduler (trafik 60s, otobüs 30s)
│   ├── cache.py             ← In-memory veri deposu
│   ├── services/
│   │   ├── tomtom.py        ← TomTom API entegrasyonu (8 nokta)
│   │   └── ego.py           ← EGO otobüs konumları
│   ├── requirements.txt
│   └── .env                 ← GİT'E EKLEME!
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── eslint.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           └── TrafficMap.jsx  ← Ana harita bileşeni
├── .gitignore
├── README.md
└── project.md               ← Bu dosya
```

## API Endpoint'leri

| Method | Endpoint | Açıklama | Güncelleme |
|---|---|---|---|
| GET | `/api/v1/traffic/live` | Trafik yoğunluk noktaları (GeoJSON) | Her 60 saniye |
| GET | `/api/v1/buses/live` | EGO otobüs konumları | Her 30 saniye |
| GET | `/api/v1/health` | Servis sağlık durumu | — |

## İzlenen Ankara Noktaları (TomTom)

| Koordinat | Bölge |
|---|---|
| 39.9334, 32.8597 | Kızılay |
| 39.9560, 32.8598 | Atatürk Blv. Kuzey |
| 39.9010, 32.8650 | Çankaya |
| 39.9490, 32.8580 | Ulus |
| 39.9750, 32.8150 | Yenimahalle |
| 39.8700, 32.7500 | Eskişehir Yolu |
| 40.0300, 32.9000 | Esenboğa Yolu |
| 39.8600, 32.8200 | Konya Yolu |

## Renk Kodlaması (Trafik)

| Renk | congestionRatio | Anlam |
|---|---|---|
| Yeşil `[0, 208, 132]` | ≥ 0.80 | Trafik serbest |
| Sarı `[255, 195, 0]` | 0.50 – 0.79 | Trafik yavaş |
| Kırmızı `[255, 77, 77]` | < 0.50 | Trafik tıkanık |

> `congestionRatio = currentSpeed / freeFlowSpeed`

## Ortam Değişkenleri

### backend/.env

```env
TOMTOM_API_KEY=buraya_tomtom_key
EGO_API_BASE=https://servis.ego.gov.tr
CORS_ORIGIN=http://localhost:5173
```

## Geliştirme Ortamı Kurulumu

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # API key'i düzenle
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

## API Limitleri & Notlar

### TomTom
- Ücretsiz hesap: [developer.tomtom.com](https://developer.tomtom.com) (kredi kartı gerekmez)
- Günlük limit: **2.500 istek**
- 8 nokta × 60 saniyelik poll = ~200 istek/gün → limite takılmaz

### EGO Cepte
- Endpoint gayri resmi, değişebilir
- Tespit yöntemleri:
  - Chrome DevTools → `m.ego.gov.tr/otobusnerede` → Network → XHR
  - mitmproxy + Android emülatör + EGO Cepte uygulaması
- Mevcut endpoint: `GET /HatSefer/GetHatKonum`
- Beklenen alan isimleri: `enlem`, `boylam`, `hatNo`

## Faz Yol Haritası

### Faz 1 — MVP (Mevcut)
- [x] TomTom anlık trafik noktaları
- [x] EGO otobüs konum katmanı
- [x] CARTO dark harita
- [x] Otomatik yenileme (60s / 30s)
- [x] Yoğunluk renk kodlaması
- [x] Tooltip

### Faz 2 — Planlanan
- [ ] PostgreSQL + PostGIS — geçmiş trafik verisi
- [ ] Time Slider — saate göre geçmiş oynatma
- [ ] Haftalık ısı haritası (`HeatmapLayer`)
- [ ] Bölge yoğunluk sidebar (Çankaya, Yenimahalle, Kızılay %)
- [ ] WebSocket ile push model (polling yerine)
- [ ] Deployment: Vercel (frontend) + Railway (backend)

## Bilinen Kısıtlar

- EGO endpoint'i resmi değil; servis güncellemelerinde kırılabilir
- TomTom ücretsiz tier'da günlük 2.500 istek limiti var
- Trafik noktaları anlık segment verisi döner, tam yol ağı değil
