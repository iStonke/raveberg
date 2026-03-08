# AP4 Technische Orientierung

## Zielbild

AP4 macht den Selfie-Pfad live-tauglich:

- serverseitig persistenter Moderationsmodus
- serverseitig persistente Slideshow-Settings
- klare Trennung zwischen oeffentlichen und Admin-Uploadlisten
- Freigeben, Ablehnen und Loeschen direkt im Dashboard
- Live-Aktualisierung von Dashboard und Display ueber SSE

## Moderationsmodell

Der technische Upload-Status und der fachliche Moderationsstatus sind getrennt.

Technischer Status:

- `uploaded`
- `processed`
- `error`

Moderationsstatus:

- `pending`
- `approved`
- `rejected`

Die oeffentliche Slideshow beruecksichtigt nur Uploads mit:

- `status = processed`
- `approved = true`

Damit bleiben nicht freigegebene oder technisch fehlerhafte Dateien strikt aus oeffentlichen Listen heraus.

## Moderationsmodi

Der persistente `selfie_state` enthaelt:

- `slideshow_enabled`
- `slideshow_interval_seconds`
- `slideshow_shuffle`
- `moderation_mode`
- `slideshow_updated_at`

`moderation_mode` unterstuetzt in AP4:

- `auto_approve`
- `manual_approve`

Verhalten neuer Uploads:

- `auto_approve`: erfolgreiche Uploads werden direkt `approved`
- `manual_approve`: erfolgreiche Uploads werden zunaechst `pending`

Verhalten beim Wechsel des Moderationsmodus:

- wirkt nur auf neue Uploads
- bestehende `approved` Uploads bleiben `approved`
- bestehende `pending` Uploads bleiben `pending`
- bestehende `rejected` Uploads bleiben `rejected`
- es gibt in AP4 keine stillen Massenupdates alter Uploads

## Selfie-API

### `GET /api/selfie`

- liefert den aktuellen Selfie-/Slideshow-State
- fuer Dashboard und Display lesbar

### `PUT /api/selfie`

- nur fuer `admin`
- aktualisiert:
  - `slideshow_enabled`
  - `slideshow_interval_seconds`
  - `slideshow_shuffle`
  - `moderation_mode`
- validiert Werte serverseitig
- Intervall ist in AP4 auf `3..30` Sekunden begrenzt

## Upload- und Moderations-API

### Oeffentlich

- `POST /api/uploads`
- `GET /api/uploads`
- `GET /api/uploads/{id}/display`

### Nur fuer Admin

- `GET /api/uploads/admin`
- `GET /api/uploads/{id}/admin-display`
- `POST /api/uploads/{id}/approve`
- `POST /api/uploads/{id}/reject`
- `DELETE /api/uploads/{id}`

`GET /api/uploads` ist bewusst strikt gehalten und liefert nur freigegebene Bilder fuer die Slideshow. Nicht freigegebene Bilder sind ausschliesslich ueber Admin-Endpunkte sichtbar.

## Upload-Flow in AP4

1. Gast laedt Bild ueber `POST /api/uploads` hoch
2. Backend validiert Datei und verarbeitet sie weiter wie in AP2
3. je nach `moderation_mode` wird der Upload nach erfolgreicher Verarbeitung:
   - `approved`
   - oder `pending`
4. Backend sendet `upload_created`
5. Admin kann spaeter:
   - freigeben
   - ablehnen
   - loeschen

Beim Loeschen werden konsistent entfernt:

- DB-Eintrag
- Originaldatei
- Display-Datei

## Eventfluss

Zentraler Stream:

- `GET /api/events/stream`

Relevante AP4-Events:

- `selfie_snapshot`
- `selfie_settings_updated`
- `upload_created`
- `upload_approved`
- `upload_rejected`
- `upload_deleted`

Zusammen mit den bestehenden Mode- und Visualizer-Events bleibt das System bei einem einzigen SSE-Kanal.

## Dashboard-Verhalten

Das Admin-Dashboard ist in Bereiche gegliedert:

- Systemstatus
- globaler Modus
- Visualizer-Steuerung
- Selfie-/Slideshow-Steuerung
- Upload-Moderation

Die Upload-Liste zeigt pro Eintrag:

- Thumbnail
- Upload-Zeit
- technischen Status
- Moderationsstatus
- Dateigroesse
- Dateityp

Aktionen sind gegen Mehrfachausloesung abgesichert, indem Buttons waehrend laufender Requests deaktiviert bzw. auf Loading gesetzt werden.

## SelfieRenderer-Verhalten

Der SelfieRenderer liest nur:

- die oeffentliche Uploadliste
- den serverseitigen Selfie-State

Er arbeitet absichtlich nicht direkt mit `moderation_mode`, damit die Freigabelogik vollstaendig im Backend bleibt.

Verhalten in AP4:

- `slideshow_enabled = false`: Slideshow stoppt sauber, keine alten Timer laufen weiter
- `slideshow_shuffle = true`: zufaellige Reihenfolge
- `slideshow_shuffle = false`: chronologische Reihenfolge gemaess API (`created_at DESC`)
- `slideshow_interval_seconds`: steuert das Wechselintervall live

Reaktion auf Live-Ereignisse:

- `upload_created`: neue Bilder werden nur sichtbar, wenn sie bereits approved sind
- `upload_approved`: Bild wird ohne Reload in den Kandidatenpool aufgenommen
- `upload_rejected`: Bild verschwindet aus der Slideshow bzw. erscheint nie
- `upload_deleted`: geloeschte Bilder werden aus dem aktiven Pool entfernt
- `selfie_settings_updated`: Renderer uebernimmt neue Interval-/Shuffle-/Enabled-Werte live

## Bewusste Vereinfachungen in AP4

- keine automatische Inhaltsmoderation
- keine Galerie- oder Archivansicht
- keine QR-Flow-Erweiterung
- keine Gastkonten oder feineren Admin-Rechte
- Moderation direkt auf dem Upload selbst, ohne getrennte Review-Queues

## Offene Punkte fuer AP5+

- Rate Limiting und Spam-Schutz
- erweiterte Moderationswerkzeuge
- Archiv-/Galerieansichten
- feingranulare Admin-Rollen
- weitergehende Automatisierung fuer Eventbetrieb
