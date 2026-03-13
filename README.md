# RAVEBERG AP7

AP7 verfeinert das AP6-System fuer den sichtbaren Eventeinsatz: konsistentes Branding ueber Guest, Admin und Display, eventtauglichere Guest-Kommunikation, Event-/QR-Zugangsinfos im Dashboard, dezente Display-Overlays und ruhigerer Display-Feinschliff. Die technische Basis aus Vue 3 + Vuetify, FastAPI, PostgreSQL, SSE und Reverse Proxy bleibt unveraendert.

## Host-Ports

| Service | Host-Port | Zweck |
| --- | --- | --- |
| Proxy | `8085` | Primaerer Einstiegspunkt |
| Frontend | `5180` | Direkter Zugriff auf das Vite-Frontend |
| Backend | `8050` | Direkter API-Zugriff fuer Entwicklung |
| PostgreSQL | `5435` | Direkter Datenbankzugriff |

Nicht verwendet werden die im Projektbrief ausgeschlossenen Standardports wie `5173`, `8000` oder `5432` auf Host-Ebene.

## Projektstruktur

- `frontend/`: Vue-Client mit Vuetify, Pinia, Auth-Guards, Guest-Upload, Event-Branding, Live-Dashboard, Quick Controls, Display-Overlays und Display-Renderern
- `backend/`: FastAPI-API mit Konfiguration, Datenbankschicht, Auth, Upload-Pipeline, Moderation, Visualizer-State, Selfie-State, Runtime-Limits, Heartbeat, SSE, Appliance-Metadaten und Alembic
- `proxy/`: Nginx-Konfiguration fuer den gebuendelten Einstiegspunkt
- `ops/`: Pi-/Appliance-Skripte, Mac-Display-Startpfade, systemd-Units und AP-Beispielkonfigurationen
- `docs/`: technische Orientierung fuer AP0 bis AP7

## Start

```bash
docker compose up --build
```

Danach sind die wichtigsten Einstiege verfuegbar:

- Proxy: <http://localhost:8085>
- Frontend direkt: <http://localhost:5180>
- Backend API direkt: <http://localhost:8050/api>
- Backend Health: <http://localhost:8050/api/health>

Fuer den Pi-/Appliance-Betrieb ist ein separater Env-/Ops-Pfad vorbereitet:

```bash
cp ops/pi/env.appliance.example ops/pi/env.appliance
docker compose --env-file ops/pi/env.appliance up -d --build
```

Die oeffentliche URL fuer den sichtbaren Gaeste-Upload-QR-Code wird ueber `GUEST_UPLOAD_URL` in `ops/pi/env.appliance` gesteuert. Fuer Quick Tunnels oder spaetere feste Domains ist keine Codeaenderung noetig: Variable anpassen und den Pi-Stack neu starten.

Pragmatischer Event-Start mit Cloudflare Quick Tunnel:

```bash
bash ops/pi/start-event.sh
```

Das Skript startet `cloudflared`, extrahiert die neue `trycloudflare.com`-URL aus dem Log, schreibt `GUEST_UPLOAD_URL=<tunnel>/guest/upload` in `ops/pi/env.appliance` und startet den Pi-Stack anschliessend erneut mit dieser Env-Datei. Die finale oeffentliche Upload-URL wird direkt im Terminal ausgegeben.

## Frontend-Routen

- `/guest/upload`
- `/admin/login`
- `/admin/dashboard`
- `/display`

## API-Endpunkte

- `GET /api/health`
- `GET /api/mode`
- `PUT /api/mode`
- `GET /api/mode/stream`
- `GET /api/events/stream`
- `GET /api/system`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/uploads`
- `GET /api/uploads`
- `GET /api/uploads/admin`
- `GET /api/uploads/{id}/display`
- `GET /api/uploads/{id}/admin-display`
- `POST /api/uploads/{id}/approve`
- `POST /api/uploads/{id}/reject`
- `DELETE /api/uploads/{id}`
- `GET /api/selfie`
- `PUT /api/selfie`
- `POST /api/selfie/actions/next`
- `POST /api/selfie/actions/reload`
- `GET /api/visualizer`
- `PUT /api/visualizer`
- `GET /api/visualizer/presets`
- `POST /api/display/heartbeat`
- `GET /api/public-info`

## Rollenmodell

- `guest`: darf nur den offenen Guest-Bereich nutzen
- `admin`: darf Dashboard, Systemstatus und Modussteuerung nutzen

Die serverseitige Pruefung liegt im Backend. Frontend-Guards sind nur zusaetzliche Navigationsteuerung.

## Auth-Flow

1. Initial-Admin wird beim Backend-Start aus `DEFAULT_ADMIN_USERNAME` und `DEFAULT_ADMIN_PASSWORD` angelegt, falls noch kein passender Benutzer existiert.
2. `POST /api/auth/login` prueft den gehashten Passwortwert aus `admin_users` und erstellt eine serverseitige Session in `admin_sessions`.
3. Das Frontend speichert das Bearer-Token lokal und validiert es ueber `GET /api/auth/session`.
4. `POST /api/auth/logout` invalidiert die Session serverseitig.

## Upload-Flow

`POST /api/uploads` akzeptiert Gast-Uploads als `multipart/form-data`. Das Backend prueft Dateityp, MIME-Type, Dateigroesse und Bildlesbarkeit, speichert das Original unter `uploads/original`, erzeugt eine optimierte Display-Version unter `uploads/display` und schreibt Metadaten in `uploads`. Nach erfolgreicher Verarbeitung entscheidet der serverseitige Moderationsmodus, ob der Upload direkt `approved` wird oder zunaechst `pending` bleibt. Danach wird `upload_created` ueber SSE ausgesendet.

## Slideshow-Flow

Im Selfie-Modus laedt das Display die letzten 100 freigegebenen Uploads ueber `GET /api/uploads`. Der Renderer uebernimmt Intervall, Shuffle und Aktivierung aus `GET /api/selfie` und reagiert live auf `selfie_settings_updated`, `upload_created`, `upload_approved`, `upload_rejected` und `upload_deleted`. Oeffentliche Listen enthalten ausschliesslich freigegebene Bilder.

## Visualizer-Flow

Der globale App-Mode entscheidet weiterhin nur zwischen `visualizer`, `selfie`, `blackout` und `idle`. Fuer den Visualizer existiert zusaetzlich ein eigener serverseitiger Zustand mit `active_preset`, `intensity`, `speed`, `brightness`, `color_scheme`, `logo_overlay_enabled` und `updated_at`. Admins lesen und aendern diesen Zustand ueber `GET /api/visualizer` und `PUT /api/visualizer`. Nach jeder Aenderung sendet das Backend `visualizer_updated`; bei Presetwechsel zusaetzlich `visualizer_preset_changed`. Das Display abonniert weiterhin nur den zentralen SSE-Stream und uebernimmt Aenderungen ohne Reload. Aktuell verfuegbare Presets sind `particles`, `kaleidoscope`, `warehouse`, `swarm_collision`, `vanta_fog`, `vanta_halo`, `hydra_rave` und `particle_swarm`.

## Open-Source-Visualizer

RAVEBERG bindet externe Visualizer nur innerhalb der bestehenden Visualizer-Runtime ein. Produktiv genutzt werden aktuell:

- `vanta` fuer `vanta_fog` und `vanta_halo`
- `hydra-synth` fuer `hydra_rave`
- `tsparticles` und `@tsparticles/engine` fuer `particle_swarm`

Wichtig fuer Entwickler: `hydra-synth` steht unter AGPL-3.0. Die Bibliothek bleibt als Open-Source-Abhaengigkeit sichtbar eingebunden und wird nicht als proprietaere Eigenentwicklung dargestellt.

## Moderations-Flow

Fuer den Selfie-Pfad existiert ein eigener persistenter `selfie_state` mit `slideshow_enabled`, `slideshow_interval_seconds`, `slideshow_shuffle`, `moderation_mode` und `slideshow_updated_at`. Es gibt zwei Modi:

- `auto_approve`: neue verarbeitete Uploads werden direkt sichtbar
- `manual_approve`: neue verarbeitete Uploads bleiben `pending`, bis ein Admin sie freigibt

Ein Wechsel des Moderationsmodus wirkt in AP4 nur auf neue Uploads. Bereits vorhandene `approved`, `pending` oder `rejected` Uploads werden nicht still umgeschrieben.

## Event-Branding AP7

AP7 fuehrt die Runtime-Branding-Werte sichtbar ein:

- `EVENT_NAME` steuert die sichtbare Event-Bezeichnung
- `EVENT_TAGLINE` ergaenzt einen ruhigen Untertitel fuer Guest, Admin und Display
- `DISPLAY_OVERLAY_ENABLED` steuert das dezente Branding-Overlay auf Selfie- und Visualizer-Screens
- `GET /api/public-info` liefert diese Branding- und Zugangsinfos ohne Admin-Session fuer Guest- und Display-Clients

## Event-UX AP7

AP7 schaerft die sichtbaren Event-Flows:

- Guest-Upload kommuniziert Moderationsmodus, Limit und Fehler verstaendlicher
- Admin-Dashboard zeigt Event-, Guest-, Admin- und Display-Zugangsinfos plus QR-Hinweise direkt im UI
- Idle ist als sichtbarer Standby-Screen ausgebaut
- Blackout bleibt bewusst dunkel und minimal
- Selfie- und Visualizer-Renderer wirken im Betrieb ruhiger und runder

## Display-Recovery

Die Display-Seite laedt ihren Startzustand weiterhin aus dem Backend und haelt danach nur eine SSE-Verbindung. AP6 erweitert diesen Pfad um:

- defensives Parsen fehlerhafter Event-Payloads
- Backoff-Reconnect fuer SSE
- periodischen Heartbeat mit Renderer- und Sync-Status
- stabilen Wechsel zwischen `visualizer`, `selfie`, `idle` und `blackout`, ohne alte Timer oder Animation-Loops weiterlaufen zu lassen

Die produktive Display-Architektur ist damit direkt:

1. der Raspberry Pi bleibt Source of Truth fuer Uploads, Moderation, Admin, API und Zustande
2. der Display-Client auf dem Mac oeffnet direkt `http://<PI-IP>:8085/display`
3. nach dem initialen Laden synchronisiert sich das Frontend ueber `GET /api/events/stream`
4. eingehende Events aktualisieren nur den lokalen Pinia-State; die Seite laedt nicht komplett neu

Display-relevante Live-Events auf dem zentralen SSE-Stream sind unter anderem:

- `public_runtime_snapshot`
- `public_runtime_updated`
- `mode_snapshot`
- `mode_changed`
- `selfie_snapshot`
- `selfie_settings_updated`
- `selfie_playback_updated`
- `standby_snapshot`
- `standby_settings_updated`
- `video_snapshot`
- `video_settings_updated`
- `video_library_snapshot`
- `video_library_updated`
- `visualizer_snapshot`
- `visualizer_updated`
- `visualizer_preset_changed`
- `visualizer_auto_cycle_updated`
- `upload_created`
- `upload_approved`
- `upload_rejected`
- `upload_deleted`

## Appliance-Flow

AP5 etabliert einen separaten Zielbetrieb fuer den Raspberry Pi:

1. Host startet
2. lokales WLAN/Access Point wird bereit
3. `raveberg-stack.service` startet den Compose-Stack
4. `ops/pi/wait-for-url.sh` wartet auf die lokale App
5. `raveberg-kiosk.service` startet Chromium im Fullscreen-Kiosk auf `/display`

Die vorbereiteten Dateien liegen unter [ops/README.md](ops/README.md), [env.appliance.example](ops/pi/env.appliance.example), [start-kiosk.sh](ops/pi/start-kiosk.sh), [raveberg-stack.service](ops/systemd/raveberg-stack.service) und [raveberg-kiosk.service](ops/systemd/raveberg-kiosk.service).

Fuer oeffentliche Guest-Upload-Links gilt:

- `GUEST_UPLOAD_URL` in `ops/pi/env.appliance` setzt den QR- und Upload-Link explizit
- wenn `GUEST_UPLOAD_URL` leer bleibt, faellt das System auf `PUBLIC_BASE_URL + GUEST_UPLOAD_PATH` zurueck
- das Hilfsskript [`ops/pi/set-guest-upload-url.sh`](/Users/admin/Documents/raveBerg/ops/pi/set-guest-upload-url.sh) aktualisiert die Variable ohne manuelles Editieren

## Mac-Display

Der bevorzugte Produktivpfad fuer einen starken Mac/PC ist kein Stream-Relay, sondern die direkte Display-Seite des Pi:

```text
http://<PI-IP>:8085/display
```

Empfohlene Betriebsweise:

1. im Adminbereich `Render-Modus = local` lassen
2. auf dem Mac Chrome oder Chromium im Vollbild/Kiosk auf `/display` starten
3. der Pi bleibt Backend-/Event-Server; der Mac rendert die Buehne direkt im Browser

Manueller Start:

```text
http://<PI-IP>:8085/display
```

Pragmatisches macOS-Startskript:

```bash
chmod +x ops/mac/start-display-client.sh
ops/mac/start-display-client.sh http://<PI-IP>:8085/display
```

Das Skript oeffnet Chrome oder Chromium in einem neuen Vollbild-Fenster. Es ist bewusst leichtgewichtig und ersetzt keine groessere native macOS-Automation.

Warum dieser Pfad fluessiger ist:

- kein Screenshot-/MJPEG-/HLS-Zwischenschritt
- kein zweiter Renderprozess
- direkte GPU-/Browser-Renderpipeline auf dem Mac
- State-Aktualisierung nur ueber kleine SSE-Events statt per Stream-Reencoding

Fallback im Eventbetrieb:

- der Pi bleibt jederzeit Source of Truth
- wenn der Mac oder der Browser abstuerzt, wird auf dem Mac einfach erneut `http://<PI-IP>:8085/display` geoeffnet
- Uploads, Moderation und Admin laufen waehrenddessen auf dem Pi weiter
- als schnelle Reserve bleibt die lokale Pi-Display-URL verfuegbar:

```text
http://localhost:8085/display
```

Der bestehende `renderer_headless` bleibt im Repo als experimenteller oder alternativer Pfad erhalten, ist aber nicht mehr der primaere Produktivweg fuer die Buehne.

## AP7-Grenzen

AP7 implementiert bewusst keinen kompletten Theme-Editor, keine Logo-/Video-Uploads, kein i18n-System und kein umfassendes grafisches Rebranding des gesamten Projekts. Die sichtbaren Verbesserungen bleiben absichtlich leichtgewichtig und bauen auf der bestehenden Struktur auf.

Weitere technische Details stehen in [docs/AP0.md](docs/AP0.md), [docs/AP1.md](docs/AP1.md), [docs/AP2.md](docs/AP2.md), [docs/AP3.md](docs/AP3.md), [docs/AP4.md](docs/AP4.md), [docs/AP5.md](docs/AP5.md), [docs/AP6.md](docs/AP6.md) und [docs/AP7.md](docs/AP7.md).
