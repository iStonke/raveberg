# AP7.2 - Idle Display fuer Eventbetrieb

## Zielwirkung

Der Idle Screen ist nicht mehr als technischer Wartezustand gedacht, sondern als fertiger Event-Screen:

- Marke sichtbar
- Botschaft sofort lesbar
- QR-Code als klare Haupthandlung
- keine Moderations- oder Admin-Kommunikation

Innerhalb von 2-3 Sekunden soll klar sein: Foto hochladen, direkt auf dem Screen sehen.

## Layout-Hierarchie

Die bevorzugte Event-Hierarchie ist jetzt:

1. Logo und Eventname
2. Hauptbotschaft `Selfies direkt auf den Screen`
3. kurze Zusatzzeile / Tagline
4. klare Upload-Aussage
5. grosser QR-Code
6. kleine Fallback-URL

Der QR-Code sitzt prominent auf einer ruhigen, kontrastreichen Flaeche und steht nicht zu nah am Rand.

Mit AP7.4 wurde diese Hierarchie weiter gestrafft:

- Logo
- kleine Kicker-Zeile mit Eventname
- kompakter Zweizeiler als Headline
- genau eine Handlungszeile
- kleine Fallback-URL
- klarer QR-Block als gleichwertiges Gegenueber

## Entfernte Inhalte

Fuer AP7.2 wurden aus dem Idle Screen entfernt:

- `IDLE MODE`
- der komplette Moderationsblock
- technische Labels wie `UPLOAD` oder `MODERATION`
- ausgeschriebene URL als dominantes Textelement

AP7.4 reduziert zusaetzlich:

- die fruehere zweite Erklaerungsebene unter der Headline
- doppelte Upload-Botschaften
- zu viele Mikrotexte auf der linken Seite

## Direkte Upload-Kommunikation

Die Kommunikation im Idle-Screen geht bewusst davon aus, dass neue Bilder direkt erscheinen:

- `Selfies direkt auf den Screen`
- `Fotos erscheinen direkt auf dem Display`
- `QR scannen`
- `Foto hochladen`
- `Direkt auf dem Screen`

Es gibt absichtlich keinen Hinweis auf Freigabe, Crew oder Pruefung.

## QR-Code-Kommunikation

Der QR-Code wird aus der Guest Upload URL der Runtime-Konfiguration abgeleitet.

Verwendet werden:

- Eventname aus Runtime-Konfiguration
- Guest Upload URL aus Runtime-Konfiguration
- Event-Tagline aus Runtime-Konfiguration

Die URL bleibt nur klein als Fallback sichtbar und ist nicht mehr der zentrale Inhalt des Screens.

Der QR-Bereich wurde in AP7.4 staerker als Action-Modul gestaltet:

- groesserer QR-Code
- ruhiges, helles Panel fuer hohe Scanbarkeit
- reduzierte Texte:
  - `QR scannen`
  - `Foto hochladen`
  - `Erscheint direkt`

## Unterschied zwischen Idle und Blackout

- `idle`: sichtbarer Event-Screen mit Branding, Botschaft und QR-Code
- `blackout`: komplett dunkler Sicherheitszustand ohne Kommunikationsinhalt

Damit bleiben beide Modi im Live-Betrieb klar unterscheidbar.

## Ambient-Hintergrundwolken

AP7.4 fuehrt hinter dem Container eine eigene Ambient-Ebene ein:

- grosse diffuse Glow-Flaechen
- dunkle Cyan-/Blau-Basis mit sehr dezenter warmer Restfarbe
- sehr langsame Drift in X/Y
- leichte, subtile Skalierung
- bewusst keine synchronen Bewegungen

Die Bewegung soll nur bei laengerem Hinsehen auffallen.

AP7.7 intensiviert diese Ebene bewusst:

- staerkere Drift-Radien statt nur leichter Verschiebung
- pro Wolke eigene Dauer, Richtung und Skalierungscharakteristik
- sichtbares "Atmen" ueber anisotrope Skalierung
- langsame Opacity-Verlaeufe fuer mehr Tiefe ohne Flackern
- zusaetzliche kleinere Cyan-Wolke fuer eine aktivere Vordergrundtiefe ausserhalb des Containers

Dadurch wirkt der Screen lebendiger und atmosphaerischer, ohne in einen hektischen Screensaver-Look zu kippen.

## Schutz von Lesbarkeit und QR-Code

Der Vordergrund bleibt bewusst dominant:

- Container mit dunkler, matter Flaeche ueber der Ambient-Ebene
- Hintergrundwolken nur weich und abgeschwaecht sichtbar
- keine transparenten Effekte ueber dem QR-Panel
- QR-Code liegt auf einem ruhigen hellen Kontrastfeld

Mit AP7.7 wurde dieser Schutz leicht verschaerft:

- der Container wurde innen etwas staerker abgedunkelt
- eine zusaetzliche matte Schicht beruhigt den Bereich hinter Logo und Headline
- der QR-Block bleibt auf einer hellen, unbewegten Ruhezone
- die staerkeren Bewegungen spielen sich vor allem ausserhalb des Containers ab

Dadurch bleibt der Screen atmosphaerisch, ohne die Scanbarkeit oder Lesbarkeit zu gefaehrden.

## Textlaenge und Ruhe

Der Idle-Screen bleibt bewusst knapp:

- eine Hauptbotschaft
- eine kleine direkte Upload-Aussage
- kurze QR-Handlungslabels
- optional kleine Tagline

Das Ziel ist ein ruhiger Club-/Event-Screen, kein Dashboard und kein Hinweisschild voller Technik.

## Performance und Stabilitaet

Die Ambient-Wolken sind absichtlich leichtgewichtig umgesetzt:

- reine DOM-/CSS-Loesung
- keine neue Grafikbibliothek
- keine JavaScript-Animation
- keine zusaetzlichen Timer oder Event-Subscriptions

Dadurch entstehen bei Renderer-Wechseln keine doppelten Animationsinstanzen oder Cleanup-Probleme.

AP7.7 behaelt diese Entscheidung bewusst bei:

- keine neue Grafikbibliothek
- weiterhin nur 5 Wolken-Layer
- lange, asynchrone Animationszyklen gegen sichtbare Wiederholungen
- staerkere Bewegung ueber CSS-Keyframes statt zusaetzlicher Runtime-Logik
