# Miniplan

[![Deploy GitHub Pages](https://github.com/Zwiebelrostbraten/miniplan/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Zwiebelrostbraten/miniplan/actions/workflows/deploy-pages.yml)

Eine datensparsame, browserbasierte Web-App für den St.-Georg-Miniplan. Sie liest Gottesdienstpläne aus PDF-, Excel-, OpenDocument- oder CSV-Dateien ein, bietet eine Korrekturtabelle und erzeugt daraus einen Miniplan als formatiertes Excel-Dokument oder in offenen Tabellenformaten.

**Live-Version:** https://zwiebelrostbraten.github.io/miniplan/

## Datenschutz und Betrieb

- Keine Anmeldung, kein Server, keine Datenbank.
- PDFs und Excel-Dateien werden ausschließlich im Browser verarbeitet.
- Nach der ersten Seite-Ladung läuft die Anwendung auch ohne Internetverbindung weiter.
- Die veröffentlichte Website wird automatisch aus dem `main`-Branch über GitHub Pages bereitgestellt.

> **Hinweis:** Gottesdienstpläne vor dem Export immer in der Prüftabelle kontrollieren. Die PDF-Erkennung ist auf das aktuelle fünfspaltige Layout des Pfarrbüros ausgelegt. Eingescannte PDFs benötigen zunächst eine OCR-Textschicht.

## Funktionen

- Import von `.pdf`, `.xlsx`, `.ods` und `.csv`
- Sofort sichtbare, editierbare Prüftabelle für eingelesene Gottesdienste
- Manuelles Ergänzen und Entfernen von Einträgen
- Berücksichtigung von Ferien, Faschingsferien und Feiertagen in Baden-Württemberg
- Konfigurierbare Gottesdienste sowie Wochendienst am Sonntag
- Formatiertes `.xlsx` für den bisherigen Excel-Workflow
- Offener Export als `.ods` (OpenDocument Spreadsheet) oder UTF-8-`.csv` mit Semikolontrennung
- Lokale Beispieldaten zum gefahrlosen Testen

## Verwendung

### Online

Die aktuelle Version unter https://zwiebelrostbraten.github.io/miniplan/ öffnen. Datei auswählen, Daten prüfen und vor dem Download im Formatmenü wählen:

- **Excel (`.xlsx`)** behält das bisherige Drucklayout und die Formatierung.
- **OpenDocument (`.ods`)** ist das offene Tabellenformat für LibreOffice, OnlyOffice und ähnliche Programme.
- **CSV (`.csv`)** ist eine einfache UTF-8-Datei mit deutscher Semikolontrennung; sie enthält die Plan-Daten, jedoch keine Druckformatierung.

Alle drei Exportwege funktionieren komplett im Browser.

### Vollständig lokal

Nach einem Build liegen die Dateien in `dist/`. Den gesamten Ordner zusammenhalten und `dist/miniplan.html` im Browser öffnen. Die vier Laufzeitdateien dürfen nicht getrennt werden:

- `miniplan.html`
- `miniplan.css`
- `miniplan.js`
- `miniplan.worker.js`

`index.html` ist zusätzlich für GitHub Pages vorhanden.

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm ci
npm test
npm run lint
npm run build
```

Oder alle Prüfungen in einem Schritt:

```bash
npm run check
```

Der Build erstellt die veröffentlichbaren Dateien unter `dist/`. Diese werden nicht eingecheckt; der GitHub-Pages-Workflow baut sie bei jedem Push auf `main` neu.

## Projektstruktur

```text
src/
  app.js              Benutzeroberfläche und Browser-Integration
  core/               Einlesen, Normalisierung, Regeln und Excel-Export
  data/               Lokale Gottesdienst-, Ferien- und Feiertagsdaten
  index.html          HTML-Vorlage
  style.css           Oberflächengestaltung
tests/                Unit- und Build-Tests
.github/workflows/    Automatischer Test- und Pages-Deployment-Workflow
```

## Qualitätssicherung

Der Deployment-Workflow führt vor jeder Veröffentlichung automatisch Tests, Linting und den Build aus. Ein fehlgeschlagener Check wird nicht veröffentlicht.

## Lizenz

[MIT](LICENSE)
