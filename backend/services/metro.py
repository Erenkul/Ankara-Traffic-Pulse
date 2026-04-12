"""Ankara Metro ve Ankaray hat verileri — statik GeoJSON."""

METRO_ROUTES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"id": "M1", "name": "M1 Kızılay – Batıkent", "color": [220, 50, 50]},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [32.8543, 39.9199],  # Kızılay
                    [32.8516, 39.9257],  # Sıhhiye
                    [32.8570, 39.9393],  # Ulus
                    [32.8418, 39.9521],  # Akköprü
                    [32.8361, 39.9623],  # İvedik
                    [32.8256, 39.9706],  # Yenimahalle
                    [32.8100, 39.9815],  # Demetevler
                    [32.8038, 39.9887],  # Hastane
                    [32.7973, 39.9932],  # Macunköy
                    [32.7901, 39.9971],  # Ostim
                    [32.7820, 40.0021],  # Batıkent
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "M2", "name": "M2 Kızılay – Keçiören", "color": [50, 100, 220]},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [32.8543, 39.9199],  # Kızılay
                    [32.8568, 39.9263],  # Necatibey
                    [32.8615, 39.9273],  # Demirtepe
                    [32.8659, 39.9291],  # Tandoğan
                    [32.8712, 39.9320],  # Maltepe
                    [32.8726, 39.9340],  # Akay
                    [32.8737, 39.9378],  # Bahçelievler
                    [32.8726, 39.9425],  # Beşevler
                    [32.8707, 39.9475],  # Emek
                    [32.8695, 39.9546],  # Botanik
                    [32.8643, 39.9617],  # Gar
                    [32.8603, 39.9680],  # Mecidiye
                    [32.8583, 39.9744],  # Kuyubaşı
                    [32.8569, 39.9808],  # Dutluk
                    [32.8566, 39.9857],  # Şehitler
                    [32.8544, 39.9906],  # Keçiören
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "A1", "name": "Ankaray AŞTİ – Dikimevi", "color": [30, 180, 100]},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [32.8283, 39.9097],  # AŞTİ
                    [32.8327, 39.9152],  # Emek
                    [32.8355, 39.9205],  # Bahçelievler
                    [32.8391, 39.9201],  # Beştepe
                    [32.8432, 39.9165],  # Aşıkpaşa
                    [32.8471, 39.9145],  # Tandoğan
                    [32.8509, 39.9145],  # Maltepe
                    [32.8543, 39.9165],  # Akay
                    [32.8543, 39.9199],  # Kızılay
                    [32.8577, 39.9170],  # Kolej
                    [32.8606, 39.9148],  # Kurtuluş
                    [32.8637, 39.9120],  # Ayrancı
                    [32.8699, 39.9098],  # Dikimevi
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"id": "M3", "name": "M3 Macunköy – OSB-Törekent", "color": [180, 80, 220]},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [32.7973, 39.9932],  # Macunköy
                    [32.7752, 39.9891],  # Şehir Hastanesi
                    [32.7635, 39.9847],  # Fatih
                    [32.7528, 39.9803],  # Hastane
                    [32.7432, 39.9761],  # Sincan
                    [32.6960, 39.9720],  # OSB-Törekent
                ],
            },
        },
    ],
}

METRO_STATIONS = {
    "type": "FeatureCollection",
    "features": [
        # M1
        {"type": "Feature", "properties": {"line": "M1", "name": "Kızılay"},     "geometry": {"type": "Point", "coordinates": [32.8543, 39.9199]}},
        {"type": "Feature", "properties": {"line": "M1", "name": "Sıhhiye"},     "geometry": {"type": "Point", "coordinates": [32.8516, 39.9257]}},
        {"type": "Feature", "properties": {"line": "M1", "name": "Ulus"},        "geometry": {"type": "Point", "coordinates": [32.8570, 39.9393]}},
        {"type": "Feature", "properties": {"line": "M1", "name": "Yenimahalle"}, "geometry": {"type": "Point", "coordinates": [32.8256, 39.9706]}},
        {"type": "Feature", "properties": {"line": "M1", "name": "Batıkent"},    "geometry": {"type": "Point", "coordinates": [32.7820, 40.0021]}},
        # M2
        {"type": "Feature", "properties": {"line": "M2", "name": "Necatibey"},   "geometry": {"type": "Point", "coordinates": [32.8568, 39.9263]}},
        {"type": "Feature", "properties": {"line": "M2", "name": "Keçiören"},    "geometry": {"type": "Point", "coordinates": [32.8544, 39.9906]}},
        # A1
        {"type": "Feature", "properties": {"line": "A1", "name": "AŞTİ"},        "geometry": {"type": "Point", "coordinates": [32.8283, 39.9097]}},
        {"type": "Feature", "properties": {"line": "A1", "name": "Dikimevi"},     "geometry": {"type": "Point", "coordinates": [32.8699, 39.9098]}},
        # M3
        {"type": "Feature", "properties": {"line": "M3", "name": "Sincan"},       "geometry": {"type": "Point", "coordinates": [32.7432, 39.9761]}},
    ],
}


def get_metro_routes():
    return METRO_ROUTES


def get_metro_stations():
    return METRO_STATIONS
