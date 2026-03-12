# Remote Full Display Renderer

Kleiner Prototyp fuer einen starken Renderer-PC, der die bestehende RAVEBERG-Display-Seite des Raspberry Pi rendert und als MJPEG-/HTTP-Stream ausliefert.

## Was der Prototyp macht

- laedt die Pi-Display-Seite, z. B. `http://192.168.178.38:8085/display`
- rendert sie in Chromium ueber Playwright
- erzeugt fortlaufend JPEG-Frames
- liefert diese als MJPEG-Stream aus

Ziel-URL auf dem Renderer-PC:

- `http://<PC-IP>:9002/stream`

## Projektstruktur

```text
renderer_pc_display/
├── README.md
├── requirements.txt
└── server.py
```

## Voraussetzungen

- Python 3.11 oder neuer empfohlen
- macOS oder Linux/Windows mit Chromium-Unterstuetzung fuer Playwright
- Netzwerkzugriff vom Renderer-PC auf die Pi-Display-Seite

## Installation

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc_display
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Start

Beispiel:

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc_display
source .venv/bin/activate
python3 server.py \
  --display-url http://192.168.178.38:8085/display \
  --width 1920 \
  --height 1080 \
  --fps 20 \
  --jpeg-quality 80 \
  --host 0.0.0.0 \
  --port 9002
```

Danach erreichbar:

- Vorschau: `http://localhost:9002/preview`
- MJPEG-Stream: `http://localhost:9002/stream`
- Snapshot: `http://localhost:9002/snapshot.jpg`
- Health: `http://localhost:9002/health`

## CLI-Optionen

- `--display-url`
- `--width`
- `--height`
- `--fps`
- `--jpeg-quality`
- `--host`
- `--port`

Standardwerte:

- Display-URL: `http://192.168.178.38:8085/display`
- Aufloesung: `1920x1080`
- FPS: `20`
- JPEG-Qualitaet: `80`
- Port: `9002`

## Test im Browser

1. Renderer-PC starten.
2. Im Browser oeffnen:

```text
http://localhost:9002/preview
```

oder direkt:

```text
http://localhost:9002/stream
```

## Test auf dem Raspberry Pi

Wenn der Renderer-PC im Netzwerk unter `192.168.178.22` erreichbar ist:

```text
http://192.168.178.22:9002/stream
```

Diese URL kann der Pi spaeter im Browser oder in einer dedizierten Background-/Display-Komponente laden.

## Hinweise

- Chromium wird nur einmal gestartet und die Display-Seite dauerhaft offen gehalten.
- Der Prototyp capturt kontinuierlich Frames aus dem gerenderten Chromium-Tab und streamt sie als MJPEG.
- Fuer die erste Version ist der Capture-Pfad auf stabile Playwright-Screenshots optimiert.
- Wenn spaeter echtes Desktop-Capturing des Browserfensters getestet werden soll, ist `mss` bereits vorbereitet. Optional:

```bash
RAVEBERG_CAPTURE_BACKEND=mss python3 server.py --display-url http://192.168.178.38:8085/display
```

## Ergebnis

Der Renderer-PC kann damit:

1. die komplette RAVEBERG-Display-Seite des Pi rendern
2. sie als MJPEG-Stream ausliefern
3. dem Raspberry Pi einen fertigen Display-Stream bereitstellen

Beispiel:

```text
http://192.168.178.22:9002/stream
```
