# MiniPlan

MiniPlan erstellt aus Gottesdienstplänen einen Dienstplan für die Ministranten. Der kompakte Arbeitsbereich verbindet Import, Prüfung und Export. Dateien werden lokal im Browser verarbeitet; ein Konto ist nicht erforderlich.

**Live-Version:** [tools.minis-mutlangen.de](https://tools.minis-mutlangen.de/)

## Schnellstart

1. Eine oder mehrere Dateien auswählen oder auf das Dateifeld ziehen. Unterstützt werden PDF, XLSX, ODS und CSV. Beispieldaten stehen unter „Einstellungen“. Die gewünschte Gemeinde direkt über der Liste eintragen.
2. Nach dem Import „Gottesdienste prüfen“ wählen. Einzelne Einträge mit dem Stiftsymbol öffnen und speichern oder abbrechen. Das Papierkorbsymbol löscht einen Eintrag unmittelbar ohne Rückfrage. „Hinzufügen“ öffnet einen neuen Entwurf, der erst beim Speichern übernommen wird. Zunächst erscheinen die ersten fünf passenden Gottesdienste; der angehängte Schalter zeigt weitere. Importhinweise sind eingeklappt und sollten bei Problemen gelesen werden.
3. „Miniplan vorbereiten“ wählen, Vorschau prüfen und die Datei herunterladen. ODS ist voreingestellt; XLSX und CSV stehen ebenfalls zur Wahl.

ODS und XLSX enthalten Tabellen- und Druckformatierung. CSV enthält die Planwerte als UTF-8 mit Semikolontrennung, ohne Drucklayout. Ein Export ist eine Dienstplantabelle, keine automatische Zuteilung einzelner Personen. Änderungen an Daten, Gemeinde, Regeln oder Kalendern erfordern eine neue Vorbereitung. Ein fehlgeschlagener Ersatzimport entfernt den bisherigen Plan und sperrt dessen Download.

## Anzeige und Planungsregeln

Die Prüfansicht zeigt standardmäßig Orte, deren Bezeichnung die eingegebene Gemeinde enthält. Groß-/Kleinschreibung und deutsche Schreibvarianten werden vereinheitlicht. „Gottesdienste anderer Gemeinden und Orte anzeigen“ verändert ausschließlich die Ansicht: Die ausgeblendeten Daten bleiben erhalten und werden weiterhin nach denselben Regeln verarbeitet.

Die Planung berücksichtigt Orte mit dem Gemeindenamen sowie die vollständigen Ortsangaben `extern` und `dorffest`. Andere externe Orte werden nicht automatisch zugeordnet; beispielsweise genügt „extern – andere Kirche“ nicht für diese Ausnahme. Ortsangaben deshalb sorgfältig prüfen. Auch die Anzeige aller Orte erweitert die Planung nicht.

Die mitgelieferten Regeln in [src/data/services.json](src/data/services.json) bestimmen Gottesdienstarten, Bezeichnungen und Dienste. Unter „Einstellungen“ kann eine eigene JSON-Regeldatei mit derselben Struktur geladen werden. Sonderregeln können Namen, Datum, Zusatzinformationen und Ort berücksichtigen. Einträge mit „entfällt“, Friedensgebete und Totengedenken werden nicht eingeplant. Sonntäglicher Wochendienst wird im Zeitraum der relevanten Gottesdienste ergänzt.

Standardmäßig verwendet MiniPlan die mitgelieferten Ferien-, Faschingsferien- und Feiertagskalender für Baden-Württemberg. Deren enthaltene Zeiträume sind begrenzt; für andere Jahre oder Regionen die ICS-Dateien prüfen und bei Bedarf eigene Kalender laden. Eigene ICS-Dateien **ersetzen** gemeinsam die Standardkalender. „Ferien- und Feiertagsprüfung deaktivieren“ verwendet keinen Kalender. Der Hinweis am Exportbereich zeigt die aktive Auswahl. Die Kalender beeinflussen insbesondere Donnerstagsgottesdienste und Schülergottesdienste; Details stehen in [src/core/schedule.js](src/core/schedule.js).

## Importgrenzen

Der Tabellenimport erwartet den Aufbau des Pfarrbüroplans mit Datumszeilen und den Spalten Beginn, Ende, Gottesdienst und Ort. Beliebige Tabellenlayouts werden nicht automatisch erkannt.

Die PDF-Erkennung ist auf das fünfspaltige Layout des Pfarrbüros ausgelegt und liest vorhandenen Text anhand seiner Positionen. Reine Scans benötigen vorher eine Textschicht durch OCR. Umbrüche, ungewöhnliche Spaltenpositionen oder beschädigte Texte können zu fehlenden oder falsch zugeordneten Angaben führen. Auch ein Import ohne Hinweise ersetzt keine fachliche Kontrolle. Die PDF-Semantik wird eigenständig geprüft; eine pauschale Übereinstimmung mit dem ursprünglichen Python-PDF-Reader wird nicht zugesichert.

## Datenschutz und Offline-Nutzung

Import, Planung und Export erfolgen im Browser. Die Anwendung überträgt die ausgewählten Dateien nicht an einen Server und bindet keine CDN-Skripte oder entfernten Laufzeitressourcen ein. Beim Öffnen der Website werden deren Dateien vom Hosting geladen. Solange die Seite geöffnet bleibt, ist die Verarbeitung auch ohne Internet möglich; eine erneute Offline-Navigation zur Website ist nicht durch einen Service Worker abgesichert. Bearbeitungen werden nicht dauerhaft gespeichert und gehen beim Neuladen verloren.

Für eine verlässlich lokal startbare Kopie den Build erstellen und diese vier Dateien aus `dist/` gemeinsam aufbewahren:

- `miniplan.html`
- `miniplan.css`
- `miniplan.js`
- `miniplan.worker.js`

`miniplan.html` lässt sich direkt als lokale Datei öffnen. Der Worker gehört zur PDF-Verarbeitung. `dist/index.html` ist eine zusätzliche Einstiegseite für das Hosting.

## Entwicklung und Prüfungen

Voraussetzung: Node.js 22 oder neuer und npm.

```sh
npm ci
npm run build
npm run check
```

`build` bündelt die lokalen Abhängigkeiten mit esbuild und schreibt die Website nach `dist/`. `check` führt ESLint sowie den Build und die Vitest-Suite aus. Einzelne Tests lassen sich gezielt mit `npx vitest run tests/service-view.test.js` ausführen.

Die reguläre Suite benötigt keine Python-Referenz. Der echte PDF-Test wird ohne `MINIPLAN_REFERENCE` oder ohne passende Datei ausdrücklich übersprungen. Mit der separat vorhandenen Referenz:

```sh
MINIPLAN_REFERENCE=../miniplan-optimized npm run check
```

Die private Datei `01.07.2026-04.10.2026.pdf` bleibt außerhalb dieses Repositorys. Der Regressionstest erwartet 153 Quelldienste und 43 Planeinträge. Private Testdaten und erzeugte Downloads nicht einchecken.

Die zusätzliche Browserprüfung öffnet den lokalen Build über `file://` mit Playwright/Chromium. Sie prüft unter anderem Import und Export, mobile Bearbeitung, Ortsfilter, Vorschau, Kalenderauswahl und fehlgeschlagene Ersatzimporte. Für den Vergleich der Planung und Tabellenwerte benötigt sie die separate Python-Referenz samt Abhängigkeiten und echter PDF-Datei; eine fehlende Referenz führt hier zum Fehler.

```sh
npx playwright install chromium
# Bei fehlenden Linux-Systembibliotheken: npx playwright install --with-deps chromium
uv sync --project ../miniplan-optimized --frozen
npm run test:browser
```

`MINIPLAN_REFERENCE` überschreibt den Referenzordner. Der Test verwendet dessen `.venv`, andernfalls `python3`; `PYTHON` kann einen anderen Interpreter angeben. `AGENT_BROWSER_EXECUTABLE_PATH` erlaubt ein bereits installiertes Chromium. Temporäre Testdateien und Downloads liegen außerhalb des Repositorys; der Test meldet ihren Pfad. UI-Screenshots werden unter `/tmp/miniplan-desktop.png`, `/tmp/miniplan-mobile-360.png` und `/tmp/miniplan-mobile-390.png` gespeichert.

## Veröffentlichung

[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) installiert unter Node.js 22 die Abhängigkeiten und führt `npm run check` aus. Bei einem Push auf `main` oder manuellem Workflow-Start wird anschließend `dist/` als GitHub-Pages-Artefakt veröffentlicht. Die Browserprüfung mit privater Referenz läuft nicht in diesem Workflow. Build-Artefakte werden nicht eingecheckt.

Die Datei [CNAME](CNAME) enthält `tools.minis-mutlangen.de`. Der aktuelle Build kopiert sie nicht nach `dist/`; die benutzerdefinierte Domain muss daher in den GitHub-Pages-Einstellungen mit passender DNS-Konfiguration eingerichtet bleiben.

## Lizenz

[MIT](LICENSE)
