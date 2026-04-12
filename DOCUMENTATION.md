# Ankara Traffic Pulse — Tam Proje Dokümantasyonu

## 1. Proje Genel Bakış

Ankara Traffic Pulse, Ankara'nın anlık trafik akışını ve EGO belediye otobüslerinin gerçek zamanlı konumlarını estetik bir dijital ikiz üzerinde sunan web uygulamasıdır. Proje tamamen ücretsiz ve açık kaynak araçlarla inşa edilir — hiçbir API token'ı ücret gerektirmez (TomTom hariç, o da ücretsiz katman).

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend Framework | React 18 + Vite + TypeScript |
| Harita | MapLibre GL JS — ücretsiz, token yok |
| Görselleştirme | deck.gl ScatterplotLayer |
| Tile | CARTO Dark Matter — ücretsiz, token yok |
| Backend | Python FastAPI + uvicorn |
| Zamanlayıcı | APScheduler — 60 sn trafik, 30 sn otobüs |
| HTTP | httpx — async |
| Trafik API | TomTom Traffic Flow API — 2.500 req/gün ücretsiz |
| Otobüs API | EGO Cepte gayri resmi endpoint |
| Veri Deposu | In-memory (Faz 1) |

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
│   ├── main.py
│   ├── scheduler.py
│   ├── cache.py
│   ├── models.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── tomtom.py
│   │   └── ego.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_tomtom.py
│   │   ├── test_ego.py
│   │   └── test_api.py
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── package.json
    ├── eslint.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── constants.ts
        ├── hooks/
        │   └── useTrafficData.ts
        └── components/
            ├── TrafficMap.tsx
            ├── BusLayer.tsx
            └── TimeSlider.tsx
```

---

## 4. API Rehberi

### 4.1. TomTom Traffic Flow API

**Hesap açma:**
1. [developer.tomtom.com](https://developer.tomtom.com) adresine git
2. "Get Started for Free" — kredi kartı gerekmez
3. Dashboard → API Keys → varsayılan anahtarı kopyala
4. `backend/.env` dosyasına `TOMTOM_API_KEY=...` olarak yaz

**Endpoint:**
```
GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
    ?point={LAT},{LNG}&unit=KMPH&openLr=false&key={API_KEY}
```

**Ankara koordinatları:**
```
39.9334, 32.8597  → Kızılay
39.9560, 32.8598  → Atatürk Bulvarı Kuzey
39.9010, 32.8650  → Çankaya
39.9490, 32.8580  → Ulus
39.9750, 32.8150  → Yenimahalle
39.8700, 32.7500  → Eskişehir Yolu
40.0300, 32.9000  → Esenboğa Yolu
39.8600, 32.8200  → Konya Yolu
```

**Yanıt alanları:**
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

**Yoğunluk hesabı:** `congestionRatio = currentSpeed / freeFlowSpeed`

| Değer | Renk | Anlam |
|---|---|---|
| ≥ 0.80 | Yeşil | Trafik serbest |
| 0.50 – 0.79 | Sarı | Trafik yavaş |
| < 0.50 | Kırmızı | Trafik tıkanık |

**Kota yönetimi:** 8 nokta 4'erli 2 gruba bölünür. Her 60 sn bir grup sorgulanır. Günlük ~720 istek, limit 2.500.

---

### 4.2. EGO Cepte Otobüs API

EGO'nun resmi API'sı yoktur. EGO Cepte uygulaması arka planda bir web servisine istek atar.

**Yöntem A — mitmproxy:**
```bash
pip install mitmproxy
mitmweb --listen-port 8080
```
Android emülatör veya telefon proxy'sini `127.0.0.1:8080` olarak ayarla. EGO Cepte uygulamasını aç, harita bölümüne gir. mitmweb arayüzünde (`localhost:8081`) `ego.gov.tr`'ye giden JSON yanıtlı isteği bul.

**Yöntem B — Chrome DevTools:**
`m.ego.gov.tr/otobusnerede` adresini aç → F12 → Network → XHR → Hat numarası gir → JSON döndüren isteği bul.

**Beklenen format:**
```json
{
  "HatNo": "135",
  "Araclar": [
    { "Enlem": 39.9334, "Boylam": 32.8597, "Hiz": 35, "Yon": 180 }
  ]
}
```

> API tespit edilmezse `_mock_buses()` otomatik devreye girer.

---

## 5. Backend API Endpoint'leri

| Method | Endpoint | Açıklama | Güncelleme |
|---|---|---|---|
| GET | `/api/v1/traffic/live` | Trafik noktaları (GeoJSON FeatureCollection) | Her 60 saniye |
| GET | `/api/v1/buses/live` | EGO otobüs konumları (JSON array) | Her 30 saniye |
| GET | `/api/v1/health` | Servis sağlık durumu | — |
| — | `/docs` | Swagger UI | — |

---

## 6. Başlatma

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
cp .env.example .env         # .env içine TomTom key'ini yaz
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

### Swagger
```
http://localhost:8000/docs
```

---

## 7. Test Fazları

### Faz 1 — Backend Unit Testleri
```bash
cd backend
pytest tests/ -v
```

### Faz 2 — Manuel Kontrol Listesi
- [ ] `http://localhost:8000/docs` açılıyor
- [ ] `/api/v1/health` → `{"status": "ok"}` dönüyor
- [ ] `/api/v1/traffic/live` → features dizisi dolu
- [ ] `/api/v1/buses/live` → en az 1 otobüs (mock dahil)
- [ ] `http://localhost:5173` açılıyor
- [ ] Harita Ankara'yı gösteriyor
- [ ] Trafik noktaları haritada görünüyor (yeşil/sarı/kırmızı)
- [ ] Mavi otobüs noktaları görünüyor
- [ ] Sol altta bilgi paneli ve "Son güncelleme" saati var
- [ ] 60 saniye sonra trafik verisi yenileniyor

### Faz 3 — EGO Gerçek Veri Entegrasyonu
- [ ] mitmproxy ile endpoint tespit edildi
- [ ] `.env` dosyasına `EGO_API_BASE` yazıldı
- [ ] `/api/v1/buses/live` gerçek otobüs verisi dönüyor
- [ ] Haritada otobüsler gerçek konumlarda görünüyor

---

## 8. Kota Özeti

| Servis | Limit | Günlük Kullanım | Durum |
|---|---|---|---|
| MapLibre GL JS | Sınırsız | — | Ücretsiz |
| CARTO Tiles | Sınırsız | — | Ücretsiz |
| TomTom Traffic | 2.500 req/gün | ~720 req | Güvenli |
| EGO Cepte | Belirsiz | ~2.880 req | Dikkatli |

---

## 9. Faz 2 Yol Haritası

- [ ] PostgreSQL + PostGIS — geçmiş trafik verisi
- [ ] Time Slider — saate göre geçmiş oynatma
- [ ] Haftalık ısı haritası — `deck.gl HeatmapLayer`
- [ ] Bölge sidebar — Çankaya / Yenimahalle / Kızılay yüzdeleri
- [ ] WebSocket — polling yerine push
- [ ] Metro/Ankaray güzergah katmanı
- [ ] Deployment — Vercel (frontend) + Railway (backend)
