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

- **OpenDocument (`.ods`)** ist der Standardexport und das offene Tabellenformat für LibreOffice, OnlyOffice und ähnliche Programme.
- **Excel (`.xlsx`)** bleibt wählbar und behält das bisherige Drucklayout und die Formatierung.
- **CSV (`.csv`)** ist eine einfache UTF-8-Datei mit deutscher Semikolontrennung; sie enthält die Plan-Daten, jedoch keine Druckformatierung.

Alle drei Exportwege funktionieren komplett im Browser.

Unter **Erweiterte Einstellungen** lassen sich eine eigene Regeldatei (`services.json`)
und eigene ICS-Kalender auswählen. Eigene Kalender ersetzen die mitgelieferten
Kalender. Die Option „Ferien- und Feiertagsprüfung deaktivieren“ entspricht
Python mit einer leeren Kalenderliste. Änderungen an diesen Einstellungen oder
ein neuer Import machen einen zuvor vorbereiteten Export ungültig.

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

Die Repository-/CI-Suite benötigt keine externe Python-Referenz. Der semantische
Regressionstest in `tests/pdf-real.test.js` wird ausdrücklich als übersprungen
gemeldet, wenn `MINIPLAN_REFERENCE` nicht gesetzt ist oder die PDF-Testdatei
`01.07.2026-04.10.2026.pdf` dort fehlt. Mit vorhandener Referenz läuft er automatisch:

```sh
MINIPLAN_REFERENCE=../miniplan-optimized npm run check
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

### Browser-Parität mit Python prüfen

`scripts/browser-parity.mjs` öffnet `dist/miniplan.html` direkt über `file://`
in Chromium (Zeitzone Europe/Berlin). Es vergleicht PDF- und XLSX-Import,
Diagnosen, Plan und exportierte Tabellenzellen mit der Python-Referenz und prüft
ODS sowie die erweiterten Einstellungen und fehlgeschlagene Ersatzimporte.
Playwright ist als Entwicklungsabhängigkeit im Lockfile festgelegt. Voraussetzung
sind das passende Chromium sowie die Python-Referenz mit ihren Abhängigkeiten
und der PDF-Testdatei unter `../miniplan-optimized`.
Diese Browser-Paritätsprüfung bleibt die verpflichtende lokale Prüfung mit der
echten PDF-Datei; eine fehlende Referenz führt hier weiterhin zum Fehler, nicht
zum Überspringen.

```sh
npm ci
npx playwright install chromium
# Unter Linux bei fehlenden Systembibliotheken: npx playwright install --with-deps chromium
uv sync --project ../miniplan-optimized --frozen
npm run test:browser
```

Der Test verwendet automatisch die `.venv` der Python-Referenz, andernfalls
`python3`; `PYTHON=/absolute/path/to/python` überschreibt diese Auswahl.
`MINIPLAN_REFERENCE` überschreibt den Referenzordner. Für ein bereits installiertes
Chromium kann `AGENT_BROWSER_EXECUTABLE_PATH` gesetzt werden. Der Test meldet den
Pfad zu seinen temporären Testdateien und Downloads.
