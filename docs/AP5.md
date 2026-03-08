# AP5 Technische Orientierung

## Zielbetrieb

AP5 definiert erstmals einen klaren Raspberry-Pi-Appliance-Betrieb:

1. Raspberry Pi bootet
2. lokales WLAN / Access Point ist verfuegbar
3. Docker und der Compose-Stack starten
4. die App ist ueber den Reverse Proxy erreichbar
5. Chromium startet im Kiosk-Modus auf der Display-Route

Der Entwicklungsmodus bleibt davon getrennt. Fuer den Pi-Betrieb ist ein eigener Ops-/Env-Pfad vorgesehen.

## Struktur fuer den Pi-Betrieb

Vorbereitet wurden:

- `ops/pi/env.appliance.example`
- `ops/pi/start-appliance-stack.sh`
- `ops/pi/stop-appliance-stack.sh`
- `ops/pi/wait-for-url.sh`
- `ops/pi/start-kiosk.sh`
- `ops/pi/generate-qr-assets.sh`
- `ops/systemd/raveberg-stack.service`
- `ops/systemd/raveberg-kiosk.service`
- `ops/network/ap/hostapd-raveberg.conf`
- `ops/network/ap/dnsmasq-raveberg.conf`
- `ops/network/ap/dhcpcd-raveberg.conf`

Damit liegt die Pi-spezifische Betriebslogik gebuendelt unter `ops/` und nicht verstreut im Projekt.

## Kiosk-Betrieb

Empfohlener Weg:

- Chromium oder `chromium-browser`
- Start ueber `ops/pi/start-kiosk.sh`
- systemd-Unit `ops/systemd/raveberg-kiosk.service`

`start-kiosk.sh` macht in AP5:

- Appliance-Env laden
- auf die Display-URL warten
- Bildschirm-Blanking und DPMS abschalten, sofern `xset` vorhanden ist
- optional den Mauszeiger mit `unclutter` ausblenden
- Chromium mit ruhigen Kiosk-Flags starten

Ziel-URL:

- `KIOSK_START_URL`
- Fallback: `PUBLIC_BASE_URL + DISPLAY_PATH`

## Startreihenfolge

Empfohlene Reihenfolge im Host-Betrieb:

1. Betriebssystem startet
2. `wlan0` bekommt die statische AP-Adresse
3. `hostapd` und `dnsmasq` machen das lokale WLAN verfuegbar
4. `raveberg-stack.service` startet Docker Compose
5. `ops/pi/wait-for-url.sh` wartet auf die lokale App
6. `raveberg-kiosk.service` startet Chromium auf `/display`

Damit startet der Browser nicht blind vor dem Proxy.

## Empfohlener AP-/WLAN-Ansatz

AP5 waehlt bewusst einen klaren empfohlenen Weg fuer Raspberry Pi OS:

- `hostapd` fuer die SSID
- `dnsmasq` fuer DHCP/DNS im lokalen Netz
- statische `wlan0`-Adresse ueber `dhcpcd`

Warum dieser Weg:

- gut nachvollziehbar
- robust fuer ein dediziertes Offline-Eventgeraet
- keine versteckte Hotspot-Magie in Desktop-Tools

Vorbereitete Dateien:

- [hostapd-raveberg.conf](../ops/network/ap/hostapd-raveberg.conf)
- [dnsmasq-raveberg.conf](../ops/network/ap/dnsmasq-raveberg.conf)
- [dhcpcd-raveberg.conf](../ops/network/ap/dhcpcd-raveberg.conf)

Ziel-IP in den Beispielen:

- `10.77.0.1/24`

## Lokale Erreichbarkeit

Empfohlene Adressen im Eventbetrieb:

- Basis: `http://10.77.0.1:8085`
- Guest Upload: `http://10.77.0.1:8085/guest/upload`
- Admin Login: `http://10.77.0.1:8085/admin/login`
- Display: `http://10.77.0.1:8085/display`

Optionaler Hostname:

- `raveberg.local`

Wichtig fuer den Eventbetrieb:

- IP-basierte URLs bleiben der harte Fallback
- `.local` ist nur zusaetzlicher Komfort und nicht die einzige Annahme

## QR-Code-Konzept

AP5 bereitet zwei QR-Codes vor:

- Guest QR -> Upload-Seite
- Admin QR -> Admin-Login

Generator-Workflow:

- `ops/pi/generate-qr-assets.sh`
- liest die Appliance-Env
- erzeugt PNG-Dateien aus `PUBLIC_BASE_URL`, `GUEST_UPLOAD_PATH` und `ADMIN_PATH`

Empfehlung fuer den Eventeinsatz:

- Guest-QR sichtbar am Eingang oder an der Fotostation
- Admin-QR nicht offen fuer alle aushaengen, sondern nur im Crew-/Host-Bereich

## Neue Konfigurationswerte

AP5 fuehrt folgende Appliance-relevanten Env-Werte ein:

- `APPLIANCE_MODE`
- `PUBLIC_BASE_URL`
- `GUEST_UPLOAD_PATH`
- `ADMIN_PATH`
- `DISPLAY_PATH`
- `KIOSK_START_URL`
- `EVENT_NAME`
- `AP_ENABLED`
- `AP_SSID`
- `AP_ADDRESS`
- `LOCAL_HOSTNAME`

Die Runtime und die Dokumentation beziehen sich damit auf dieselben Zieladressen.

## Admin-Systemstatus

`GET /api/system` liefert in AP5 zusaetzlich:

- Basis-URL
- Guest-/Admin-/Display-URL
- Event-Name
- Access-Point-Metadaten
- aktuellen globalen Modus
- aktuellen Moderationsmodus
- aktiven Display-Renderer
- freien und gesamten Speicherplatz

Das Admin-Dashboard zeigt diese Informationen in verdichteter Form an.

## Display-Robustheit

Die Display-Seite wurde fuer Dauerbetrieb gehaertet:

- initialer State-Load fuer Mode, Selfie und Visualizer
- sauberer SSE-Reconnect mit Backoff
- alte EventSource wird vor Reconnect geschlossen
- keine mehrfachen Subscriptions
- letzter gueltiger Renderer bleibt bei kurzem Backend-Verlust erhalten
- definierter Fallback auf `IdleRenderer`, wenn beim ersten Start noch kein State verfuegbar ist

Die Statusanzeige im Display bleibt klein und ruhig, damit der Beamerbetrieb nicht unnoetig gestoert wird.

## Browser-/Kiosk-Optimierungen

Im vorbereiteten Chromium-Start enthalten:

- `--kiosk`
- `--start-fullscreen`
- `--no-first-run`
- `--no-default-browser-check`
- `--disable-session-crashed-bubble`
- `--disable-infobars`
- `--autoplay-policy=no-user-gesture-required`

Host-seitig empfohlen:

- `xset s off`
- `xset -dpms`
- `xset s noblank`
- optional `unclutter`

## Host-Setup auf dem Raspberry Pi

Empfohlene Reihenfolge:

1. Raspberry Pi OS und Desktop/Kiosk-faehigen Browser installieren
2. Docker und Compose-Plugin installieren
3. Repository nach `/opt/raveberg` legen
4. `ops/pi/env.appliance.example` nach `ops/pi/env.appliance` kopieren und anpassen
5. AP-Konfigurationen fuer `hostapd`, `dnsmasq`, `dhcpcd` uebernehmen
6. systemd-Units nach `/etc/systemd/system/` kopieren
7. `sudo systemctl daemon-reload`
8. `sudo systemctl enable raveberg-stack.service`
9. `sudo systemctl enable raveberg-kiosk.service`
10. Neustart und kompletter Boot-Test

## systemd-Ansatz

`raveberg-stack.service`:

- startet den Compose-Stack
- haengt an `docker.service`
- ist fuer `multi-user.target` vorbereitet

`raveberg-kiosk.service`:

- startet nach `raveberg-stack.service`
- laeuft als Benutzer `pi`
- setzt `DISPLAY=:0`
- startet den Browser auf der vorbereiteten Display-URL

Die Beispiel-Unit muss vor Ort noch auf Benutzername, Pfade und XAUTHORITY abgestimmt werden.

## Eventbetrieb-Szenarien

### Kleiner Event / entspannter Betrieb

- `moderation_mode = auto_approve`
- `mode = selfie` oder `visualizer` je nach Phase
- Shuffle aktiv
- Guest-QR offen sichtbar

### Groesserer Event / kontrollierter Betrieb

- `moderation_mode = manual_approve`
- Admin-Zugriff separat halten
- Display dauerhaft im Kiosk auf dem Beamer
- Selfie-Uploads nur nach Freigabe sichtbar

## Bewusste Vereinfachungen in AP5

- keine vollautomatische AP-Einrichtung fuer jede Linux-Variante
- kein Captive Portal
- kein OTA-Update-Mechanismus
- keine Cloud- oder Fernwartungsschicht
- keine QR-Code-Verwaltung im Admin-UI

## Offene Punkte fuer AP6+

- vereinfachter Host-Installer fuer Raspberry Pi OS
- tiefere Betriebsdiagnostik
- optionale lokale Admin-Konsole am Geraet
- feinere Recovery-Strategien fuer Browser/Display
- spaetere Fernwartung oder Update-Mechanik
