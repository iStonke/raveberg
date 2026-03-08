# AP2 Technische Orientierung

## Zielbild

AP2 macht den Selfie-Pfad erstmals nutzbar:

- offene Gast-Uploads ueber `/guest/upload`
- serverseitige Validierung und Bildverarbeitung
- getrennte Speicherung von Original und Display-Version
- Selfie-Slideshow auf dem Display
- Live-Aktualisierung per `upload_created`-Event

## Upload-API

### `POST /api/uploads`

- erwartet `multipart/form-data`
- Feldname: `file`
- erlaubte Formate: `jpg`, `jpeg`, `png`, `webp`, `heic`, `heif`
- zusaetzliche MIME-Pruefung
- Dateigroessenlimit ueber `UPLOAD_MAX_BYTES`

### `GET /api/uploads`

- liefert maximal 100 Eintraege
- nur `approved = true`
- nur `status = processed`
- Sortierung: `created_at DESC`

### `GET /api/uploads/admin`

- nur fuer `admin`
- zeigt die juengsten Uploads inklusive Fehlerfaellen fuer das Dashboard

### `GET /api/uploads/{id}/display`

- liefert die optimierte Display-Datei

## Upload-Validierung

Der Backend-Pfad prueft:

- Dateiendung
- MIME-Type
- maximale Bytegruesse
- Bildlesbarkeit ueber Pillow
- beschaedigte Dateien durch echten Ladevorgang vor der Verarbeitung

Fehlerhafte Dateien werden mit `400` abgelehnt. Falls ein Datensatz bereits angelegt wurde, landet er mit `status = error` in der Upload-Uebersicht.

## Bildverarbeitung

`UploadService` fuehrt die Pipeline synchron aus:

1. Originaldatei in `uploads/original` speichern
2. Bild mit Pillow laden
3. EXIF-Rotation mit `ImageOps.exif_transpose()` korrigieren
4. Bild proportional auf maximal `1920x1080` skalieren
5. optimierte JPEG-Display-Version in `uploads/display` schreiben

HEIC/HEIF wird ueber `pillow-heif` geoeffnet.

## Speicherstruktur

- `uploads/original`: unveraenderte Originale
- `uploads/display`: optimierte Display-Dateien

Beide Verzeichnisse liegen im persistenten Upload-Volume.

## Datenmodell `uploads`

- `id`
- `filename_original`
- `filename_display`
- `mime_type`
- `size`
- `created_at`
- `status`
- `approved`

Statuswerte:

- `uploaded`
- `processed`
- `error`

In AP2 wird `approved` direkt auf `true` gesetzt, damit die Moderation spaeter ohne Schemawechsel eingefuehrt werden kann.

## Event-System

- Stream-Endpunkt: `GET /api/events/stream`
- relevante Events:
  - `mode_snapshot`
  - `mode_changed`
  - `upload_created`

Nach erfolgreicher Verarbeitung broadcastet das Backend `upload_created`. Das Display laedt daraufhin die Slideshow-Daten neu.

## Frontend-Aufbau

- `src/views/guest/GuestUploadView.vue`
  - reduzierte Upload-Seite ohne Navigation
  - Kamera- oder Dateiauswahl
  - Fortschritt, Erfolg und Fehler
- `src/components/display/SelfieRenderer.vue`
  - laedt Slideshow-Daten aus `GET /api/uploads`
  - mischt die Reihenfolge zufaellig
  - zeigt Fade-Uebergaenge
  - reagiert auf `upload_created`
- `src/views/admin/AdminDashboardView.vue`
  - zeigt letzte Uploads mit Thumbnail, Zeit und Status

## Verifikation in AP2

Geprueft wurden:

- erfolgreicher Bild-Upload ueber `multipart/form-data`
- Persistenz von Original und Display-Datei
- oeffentliche Upload-Liste nur mit verarbeiteten Bildern
- Admin-Uebersicht inklusive Fehlerstatus
- JPEG-Auslieferung der Display-Version
- Ablehnung eines kaputten Bilduploads mit sauberer Fehlermeldung
- `upload_created` ueber SSE nach erfolgreichem Upload

## Offene Punkte fuer AP3+

- Admin-Moderation ueber `approved`
- echte Thumbnails oder mehrere Renditions
- robustere Metadaten- und EXIF-Nutzung
- Upload-Limits pro Zeitfenster
- slideshowbezogene Presets und Timing-Konfiguration
