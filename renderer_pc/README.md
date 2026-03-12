# Renderer PC Prototype

Kleiner lokaler Prototyp fuer einen "Renderer-PC"-Streamer, der einen animierten Visualizer rendert und als MJPEG-/HTTP-Stream ausliefert.

## Was der Prototyp macht

- rendert lokal einen generativen, animierten Background
- liefert MJPEG ueber HTTP unter `/stream`
- ist im lokalen Netzwerk erreichbar
- ist bewusst einfach gehalten: ein Python-Prozess, keine UI, kein WebRTC, kein Docker-Zwang

## Projektstruktur

```text
renderer_pc/
├── README.md
├── requirements.txt
└── server.py
```

## Voraussetzungen

- Python 3.11 oder neuer empfohlen
- macOS oder Linux/PC mit Python

## Installation

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Start

Standardstart:

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc
source .venv/bin/activate
python3 server.py
```

Der Stream liegt dann standardmaessig hier:

- Vorschau im Browser: `http://127.0.0.1:9001/`
- MJPEG-Stream: `http://127.0.0.1:9001/stream`
- Snapshot: `http://127.0.0.1:9001/snapshot.jpg`

Im Netzwerk ist der Stream ueber die IP des Renderer-PCs erreichbar, zum Beispiel:

- `http://192.168.178.50:9001/stream`

## Konfiguration

Alle wichtigen Parameter koennen per CLI gesetzt werden:

```bash
python3 server.py \
  --host 0.0.0.0 \
  --port 9001 \
  --width 1920 \
  --height 1080 \
  --fps 20 \
  --jpeg-quality 82
```

Verfuegbare Optionen:

- `--host`
- `--port`
- `--width`
- `--height`
- `--fps`
- `--jpeg-quality`

## Test auf dem Raspberry Pi

1. Den Stream auf dem Mac/PC starten.
2. Die IP-Adresse des Renderer-PCs herausfinden.
3. Auf dem Raspberry Pi in Chromium oeffnen:

```text
http://<RENDERER-PC-IP>:9001/stream
```

Wenn der Stream direkt im Browser sichtbar ist, ist der Prototyp fuer den naechsten Integrationsschritt brauchbar.

## Hinweise zur spaeteren Nutzung in RaveBerg

Spaeter kann der Raspberry Pi diesen Stream einfach als externe Hintergrund-Quelle laden, zum Beispiel:

- direkt per `<img src="http://<RENDERER-PC-IP>:9001/stream">`
- oder als dedizierte Visualizer-/Background-Ansicht in der Display-Oberflaeche

Da MJPEG aus einzelnen JPEG-Frames ueber HTTP besteht, ist der Ansatz robust und leicht zu debuggen. Fuer den Prototyp ist das sinnvoll; spaeter kann bei Bedarf auf effizientere Transportwege wie WebRTC oder HLS umgestellt werden.
