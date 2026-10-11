# MiniPlan

**Vom Gottesdienstplan zur Dienstplantabelle für Ministrantinnen und Ministranten.** MiniPlan liest Pläne aus dem Pfarrbüro ein, bietet eine bearbeitbare Prüfansicht und exportiert die benötigten Dienste. Die Verarbeitung erfolgt lokal im Browser, ohne Konto.

[![GitHub Pages](https://github.com/Zwiebelrostbraten/miniplan/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Zwiebelrostbraten/miniplan/actions/workflows/deploy-pages.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

[**App öffnen**](https://tools.minis-mutlangen.de) · [Schnellstart](#schnellstart) · [Dateiformate](#dateiformate) · [Anpassung](#anpassung) · [Entwicklung](#entwicklung) · [GitHub](https://github.com/Zwiebelrostbraten/miniplan)

## Funktionen

- Mehrere PDF- oder Tabellendateien gemeinsam importieren, auch per Drag & Drop.
- Gottesdienste prüfen, bearbeiten, ergänzen und direkt löschen – in einer kompakten Ansicht für Desktop und Mobilgeräte.
- Dienste anhand der Gemeinde, Gottesdienstart und konfigurierbarer Regeln vorbereiten; Ferien und Feiertage berücksichtigen.
- Vorschau kontrollieren und als formatierte ODS- oder XLSX-Datei oder als CSV herunterladen.

**MiniPlan führt die benötigten Dienste auf, teilt ihnen aber keine Personen zu.** Die persönliche Einteilung erfolgt anschließend in der exportierten Tabelle.

## Schnellstart

1. [MiniPlan öffnen](https://tools.minis-mutlangen.de) und eine oder mehrere Dateien auswählen oder auf das Dateifeld ziehen. Zum Ausprobieren gibt es unter **„Einstellungen“ → „Beispieldaten laden“** einen kleinen Beispielplan.
2. **„Eigene Gemeinde“** prüfen; voreingestellt ist `St. Georg`. Nach dem Import **„Gottesdienste prüfen“** wählen und Datum, Zeiten, Bezeichnung und Ort kontrollieren. Bei Unstimmigkeiten die eingeklappten Importhinweise öffnen.
3. Mit dem **Stiftsymbol** einen Eintrag bearbeiten und speichern oder abbrechen. **„Hinzufügen“** öffnet einen neuen Entwurf, der erst beim Speichern übernommen wird. Das **Papierkorbsymbol löscht mit einem Klick, ohne Rückfrage**.
4. **„Miniplan vorbereiten“** wählen, die Vorschau prüfen und **„Herunterladen“** anklicken. ODS ist voreingestellt; XLSX und CSV stehen ebenfalls zur Auswahl.

Die Liste zeigt zunächst fünf passende Gottesdienste; der Schalter darunter klappt die übrigen auf. Standardmäßig werden nur Orte angezeigt, deren Bezeichnung die eigene Gemeinde enthält. **„Andere Gemeinden anzeigen“ ändert ausschließlich die Ansicht**: Alle Importdaten bleiben erhalten, und die Planungsregeln gelten unverändert.

Nach Änderungen an Einträgen, Gemeinde, Regeln oder Kalendern muss der Miniplan erneut vorbereitet werden. Ein neuer Import ersetzt die bisherigen Daten; auch ein fehlgeschlagener Ersatzimport entfernt den bisherigen Plan und sperrt dessen Download.

## Dateiformate

| Format | Import | Export |
| --- | --- | --- |
| PDF | Textbasiertes, unterstütztes Pfarrbüro-Layout | – |
| ODS | Pfarrbüro-Tabelle | **Standard:** formatierte Tabelle mit Drucklayout |
| XLSX | Pfarrbüro-Tabelle | Formatierte Tabelle mit Drucklayout |
| CSV | Pfarrbüro-Tabelle | Daten ohne Drucklayout, UTF-8 mit Semikolontrennung |

### Unterstütztes Layout

Der Tabellenimport erwartet Datumszeilen und die Spalten Beginn, Ende, Gottesdienst und Ort im Aufbau des Pfarrbüroplans. Beliebige Tabellen und die exportierte Dienstplantabelle werden nicht automatisch als Gottesdienstplan erkannt.

Die PDF-Erkennung liest vorhandenen Text anhand seiner Positionen im fünfspaltigen Pfarrbüro-Layout. **MiniPlan führt keine OCR aus**; reine Scans benötigen vorher eine Textschicht. Abweichende Spaltenpositionen, Umbrüche oder beschädigte Texte können Angaben verfälschen oder auslassen. Die importierten Einträge sollten deshalb auch dann geprüft werden, wenn keine Importhinweise erscheinen.

## Datenschutz und Offline-Nutzung

Import, Planung und Export laufen auf dem eigenen Gerät. **Ausgewählte Dateien werden nicht an einen Server hochgeladen.** Die Anwendung benötigt keine CDN-Skripte oder entfernten Laufzeitressourcen. Beim ersten Laden der Website ist Internet erforderlich, um die Anwendung vom Hosting abzurufen.

Nach dem Laden kann die Verarbeitung in der geöffneten Seite ohne Internet fortgesetzt werden. Für einen späteren Offline-Aufruf der Website gibt es keine PWA- oder Service-Worker-Garantie. Bearbeitungen werden nicht dauerhaft gespeichert: **Ein Neuladen der Seite verliert die Änderungen.** Den fertigen Plan daher rechtzeitig herunterladen.

Eine lokale Kopie lässt sich nach dem [Build](#entwicklung) direkt über `dist/miniplan.html` öffnen. Dafür diese vier Dateien gemeinsam im selben Ordner aufbewahren:

```text
miniplan.html
miniplan.css
miniplan.js
miniplan.worker.js
```

`dist/index.html` ist der zusätzliche Einstieg für das Webhosting.

## Anpassung

### Gemeinde und Planungsregeln

Für die Planung berücksichtigt MiniPlan Orte, deren Bezeichnung den Gemeindenamen enthält, sowie die vollständigen Ortsangaben `extern` und `dorffest`. Groß-/Kleinschreibung und deutsche Schreibvarianten werden vereinheitlicht. Die Ausnahmen gelten nur für diese beiden vollständigen Angaben: `extern – andere Kirche` oder beliebige andere externe Ortsnamen werden darüber nicht einbezogen. Die Anzeige anderer Gemeinden erweitert diese Auswahl nicht.

Die mitgelieferten [Planungsregeln](src/data/services.json) definieren Gottesdienstarten, Bezeichnungen und Dienste. Unter **„Einstellungen“ → „Planungsregeln (JSON)“** lässt sich eine eigene Datei mit derselben Struktur laden. Sonderregeln können zusätzlich Datum, Zusatzinformationen und Ort berücksichtigen. Einträge mit „entfällt“, Friedensgebete und Totengedenken werden nicht eingeplant; sonntäglicher Wochendienst wird im Zeitraum der relevanten Gottesdienste ergänzt. Die genaue Umsetzung steht in [schedule.js](src/core/schedule.js).

### Ferien und Feiertage

Standardmäßig werden die mitgelieferten Kalender für Ferien, Faschingsferien und Feiertage in Baden-Württemberg verwendet. Ihre Zeiträume sind begrenzt; für andere Jahre oder Regionen können unter **„Ferien & Feiertage (ICS)“** eigene Kalender geladen werden. **Die ausgewählten ICS-Dateien ersetzen gemeinsam die Standardkalender**, statt sie zu ergänzen.

**„Ferien- und Feiertagsprüfung deaktivieren“** schaltet die Kalenderprüfung aus und deaktiviert die ICS-Dateiauswahl. Der Hinweis im Exportbereich zeigt den aktuellen Kalenderzustand. Die Prüfung beeinflusst insbesondere Donnerstagsgottesdienste und Schülergottesdienste.

## Entwicklung

Voraussetzung sind **Node.js 22 oder neuer** und npm. Für einen normalen Checkout sind weder Python noch private Testdateien erforderlich.

```sh
git clone https://github.com/Zwiebelrostbraten/miniplan.git
cd miniplan
npm ci
npm run check
```

`npm run check` führt ESLint, den Build und die Vitest-Suite aus. Wer nur die Anwendung bauen möchte, verwendet nach `npm ci`:

```sh
npm run build
```

Der [Build](build.mjs) bündelt die Abhängigkeiten mit esbuild nach `dist/`. Anschließend `dist/miniplan.html` im Browser öffnen. UI und Verhalten liegen in [src/index.html](src/index.html), [src/style.css](src/style.css) und [src/app.js](src/app.js); Import, Planung und Export sind in [src/core](src/core) getrennt.

### Gezielte Prüfungen

Einzelne Tests können direkt ausgeführt werden, beispielsweise:

```sh
npx vitest run tests/service-view.test.js
```

Für Änderungen an Interaktionen oder responsivem Layout gibt es eine Browserprüfung mit generierten Beispieldaten, ohne Python-Referenz. Sie benötigt den aktuellen Build und Playwright/Chromium:

```sh
npx playwright install chromium
npm run build
node scripts/browser-responsive.mjs
```

Bei fehlenden Linux-Systembibliotheken kann `npx playwright install --with-deps chromium` erforderlich sein. `AGENT_BROWSER_EXECUTABLE_PATH` erlaubt die Verwendung eines bereits installierten Chromium.

<details>
<summary>Optionale Referenz- und PDF-Prüfungen</summary>

Der zusätzliche reale PDF-Test läuft nur, wenn `MINIPLAN_REFERENCE` auf einen separat vorhandenen Referenzordner mit der erwarteten PDF-Datei zeigt. Andernfalls wird er übersprungen:

```sh
MINIPLAN_REFERENCE=../miniplan-optimized npm run check
```

`npm run test:browser` baut die Anwendung und startet den umfassenderen Vergleich über [browser-parity.mjs](scripts/browser-parity.mjs). Dafür sind die separate Python-Referenz, ihre installierten Abhängigkeiten, die erwartete private PDF-Datei sowie Playwright/Chromium erforderlich. Eine fehlende Referenz führt bei dieser Prüfung zum Fehler. `MINIPLAN_REFERENCE` wählt den Referenzordner; `PYTHON` kann den Interpreter überschreiben. Ohne diese Vorbereitungen genügt für normale Beiträge die reguläre Suite und bei UI-Änderungen die oben beschriebene Browserprüfung.

Private Testdaten und erzeugte Downloads gehören nicht ins Repository.

</details>

### Deployment

Der [GitHub-Pages-Workflow](.github/workflows/deploy-pages.yml) installiert mit Node.js 22 die Abhängigkeiten, führt `npm run check` aus und veröffentlicht `dist/`. Er startet bei einem Push auf `main` oder manuell über GitHub Actions. Die optionale Browserprüfung mit privater Referenz ist kein Teil des Workflows. Build-Artefakte werden nicht eingecheckt.

Die [CNAME-Datei](CNAME) nennt `tools.minis-mutlangen.de`, wird vom Build jedoch nicht nach `dist/` kopiert. Die benutzerdefinierte Domain muss in den GitHub-Pages-Einstellungen und im DNS eingerichtet sein.

## Mitwirken

Fehlerberichte und Verbesserungsvorschläge sind in den [GitHub Issues](https://github.com/Zwiebelrostbraten/miniplan/issues) willkommen. Hilfreich sind reproduzierbare Schritte, das Dateiformat, der Browser und das erwartete Verhalten. Für Importprobleme möglichst ein anonymisiertes oder künstlich erstelltes Beispiel verwenden.

Pull Requests sollten eine klar umrissene Änderung beschreiben und passende Prüfungen nennen. Vor Codebeiträgen `npm run check` ausführen; bei Änderungen an der Oberfläche zusätzlich die gezielte Browserprüfung verwenden. Größere Änderungen können vorab in einem Issue abgestimmt werden.

## Lizenz

MiniPlan steht unter der [MIT-Lizenz](LICENSE).
