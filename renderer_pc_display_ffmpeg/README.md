# Remote Full Display Renderer (ffmpeg + H.264/HLS)

Pragmatischer Prototyp fuer "Remote Full Display Rendering" in RAVEBERG.

Die Architektur bleibt bewusst gleich:

1. Der Raspberry Pi liefert weiter die echte Display-Seite, z. B. `http://192.168.178.92:8085/display`
2. Ein starker Mac oeffnet diese Seite in einem normalen Chrome-/Chromium-Fenster
3. `ffmpeg` capturt den definierten Bildschirmbereich per `avfoundation`
4. Der Hauptpfad wird jetzt als **H.264/HLS** ausgegeben
5. Der Renderer laeuft bewusst als **HLS-only**-Prototyp

## Warum H.264 statt MJPEG?

MJPEG uebertraegt jedes Frame als einzelnes JPEG-Bild. Das ist einfach und robust, aber auf dem Raspberry Pi teuer:

- mehr Netzlast
- mehr Decode-Last im Browser
- schlechtere zeitliche Effizienz

H.264 ist fuer kontinuierliches Video deutlich effizienter:

- weniger Bandbreite
- deutlich bessere Hardware-Decode-Chancen
- voraussichtlich spuerbar geringere CPU-Last auf dem Pi

## Projektstruktur

```text
renderer_pc_display_ffmpeg/
├── README.md
├── requirements.txt
└── server.py
```

## Pipeline

- Browser: rendert `/display` des Raspberry Pi in einem festen Fenster
- Screen Capture: `ffmpeg` liest den Bildschirm per `avfoundation`
- Crop: `ffmpeg` schneidet den definierten Bereich heraus
- Hauptausgabe: H.264 als HLS-Playlist mit Segmenten

Wichtig:

- kein Playwright-Screenshot-Loop
- kein neuer Renderer
- keine Verlagerung der Business-Logik

## Voraussetzungen

- macOS
- Python 3.11 oder neuer
- `ffmpeg` installiert
- Google Chrome oder Chromium installiert

Beispiel mit Homebrew:

```bash
brew install ffmpeg
```

## macOS-Rechte

Der wichtigste Punkt auf macOS:

- Der Terminal-Prozess oder die Python-Umgebung braucht **Screen Recording**-Rechte
- Chrome/Chromium braucht normalen Browser-/Netzwerkzugriff

Freigaben setzen:

1. `System Settings`
2. `Privacy & Security`
3. `Screen Recording`
4. Terminal / iTerm / Codex / Python erlauben

Ohne diese Freigabe kann `ffmpeg` den Bildschirm nicht capturen.

## Installation

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc_display_ffmpeg
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Screen-Device finden

Vor dem ersten Start ist es sinnvoll, die von `ffmpeg` erkannten macOS-Screens zu listen:

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc_display_ffmpeg
source .venv/bin/activate
python3 server.py --list-screen-devices
```

In der Ausgabe taucht typischerweise ein Eintrag wie `Capture screen 0` oder aehnlich auf.

## Browserstart

Der Dienst startet Chrome/Chromium selbst mit:

- `--app=<display-url>`
- `--kiosk`
- `--new-window`
- festem `--window-position`
- fester `--window-size`
- reduziertem UI-Overhead

Ziel:

- moeglichst stoerungsfreies Display-Fenster
- definierter Bereich fuer das Screen-Capture

Wichtig:

- Der Capture-Bereich muss zum Browserfenster passen
- Andere Fenster duerfen diesen Bereich nicht ueberdecken

## Hauptausgabe

Die bevorzugte neue Ausgabe ist:

- **HLS mit H.264**

Warum diese Variante:

- lokal und im Netzwerk gut testbar
- robust mit `ffmpeg`
- fuer Browser und Player nachvollziehbar
- deutlich sinnvoller fuer produktionsnaehere Tests als MJPEG

Standard-Ausgabepfad fuer HLS-Dateien:

- `/Users/admin/Documents/raveBerg/renderer_pc_display_ffmpeg/runtime/hls/`

Dort schreibt `ffmpeg`:

- `playlist.m3u8`
- `segment_*.ts`

Dieser Ordner wird beim Start explizit vorbereitet und vom HTTP-Server unter `/hls/...` ausgeliefert.

## Start

Beispiel:

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc_display_ffmpeg
source .venv/bin/activate
python3 server.py \
  --display-url http://192.168.178.92:8085/display \
  --width 1920 \
  --height 1080 \
  --fps 20 \
  --host 0.0.0.0 \
  --port 9003 \
  --screen-device 1 \
  --browser-x 0 \
  --browser-y 0 \
  --capture-x 0 \
  --capture-y 0 \
  --encoder h264_videotoolbox \
  --video-bitrate 5000k \
  --maxrate 6500k \
  --bufsize 10000k \
  --hls-time 1 \
  --hls-list-size 4
```

Wenn dein Screen-Device z. B. `4` ist:

```bash
python3 server.py --display-url http://192.168.178.92:8085/display --screen-device 4
```

## Wichtige Parameter

- `--display-url`
- `--width`
- `--height`
- `--fps`
- `--host`
- `--port`
- `--browser-path`
- `--ffmpeg-path`
- `--browser-x`
- `--browser-y`
- `--capture-x`
- `--capture-y`
- `--screen-device`
- `--encoder`
- `--video-bitrate`
- `--maxrate`
- `--bufsize`
- `--hls-time`
- `--hls-list-size`
- `--hls-directory`

Wenn `--hls-directory` nicht gesetzt ist, wird standardmaessig der feste Projektpfad verwendet:

```text
/Users/admin/Documents/raveBerg/renderer_pc_display_ffmpeg/runtime/hls
```

## Encoder

Standard:

- `h264_videotoolbox`

Das ist auf macOS die pragmatische erste Wahl, weil es in vielen Faellen hardwarebeschleunigt arbeitet.

Fallback moeglich:

```bash
python3 server.py --encoder libx264
```

## HTTP-Endpunkte

### Betriebs-/Hauptpfad

- HLS-Playlist: `http://localhost:9003/hls/playlist.m3u8`
- Alias: `http://localhost:9003/video`

### Preview

- `http://localhost:9003/preview`

Die Preview-Seite versucht zuerst native HLS-Wiedergabe und nutzt sonst `hls.js` aus einem CDN.

### Debug

- Health: `http://localhost:9003/health`
- HLS-Dateien: `http://localhost:9003/hls/playlist.m3u8`

## Test im lokalen Browser

Empfohlener Test:

```text
http://localhost:9003/preview
```

Direkter HLS-Pfad:

```text
http://localhost:9003/hls/playlist.m3u8
```

## Test auf dem Raspberry Pi

Wenn der Renderer-Mac z. B. unter `192.168.178.22` erreichbar ist:

### Bevorzugter Pfad

```text
http://192.168.178.22:9003/hls/playlist.m3u8
```

### Preview-Seite

```text
http://192.168.178.22:9003/preview
```

## Health / Debug

`/health` zeigt weiterhin:

- `browser_running`
- `browser_pid`
- `ffmpeg.running`
- `ffmpeg.output_mode`
- `ffmpeg.stderr_tail`
- `ffmpeg.last_stderr_at`
- `ffmpeg.encoder`
- `ffmpeg.hardware_encoding`
- `preferred_output`

Woran man erkennt, dass die Pipeline sauber laeuft:

- `browser_running: true`
- `ffmpeg.running: true`
- `ffmpeg.output_mode: hls_only`
- `preferred_output.directory` zeigt auf den erwarteten absoluten HLS-Ordner
- `preferred_output.playlist_path` zeigt auf die erwartete Playlist-Datei
- `preferred_output.playlist_exists: true`
- `preferred_output.segment_count > 0`
- `preferred_output.ready: true`
- `preferred_output.latest_segment_updated_at` und `preferred_output.recent_activity_at` bewegen sich weiter

Zusätzlich direkt auf Dateiebene pruefbar:

```bash
cd /Users/admin/Documents/raveBerg/renderer_pc_display_ffmpeg
find runtime/hls -maxdepth 2 \( -name "*.m3u8" -o -name "*.ts" \)
```

Wenn alles funktioniert, solltest du mindestens sehen:

- `runtime/hls/playlist.m3u8`
- mehrere `runtime/hls/segment_*.ts`

## Bekannte Grenzen

- Der Prototyp capturt einen **Bildschirmbereich**, nicht direkt ein einzelnes Browserfenster
- Andere Fenster duerfen diesen Bereich nicht ueberdecken
- Die Preview-Seite nutzt fuer Chromium-basierte Browser bei Bedarf `hls.js` aus einem CDN
- Es ist noch keine WebRTC- oder Produktionsarchitektur
- `/snapshot.jpg` und `/stream` sind im HLS-only-Modus bewusst deaktiviert

## Einschätzung

Diese neue H.264/HLS-Ausgabe sollte fuer den Raspberry Pi voraussichtlich **deutlich effizienter als MJPEG** sein, weil:

- weniger Daten uebertragen werden
- H.264-Video fuer kontinuierliche Wiedergabe optimiert ist
- Browser und Hardware typischerweise besser mit H.264 umgehen als mit dauerhaften JPEG-Einzelbildern

## Ausblick

Ein sinnvoller naechster Schritt Richtung Produktion waere:

1. denselben Capture-Pfad beibehalten
2. HLS weiter optimieren oder auf CMAF/fMP4 umstellen
3. spaeter WebRTC oder einen anderen interaktiveren Pfad ergaenzen
4. Browserfenster-Management und Recovery weiter haerten
