# RAVEBERG Ops

Dieser Bereich buendelt den vorbereiteten Appliance-Betrieb fuer den Raspberry Pi.

- `pi/`: Start-, Kiosk- und QR-Skripte fuer den Eventbetrieb
- `mac/`: einfacher Startpfad fuer den produktiven Display-/Beamer-Client auf macOS
- `renderer_headless/`: Env-, Start- und Autostart-Vorlagen fuer den separaten Renderer-Rechner
- `systemd/`: vorbereitete Unit-Files fuer Stack- und Kiosk-Autostart
- `network/ap/`: Beispielkonfigurationen fuer einen dedizierten Access-Point mit `hostapd`, `dnsmasq` und statischer `wlan0`-Adresse

Die fachliche Betriebsdokumentation steht in [docs/AP5.md](../docs/AP5.md).

## Oeffentliche Guest-Upload-URL

Der sichtbare Upload-QR-Code auf Guest-, Idle-, Selfie- und Display-Pfaden nutzt zentral `GUEST_UPLOAD_URL` aus [`ops/pi/env.appliance`](/Users/admin/Documents/raveBerg/ops/pi/env.appliance).

Vorgehen fuer Quick Tunnels oder spaetere feste Domains:

1. `GUEST_UPLOAD_URL` in `ops/pi/env.appliance` setzen oder aktualisieren
2. Pi-Stack neu starten, damit Backend und Runtime-Info die neue URL ausliefern
3. Display/QR-Code nutzt danach automatisch den neuen Wert

Beispiel:

```text
GUEST_UPLOAD_URL=https://your-public-upload-host.example/guest/upload
```

Hilfsskript:

```bash
chmod +x ops/pi/set-guest-upload-url.sh
ops/pi/set-guest-upload-url.sh https://your-public-upload-host.example/guest/upload
```

Fallback:

- wenn `GUEST_UPLOAD_URL` gesetzt ist, hat diese Variable Vorrang
- wenn `GUEST_UPLOAD_URL` leer ist, wird weiterhin `PUBLIC_BASE_URL + GUEST_UPLOAD_PATH` verwendet

## Event-Start mit Cloudflare Quick Tunnel

Fuer einen pragmatischen Event-Start auf dem Pi gibt es jetzt einen Ein-Befehl-Pfad:

```bash
bash ops/pi/start-event.sh
```

Das Skript macht in dieser Reihenfolge:

1. Appliance-Stack mit `ops/pi/env.appliance` starten
2. `cloudflared tunnel --url http://localhost:8085` im Hintergrund starten
3. die `https://...trycloudflare.com`-URL aus dem Log extrahieren
4. daraus `https://...trycloudflare.com/guest/upload` bilden
5. `GUEST_UPLOAD_URL=...` in `ops/pi/env.appliance` setzen oder aktualisieren
6. den Stack mit derselben Env-Datei erneut `up -d --build` starten

Wichtige Dateien:

- Tunnel-Log: `ops/pi/runtime/cloudflared.log`
- PID-Datei: `ops/pi/runtime/cloudflared.pid`
- gesetzte Upload-URL: `ops/pi/env.appliance`

Die finale Upload-URL wird nach dem Start im Terminal ausgegeben.

Quick Tunnel stoppen:

```bash
bash ops/pi/stop-event.sh
```

Das Stop-Skript beendet nur den `cloudflared`-Prozess. Der Docker-Stack bleibt dabei bestehen.

## Direkter Mac-Display-Client

Der bevorzugte Produktivpfad ist inzwischen:

1. der Pi bleibt Source of Truth fuer Uploads, Moderation, Admin und API
2. der Mac oeffnet direkt `http://<PI-IP>:8085/display`
3. die Display-Seite haelt selbst eine SSE-Verbindung auf `/api/events/stream`
4. Aenderungen werden lokal im Frontend-State verarbeitet, ohne Full Reload

Empfehlung:

- `DISPLAY_RENDER_MODE=local`
- auf dem Mac Chrome/Chromium im Vollbild oder Kiosk auf `/display`
- kein `renderer_headless` im Hauptpfad noetig

Bevorzugte Produktiv-URL:

```text
http://<PI-IP>:8085/display
```

Einfacher macOS-Startpfad:

```bash
chmod +x ops/mac/start-display-client.sh
ops/mac/start-display-client.sh http://<PI-IP>:8085/display
```

Das Skript sucht nach Chrome oder Chromium in `/Applications` und oeffnet die Display-Seite in einem neuen Vollbild-Fenster.

Fallback-Modell:

1. der Pi bleibt Server und Source of Truth
2. faellt der Mac aus, wird auf dem Mac einfach dieselbe URL erneut geoeffnet
3. als schnelle Reserve bleibt auf dem Pi lokal verfuegbar:

```text
http://localhost:8085/display
```

## Remote Headless Display

Der Pi bleibt weiter auf `KIOSK_START_URL=/display`. Die Umschaltung zwischen lokalem Display-Rendering und dem externen `renderer_headless`-Output erfolgt zur Laufzeit ueber die Runtime-Settings im Adminbereich.

Relevante Default-Variablen im Appliance-Env:

- `DISPLAY_RENDER_MODE=local|remote_headless`
- `REMOTE_RENDERER_BASE_URL`
- `REMOTE_RENDERER_OUTPUT_PATH`
- `REMOTE_RENDERER_HEALTH_URL`
- `REMOTE_RENDERER_RECONNECT_MS`
- `REMOTE_RENDERER_FALLBACK=local|notice`

Reserve-/Experimentpfad:

1. `renderer_headless` auf dem starken Rechner starten
2. im Adminbereich `Render-Modus = remote_headless` setzen
3. Renderer-Basis-URL und Output-Pfad eintragen, z. B. `/preview-lite`
4. der Pi bleibt auf `/display` und konsumiert dort den externen Renderer mit Fallback

## Renderer-Rechner

Unter [`ops/renderer_headless/`](/Users/admin/Documents/raveBerg/ops/renderer_headless) liegen:

- [`env.renderer.example`](/Users/admin/Documents/raveBerg/ops/renderer_headless/env.renderer.example)
- [`start-renderer.sh`](/Users/admin/Documents/raveBerg/ops/renderer_headless/start-renderer.sh)
- [`ecosystem.config.cjs`](/Users/admin/Documents/raveBerg/ops/renderer_headless/ecosystem.config.cjs)
- [`com.raveberg.renderer-headless.plist.example`](/Users/admin/Documents/raveBerg/ops/renderer_headless/com.raveberg.renderer-headless.plist.example)

Pragmatische Empfehlung:

1. `env.renderer.example` nach `env.renderer` kopieren
2. Renderer einmal per `start-renderer.sh` testen
3. danach ueber `pm2 start ops/renderer_headless/ecosystem.config.cjs` betreiben

Wichtig:

- `renderer_headless` bleibt ein experimenteller oder alternativer Pfad
- fuer den produktiven Beamer-Betrieb ist der direkte Mac-Client auf `/display` vorzuziehen
