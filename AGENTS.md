# AGENTS.md

## Projektkontext

Dieses Repository enthält das Projekt **RaveBerg**.

RaveBerg ist ein Event-/Party-Display-System mit folgenden Hauptbestandteilen:

- **backend/**  
  API, Uploads, Moderation, Zustände, Event-Logik, Persistenz

- **frontend/**  
  Admin-Oberfläche, Display-Ansichten, `/display`, Visualizer, Slideshows, Idle-Screens, Overlays

- **ops/**  
  Start-/Betriebskonfigurationen, Pi-spezifische Umgebungen, Appliance-Setup

Zielarchitektur:
- Der **Raspberry Pi** bleibt Master für Backend, Uploads, Admin, Moderation und Zustände.
- Ein externer Renderer darf Rendering-Arbeit übernehmen.
- Rendering-Lösungen sollen möglichst sauber, robust und wartbar sein.

---

## Allgemeine Arbeitsweise

Bei Änderungen bitte:

1. **Bestehende Architektur zuerst verstehen**, bevor größere neue Strukturen eingeführt werden.
2. **Möglichst wenig Business-Logik duplizieren.**
3. Neue Features **sauber als getrennte Module/Services** aufbauen.
4. Änderungen **inkrementell** umsetzen:
   - erst minimal lauffähig
   - dann erweitern
5. Bestehende Dateien nur dann stark umbauen, wenn es wirklich nötig ist.
6. Keine unnötigen großflächigen Refactorings ohne klaren Nutzen.

---

## Bevorzugte Umsetzungsprinzipien

### 1. Saubere Trennung
Bevorzugt werden klare Rollen:

- backend = Logik / API / Zustände
- frontend = UI / Display / Admin
- renderer = optional separater Rendering-Service

Neue Rendering- oder Streaming-Lösungen bitte **nicht als unstrukturierte Hacks** in bestehende Dateien mischen.

### 2. Bestehende `/display`-Logik weiterverwenden
Wenn ein externer Renderer gebaut wird:
- nach Möglichkeit die bestehende `/display`-Seite weiterverwenden
- keine doppelte Business-Logik außerhalb des bestehenden Systems aufbauen
- bestehende Renderpfade analysieren und gezielt wiederverwenden

### 3. Erst pragmatisch, dann elegant erweitern
Neue Services bitte zuerst in einer **minimal lauffähigen Version** bauen:
- health endpoint
- preview
- einfache Konfiguration
- klare Logs

Danach erst Optimierungen.

### 4. Konfigurierbarkeit
Neue Funktionen bitte nicht hartkodieren.

Bevorzugt:
- Umgebungsvariablen
- klar benannte Defaults
- dokumentierte Ports/URLs
- sinnvolle CLI- oder Config-Optionen

---

## Stil bei Codeänderungen

### Backend / Services
- lieber kleine, klar getrennte Funktionen
- klare Fehlerbehandlung
- lesbare Logs
- keine unnötig magischen Seiteneffekte

### Frontend / Display
- bestehende Struktur respektieren
- neue Renderer-Komponenten klar benennen
- keine schweren Effekte ungeprüft global aktivieren
- Performance auf schwacher Hardware immer mitdenken

### Renderer-/Streaming-Code
- Diagnosefähigkeit ist wichtig
- Health-/Statusinformationen immer mitdenken
- lieber robuste und transparente Lösung als „cleverer“ fragiler Trick
- keine Desktop-/Screen-Capture-Hacks, wenn es eine sauberere Render-Lösung gibt

---

## Performance-Grundsätze

RaveBerg läuft oder interagiert mit schwacher Hardware (insbesondere Raspberry Pi). Daher gilt:

1. GPU-/CPU-intensive Effekte sparsam einsetzen.
2. Unnötige Blur-, Backdrop-, Glow- und Filter-Ketten vermeiden.
3. Framerate, Auflösung und Render-Qualität konfigurierbar halten.
4. Wenn möglich:
   - Headless Rendering vor Screen Capture
   - effizientere Videoformate vor MJPEG
5. Immer mitdenken:
   - Pi ist schwächer als Renderer-PC
   - Netzwerk und Dauerbetrieb sind reale Randbedingungen

---

## Gewünschte Arbeitsweise bei größeren Aufgaben

Bei größeren Änderungen bitte in sinnvoller Reihenfolge arbeiten:

1. **Bestehende relevante Dateien identifizieren**
2. **Minimalen Zielpfad herstellen**
3. **Health/Diagnose sicherstellen**
4. **Preview/Testbarkeit herstellen**
5. **Integration dokumentieren**
6. Erst danach verfeinern

Wenn neue Services entstehen, bitte immer mitliefern:
- README
- Startanleitung
- Konfigurationsübersicht
- bekannte Grenzen

---

## Was vermieden werden soll

Bitte vermeiden:

- unnötige komplette Neuaufbauten des Projekts
- doppelte Business-Logik neben dem bestehenden Backend
- schwer wartbare Einmal-Prototypen im Hauptpfad
- stilles Hartkodieren lokaler Spezialpfade
- Plattform-Hacks ohne klare Begründung
- „magische“ Lösungen ohne Health/Diagnose

---

## Bei neuen Services

Wenn ein neuer Service ergänzt wird, bitte bevorzugt so strukturieren:

- eigener Ordner im Repo
- eigene README
- klare Startdatei
- klare Config
- optional Docker-/Compose-Integration
- Health-Endpunkt
- Preview/Test-Endpunkt
- saubere Logs

---

## Erwartete Ausgabe von Codex

Nach größeren Änderungen bitte immer liefern:

1. kurze Zusammenfassung
2. Liste der neuen/geänderten Dateien
3. Startanleitung
4. Konfigurationshinweise
5. bekannte Einschränkungen / nächste sinnvolle Schritte

---

## Projektziel bei Renderer-Themen

Für Renderer-/Display-Themen ist die bevorzugte Richtung:

- Pi bleibt Master
- externer Renderer übernimmt schwere Renderarbeit
- bestehende `/display`-Logik möglichst weiterverwenden
- keine Bildschirmaufnahme, wenn es headless/renderseitig sauberer lösbar ist
- streambarer Output für den Pi
- robuste, wartbare Architektur statt kurzfristiger Hack