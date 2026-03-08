# AP3 Technische Orientierung

## Zielbild

AP3 macht den Visualizer-Modus erstmals produktiv nutzbar:

- persistenter serverseitiger Visualizer-State
- Live-Steuerung aus dem Admin-Dashboard
- Canvas-basierter Display-Renderer fuer `visualizer`
- stabile Umschaltung zwischen `visualizer`, `selfie`, `blackout` und `idle`
- weiterhin zentrales SSE-System statt Polling

## Visualizer-Fachmodell

Der globale App-Mode bleibt die fachliche Oberkante:

- `visualizer`
- `selfie`
- `blackout`
- `idle`

Fuer den eigentlichen Visualizer existiert ein eigener Zustand:

- `active_preset`
- `intensity`
- `speed`
- `brightness`
- `color_scheme`
- `updated_at`

Dieser Zustand ist serverseitig die Quelle der Wahrheit und bleibt nach Neustarts erhalten.

## Datenmodell

Tabelle: `visualizer_state`

- `id`
- `active_preset`
- `intensity`
- `speed`
- `brightness`
- `color_scheme`
- `updated_at`

AP3 arbeitet bewusst mit genau einem aktiven Datensatz. Das haelt den Steuerpfad einfach, ohne spaetere Erweiterungen auf mehrere Visualizer-Profile zu verbauen.

## API

### `GET /api/visualizer`

- liefert den aktuell aktiven Visualizer-State
- fuer Display und Admin nutzbar

### `PUT /api/visualizer`

- nur fuer `admin`
- aktualisiert `active_preset`, `intensity`, `speed`, `brightness`, `color_scheme`
- validiert Presetnamen, Farbschema und Wertebereiche serverseitig

### `GET /api/visualizer/presets`

- liefert erlaubte Presets und Farbschemata fuer das Frontend

## Presets

In AP3 umgesetzt:

- `tunnel`
- `particles`
- `waves`
- `kaleidoscope`

Die Namen sind stabil und serverseitig validiert. Neue Presets werden spaeter ueber drei Schritte ergaenzt:

1. Presetname in Backend-Validierung und Optionen aufnehmen
2. Render-Funktion in `VisualizerRenderer` ergaenzen
3. Preset in der Admin-Auswahl sichtbar machen

## Farbwelten

In AP3 umgesetzt:

- `mono`
- `acid`
- `ultraviolet`
- `redline`

Die Farbwelten werden serverseitig validiert und im Renderer auf unterschiedliche Paletten abgebildet.

## Wertebereiche

Serverseitig begrenzt:

- `speed`: `0..100`
- `intensity`: `0..100`
- `brightness`: `0..100`

Dadurch gelangen keine unkontrollierten Werte in das Rendering. Der Renderer selbst behandelt fehlende oder ungueltige Werte zusaetzlich robust.

## Live-Update-Mechanik

Zentraler Stream:

- `GET /api/events/stream`

Relevante Events in AP3:

- `mode_snapshot`
- `mode_changed`
- `visualizer_snapshot`
- `visualizer_updated`
- `visualizer_preset_changed`
- `upload_created`

Flow bei einer Visualizer-Aenderung:

1. Admin aendert Werte im Dashboard
2. Frontend ruft `PUT /api/visualizer`
3. Backend speichert den Zustand in PostgreSQL
4. Backend broadcastet `visualizer_updated`
5. bei Presetwechsel zusaetzlich `visualizer_preset_changed`
6. Display uebernimmt die neuen Werte ohne Reload

## Frontend-Aufbau

### Admin-Dashboard

`src/views/admin/AdminDashboardView.vue` enthaelt:

- Preset-Auswahl
- Farbwelt-Auswahl
- Slider fuer `speed`, `intensity`, `brightness`
- operative Statusanzeige fuer aktuellen Mode, aktives Preset, letzten Update-Zeitpunkt und SSE-Verbindung

### Display

`src/views/display/DisplayView.vue` entscheidet anhand des globalen Modes ueber den aktiven Renderer:

- `visualizer` -> `VisualizerRenderer`
- `selfie` -> `SelfieRenderer`
- `blackout` -> `BlackoutRenderer`
- `idle` -> `IdleRenderer`

## Renderer-Technik

`VisualizerRenderer` nutzt bewusst einen leichten Canvas-2D-Ansatz statt eines groesseren Grafik-Stacks:

- keine schweren externen Rendering-Libraries
- eine Animation-Loop per `requestAnimationFrame`
- Resize-Handling fuer Fullscreen-Projektion
- Cleanup bei Unmount, damit keine Loops oder Listener haengen bleiben

Der Fokus liegt in AP3 auf fluessiger 1080p-Darstellung und stabiler Live-Steuerung auf Raspberry-Pi-Hardware.

## Stabilitaet

In AP3 explizit beruecksichtigt:

- Cleanup der Animation-Loop bei Renderer-Wechsel
- sauberes Schliessen von SSE-Verbindungen
- keine Polling-Fallbacks mehr fuer den Display-State
- Visualizer- und Selfie-Renderer laufen nie parallel sichtbar
- Display laedt den aktuellen Visualizer-State beim Start aktiv aus dem Backend

## Bewusste Vereinfachungen in AP3

- kein Audio-Input und keine Beat-Detection
- keine Shader-Editoren oder frei definierbaren Presets
- genau ein aktiver persistenter Visualizer-State statt Preset-Verwaltung per CRUD
- `blackout` und `idle` sind funktional vorbereitet, aber bewusst minimal gehalten

## Offene Punkte fuer AP4+

- Audio-Reaktivitaet
- mehr Presets oder preset-spezifische Zusatzparameter
- feinere Performance-Profile fuer unterschiedliche Hardware
- komplexeres Preset-Management mit mehreren gespeicherten Setups
- weitergehende Display-Synchronisation fuer mehrere Projektionen
