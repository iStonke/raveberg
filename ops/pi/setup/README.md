# RaveBerg Setup Mode

Dieser Ordner enthaelt den Pi-Setup-Modus fuer ein eigenes WLAN mit Captive Portal.

## Zielbild

- Raspberry Pi startet bei Bedarf `RaveBerg-Setup`
- `wlan0` bekommt `192.168.4.1/24`
- `dnsmasq` liefert DHCP/DNS fuer das Setup-Netz
- `NoDogSplash` zeigt eine Splash-Seite und leitet auf `http://192.168.4.1/setup`
- Das Backend nutzt `nmcli` fuer WLAN-Scan und WLAN-Verbindung

## Dateien

- `install-setup-deps.sh`: installiert Host-Pakete und registriert die systemd-Unit
- `start-setup-mode.sh`: startet AP, DHCP/DNS und NoDogSplash
- `stop-setup-mode.sh`: beendet AP, DHCP/DNS und NoDogSplash sauber
- `check-network.sh`: Diagnose fuer `nmcli` und den Setup-Dienst
- `env.setup.example`: Host-Konfigurationsvorlage fuer `/etc/default/raveberg-setup-mode`
- `nodogsplash/splash.html.template`: Branding-/Portal-Template

## Installation auf dem Pi

```bash
cd /opt/raveberg
sudo bash ops/pi/setup/install-setup-deps.sh
sudo cp ops/pi/setup/env.setup.example /etc/default/raveberg-setup-mode
sudo systemctl daemon-reload
```

Wenn `apt-cache show nodogsplash` auf dem Pi kein Paket liefert, bricht das Skript nicht den gesamten Setup ab, sondern zeigt den offiziellen Build-Fallback ueber das NoDogSplash-GitHub-Repo an.

## Technischer Startpfad

Das Backend startet den Host-Dienst `raveberg-setup-mode.service` per `systemctl` ueber den gemounteten System-Bus.

Der Host-Dienst fuehrt aus:

1. `ops/pi/setup/start-setup-mode.sh`
2. AP-Verbindung per `nmcli`
3. `dnsmasq` mit dedizierter Runtime-Config
4. `nodogsplash` mit dediziertem Splash-Template

Beim Beenden laeuft:

1. `ops/pi/setup/stop-setup-mode.sh`
2. NoDogSplash stoppen
3. dnsmasq stoppen
4. AP-Verbindung sauber abbauen

## Konfiguration

Host-Konfiguration:

- `/etc/default/raveberg-setup-mode`

Wichtige Variablen:

- `WIFI_INTERFACE`
- `SETUP_MODE_SSID`
- `SETUP_MODE_ADDRESS`
- `SETUP_MODE_PREFIX_LENGTH`
- `SETUP_MODE_DHCP_START`
- `SETUP_MODE_DHCP_END`
- `SETUP_MODE_CONNECTION_NAME`
- `SETUP_MODE_RUNTIME_DIR`
- `SETUP_MODE_PORTAL_PATH`

Container-/Backend-Konfiguration:

- `ops/pi/env.appliance`
- `AUTO_SETUP_MODE_ENABLED`
- `AUTO_SETUP_MODE_INITIAL_DELAY_SECONDS`
- `AUTO_SETUP_MODE_CHECK_INTERVAL_SECONDS`
- `AUTO_SETUP_MODE_FAILURE_THRESHOLD`
- `AUTO_SETUP_MODE_COOLDOWN_SECONDS`

## Runtime- und Portal-Dateien

Zur Laufzeit schreibt der Host-Dienst nach:

- `ops/pi/runtime/setup-mode/dnsmasq.conf`
- `ops/pi/runtime/setup-mode/nodogsplash.conf`
- `ops/pi/runtime/setup-mode/htdocs/splash.html`
- `ops/pi/runtime/setup-mode/state.json`

Portal-Branding/Text anpassen:

- `ops/pi/setup/nodogsplash/splash.html.template`

## Verhalten nach Reboot

- Wenn `AUTO_SETUP_MODE_ENABLED=true` gesetzt ist, prueft das Backend nach dem Boot den WLAN-Status
- Bei fehlender aktiver WLAN-Client-Verbindung wird nach der konfigurierten Schwellwert-/Cooldown-Logik automatisch der Setup-Modus gestartet
- Es gibt keine aggressive Umschalt-Schleife: aktive Setup-Sessions und laufende Connect-Versuche blockieren den Auto-Fallback

## Bekannte Grenzen

- Fuer das Captive Portal sollte der Pi-Appliance-Proxy auf Port `80` laufen, damit `http://192.168.4.1` ohne Port funktioniert
- Der eigentliche Wechsel vom Setup-AP ins Ziel-WLAN kann die Client-Verbindung sofort trennen; deshalb meldet die Setup-UI den Wechsel optimistisch und zeigt Fehler erst beim naechsten Reconnect wieder an
- Die finale NoDogSplash-Config kann je nach Pi-OS-Image kleine Paket-/Pfadunterschiede haben; dafuer ist der Install-/Fallback-Pfad dokumentiert
