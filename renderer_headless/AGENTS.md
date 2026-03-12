# AGENTS.md

## Kontext dieses Ordners

Dieser Ordner enthält einen **separaten Renderer-Service** für RaveBerg.

Der Service ist **kein eigenes Fachsystem**, sondern ein technischer Rendering-Baustein innerhalb des bestehenden RaveBerg-Projekts.

Rollenverteilung:

- **Raspberry Pi / bestehendes RaveBerg-System**
  - Backend
  - Uploads
  - Admin
  - Moderation
  - API
  - Zustände
  - bestehende `/display`-Route

- **renderer_headless/**
  - lädt die bestehende `/display`-Ansicht
  - rendert sie headless
  - erzeugt daraus einen streambaren Output
  - stellt Health-/Diagnose-Endpunkte bereit

Wichtig:
- Dieser Ordner soll **keine Business-Logik des Backends duplizieren**
- Der Renderer ist nur für Rendering / Videoausgabe zuständig

---

## Primäres Ziel

Ziel dieses Services ist:

1. die bestehende `/display`-Seite zu laden
2. sie ohne Desktop-/Bildschirmaufnahme zu rendern
3. einen streambaren Output zu erzeugen
4. für den Raspberry Pi als Display-Quelle zu dienen

Bevorzugte Richtung:
- **headless rendering**
- **kein Screen Capture**
- **kein AVFoundation/Desktop-Abfilmen**
- **keine fragilen GUI-Hacks**

---

## Architekturprinzipien in diesem Ordner

### 1. Keine doppelte Business-Logik
Der Renderer darf:
- Display-Seite laden
- Zustände konsumieren
- Frames erzeugen
- Video ausgeben

Er darf nicht:
- Upload-/Moderationslogik neu implementieren
- Zustandslogik doppeln
- eigene Fachlogik neben dem Backend aufbauen

### 2. Bestehende `/display`-Ansicht ist Quelle
Bitte die bestehende Display-Kette des Projekts möglichst weiterverwenden.

Wenn möglich:
- `/display` laden
- vorhandene Darstellung wiederverwenden
- nur den Renderweg neu organisieren

### 3. Diagnose ist Pflicht
Dieser Service muss gut beobachtbar sein.

Mindestens mitdenken:
- `/health`
- klare Logs
- Status des Renderers
- Status der Videoausgabe
- letzter erfolgreicher Render
- lesbare Fehler statt schwarzer Leere

### 4. Minimal lauffähig zuerst
Bitte Renderer-Features in dieser Reihenfolge bauen:

1. minimaler Start
2. Health
3. Preview/Testbarkeit
4. streambarer Output
5. Integration / Doku
6. erst danach Optimierung

---

## Technische Leitplanken

### Bevorzugt
- headless Browser / kontrollierte Renderumgebung
- direkte Render-/Frame-Pipeline statt Bildschirmaufnahme
- effizienter Video-Output
- robuste, reproduzierbare Umgebung

### Vermeiden
- Desktop-Capture
- Bildschirmaufnahme als Standardweg
- macOS-spezifische Capture-Hacks
- unnötige GUI-Abhängigkeiten
- fragile Einmaltricks

### Video/Streaming
Bevorzugt:
- H.264 oder ähnlich effiziente Formate
- pragmatischer erster Video-Output okay
- MJPEG höchstens als Debug/Fallback, nicht als Zielpfad

---

## Konfiguration

Bitte keine lokalen Spezialpfade hartkodieren.

Der Service soll möglichst über klar benannte Konfiguration steuerbar sein, z. B.:

- Render-URL / Display-URL
- Backend-URL
- Port
- Auflösung
- FPS
- Videoformat / Encoder-Modus
- Health-/Preview-Endpunkte

Defaults sind okay, aber bitte klar dokumentieren.

---

## Ordnerstruktur

Bitte in diesem Ordner sauber strukturieren.

Bevorzugt:
- klare Startdatei
- Config/Settings
- Renderer-Logik
- Output/Streaming-Logik
- Health/HTTP
- README

Keine unnötig monolithische Ein-Datei-Lösung, wenn sich abzeichnet, dass der Service wächst.

---

## README-Erwartung

Zu diesem Ordner gehört eine README mit:

1. Zweck des Services
2. Startanleitung
3. Konfiguration
4. Endpunkte
5. bekannte Einschränkungen
6. wie der Pi den Output konsumieren soll

---

## Erwartete Codex-Ausgabe bei Änderungen in diesem Ordner

Bitte nach relevanten Änderungen immer angeben:

1. was geändert wurde
2. welche Dateien neu/geändert sind
3. wie der Service gestartet wird
4. welche Endpunkte verfügbar sind
5. wie man erkennt, dass der Renderer korrekt läuft
6. bekannte Grenzen / nächste sinnvolle Schritte

---

## Zielbild dieses Ordners

Der Renderer-Service soll langfristig:

- stabil
- headless
- wartbar
- diagnostizierbar
- vom restlichen Projekt sauber getrennt

sein.

Er ist ein technischer Baustein für:
- externer Full-Display-Renderer
- Pi bleibt Master
- Pi zeigt finalen streambaren Output