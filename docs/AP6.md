# AP6 - Betriebsrobustheit, Quick Controls, Rate Limits, Cleanup und Event-Sicherheit

## Zielbild

AP6 haertet RAVEBERG fuer den echten Eventbetrieb. Der fachliche Aufbau aus AP0 bis AP5 bleibt bestehen, wird aber um schnelle Eingriffe, konservative Betriebsgrenzen und robustere Recovery-Pfade erweitert.

## Neue Betriebszustaende und Settings

### Globaler Modus

- `visualizer`: generative Visuals mit Live-Steuerung
- `selfie`: Slideshow mit freigegebenen Uploads
- `idle`: ruhiger sichtbarer Standby-/Branding-Screen
- `blackout`: sofort dunkler Sicherheitsmodus ohne sichtbare Ausgabe

### Visualizer-State

Persistente Felder in `visualizer_state`:

- `active_preset`
- `intensity`
- `speed`
- `brightness`
- `color_scheme`
- `auto_cycle_enabled`
- `auto_cycle_interval_seconds`
- `updated_at`

`auto_cycle_enabled` und `auto_cycle_interval_seconds` steuern einen serverseitigen Preset-Wechsel. Das Backend waehlt nur aus gueltigen Presets und broadcastet die Aenderung ueber SSE.

### Selfie-/Slideshow-State

Persistente Felder in `selfie_state`:

- `slideshow_enabled`
- `slideshow_interval_seconds`
- `slideshow_shuffle`
- `moderation_mode`
- `slideshow_updated_at`

Diese Werte bleiben weiterhin getrennt vom globalen App-Mode.

### Runtime-Grenzen

Neue konfigurierbare Betriebsgrenzen:

- `UPLOAD_RATE_LIMIT_COUNT`
- `UPLOAD_RATE_LIMIT_WINDOW_SECONDS`
- `MAX_STORED_UPLOADS`
- `CLEANUP_PRESERVE_LATEST_COUNT`
- `CLEANUP_BATCH_SIZE`
- `DISPLAY_HEARTBEAT_INTERVAL_SECONDS`
- `DISPLAY_HEARTBEAT_STALE_SECONDS`
- `DEFAULT_VISUALIZER_AUTO_CYCLE_ENABLED`
- `DEFAULT_VISUALIZER_AUTO_CYCLE_INTERVAL_SECONDS`

## Quick Controls

Das Admin-Dashboard fuehrt einen separaten Quick-Control-Bereich fuer den Live-Betrieb:

- `Blackout`
- `Idle`
- `Visualizer`
- `Selfie`
- `Slideshow pausieren / fortsetzen`
- `Naechstes Bild`
- `Pool neu laden`
- `Preset weiter`
- `Auto-Cycle starten / pausieren`

Die Aktionen wirken ohne zusaetzliche Navigation. Reversible Eingriffe laufen bewusst ohne bestaetigende Dialoge.

## Unterschied zwischen Idle und Blackout

- `idle` ist sichtbar, ruhig und neutral. Der Renderer zeigt eine standfeste Standby-Flaeche.
- `blackout` ist die sofortige Sicherheitsfunktion. Das Display wird vollstaendig dunkel.

Beim Wechsel sorgt die Display-Architektur dafuer, dass Renderer sauber unmounten. Alte Animation-Loops oder Slideshow-Timer duerfen nicht weiterlaufen.

## Selfie-Live-Steuerung

Selfie-/Slideshow-Steuerung erfolgt weiter ueber `GET /api/selfie` und `PUT /api/selfie`. Fuer schnelle Eingriffe kommen hinzu:

- `POST /api/selfie/actions/next`
- `POST /api/selfie/actions/reload`

Diese Endpunkte erzeugen bewusst nur kleine Runtime-Ereignisse. Der Renderer laedt weiterhin seine eigentlichen Bilder ausschliesslich ueber die oeffentliche Upload-Liste.

## Visualizer Auto-Cycle

Der Auto-Cycle laeuft serverseitig:

1. `visualizer_state.auto_cycle_enabled = true`
2. Hintergrundloop prueft das Intervall
3. Backend waehlt ein neues Preset aus der gueltigen Presetliste
4. Neuer Zustand wird persistiert
5. SSE sendet `visualizer_updated` und `visualizer_preset_changed`

Manuelle Eingriffe bleiben erlaubt. Ein manuelles Speichern setzt den neuen Zustand persistiert und verschiebt damit den naechsten Auto-Cycle-Zeitpunkt implizit nach hinten.

## Rate-Limit-Strategie

Upload-Spam wird in AP6 mit einem einfachen, robusten In-Memory-Limit pro IP gebremst:

- Zeitfenster: `UPLOAD_RATE_LIMIT_WINDOW_SECONDS`
- Maximalanzahl: `UPLOAD_RATE_LIMIT_COUNT`
- Fehlerantwort: HTTP `429`
- Rueckmeldung: `Retry-After` Header und lesbare Fehlermeldung

Bei einem Treffer publiziert das Backend zusaetzlich `rate_limit_triggered`, damit das Dashboard den Zustand live sichtbar machen kann.

Hinweis: Der Schutz ist bewusst lokal und einfach. Er ersetzt kein verteiltes Abuse-System.
Die zugehoerigen Diagnostikzaehler sind in AP6 ebenfalls bewusst in-memory und starten nach einem Backend-Neustart neu.

## Cleanup-Strategie

AP6 fuehrt ein serverseitiges Cleanup mit klarer Priorisierung ein:

1. Solange die Gesamtzahl `MAX_STORED_UPLOADS` nicht uebersteigt, passiert nichts.
2. Die neuesten `CLEANUP_PRESERVE_LATEST_COUNT` Uploads bleiben geschuetzt.
3. Darueber hinaus werden bevorzugt alte, nicht priorisierte Eintraege entfernt:
   - `error`
   - `pending`
   - `rejected`
   - sonstige nicht freigegebene Uploads
4. Erst wenn noetig, werden aeltere bereits freigegebene Uploads aus dem Archivbereich entfernt.
5. Pro Durchlauf wird ueber `CLEANUP_BATCH_SIZE` begrenzt, wie viele Eintraege physisch entfernt werden.

Beim Cleanup werden immer konsistent geloescht:

- DB-Eintrag
- Originaldatei
- Display-Datei

Zusatzereignisse:

- pro geloeschtem Upload `upload_deleted`
- nach dem Batch `cleanup_completed`

## Eventfluss

AP6 nutzt weiterhin nur das zentrale SSE-System. Neue bzw. im Betrieb relevante Ereignisse:

- `blackout_activated`
- `blackout_cleared`
- `selfie_playback_updated`
- `visualizer_auto_cycle_updated`
- `cleanup_completed`
- `rate_limit_triggered`
- `heartbeat_updated`

Bereits bestehende Events wie `mode_changed`, `upload_created`, `upload_approved`, `upload_rejected`, `upload_deleted`, `selfie_settings_updated`, `visualizer_updated` und `visualizer_preset_changed` bleiben aktiv.

## Display-Recovery und Heartbeat

Die Display-Seite wurde fuer laengeren Laufbetrieb gehaertet:

- Start laedt den letzten serverseitigen Zustand
- SSE wird bei Fehlern mit Backoff neu aufgebaut
- Event-Payloads werden defensiv geparst
- Heartbeat wird regelmaessig an `POST /api/display/heartbeat` gemeldet
- Heartbeat uebertraegt:
  - aktuellen Modus
  - aktiven Renderer
  - SSE-Verbindungsstatus
  - letzten erfolgreichen State-Sync

Das Admin-Dashboard zeigt daraus u. a.:

- Display live / nicht live
- Stale-Zustand
- letzter Heartbeat
- letzter State-Sync

## Dashboard-Diagnostik

Das Dashboard fasst fuer den Live-Betrieb zusammen:

- aktuellen globalen Modus
- aktiven Display-Renderer
- Moderationsmodus
- Slideshow aktiv / pausiert
- aktives Preset
- Visualizer-Auto-Cycle aktiv / aus
- freien Speicher
- Upload-Gesamtzahl
- Rate-Limit-Treffer
- letztes Cleanup
- Dashboard-Liveverbindung
- letzten Display-Heartbeat

## Verhalten bei Fehlern

- Kurzzeitige API-/SSE-Ausfaelle sollen den Display-Betrieb nicht zerstoeren.
- Fehlschlaegt ein Selfie-Pool-Reload, laeuft der bisherige Pool weiter.
- Bei `slideshow_enabled = false` stoppt der Renderer seine Timer sauber.
- Bei Blackout/Idle werden alte Renderer sauber verlassen, statt im Hintergrund weiterzulaufen.

## Bewusste Vereinfachungen in AP6

- Rate-Limiting ist rein lokal/in-memory.
- Cleanup arbeitet count-basiert, nicht mit komplexer Archivpolitik.
- Heartbeat dient der Beobachtbarkeit, nicht als vollautomatischer Selbstheilungsdaemon.
- Auto-Cycle arbeitet mit einer kleinen festen Presetliste.
- Es gibt weiterhin keine Audio-Reaktivitaet, kein Captive Portal und keine Cloud-Anbindung.

## Vorbereitung fuer AP7

AP6 schafft die Grundlage fuer weitere Betriebsfunktionen:

- staerkerer Watchdog / Auto-Reload fuer Kiosk-Displays
- weitergehende Betriebsdiagnostik
- robustere Moderations- und Archivwerkzeuge
- spaetere Audio-Reaktivitaet und erweiterte Visualizer-Logik
