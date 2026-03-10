# AP7 - Branding, Event-UX, Display-Overlays und Feinschliff

## Zielbild

AP7 macht RAVEBERG im sichtbaren Verhalten eventtauglicher. Die bestehende technische Architektur bleibt bestehen; erweitert werden Branding, Klarheit, Display-Wirkung und Live-Bedienbarkeit.

## Branding-Konzept

Das Branding kommt jetzt aus der Runtime-Konfiguration:

- `EVENT_NAME`
- `EVENT_TAGLINE`
- `DISPLAY_OVERLAY_ENABLED`

Diese Werte wirken direkt in:

- Guest Upload View
- Admin App Shell und Dashboard
- Idle Renderer
- Display-Overlay auf Selfie und Visualizer

Das System bleibt damit auf andere Eventnamen umstellbar, ohne Frontend-Texte hart umzubauen.

## Oeffentliche Runtime-Infos

Fuer Guest- und Display-Clients gibt es `GET /api/public-info`.

Der Endpunkt liefert:

- Event-Name
- Event-Tagline
- Overlay-Flag
- Moderationsmodus
- Upload-Limit
- Guest-/Admin-/Display-URL
- AP-/Hostname-Info

Dadurch muessen Guest und Display nicht ueber Admin-Endpunkte an Branding- oder Eventdaten kommen.

## Guest-UX

Die Guest-Upload-Seite wurde in AP7 gezielt geschaerft:

- klarer Event-Lockup mit Event-Name und Tagline
- kurze 1-2-3-Kommunikation fuer den Upload-Flow
- sichtbarer Hinweis auf den aktuellen Moderationsmodus
- klarere Erfolgsmeldungen
- menschlichere Fehlertexte fuer:
  - Rate Limit
  - zu grosse Dateien
  - falsche Formate
  - defekte Bilder
  - generische Ausfaelle

Der Upload bleibt weiterhin offen und maximal reduziert. Es werden keine Admin-Funktionen sichtbar gemacht.

## Dashboard fuer Eventbetrieb

Das Admin-Dashboard wurde fuer den Live-Einsatz sichtbarer strukturiert:

- Quick Controls bleiben oben und prominent
- Event-Name und Tagline sitzen direkt im Quick-Control-Bereich
- Betriebsstatus zeigt wichtige Live-Zustaende kompakt
- Event Setup & QR-Bereich zeigt:
  - Guest Upload URL
  - Admin URL
  - Display URL
  - AP-/Hostname-Info
  - klaren Hinweis, welcher QR fuer wen gedacht ist
- Upload-Sektion zeigt Pending/Approved/Rejected sichtbar zusammengefasst

Ziel war kein Backoffice-Redesign, sondern schnell erfassbare Live-Informationen auf dem Smartphone im Keller.

## Display-Overlays

AP7 fuehrt ein leichtgewichtiges Overlay fuer Selfie und Visualizer ein.

Das Overlay zeigt dezent:

- Event-Name
- Event-Tagline
- Moduskontext
- im Selfie-Modus zusaetzlich die Guest Upload URL

Das Overlay bleibt bewusst klein, halbtransparent und ohne Interaktion. Im Blackout-Modus wird es nicht gezeigt.

## Idle und Blackout

### Idle

Idle ist jetzt ein sichtbarer Standby-Screen mit:

- Event-Name
- Event-Tagline
- Upload-URL
- Moderationshinweis
- ruhigen, subtilen Ambient-Formen

Idle ist damit klar als ruhiger Zwischenzustand fuer Start, Umbau oder Pausen erkennbar.

### Blackout

Blackout bleibt bewusst maximal reduziert:

- komplett dunkle Flaeche
- keine sichtbaren Reste anderer Renderer
- keine Animationen
- kein zusaetzlicher UI-Muell

Damit bleibt Blackout die Safety-/Panic-Funktion und wird nicht mit Idle vermischt.

## Selfie-Feinschliff

Der SelfieRenderer wurde fuer echte Nutzung verfeinert:

- weichere Fade-Uebergaenge
- sauberer Platzhalterzustand ohne freigegebene Bilder
- ruhige Darstellung bei nur einem Bild im Pool
- pausierte Slideshow bleibt als definierter Zustand erkennbar
- dezente Meta-Information statt roher Platzhaltertexte

Die eigentliche Freigabelogik bleibt weiterhin im Backend.

## Visualizer-Feinschliff

Der Canvas-Renderer bleibt bewusst leichtgewichtig. AP7 verbessert:

- weichere Reaktion auf Speed/Intensity/Brightness-Aenderungen durch leichtes Smoothing
- visuell ruhigere Presetwechsel durch sanften Uebergangs-Fade
- keine neue schwere Grafikarchitektur

Das Ziel ist Feinschliff fuer den Einsatz, nicht ein komplett neues Render-System.

## Leere und Randzustaende

AP7 gestaltet mehrere Randzustaende bewusst:

- Guest ohne Runtime-Info faellt sauber auf Default-Branding zurueck
- Selfie ohne Bilder wirkt fertig statt roh
- Selfie mit einem Bild bleibt ruhig
- Idle wirkt absichtlich gestaltet statt technisch leer
- fehlende AP-/QR-Infos werden als klarer Zustand angezeigt, nicht als kaputte UI

## Bewusste Vereinfachungen

- kein frei konfigurierbarer Theme-Editor
- keine hochkomplexe QR-Verwaltung im UI
- kein mehrsprachiges i18n-System
- kein Redesign jedes einzelnen Screens
- kein visuelles Overengineering mit schweren Animationen

## Vorbereitung fuer AP8

AP7 schafft eine bessere Basis fuer spaetere Ausbaustufen:

- weitergehende Event-Settings
- optionale QR-Preview/Download-Pfade
- noch feinere Branding-/Theme-Konfiguration
- spaetere Audio-Reaktivitaet und weitere Display-Modi
