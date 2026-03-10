# AP7.1 - Guest Upload UI vereinfachen und optimieren

## Zielstruktur

Die Guest-Upload-Seite ist jetzt auf einen minimalen Event-Flow reduziert:

1. Logo
2. kurze Headline
3. Hauptaktion `Kamera oeffnen`
4. Sekundaeraktion `Bild auswaehlen`
5. kurzer Moderationshinweis
6. kompakte Upload-Regeln
7. Upload-Feedback mit Thumbnail

Die Seite soll auf typischen Smartphone-Hoehen ohne unnötiges Scrollen bedienbar bleiben.

## Entfernte Elemente

Fuer AP7.1 wurden entfernt:

- Texttitel `Guest Upload`
- zweiter Texttitel `RAVEBERG`
- Ablauf-Card
- nummerierte Schrittbeschreibung
- laengere Erklaerungstexte

Das Logo ist jetzt der einzige visuelle Haupttitel.

## Reduzierte Textstrategie

Die Copy wurde bewusst stark gekuerzt:

- Default: `Foto hochladen – erscheint gleich auf dem Screen.`
- bei `manual_approve`: `Die Crew prueft dein Bild kurz, dann erscheint es auf dem Screen.`

Fehlertexte werden ebenfalls knapp und menschlich gehalten, statt technische API-Details zu zeigen.

## Upload-Feedback mit Thumbnail

Nach erfolgreichem Upload erscheint eine kleine Bestaetigungsbox mit:

- Thumbnail des gerade gewaehlten Bildes
- Titel `Bild hochgeladen`
- kurzer Statuszeile je nach Moderationsmodus

Das Thumbnail wird direkt aus der lokal gewaehlten Datei erzeugt, die technische Upload-Logik bleibt unveraendert.

## Moderationshinweise

Die Seite kommuniziert den aktiven Moderationsmodus weiterhin dynamisch:

- `auto_approve`: Bild erscheint nach Verarbeitung
- `manual_approve`: Crew prueft das Bild kurz

## Designprinzip

AP7.1 folgt einem minimalen Event-Flow:

- eine Hauptaktion
- wenig Text
- grosse Touch-Ziele
- keine Ablenkung durch Nebeninfos
- schnelle visuelle Rueckmeldung nach Upload
