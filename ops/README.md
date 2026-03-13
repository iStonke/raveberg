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
7. eine Statusdatei unter `ops/pi/runtime/event-info.txt` schreiben

Wichtige Dateien:

- Tunnel-Log: `ops/pi/runtime/cloudflared.log`
- PID-Datei: `ops/pi/runtime/cloudflared.pid`
- Event-Info: `ops/pi/runtime/event-info.txt`
- gesetzte Upload-URL: `ops/pi/env.appliance`

Die finale Upload-URL wird nach dem Start im Terminal und in `event-info.txt` ausgegeben.

Quick Tunnel stoppen:

```bash
bash ops/pi/stop-event.sh
```

Das Stop-Skript beendet nur den `cloudflared`-Prozess. Der Docker-Stack bleibt dabei bestehen.

## Event-Autostart nach Reboot

Fuer automatischen Event-Start nach einem Pi-Neustart liegt eine systemd-Unit bereit:

- [`ops/pi/raveberg-event.service`](/Users/admin/Documents/raveBerg/ops/pi/raveberg-event.service)

Sie wartet auf Netzwerk und Docker, verzoegert den Start kurz und fuehrt dann `bash /opt/raveberg/ops/pi/start-event.sh` aus.

Installation auf dem Pi:

```bash
cd /opt/raveberg
sudo cp ops/pi/raveberg-event.service /etc/systemd/system/raveberg-event.service
sudo systemctl daemon-reload
sudo systemctl enable raveberg-event.service
sudo systemctl start raveberg-event.service
```

Pruefen:

```bash
systemctl status raveberg-event.service
journalctl -u raveberg-event.service -b
cat /opt/raveberg/ops/pi/runtime/event-info.txt
```

Wichtig:

- wenn dieser Dienst den Event-Start uebernehmen soll, ist er der relevante Boot-Pfad fuer den Quick Tunnel
- ein zusaetzlich separat aktivierter reiner Stack-Autostart ist dann normalerweise nicht mehr noetig
- der Dienst startet den bestehenden Event-Workflow, statt eine zweite Logik daneben aufzubauen
- fuer einen manuellen Neustart des Event-Betriebs bleibt `bash ops/pi/start-event.sh` weiter gueltig

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

Noch einfacher fuer den Eventbetrieb:

```bash
chmod +x ops/mac/start-event-display.sh
ops/mac/start-event-display.sh 192.168.178.92
```

Das Convenience-Skript akzeptiert entweder nur die Pi-IP bzw. den Hostnamen oder direkt eine volle Display-URL.

## Event-Ablauf

A) Pi vorbereiten

```bash
cd /opt/raveberg
bash ops/pi/start-event.sh
```

B) Mac Display starten

```bash
cd /opt/raveberg
bash ops/mac/start-event-display.sh <PI-IP>
```

oder direkt:

```text
http://<PI-IP>:8085/display
```

C) QR-/Upload-Test

1. Smartphone ueber Mobilfunk oder externes Netz nutzen
2. QR-Code auf dem Display scannen
3. Testbild hochladen und auf dem Mac-Display pruefen

D) Stoppen

```bash
cd /opt/raveberg
bash ops/pi/stop-event.sh
```

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
