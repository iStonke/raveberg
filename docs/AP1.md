# AP1 Technische Orientierung

## Zielbild

AP1 macht das System erstmals praktisch steuerbar:

- echte Admin-Authentifizierung mit gehashten Passwoertern
- serverseitige Rollenpruefung fuer Admin-Funktionen
- Live-Moduswechsel fuer Displays ohne Polling
- vorbereitete Display-Renderer fuer `visualizer` und `selfie`

## Rollenmodell

### `guest`

- darf nur offene Guest-Routen wie `/guest/upload` nutzen
- hat keinen Zugriff auf Dashboard, Systemstatus oder Modussteuerung

### `admin`

- darf `/admin/dashboard` aufrufen
- darf `GET /api/system` lesen
- darf `PUT /api/mode` ausfuehren

Die Autorisierung wird im Backend ueber `require_admin_user()` durchgesetzt.

## Auth-Flow

1. Beim Backend-Start ruft `AuthService.ensure_initial_admin()` das Initial-Seeding auf.
2. Der Benutzer wird in `admin_users` mit `password_hash` gespeichert.
3. `POST /api/auth/login` erzeugt ein zufaelliges Bearer-Token und legt dessen Hash in `admin_sessions` ab.
4. `GET /api/auth/session` liefert den aktuellen eingeloggten Benutzer nur bei gueltiger serverseitiger Session.
5. `POST /api/auth/logout` entfernt die Session serverseitig.

## Relevante Tabellen

- `admin_users`
  - `id`
  - `username`
  - `password_hash`
  - `role`
  - `created_at`
  - `active`
- `admin_sessions`
  - `id`
  - `user_id`
  - `token_hash`
  - `created_at`
  - `expires_at`
- `app_state`
  - `id`
  - `mode`
  - `source`
  - `updated_at`

## Mode-System

- Backend-Enum: `visualizer`, `selfie`, `blackout`, `idle`
- AP1 nutzt aktiv `visualizer` und `selfie`
- `GET /api/mode` ist lesbar fuer Display und Frontend
- `PUT /api/mode` ist nur fuer `admin` erlaubt

## Event-System

- Transport: Server-Sent Events
- Endpunkt: `GET /api/mode/stream`
- Event-Typen:
  - `mode_snapshot`: initialer Zustand direkt nach Verbindungsaufbau
  - `mode_changed`: Broadcast nach erfolgreicher Modusaenderung

`EventService` verwaltet mehrere Subscriber gleichzeitig und ist damit auf mehrere gleichzeitige Displays vorbereitet.

## Frontend-Aufbau

- `src/stores/auth.ts`: Token, User, Rolle, Sessionstatus
- `src/router/index.ts`: Guard fuer `/admin/*`
- `src/views/admin/AdminDashboardView.vue`: Modussteuerung und Systemstatus
- `src/views/display/DisplayView.vue`: SSE-Verbindung und Renderer-Auswahl
- `src/components/display/VisualizerRenderer.vue`
- `src/components/display/SelfieRenderer.vue`

## Verifikation in AP1

Geprueft wurden:

- erfolgreicher Login fuer den Initial-Admin
- gueltige Session-Abfrage
- Logout mit ungueltiger Session danach
- serverseitig blockierter Zugriff auf geschuetzte Endpunkte ohne Bearer-Token
- erfolgreicher Moduswechsel mit Admin-Session
- sofortiges `mode_changed`-Event ueber SSE

## Offene Punkte fuer AP2+

- Auth-Haertung mit Rotation, CSRF-/Cookie-Strategie oder JWT-Alternative
- Guest-Upload-Flow mit echter Dateiannahme
- Renderer mit echter Visualizer- bzw. Slideshow-Logik
- Moderation, Settings und Live-Steuerung fuer weitere Systembereiche
