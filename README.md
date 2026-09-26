# Ankara Traffic Pulse

Ankara'nın 8 ana koridorundaki anlık trafik yoğunluğunu, EGO otobüslerini ve raylı sistem hatlarını (M1–M4, Ankaray) tek bir karanlık haritada gösteren full-stack web uygulaması.

**Geliştiren:** [Alp Eren Kul](https://alperenkul.com)

## Özellikler

- **Canlı trafik:** 8 koridorda 32 ölçüm noktası. Renk, anlık hızın serbest akış hızına oranından gelir.
- **EGO otobüsleri:** Konumlar 30 sn'de bir yenilenir, araçlar aradaki yolu kayarak alır.
- **Raylı sistem:** M1, M2, M3, M4 ve Ankaray. Güzergâhlar OpenStreetMap'ten günde bir çekilir; hatlar üzerinde temsili trenler hareket eder.
- **3B görünüm:** "3B sütun" modunda kamera eğilir, her ölçüm noktası yoğunluğu kadar yükselen bir sütun olur.
- **Ulaşım paneli:** Projeye özel çizilmiş izometrik otobüs, metro treni ve otopark görselleri; hat seçince tren hat rengine boyanır.
- **Otopark ve bisiklet:** Araç otoparkları (doluluk bilgisi varsa renkli P ikonu), bisiklet park/istasyonları, bisiklet yolları ve teleferik durakları. Kaynak önceliği: ULASAV/Şeffaf Ankara dosyası → Şeffaf Ankara API → ULASAV → OpenStreetMap.
- **Geçmiş ve haftalık:** Son 7 günün seçilen saati ya da ortalaması (PostgreSQL gerekir).
- **Bölge yoğunluğu:** 7 bölge için yüzde hız kaybı.
- **Tahmin:** Önümüzdeki 4 saat. Yeterli veri varsa Ridge regresyonu, yoksa Ankara saatlik profili.
- **Demo modu:** API anahtarı olmadan da çalışır. Örnek veri kullanıldığında arayüz bunu açıkça gösterir.

| Yoğunluk | Hız / serbest akış |
|---|---|
| Serbest | ≥ 0,80 |
| Yavaş | 0,60 – 0,80 |
| Yoğun | 0,40 – 0,60 |
| Tıkanık | < 0,40 |

## Teknolojiler

- **Frontend:** React 18, TypeScript, Vite, Deck.gl 9, MapLibre GL
- **Backend:** Python FastAPI, APScheduler, SQLAlchemy (async), scikit-learn
- **Veritabanı:** PostgreSQL (opsiyonel, olmadan da çalışır)
- **Gerçek zamanlı:** WebSocket, bağlantı koparsa REST yedeği ve otomatik yeniden bağlanma
- **Veri:** TomTom Traffic Flow API, EGO, OpenStreetMap (Overpass), OpenFreeMap vektör altlık haritası (anahtarsız)

## Yerelde çalıştırma

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # TOMTOM_API_KEY'i yaz (yazmazsan demo modu açılır)
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

### Docker ile hepsi birden

```bash
cp backend/.env.example backend/.env
docker compose up --build
# Harita: http://localhost:5173 · API: http://localhost:8000/docs
```

### Testler

```bash
cd backend && python -m pytest -q          # 39 test
cd frontend && npm run lint && npm run build
```

## Yayına alma (Railway + Vercel)

### 1. Backend → Railway

1. Railway'de **New Project → Deploy from GitHub repo** ile bu depoyu seç, servisin **Root Directory** ayarını `backend` yap. `backend/railway.json` Dockerfile ile derler ve `/api/v1/health` üzerinden sağlık kontrolü yapar.
2. Aynı projeye **Add → Database → PostgreSQL** ekle. Backend servisinde `DATABASE_URL` değişkenini `${{Postgres.DATABASE_URL}}` olarak bağla. `postgres://` adresi otomatik olarak asyncpg sürücüsüne çevrilir.
3. Değişkenler:

   | Değişken | Değer |
   |---|---|
   | `TOMTOM_API_KEY` | TomTom anahtarı (boşsa demo trafik) |
   | `CORS_ORIGIN` | `https://alperenkul.com,https://<vercel-adresi>.vercel.app` |
   | `EGO_API_BASE` | EGO servis adresi (boşsa demo otobüs) |
   | `RETENTION_DAYS` | Geçmiş kayıt saklama süresi, varsayılan `30` |
   | `PARKING_RESOURCE_URL` | (İsteğe bağlı) Otopark verisi adresi |
   | `BIKESTATIONS_RESOURCE_URL` | (İsteğe bağlı) Bisiklet istasyonu verisi adresi |
   | `BIKE_RESOURCE_URL` | (İsteğe bağlı) Bisiklet yolu verisi adresi (ör. Şeffaf Ankara API) |
   | `CABLECAR_RESOURCE_URL` | (İsteğe bağlı) Teleferik durak verisi adresi |
   | `OVERPASS_URLS` | (İsteğe bağlı) Virgülle ayrılmış Overpass sunucuları |
   | `OPEN_DATA` | `off` yapılırsa açık veri katmanları kapanır |

4. **Settings → Networking → Generate Domain** ile genel adres al (ör. `atp-api.up.railway.app`).

> Replika sayısı 1 kalmalı: zamanlayıcı ve canlı cache süreç içinde çalışır.

### 2. Frontend → Vercel

1. Vercel'de **Add New → Project** ile depoyu içe aktar, **Root Directory** olarak `frontend` seç. Ayarlar `frontend/vercel.json` içinde.
2. Ortam değişkenleri:

   | Değişken | Değer |
   |---|---|
   | `VITE_API_BASE` | `https://atp-api.up.railway.app` |
   | `VITE_WS_BASE` | `wss://atp-api.up.railway.app` |
   | `VITE_BASE_PATH` | Yalnızca alt dizinde yayınlanacaksa, ör. `/projects/ankara-traffic-pulse/` |

3. Deploy et. Kendi alan adını bağlamak için **Settings → Domains** (ör. `traffic.alperenkul.com`). Bu adresi backend'deki `CORS_ORIGIN`'e de ekle.

## API

| Endpoint | Açıklama |
|---|---|
| `GET /api/v1/traffic/live` | Anlık trafik noktaları (GeoJSON) |
| `GET /api/v1/buses/live` | Otobüs konumları |
| `GET /api/v1/traffic/history?hour=N` | Son 7 günde o saatin verisi (Ankara saati) |
| `GET /api/v1/traffic/weekly` | Son 7 günün nokta bazlı ortalaması |
| `GET /api/v1/traffic/districts` | Bölge bazında yoğunluk |
| `GET /api/v1/traffic/predict?hours=N` | Önümüzdeki N saat tahmini |
| `GET /api/v1/metro/routes` · `/metro/stations` | Raylı sistem hatları ve istasyonlar |
| `GET /api/v1/meta` | Veri kaynakları: gerçek mi, demo mu; açık veri katman sayıları |
| `GET /api/v1/opendata/{parking,bikestations,bike,cablecar}` | Otopark, bisiklet ve teleferik katmanları (GeoJSON + kaynak/lisans) |
| `GET /api/v1/health` | Servis, DB, cache ve bağlantı durumu |
| `WS  /ws/traffic` | Anlık yayın (`ping` → `pong`) |
| `GET /docs` | Swagger arayüzü |

## Zamanlama ve kota

TomTom'un ücretsiz katmanı günde 2.500 istek verir. Her turda 4 nokta sorgulanır.

| İş | Aralık |
|---|---|
| TomTom turu (`TRAFFIC_REFRESH_SECONDS`) | 180 sn → günde 1.920 istek |
| Tüm koridorların tazelenmesi | 24 dk |
| Trafik noktasının cache ömrü | 45 dk |
| Otobüs konumları | 30 sn |
| Raylı sistem verisi (OSM) | 24 saat |
| Otopark verisi | 10 dk |
| Bisiklet istasyonları | 1 saat |
| Bisiklet yolları, teleferik | 24 saat |
| Eski kayıt temizliği | 24 saatte bir, `RETENTION_DAYS` günden eski |
| Tahmin modelinin yeniden eğitimi | 15 dk |

## Veri kaynakları

- **TomTom Traffic Flow API:** [developer.tomtom.com](https://developer.tomtom.com). Kredi kartı gerekmez.
- **EGO:** Resmi ve herkese açık bir canlı otobüs API'si yok. EGO Cepte uygulamasının kullandığı uç noktalar belgelenmemiştir ve değişebilir. `EGO_API_BASE` tanımlıysa `services/ego.py` bilinen adresleri dener, yanıt alamazsa demo veriye geçer.
- **OpenStreetMap:** Raylı sistem güzergâhları Overpass API ile çekilir (© OpenStreetMap katkıcıları, ODbL). Erişilemezse doğrulanmış istasyon koordinatlarından oluşan yerleşik veri kullanılır.
- **Ankara açık veri (ULASAV / Şeffaf Ankara):** Ankara Büyükşehir'in [ULASAV ulaşım grubunda](https://ulasav.csb.gov.tr/dataset/?organization=ankara-buyuksehir-belediyesi&groups=ulasim) bisiklet istasyonu, bisiklet yolu, elektrikli bisiklet istasyonu, metro durağı ve teleferik durağı veri setleri XLSX olarak yayınlanıyor. **Otopark doluluk veri seti bu grupta yok.** ULASAV ve Şeffaf Ankara yurt dışı sunuculardan gelen istekleri reddedebildiği için veri setlerini tarayıcıdan indirip [`backend/data/opendata/`](backend/data/opendata/README.md) klasörüne koymak en güvenilir yoldur; backend XLSX/CSV/GeoJSON dosyalarını otomatik okur. Türkçe sütun adları, ondalık virgül, WKT geometri ve WGS84 / Web Mercator / ITRF96-TM33 koordinatları tanınır. Şeffaf Ankara'da bir veri seti için API başvurusu onaylanırsa verilen `.../GetApiFeatures/apiKey=...` adresi `*_RESOURCE_URL` değişkenine yazılabilir. Lisans: [Şeffaf Ankara Lisansı](https://seffaf.ankara.bel.tr/resources/images/hakkimizda/lisans.pdf), atıf zorunlu.
- **OpenStreetMap yedeği:** Resmi veri yoksa otopark (adı, kapasitesi, türü, ücretli/ücretsiz), bisiklet parkı ve bisiklet yolu konumları OSM'den çekilir (© OpenStreetMap katkıcıları, ODbL). OSM'de doluluk bilgisi yoktur.
- **Tren konumları:** EGO raylı sistem için canlı konum yayınlamaz. Haritadaki trenler ortalama 35 km/s ile hat boyunca hareket eden temsili araçlardır.

## Faz durumu

- [x] **Faz 1:** TomTom trafik, EGO katmanı, karanlık harita, otomatik yenileme
- [x] **Faz 2:** PostgreSQL, geçmiş, ısı haritası, bölge paneli, WebSocket, Docker
- [x] **Faz 3:** Raylı sistem (OSM), haftalık ısı, ML tahmini, animasyonlu otobüsler, demo modu, yayın yapılandırması
- [ ] Gerçek EGO canlı verisi (resmi API açılırsa)

## Lisans ve atıf

Altlık harita © OpenFreeMap, © OpenMapTiles, © OpenStreetMap katkıcıları. Trafik verisi © TomTom.
