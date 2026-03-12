# RAVEBERG Ops

Dieser Bereich buendelt den vorbereiteten Appliance-Betrieb fuer den Raspberry Pi.

- `pi/`: Start-, Kiosk- und QR-Skripte fuer den Eventbetrieb
- `renderer_headless/`: Env-, Start- und Autostart-Vorlagen fuer den separaten Renderer-Rechner
- `systemd/`: vorbereitete Unit-Files fuer Stack- und Kiosk-Autostart
- `network/ap/`: Beispielkonfigurationen fuer einen dedizierten Access-Point mit `hostapd`, `dnsmasq` und statischer `wlan0`-Adresse

Die fachliche Betriebsdokumentation steht in [docs/AP5.md](../docs/AP5.md).

## Remote Headless Display

Der Pi bleibt weiter auf `KIOSK_START_URL=/display`. Die Umschaltung zwischen lokalem Display-Rendering und dem externen `renderer_headless`-Output erfolgt zur Laufzeit ueber die Runtime-Settings im Adminbereich.

Relevante Default-Variablen im Appliance-Env:

- `DISPLAY_RENDER_MODE=local|remote_headless`
- `REMOTE_RENDERER_BASE_URL`
- `REMOTE_RENDERER_OUTPUT_PATH`
- `REMOTE_RENDERER_HEALTH_URL`
- `REMOTE_RENDERER_RECONNECT_MS`
- `REMOTE_RENDERER_FALLBACK=local|notice`

Empfohlener Pi-Betrieb:

1. `renderer_headless` auf dem starken Rechner starten
2. im Adminbereich `Render-Modus = remote_headless` setzen
3. Renderer-Basis-URL und Output-Pfad eintragen, z. B. `/preview`
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
