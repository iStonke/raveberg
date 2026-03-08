# RAVEBERG AP5

AP5 erweitert das AP4-System in Richtung Raspberry-Pi-Appliance: vorbereiteter Kiosk-Betrieb, Pi-spezifische Runtime-Struktur, Access-Point-Konzept und robusterer Display-Dauerbetrieb. Das Repository enthaelt weiterhin einen containerisierten Entwicklungsstack mit Vue 3 + Vuetify, FastAPI, PostgreSQL und einem Reverse Proxy mit konfliktfreier Host-Portbelegung.

## Host-Ports

| Service | Host-Port | Zweck |
| --- | --- | --- |
| Proxy | `8085` | Primaerer Einstiegspunkt |
| Frontend | `5180` | Direkter Zugriff auf das Vite-Frontend |
| Backend | `8050` | Direkter API-Zugriff fuer Entwicklung |
| PostgreSQL | `5435` | Direkter Datenbankzugriff |

Nicht verwendet werden die im Projektbrief ausgeschlossenen Standardports wie `5173`, `8000` oder `5432` auf Host-Ebene.

## Projektstruktur

- `frontend/`: Vue-Client mit Vuetify, Pinia, Auth-Guards, Guest-Upload, Moderations-Dashboard und Display-Renderern
- `backend/`: FastAPI-API mit Konfiguration, Datenbankschicht, Auth, Upload-Pipeline, Moderation, Visualizer-State, Selfie-State, SSE, Appliance-Metadaten und Alembic
- `proxy/`: Nginx-Konfiguration fuer den gebuendelten Einstiegspunkt
- `ops/`: Pi-/Appliance-Skripte, systemd-Units und AP-Beispielkonfigurationen
- `docs/`: technische Orientierung fuer AP0 bis AP5

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
- `GET /api/visualizer`
- `PUT /api/visualizer`
- `GET /api/visualizer/presets`

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

Der globale App-Mode entscheidet weiterhin nur zwischen `visualizer`, `selfie`, `blackout` und `idle`. Fuer den Visualizer existiert zusaetzlich ein eigener serverseitiger Zustand mit `active_preset`, `intensity`, `speed`, `brightness`, `color_scheme` und `updated_at`. Admins lesen und aendern diesen Zustand ueber `GET /api/visualizer` und `PUT /api/visualizer`. Nach jeder Aenderung sendet das Backend `visualizer_updated`; bei Presetwechsel zusaetzlich `visualizer_preset_changed`. Das Display abonniert weiterhin nur den zentralen SSE-Stream und uebernimmt Aenderungen ohne Reload.

## Moderations-Flow

Fuer den Selfie-Pfad existiert ein eigener persistenter `selfie_state` mit `slideshow_enabled`, `slideshow_interval_seconds`, `slideshow_shuffle`, `moderation_mode` und `slideshow_updated_at`. Es gibt zwei Modi:

- `auto_approve`: neue verarbeitete Uploads werden direkt sichtbar
- `manual_approve`: neue verarbeitete Uploads bleiben `pending`, bis ein Admin sie freigibt

Ein Wechsel des Moderationsmodus wirkt in AP4 nur auf neue Uploads. Bereits vorhandene `approved`, `pending` oder `rejected` Uploads werden nicht still umgeschrieben.

## Appliance-Flow

AP5 etabliert einen separaten Zielbetrieb fuer den Raspberry Pi:

1. Host startet
2. lokales WLAN/Access Point wird bereit
3. `raveberg-stack.service` startet den Compose-Stack
4. `ops/pi/wait-for-url.sh` wartet auf die lokale App
5. `raveberg-kiosk.service` startet Chromium im Fullscreen-Kiosk auf `/display`

Die vorbereiteten Dateien liegen unter [ops/README.md](ops/README.md), [env.appliance.example](ops/pi/env.appliance.example), [start-kiosk.sh](ops/pi/start-kiosk.sh), [raveberg-stack.service](ops/systemd/raveberg-stack.service) und [raveberg-kiosk.service](ops/systemd/raveberg-kiosk.service).

## AP5-Grenzen

AP5 implementiert bewusst noch keine vollautomatische AP-Einrichtung fuer beliebige Distributionen, kein Captive Portal, keine Cloud-Anbindung und kein OTA-Update-System. Die vorbereiteten Ops-Dateien definieren einen klaren empfohlenen Weg fuer Raspberry Pi OS, ohne Host-Setups magisch wegzuabstrahieren.

Weitere technische Details stehen in [docs/AP0.md](docs/AP0.md), [docs/AP1.md](docs/AP1.md), [docs/AP2.md](docs/AP2.md), [docs/AP3.md](docs/AP3.md), [docs/AP4.md](docs/AP4.md) und [docs/AP5.md](docs/AP5.md).
