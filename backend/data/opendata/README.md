# Ankara açık veri dosyaları

ULASAV ve Şeffaf Ankara bazı yurt dışı sunuculardan gelen istekleri reddedebilir.
Bu durumda veri setlerini tarayıcıdan indirip bu klasöre koyun; backend her
yenilemede buradaki dosyaları otomatik okur (XLSX, CSV, JSON, GeoJSON).

Dosya adı, katmanı belirler:

| Dosya adında geçen kelimeler | Katman |
|---|---|
| `bisiklet` + `istasyon` | Bisiklet istasyonları (elektrikli dahil) |
| `bisiklet` + `yol` | Bisiklet yolları |
| `teleferik` | Teleferik durakları |
| `otopark` | Otoparklar (doluluk sütunları varsa gösterilir) |

Kaynak: [ULASAV — Ankara Büyükşehir, Ulaşım grubu](https://ulasav.csb.gov.tr/dataset/?organization=ankara-buyuksehir-belediyesi&groups=ulasim)
Lisans: Şeffaf Ankara Lisansı — atıf zorunludur.
