// Run after npm run build. Requires installed Chromium and the Python reference dependencies.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import * as SheetJS from '@e965/xlsx';
import JSZip from 'jszip';
import { chromium } from 'playwright';
import { assertPdfServices, assertPdfPlan } from './pdf-semantics.mjs';

const reference = resolve(process.env.MINIPLAN_REFERENCE || '../miniplan-optimized');
const referencePython = resolve(reference, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.PYTHON || (existsSync(referencePython) ? referencePython : 'python3');
const output = await mkdtemp(resolve(tmpdir(), 'miniplan-parity-'));
execFileSync(python, ['scripts/parity-reference.py', reference, output], {
  env: { ...process.env, PYTHONPATH: resolve(reference, 'src') },
});
const oracle = JSON.parse(await readFile(resolve(output, 'oracle.json')));
const browser = await chromium.launch({
  executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ timezoneId: 'Europe/Berlin' });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const fields = ['date', 'start', 'end', 'name', 'location', 'dayInfo'];
async function openSettings() {
  const disclosure = page.locator('.advanced-options');
  if (!await disclosure.evaluate((node) => node.open)) await disclosure.locator('summary').click();
}
async function editRow(index, field, value) {
  await page.locator('.service-row').nth(index).getByRole('button', { name: /bearbeiten/i }).click();
  await page.locator(`.service-editor input[name=${field}]`).fill(value);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
}
async function deleteRow(index) {
  await page.locator('.service-row').nth(index).getByRole('button', { name: /löschen/i }).click();
}
async function addRow() {
  await page.locator('#add-service').click();
  assert.equal(await page.locator('.service-editor input[name=date]').evaluate((node) => node === document.activeElement), true);
  await page.locator('.service-editor input[name=date]').fill('2026-07-03');
  await page.locator('.service-editor input[name=start]').fill('10:00');
  await page.locator('.service-editor input[name=name]').fill('Neuer langer Gottesdienstname');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  const toggle = page.locator('#services-toggle');
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}
async function importFile(path, expected) {
  await page.locator('#file-input').setInputFiles(path);
  await page.waitForFunction(() => !document.getElementById('message').textContent.includes('verarbeitet'));
  // Inspect every imported row for reference parity, independent of the display filter.
  await page.locator('#show-other-services').check();
  const toggle = page.locator('#services-toggle');
  assert.ok(await page.locator('#services tr:not(.empty)').count() <= 5, 'imports initially show at most five services');
  if (await toggle.isVisible()) {
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'imports start collapsed');
    await toggle.click();
  }
  const services = await page.locator('#services tr:not(.empty)').evaluateAll((rows, names) => rows.map((row) =>
    Object.fromEntries([...row.querySelectorAll('td')].slice(0, 6).map((cell, index) => [names[index], index === 0 ? cell.textContent.split('.').reverse().join('-') : cell.textContent === '–' ? '' : cell.textContent]))), fields);
  if (expected) assert.deepEqual(services, expected.services);
  return services;
}
async function exportPlan(expected, format = 'xlsx') {
  await page.locator('#create-plan').click();
  await page.waitForFunction(() => !document.getElementById('download').disabled);
  assert.equal(await page.locator('#plan-preview h3').textContent(), `${expected.plan.length} Einträge für den Miniplan`);
  await page.locator('#export-format').selectOption(format);
  const downloading = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloading;
  assert.ok(download.suggestedFilename().endsWith(`.${format}`));
  const path = resolve(output, `browser-${format}.${format}`);
  await download.saveAs(path);
  const bytes = await readFile(path);
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.worksheets[0];
    const rows = Array.from({ length: sheet.rowCount }, (_, index) =>
      Array.from({ length: 7 }, (_, col) => {
        const cell = sheet.getRow(index + 1).getCell(col + 1);
        return cell.isMerged && cell.address !== cell.master.address ? null : cell.value;
      }));
    assert.deepEqual(rows, expected.rows);
    assert.equal(sheet.views[0].ySplit, 2);
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal(sheet.pageSetup.printTitlesRow, '1:2');
  } else {
    const workbook = SheetJS.read(bytes, { type: 'array' });
    const rows = SheetJS.utils.sheet_to_json(workbook.Sheets.Miniplan, { header: 1, defval: null });
    const meaningful = (rows) => rows.filter((row) => row.some((v) => v !== null && v !== '')).map((row) =>
      Array.from({ length: 7 }, (_, i) => row[i] === '' || row[i] === undefined ? null : row[i]));
    assert.deepEqual(meaningful(rows), meaningful(expected.rows));
    const zip = await JSZip.loadAsync(bytes);
    assert.ok((await zip.file('styles.xml').async('string')).includes('style:print-orientation="landscape"'));
  }
}
try {
  await page.goto(pathToFileURL(resolve('dist/miniplan.html')).href);
  assert.equal(await page.locator('#export-format').inputValue(), 'ods');
  assert.equal(await page.locator('#show-other-services').isChecked(), false);
  const diagnosticsDisclosure = page.locator('#diagnostics-disclosure');
  const diagnosticsSummary = page.getByText('Importhinweise anzeigen / ausblenden (2)', { exact: true });
  assert.equal(await diagnosticsDisclosure.isVisible(), false);
  const diagnosticFile = {
    name: 'diagnostics.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Donnerstag, 2. Juli 2026\n;18:30;;Eucharistiefeier;Kirche St. Georg\n;morgen;;Tauffeier;Kirche St. Georg\n;später;;Tauffeier;Kirche St. Georg'),
  };
  await importFile(diagnosticFile);
  assert.equal(await page.locator('#message').textContent(), '1 Gottesdienste aus 1 Datei eingelesen. Vorherige Daten wurden ersetzt. Bitte Angaben prüfen. 2 Importhinweise unter der Tabelle.');
  assert.equal(await page.locator('#message').getAttribute('role'), 'status');
  assert.equal(await page.locator('#message').getAttribute('aria-live'), 'polite');
  assert.equal(await diagnosticsDisclosure.isVisible(), true);
  assert.equal(await diagnosticsDisclosure.evaluate((node) => node.tagName), 'DETAILS');
  assert.equal(await diagnosticsSummary.evaluate((node) => node.tagName), 'SUMMARY');
  assert.equal(await page.locator('#diagnostics p').count(), 2);
  assert.equal(await page.locator('#diagnostics p').first().isVisible(), false);
  const retainedDiagnostics = await page.locator('#diagnostics p').allTextContents();
  assert.ok(retainedDiagnostics.every((text) => text.includes('Ungültige Startzeit ignoriert')));
  await diagnosticsSummary.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#diagnostics p').first().isVisible(), true);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#diagnostics p').first().isVisible(), false);
  assert.deepEqual(await page.locator('#diagnostics p').allTextContents(), retainedDiagnostics);
  await diagnosticsSummary.click();
  await importFile(diagnosticFile);
  assert.equal(await diagnosticsDisclosure.evaluate((node) => node.open), false, 'each import starts collapsed');
  await importFile({ name: 'clean.csv', mimeType: 'text/csv', buffer: Buffer.from('Donnerstag, 2. Juli 2026\n;18:30;;Eucharistiefeier;Kirche St. Georg') });
  assert.equal(await diagnosticsDisclosure.isVisible(), false);
  assert.equal(await page.locator('#diagnostics p').count(), 0);
  assert.equal(await page.locator('#message').textContent(), '1 Gottesdienste aus 1 Datei eingelesen. Vorherige Daten wurden ersetzt. Bitte Angaben prüfen.');
  console.log('Diagnostics: collapsed by default, keyboard disclosure retains all messages, import resets disclosure, clean import hides control; live status/count: PASS');
  const serviceRows = page.locator('#services tr:not(.empty)');
  const servicesToggle = page.locator('#services-toggle');
  const manyServicesFile = {
    name: 'many-services.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Donnerstag, 2. Juli 2026\n' + Array.from({ length: 8 }, (_, i) =>
      `;18:30;;Gottesdienst ${i + 1};Kirche St. Georg`).join('\n')),
  };
  await importFile(manyServicesFile);
  // The parity reader expands to inspect all imported data; collapse for UI assertions.
  await servicesToggle.click();
  assert.equal(await serviceRows.count(), 5);
  assert.equal(await servicesToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await servicesToggle.getAttribute('aria-controls'), 'services');
  assert.equal(await servicesToggle.textContent(), '3 weitere Gottesdienste anzeigen (8 insgesamt)');
  await servicesToggle.focus();
  await page.keyboard.press('Enter');
  assert.equal(await serviceRows.count(), 8);
  assert.equal(await servicesToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await servicesToggle.textContent(), 'Auf 5 Gottesdienste reduzieren (8 insgesamt)');
  await editRow(7, 'name', 'Bearbeitet');
  await servicesToggle.focus();
  await page.keyboard.press('Space');
  assert.equal(await serviceRows.count(), 5);
  await servicesToggle.click();
  assert.equal(await serviceRows.nth(7).locator('td').nth(3).textContent(), 'Bearbeitet');
  await deleteRow(6);
  assert.equal(await serviceRows.count(), 7);
  assert.equal(await serviceRows.nth(6).locator('td').nth(3).textContent(), 'Bearbeitet');
  await page.locator('#file-input').setInputFiles(manyServicesFile);
  await page.waitForFunction(() => !document.getElementById('message').textContent.includes('verarbeitet'));
  assert.equal(await serviceRows.count(), 5, 'replacement import resets expansion');
  await servicesToggle.click();
  await page.locator('.advanced-options').evaluate((node) => { node.open = true; });
  await page.locator('#load-demo').click();
  assert.equal(await serviceRows.count(), 2);
  assert.equal(await servicesToggle.isVisible(), false);
  for (let i = 0; i < 4; i++) await addRow();
  assert.equal(await serviceRows.count(), 6, 'addition reveals the new row');
  assert.equal(await page.locator('#services input').count(), 0, 'saved rows return to read mode');
  await deleteRow(5);
  assert.equal(await serviceRows.count(), 5);
  assert.equal(await servicesToggle.isVisible(), false, 'exactly five services need no control');
  console.log('Services: five-row preview, accessible keyboard toggle/counts, retained edits, expanded removal, import/demo reset, no control at five or fewer: PASS');
  await page.locator('#show-other-services').uncheck();
  const mixedFile = {
    name: 'mixed.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Donnerstag, 2. Juli 2026\n' + [
      ';18:30;;Tauffeier;Andere Kirche',
      ...Array.from({ length: 7 }, (_, i) => `;18:30;;Tauffeier ${i};Kirche STRASSE`),
      ';18:30;;Tauffeier;extern', ';18:30;;Tauffeier;Dorffest',
    ].join('\n')),
  };
  await page.locator('#parish').fill(' Straße ');
  await page.locator('#file-input').setInputFiles(mixedFile);
  await page.waitForFunction(() => !document.getElementById('message').textContent.includes('verarbeitet'));
  assert.equal(await serviceRows.count(), 5);
  assert.equal(await servicesToggle.textContent(), '2 weitere Gottesdienste anzeigen (7 insgesamt)');
  assert.equal(await serviceRows.first().locator('td').nth(4).textContent(), 'Kirche STRASSE');
  for (const width of [1280, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.locator('.table-wrap').evaluate((wrap) => {
      const button = wrap.querySelector('#services-toggle');
      const scroll = wrap.querySelector('.table-scroll');
      const rect = wrap.getBoundingClientRect();
      const footer = button.getBoundingClientRect();
      return { width: rect.width, footerWidth: footer.width, left: footer.left - rect.left,
        bottom: rect.bottom - footer.bottom, radius: getComputedStyle(wrap).borderRadius,
        overflow: getComputedStyle(scroll).overflowX,
        scrolls: scroll.scrollWidth > scroll.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(Math.abs(layout.width - layout.footerWidth) < 1);
    assert.equal(layout.left, 0);
    assert.equal(layout.bottom, 1);
    assert.equal(layout.radius, '0px');
    assert.equal(layout.overflow, 'auto');
    assert.equal(layout.pageOverflow, false);
    if (width < 700) {
      assert.equal(layout.scrolls, false, 'mobile editor needs no horizontal scrolling');
      await serviceRows.first().getByRole('button', { name: /bearbeiten/i }).click();
      const input = page.locator('.service-editor input[name=name]');
      await input.fill('Tauffeier mit einem sehr langen Namen und weiteren Angaben');
      assert.equal(await input.evaluate((node) => getComputedStyle(node).fontSize), '16px');
      assert.ok((await input.boundingBox()).height >= 44);
      assert.ok(await input.locator('..').textContent(), 'visible field label');
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await page.screenshot({ path: `/tmp/miniplan-mobile-${width}.png`, fullPage: true });
    }
    await servicesToggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await serviceRows.count(), 7);
    await page.keyboard.press('Space');
    assert.equal(await serviceRows.count(), 5);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await editRow(0, 'name', 'Tauffeier bearbeitet');
  await deleteRow(1);
  assert.equal(await servicesToggle.textContent(), '1 weitere Gottesdienste anzeigen (6 insgesamt)');
  await page.locator('#show-other-services').check();
  assert.equal(await servicesToggle.textContent(), '4 weitere Gottesdienste anzeigen (9 insgesamt)');
  assert.equal(await serviceRows.first().locator('td').nth(3).textContent(), 'Tauffeier');
  assert.equal(await serviceRows.nth(1).locator('td').nth(3).textContent(), 'Tauffeier bearbeitet');
  await page.locator('#create-plan').click();
  await page.waitForFunction(() => !document.getElementById('download').disabled);
  const allViewPlan = await page.locator('#plan-preview').textContent();
  await page.locator('#show-other-services').uncheck();
  assert.equal(await page.locator('#download').isDisabled(), false, 'display-only toggle preserves plan');
  await page.locator('#create-plan').click();
  assert.equal(await page.locator('#plan-preview').textContent(), allViewPlan, 'display filtering leaves scheduling unchanged');
  await editRow(0, 'location', 'Andere Kirche');
  await page.locator('#parish').focus();
  assert.equal(await servicesToggle.isVisible(), false, 'location edit drops the displayed count to five');
  assert.equal(await serviceRows.count(), 5);
  await page.setViewportSize({ width: 360, height: 900 });
  await addRow();
  assert.equal(await serviceRows.count(), 6);
  await deleteRow(5);
  assert.equal(await serviceRows.count(), 5);
  await addRow();
  assert.equal(await servicesToggle.textContent(), 'Auf 5 Gottesdienste reduzieren (6 insgesamt)');
  assert.equal(await servicesToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await serviceRows.last().locator('td').nth(4).textContent(), ' Straße ');
  await page.locator('#parish').fill('Unbekannt');
  assert.equal(await serviceRows.count(), 0);
  assert.ok((await page.locator('#services .empty').textContent()).includes('Keine Gottesdienste passen'));
  await page.locator('#parish').fill(' ');
  assert.ok((await page.locator('#services .empty').textContent()).includes('Bitte eine Gemeinde'));
  await page.locator('#show-other-services').check();
  await servicesToggle.click();
  assert.equal(await serviceRows.count(), 10, 'hidden imported and manual rows remain in state');
  await page.locator('#file-input').setInputFiles(mixedFile);
  await page.waitForFunction(() => !document.getElementById('message').textContent.includes('verarbeitet'));
  assert.equal(await serviceRows.count(), 5);
  assert.equal(await servicesToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await servicesToggle.textContent(), '5 weitere Gottesdienste anzeigen (10 insgesamt)');
  await page.locator('#show-other-services').uncheck();
  assert.equal(await serviceRows.count(), 0);
  await page.locator('#parish').fill('St. Georg');
  await page.locator('.advanced-options').evaluate((node) => { node.open = true; });
  assert.ok(!/Python|Python-Programm|Server|Browser/.test(await page.locator('body').innerText()));
  console.log('Location filter: German folding, source-safe edits/removals, display-only planning, live parish/empty states, manual addition, import reset; connected footer at 1280px/768px/390px/360px with keyboard: PASS');
  const pdfServices = await importFile(resolve(reference, '01.07.2026-04.10.2026.pdf'));
  assertPdfServices(pdfServices);
  await writeFile(resolve(output, 'pdf-services.json'), JSON.stringify(pdfServices));
  execFileSync(python, ['scripts/parity-reference.py', reference, output], {
    env: { ...process.env, PYTHONPATH: resolve(reference, 'src') },
  });
  oracle.pdf = JSON.parse(await readFile(resolve(output, 'oracle.json'))).pdf;
  assertPdfPlan(oracle.pdf.plan);
  const pdfDiagnostics = await page.locator('#diagnostics p').allTextContents();
  assert.ok(pdfDiagnostics.every((message) => /^01\.07\.2026-04\.10\.2026\.pdf, Zeile (?:[1-9]|1[0-5]): (?:Unvollständige Gottesdienstzeile übersprungen|Ungültige Startzeit ignoriert)$/.test(message)));
  await exportPlan(oracle.pdf, 'ods');
  await exportPlan(oracle.pdf);
  console.log(`file:// PDF: ${oracle.pdf.services.length} semantically validated source services; ${oracle.pdf.plan.length} plan entries; ODS/XLSX exports match Python from corrected source services`);
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      return new Promise((resolve) => {
        window.finishReplacement = () => {
          File.prototype.arrayBuffer = original;
          resolve(original.call(this));
        };
      });
    };
  });
  await page.locator('#file-input').setInputFiles({ name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('broken') });
  assert.equal(await page.locator('#download').isDisabled(), true, 'replacement must disable the prior export immediately');
  await page.evaluate(() => window.finishReplacement());
  await page.waitForFunction(() => !document.getElementById('message').textContent.includes('verarbeitet'));
  assert.equal(await page.locator('#download').isDisabled(), true);
  assert.equal(await page.locator('#plan-preview').isHidden(), true);
  assert.equal(await page.locator('#services tr:not(.empty)').count(), 0);
  console.log('Failed replacement import clears prior plan and disables export');
  await importFile(resolve(output, 'input.xlsx'), oracle.xlsx);
  for (const diagnostic of oracle.xlsx.diagnostics) {
    assert.ok((await page.locator('#diagnostics').textContent()).includes(`Zeile ${diagnostic.row}: ${diagnostic.message}`));
  }
  await exportPlan(oracle.xlsx);
  await page.locator('.advanced-options').evaluate((node) => { node.open = true; });
  await openSettings();
  await page.locator('#rules-input').setInputFiles(resolve(output, 'rules.json'));
  assert.equal(await page.locator('#download').isDisabled(), true);
  await openSettings();
  await page.locator('#calendar-input').setInputFiles(resolve(output, 'custom.ics'));
  assert.equal(await page.locator('#calendar-help').textContent(), 'Ferien und Feiertage aus deinen ausgewählten Kalendern werden berücksichtigt.');
  await exportPlan(oracle.custom);
  await openSettings();
  await page.locator('#no-calendar').check();
  assert.equal(await page.locator('#calendar-input').isDisabled(), true);
  assert.equal(await page.locator('#download').isDisabled(), true);
  assert.equal(await page.locator('#calendar-help').textContent(), 'Der Miniplan wird ohne Ferien- und Feiertagsprüfung erstellt.');
  await exportPlan(oracle.none);
  await openSettings();
  await page.locator('#no-calendar').uncheck();
  assert.equal(await page.locator('#calendar-input').isDisabled(), false);
  assert.equal(await page.locator('#calendar-help').textContent(), 'Ferien und Feiertage aus deinen ausgewählten Kalendern werden berücksichtigt.');
  await exportPlan(oracle.custom);
  await openSettings();
  await page.locator('#calendar-input').setInputFiles({ name: 'bad.ics', mimeType: 'text/calendar', buffer: Buffer.from('not a calendar') });
  await page.locator('#create-plan').click();
  await page.waitForFunction(() => document.getElementById('export-message').textContent.includes('Ungültiger ICS'));
  assert.equal(await page.locator('#download').isDisabled(), true);
  await openSettings();
  await page.locator('#calendar-input').setInputFiles([]);
  assert.equal(await page.locator('#calendar-help').textContent(), 'Ferien und Feiertage in Baden-Württemberg werden berücksichtigt.');
  await openSettings();
  await page.locator('#no-calendar').check();
  assert.equal(await page.locator('#calendar-help').textContent(), 'Der Miniplan wird ohne Ferien- und Feiertagsprüfung erstellt.');
  await openSettings();
  await page.locator('#no-calendar').uncheck();
  assert.equal(await page.locator('#calendar-help').textContent(), 'Ferien und Feiertage in Baden-Württemberg werden berücksichtigt.');
  await openSettings();
  await page.locator('#rules-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.locator('#create-plan').click();
  await page.waitForFunction(() => document.getElementById('export-message').textContent.includes('Fehlende Regelbereiche'));
  assert.equal(await page.locator('#download').isDisabled(), true);
  await openSettings();
  await page.locator('#rules-input').setInputFiles([]);
  const workbook = SheetJS.utils.book_new();
  SheetJS.utils.book_append_sheet(workbook, SheetJS.utils.aoa_to_sheet([
    ['Donnerstag, 2. Juli 2026'], ['Hochfest'], [],
    ['', '18:30', '', 'Eucharistiefeier', 'Kirche St. Georg'], [], [],
    ['', 'morgen', '', 'Tauffeier', 'Kirche St. Georg'],
    ['Sonntag, 5. Juli 2026'], ['', '10:00', '', 'Wortgottesdienst', 'Kirche St. Georg'],
  ]), 'Plan');
  const odsPath = resolve(output, 'input.ods');
  await writeFile(odsPath, Buffer.from(SheetJS.write(workbook, { bookType: 'ods', type: 'array' })));
  await importFile(odsPath, oracle.xlsx);
  await exportPlan(oracle.xlsx, 'ods');
  assert.deepEqual(errors, []);
  console.log('XLSX/ODS import, scheduling, export; custom rules/calendar/no-calendar; invalid configuration: PASS');
  await page.locator('.advanced-options').evaluate((node) => { node.open = true; });
  await page.locator('#load-demo').click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '/tmp/miniplan-desktop.png', fullPage: true });
  console.log(`Artifacts: ${output}; screenshots: /tmp/miniplan-desktop.png, /tmp/miniplan-mobile-360.png, /tmp/miniplan-mobile-390.png`);
} finally {
  await browser.close();
}
