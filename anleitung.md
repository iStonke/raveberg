# Verbindung zum Raspberry Pi (RaveBerg)

Diese Anleitung beschreibt, wie du dich mit dem Raspberry Pi verbindest und die wichtigsten Dienste nutzt.

---

## 1. Tailscale einrichten und anmelden

1. Öffne Tailscale auf deinem Rechner  
2. Melde dich über **GitHub** an

**Zugangsdaten:**

- Benutzername: `j.steinke@me.com`
- Passwort: `nucda6-keccuk-sYrtuw`

---

## 2. Verbindung per SSH (optional, für Steuerung)

Falls du Zugriff auf den Pi brauchst:

```bash
ssh jan@pi-rave
```

---

## 3. Dienste starten (optional)

Nach erfolgreicher SSH-Verbindung:

```bash
cd /opt/raveberg
bash ops/pi/start-event.sh
```

---

## 4. Admin-Zugriff

Admin-Oberfläche im Browser öffnen:

```
http://pi-rave.local:8085/admin/login
```

**Was ist das?**  
Hier steuerst du das gesamte System: Modi wechseln (Visualizer, Slideshow etc.), Uploads verwalten und Einstellungen anpassen.

**Login:**

- Benutzername: `admin`
- Passwort: `admin123`

---

## 5. Display aufrufen

```
http://pi-rave.local:8085/display
```

**Was ist das?**  
Das ist die eigentliche Anzeige für die Party – also das, was später auf dem Bildschirm/Beamer läuft (Visualizer, Fotos, Videos usw.).


---

## 6. Gäste-Upload

```
http://pi-rave.local:8085/guest/upload
```

**Was ist das?**  
Hier können Gäste Bilder hochladen, die anschließend automatisch im System erscheinen und z. B. in der Slideshow angezeigt werden.


---

## Hinweise

- Stelle sicher, dass Tailscale aktiv verbunden ist
- Der Pi muss eingeschaltet und im Netzwerk erreichbar sein
- Bei Problemen ggf. SSH-Verbindung prüfen