# AP0 Technische Orientierung

## Zielbild

AP0 liefert ein stabiles Grundsystem fuer lokale Entwicklung und spaeteren Raspberry-Pi-Betrieb:

- Docker-Compose als zentrale Betriebsbasis
- Vue 3 + Vuetify fuer Guest/Admin/Display
- FastAPI als API und Quelle der Wahrheit fuer den globalen Modus
- PostgreSQL mit vorbereiteter Migrationsstruktur
- Nginx als Reverse Proxy auf Host-Port `8085`

## Services

| Service | Intern | Extern | Aufgabe |
| --- | --- | --- | --- |
| `proxy` | `80` | `8085` | Leitet `/` an das Frontend und `/api` an das Backend weiter |
| `frontend` | `5173` | `5180` | Vue/Vite/Vuetify-Client fuer Guest/Admin/Display |
| `backend` | `8000` | `8050` | FastAPI-API, Mode-State, Health, Systemstatus, Auth-Basis |
| `db` | `5432` | `5435` | PostgreSQL fuer persistente App-Daten |

## Persistenz

Vorgesehene Docker-Volumes:

- `postgres_data`: Datenbank
- `app_data`: allgemeine App-Datenbasis
- `upload_data`: vorbereitete Upload-Ablage fuer spaetere APs
- `display_cache`: vorbereitete Display-/Rendering-Ablage

## Frontend-Aufbau

- `src/router`: Routen mit Guard fuer Admin-Bereich
- `src/layouts/AppShellLayout.vue`: Guest/Admin-Rahmen mit minimaler Navigation
- `src/layouts/DisplayLayout.vue`: bewusste Vollbildflaeche ohne Stoer-UI
- `src/stores/auth.ts`: Admin-Session-Basis
- `src/stores/appMode.ts`: zentrale FE-Sicht auf den globalen Modus
- `src/stores/systemStatus.ts`: Health-/Systemdaten
- `src/stores/displayStatus.ts`: Display-spezifische Ableitungen

## Backend-Aufbau

- `app/api/routes`: Endpunkte fuer Health, Mode, System und Auth
- `app/core`: Settings und Sicherheitshelfer
- `app/db`: SQLAlchemy-Engine, Session, Base
- `app/models`: vorbereitete Persistenzmodelle
- `app/schemas`: API-Schemas
- `app/services`: fachliche Kapselung fuer Mode, System und Auth
- `alembic/`: Migrationsbasis fuer spaetere APs

## Aktueller Modusfluss

1. Beim Backend-Start stellt `ModeService.ensure_state()` sicher, dass ein globaler `app_state` existiert.
2. `GET /api/mode` liefert den aktuellen Modus.
3. `PUT /api/mode` aktualisiert den Modus und setzt `updated_at`.
4. Das Frontend liest den Modus ueber den `appMode`-Store.
5. Die Display-Ansicht schaltet zwischen Platzhaltern fuer `visualizer` und `selfie`.

## Offene Punkte fuer AP1+

- echte Admin-Authentifizierung mit Session-/Token-Haertung
- Upload-Workflow inkl. Dateiablage, Moderation und Formate
- Renderer fuer Visualizer und Selfie-Slideshow
- Settings-Management jenseits des Minimalzustands
- Echtzeit-Synchronisierung per WebSocket oder SSE
- Rollen-/Rechtemodell ueber `guest` und `admin` hinaus
