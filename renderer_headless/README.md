# Headless Full Display Renderer

Pragmatischer separater Renderer-Service fuer RaveBerg. Der Service bleibt Teil des bestehenden Repos, nutzt die vorhandene `/display`-Seite als Render-Quelle und dupliziert keine Business-Logik.

## Architektur

1. Das bestehende RaveBerg-System auf dem Raspberry Pi bleibt Master fuer Backend, Uploads, Admin, Moderation, API und Zustande.
2. Dieser Service laedt die bestehende `/display`-Seite in einem Headless-Chromium.
3. Der Browser rendert die Vue-Display-Ansicht ohne Desktop-Capture oder Bildschirmaufnahme.
4. Einzelne Browser-Frames werden direkt aus der Headless-Renderpipeline als JPEG entnommen.
5. `ffmpeg` encodiert diese Frames in H.264/HLS.
6. Der Raspberry Pi kann spaeter den HLS-Output im Browser statt der schweren lokalen Display-Ansicht anzeigen.

Wichtig:

- keine AVFoundation
- keine Desktop-Aufnahme
- keine neue doppelte Business-Logik
- die bestehende `/display`-Route bleibt die Quelle

## Ordnerstruktur

```text
renderer_headless/
├── README.md
├── package.json
├── scripts/
│   └── healthcheck.mjs
└── server.js
```

Zur Laufzeit schreibt der Service nach:

```text
renderer_headless/runtime/hls/
```

## Voraussetzungen

- Node.js 20 oder neuer
- `ffmpeg` im `PATH`
- Zugriff vom Renderer-Rechner auf das bestehende RaveBerg-Backend bzw. die `/display`-URL

Installation:

```bash
cd /Users/admin/Documents/raveBerg/renderer_headless
npm install
npx playwright install chromium
```

Fuer Dauerbetrieb und Autostart liegen unter [`ops/renderer_headless/`](/Users/admin/Documents/raveBerg/ops/renderer_headless):

- [`env.renderer.example`](/Users/admin/Documents/raveBerg/ops/renderer_headless/env.renderer.example)
- [`start-renderer.sh`](/Users/admin/Documents/raveBerg/ops/renderer_headless/start-renderer.sh)
- [`ecosystem.config.cjs`](/Users/admin/Documents/raveBerg/ops/renderer_headless/ecosystem.config.cjs)
- [`com.raveberg.renderer-headless.plist.example`](/Users/admin/Documents/raveBerg/ops/renderer_headless/com.raveberg.renderer-headless.plist.example)

## Konfiguration

Der Service wird komplett ueber Umgebungsvariablen konfiguriert.

Wichtige Variablen:

- `HEADLESS_RENDERER_HOST`
- `HEADLESS_RENDERER_PORT`
- `HEADLESS_RENDERER_DISPLAY_URL`
- `HEADLESS_RENDERER_PROFILE`
- `HEADLESS_RENDERER_WIDTH`
- `HEADLESS_RENDERER_HEIGHT`
- `HEADLESS_RENDERER_OUTPUT_WIDTH`
- `HEADLESS_RENDERER_OUTPUT_HEIGHT`
- `HEADLESS_RENDERER_RENDER_WIDTH`
- `HEADLESS_RENDERER_RENDER_HEIGHT`
- `HEADLESS_RENDERER_FPS`
- `HEADLESS_RENDERER_JPEG_QUALITY`
- `HEADLESS_RENDERER_KEYFRAME_INTERVAL`
- `HEADLESS_RENDERER_PRESET`
- `HEADLESS_RENDERER_ENCODER`
- `HEADLESS_RENDERER_VIDEO_BITRATE`
- `HEADLESS_RENDERER_MAXRATE`
- `HEADLESS_RENDERER_BUFSIZE`
- `HEADLESS_RENDERER_HLS_TIME`
- `HEADLESS_RENDERER_HLS_LIST_SIZE`
- `HEADLESS_RENDERER_STARTUP_GRACE_MS`
- `HEADLESS_RENDERER_HLS_INIT_TIMEOUT_MS`
- `HEADLESS_RENDERER_OUTPUT_STALE_MS`
- `HEADLESS_RENDERER_WATCHDOG_ENABLED`
- `HEADLESS_RENDERER_WATCHDOG_INTERVAL_MS`
- `HEADLESS_RENDERER_WATCHDOG_FAILURE_THRESHOLD`
- `HEADLESS_RENDERER_FFMPEG_PATH`
- `HEADLESS_RENDERER_BROWSER_CHANNEL`
- `HEADLESS_RENDERER_BROWSER_EXECUTABLE_PATH`
- `HEADLESS_RENDERER_HLS_DIRECTORY`

Sinnvolle Defaults:

- Port `9012`
- Display-URL `http://127.0.0.1:8085/display`
- Output-Aufloesung `1920x1080`
- Render-Aufloesung `1280x720` im Profil `balanced`
- Profil `balanced`
- FPS `12`
- JPEG-Qualitaet `78`
- Keyframe-Intervall `12`
- Encoder `libx264`
- Preset `veryfast`
- Video-Bitrate `3500k`
- HLS-Segmentdauer `1s`
- HLS-Playlist-Groesse `4`
- Startup-Grace `35000ms`
- HLS-Init-Timeout `70000ms`
- HLS-Stale-Schwelle `12000ms`
- Watchdog `an`, Intervall `10000ms`, Fehlergrenze `3`

Profile:

- `balanced`
  Empfohlener Startpunkt fuer normale Tests. Render intern in `1280x720`, skaliert auf `1920x1080`, `12 FPS`, JPEG `78`, `veryfast`.
- `performance`
  Rettungsprofil fuer den ersten stabilen HLS-Erfolg. Render intern in `960x540`, Ausgabe `1280x720`, `6 FPS`, JPEG `52`, `ultrafast`, kleinere Bitrate und laengeres Init-Zeitfenster.
- `quality`
  Hoehere visuelle Qualitaet. Render und Ausgabe `1920x1080`, `15 FPS`, JPEG `84`, `faster`, hoehere Bitrate und etwas groessere Playlist.

Explizit gesetzte Umgebungsvariablen ueberschreiben das Profil.

Wichtig zur Aufloesung:

- `HEADLESS_RENDERER_WIDTH` und `HEADLESS_RENDERER_HEIGHT` bleiben als einfache Alias-Werte fuer die HLS-Ausgabe nutzbar.
- Mit `HEADLESS_RENDERER_RENDER_WIDTH` und `HEADLESS_RENDERER_RENDER_HEIGHT` laesst sich die interne Browser-Renderflaeche separat kleiner halten.
- Genau diese Trennung reduziert die Kosten von `page.screenshot()` deutlich.

Optional auf einem Mac:

```bash
export HEADLESS_RENDERER_ENCODER=h264_videotoolbox
```

## Start

Entwicklung:

```bash
cd /Users/admin/Documents/raveBerg/renderer_headless
npm run dev
```

Produktionsnah lokal:

```bash
cd /Users/admin/Documents/raveBerg/renderer_headless
HEADLESS_RENDERER_DISPLAY_URL=http://192.168.178.38:8085/display \
HEADLESS_RENDERER_HOST=0.0.0.0 \
HEADLESS_RENDERER_PORT=9012 \
HEADLESS_RENDERER_PROFILE=balanced \
HEADLESS_RENDERER_OUTPUT_WIDTH=1920 \
HEADLESS_RENDERER_OUTPUT_HEIGHT=1080 \
HEADLESS_RENDERER_RENDER_WIDTH=1280 \
HEADLESS_RENDERER_RENDER_HEIGHT=720 \
HEADLESS_RENDERER_FPS=12 \
HEADLESS_RENDERER_JPEG_QUALITY=78 \
HEADLESS_RENDERER_KEYFRAME_INTERVAL=12 \
HEADLESS_RENDERER_ENCODER=libx264 \
HEADLESS_RENDERER_PRESET=veryfast \
npm run start:prod
```

Healthcheck lokal:

```bash
cd /Users/admin/Documents/raveBerg/renderer_headless
npm run healthcheck
```

Optional fuer entfernte Checks:

```bash
HEADLESS_RENDERER_HEALTHCHECK_URL=http://127.0.0.1:9012/health npm run healthcheck
```

## Dauerbetrieb

Empfohlener pragmatischer Pfad:

1. Env-Datei anlegen:

```bash
cd /Users/admin/Documents/raveBerg
cp ops/renderer_headless/env.renderer.example ops/renderer_headless/env.renderer
chmod +x ops/renderer_headless/start-renderer.sh
```

2. `ops/renderer_headless/env.renderer` anpassen
3. Start einmalig testen:

```bash
/Users/admin/Documents/raveBerg/ops/renderer_headless/start-renderer.sh
```

4. Danach ueber `pm2` betreiben:

```bash
cd /Users/admin/Documents/raveBerg
npm install -g pm2
pm2 start ops/renderer_headless/ecosystem.config.cjs
pm2 logs raveberg-renderer-headless
pm2 save
```

Autostart mit `pm2`:

```bash
pm2 startup
pm2 save
```

Der interne Watchdog beendet den Prozess mit Exit-Code `1`, wenn der Health-Zustand mehrfach hintereinander `failed` ist. Ein Process Manager wie `pm2` startet ihn dann automatisch neu.

## macOS Autostart

Alternativ auf macOS:

1. [`com.raveberg.renderer-headless.plist.example`](/Users/admin/Documents/raveBerg/ops/renderer_headless/com.raveberg.renderer-headless.plist.example) kopieren und Pfade anpassen
2. nach `~/Library/LaunchAgents/com.raveberg.renderer-headless.plist` legen
3. laden:

```bash
launchctl load ~/Library/LaunchAgents/com.raveberg.renderer-headless.plist
```

## Performance

- `HEADLESS_RENDERER_PROFILE` ist der einfachste Schalter fuer echte Tests. Fuer den ersten HLS-Erfolg ist jetzt `performance` der sicherste Pfad.
- `HEADLESS_RENDERER_FPS` taktet die Render-Schleife hart. Es werden keine Backlogs aufgebaut; langsame Iterationen fuehren stattdessen zu `frames_skipped_total`.
- `HEADLESS_RENDERER_JPEG_QUALITY` steuert Groesse und CPU-Last der Browser-Frames. Hoeher = mehr Detail, aber mehr Last.
- `HEADLESS_RENDERER_RENDER_WIDTH` und `HEADLESS_RENDERER_RENDER_HEIGHT` reduzieren direkt die Kosten von `page.screenshot()`.
- `HEADLESS_RENDERER_OUTPUT_WIDTH` und `HEADLESS_RENDERER_OUTPUT_HEIGHT` definieren davon getrennt die HLS-Zielgroesse. `ffmpeg` skaliert bei Bedarf mit einem schnellen Bilinear-Filter.
- `HEADLESS_RENDERER_KEYFRAME_INTERVAL` sollte fuer HLS niedrig genug sein, damit Segmente schnell decodierbar bleiben. Der Default ist auf etwa ein Keyframe pro Sekunde abgestimmt.
- `HEADLESS_RENDERER_HLS_TIME` und `HEADLESS_RENDERER_HLS_LIST_SIZE` steuern Latenz und Robustheit. Standard ist `1s` mit kurzer Live-Playlist.
- `HEADLESS_RENDERER_PRESET` gilt fuer `libx264`. `veryfast` ist der pragmatische Standard, `superfast` reduziert CPU-Last weiter.
- `HEADLESS_RENDERER_HLS_INIT_TIMEOUT_MS` gibt dem Renderer Zeit, bis bei langsamer Frame-Produktion die erste Playlist und die ersten Segmente entstehen.
- Der Service wartet bei `ffmpeg`-Backpressure auf `drain` und misst diese Phasen ueber `ffmpeg_stdin_backpressure_count` und `backpressureWaitMsAvg`.

Empfohlener erster echter Erfolgstest:

- `HEADLESS_RENDERER_PROFILE=performance`
- `HEADLESS_RENDERER_OUTPUT_WIDTH=1280`
- `HEADLESS_RENDERER_OUTPUT_HEIGHT=720`
- `HEADLESS_RENDERER_RENDER_WIDTH=960`
- `HEADLESS_RENDERER_RENDER_HEIGHT=540`
- `HEADLESS_RENDERER_FPS=6`
- `HEADLESS_RENDERER_JPEG_QUALITY=52`
- `HEADLESS_RENDERER_PRESET=ultrafast`
- auf dem Pi bevorzugt `Output-Pfad = /preview`

## Endpunkte

- `/health`
  Zeigt Browser-, Display-, Render- und Output-Status.
- `/preview`
  Kleine lokale Preview-Seite mit klarer Statusanzeige fuer Browser, ffmpeg und HLS.
- `/video`
  Redirect auf die Playlist.
- `/hls/playlist.m3u8`
  Hauptausgabe fuer den Pi.
- `/snapshot.jpg`
  Letztes gerendertes Browser-Frame als Debugbild.

## Health / Diagnose

`/health` zeigt mindestens:

- ob der Renderer laeuft
- ob der Headless-Browser laeuft
- ob `/display` erfolgreich geladen wurde
- ob die Render-Pipeline aktiv ist
- wie viele Frames erfolgreich an `ffmpeg` uebergeben wurden
- wie viele Frames verworfen oder uebersprungen wurden
- ob Backpressure aufgetreten ist
- ob HLS-Dateien erzeugt werden
- letzter erfolgreicher Render-Zeitpunkt
- letzter Output-Zeitpunkt
- letzte bekannte Fehlermeldung
- Watchdog-Zustand und Fehlerzaehler

Wichtige Felder:

- `browser_running`
- `display_loaded`
- `render_loop_running`
- `last_frame_rendered_at`
- `frames_rendered_total`
- `frames_dropped_total`
- `frames_skipped_total`
- `actual_fps`
- `avg_frame_render_ms`
- `ffmpeg_running`
- `ffmpeg_exit_code`
- `ffmpeg_stdin_backpressure_count`
- `status`
- `statusDetail`
- `startup_grace_active`
- `hls_init_timeout_ms`
- `hls_init_timeout_remaining_ms`
- `last_healthy_at`
- `renderPipeline.active`
- `renderPipeline.framesRenderedTotal`
- `renderPipeline.framesSkippedTotal`
- `renderPipeline.slowFramesTotal`
- `renderPipeline.backpressureWaitsTotal`
- `renderPipeline.backpressureWaitMsAvg`
- `renderPipeline.avgScreenshotMs`
- `renderPipeline.avgEncodeWaitMs`
- `ffmpeg.outputMode`
- `preferred_output.playlist_exists`
- `preferred_output.segment_count`
- `preferred_output.ready`
- `preferred_output.last_activity_at`
- `preferred_output.hls_update_interval_ms`
- `preferred_output.render_width`
- `preferred_output.render_height`
- `preferred_output.stale`
- `watchdog.consecutiveFailures`
- `lastError`

Gesamtstatus:

- `starting`: normaler Anlauf innerhalb der Startup-Grace
- `ok`: Browser, Render-Loop, `ffmpeg` und HLS laufen sauber
- `degraded`: Renderer laeuft, ist aber noch im HLS-Warmup oder klar unter Ziel-FPS
- `failed`: Browser/Display/Render-Loop/`ffmpeg` sind ausgefallen, HLS ist veraltet oder HLS wurde auch nach dem Init-Timeout nicht bereit

## Lokal testen

Nach dem Start:

- Preview: `http://localhost:9012/preview`
- Playlist: `http://localhost:9012/hls/playlist.m3u8`
- Health: `http://localhost:9012/health`

Auf Dateiebene:

```bash
cd /Users/admin/Documents/raveBerg/renderer_headless
find runtime/hls -maxdepth 2 \\( -name "*.m3u8" -o -name "*.ts" \\)
```

Wenn alles sauber laeuft, sollten auftauchen:

- `runtime/hls/playlist.m3u8`
- mehrere `runtime/hls/segment_*.ts`

Stabiler Lauf in `/health` erkennbar:

- `browser_running = true`
- `display_loaded = true`
- `render_loop_running = true`
- `ffmpeg_running = true`
- `ffmpeg_exit_code = null`
- `frames_rendered_total` steigt kontinuierlich
- `frames_skipped_total` bleibt niedrig
- `actual_fps` liegt nahe an `settings.fps`
- `avg_frame_render_ms` bleibt klar unter `1000 / settings.fps`
- `ffmpeg_stdin_backpressure_count` steigt nicht dauerhaft stark
- `preferred_output.playlist_exists = true`
- `preferred_output.segment_count > 0`
- `preferred_output.ready = true`
- `preferred_output.last_activity_at` bewegt sich weiter

Problemfaelle klar erkennbar:

- `status = starting` und `statusDetail = starting`
- `status = degraded` und `statusDetail = warming_up`
- `status = failed` und `statusDetail = browser_failed`
- `status = failed` und `statusDetail = display_not_loaded`
- `status = failed` und `statusDetail = ffmpeg_failed`
- `status = failed` und `statusDetail = render_loop_stopped`
- `status = failed` und `statusDetail = hls_stale`
- `status = degraded` und `statusDetail = running_slowly`
- `status = failed` und `statusDetail = hls_init_timeout`

## Nutzung auf dem Raspberry Pi

Der Pi bleibt im integrierten Betrieb weiterhin auf der bestehenden RaveBerg-Seite `/display`. Dort kann im Adminbereich zwischen lokalem Rendering und `remote_headless` umgeschaltet werden.

Empfohlene Runtime-Konfiguration in RaveBerg:

- `Render-Modus = remote_headless`
- `Renderer-Basis-URL = http://<RENDERER-IP>:9012`
- `Output-Pfad = /preview`
- optional `Health-URL = leer`, dann wird automatisch `/health` genutzt
- `Fallback = local` oder `notice`

Der Pi konsumiert dann intern den Renderer-Output, zum Beispiel:

```text
http://<RENDERER-IP>:9012/preview
```

Fuer Chromium auf dem Pi ist `/preview` der pragmatischste erste Pfad. Wenn nativer HLS-Support vorhanden ist, kann alternativ auch `/hls/playlist.m3u8` verwendet werden.

Wenn der Renderer ausfaellt:

- bei `Fallback = local` rendert der Pi wieder lokal
- bei `Fallback = notice` zeigt das Display einen klaren Hinweis statt einer Browser-Fehlerseite

Pruefen auf dem Pi:

1. Renderer-Gesundheit auf dem Renderer-Rechner pruefen: `/health`
2. In RaveBerg `Render-Modus = remote_headless` setzen
3. Auf dem Pi weiter `/display` oeffnen
4. Testweise den Renderer-Prozess beenden; dann muss lokales Rendering oder der Hinweis greifen

## Bekannte Grenzen des ersten Wurfs

- Der Service nutzt weiterhin eine Frame-Schleife ueber Headless-Chromium-Screenshots. Das ist aber Browser-internes Headless-Rendering, keine Desktop-Aufnahme.
- Das ist noch keine echte GPU-direkte Video-Renderpipeline.
- Die Preview-Seite nutzt fuer Chromium-basierte Browser bei Bedarf `hls.js` aus einem CDN.
- Der Service wird noch nicht automatisch aus `docker-compose.yml` gestartet.
- Audio wird nicht uebertragen.

## Naechster sinnvoller Schritt

Wenn sich diese Repo-integrierte Headless-Variante bewaehrt, ist der naechste technische Schritt:

1. HLS auf CMAF/fMP4 umstellen
2. Encoder-Profile gegen echte Pi-Messwerte weiter abstimmen
3. spaeter auf WebRTC oder einen echten low-latency-H.264-Pfad gehen
