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
async function importFile(path, expected) {
  await page.locator('#file-input').setInputFiles(path);
  await page.waitForFunction(() => !document.getElementById('message').textContent.includes('verarbeitet'));
  const services = await page.locator('#services tr:not(.empty)').evaluateAll((rows, names) => rows.map((row) =>
    Object.fromEntries([...row.querySelectorAll('input')].map((input, index) => [names[index], input.value]))), fields);
  assert.deepEqual(services, expected.services);
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
  await importFile(resolve(reference, '01.07.2026-04.10.2026.pdf'), oracle.pdf);
  const pdfDiagnostics = await page.locator('#diagnostics p').allTextContents();
  assert.deepEqual(pdfDiagnostics, oracle.pdf.diagnostics.map((item) => `01.07.2026-04.10.2026.pdf, Zeile ${item.row}: ${item.message}`));
  await exportPlan(oracle.pdf, 'ods');
  await exportPlan(oracle.pdf);
  console.log(`file:// PDF: ${oracle.pdf.services.length} exact source rows; ${oracle.pdf.plan.length} plan entries; ODS/XLSX exports match Python`);
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
  await page.locator('details').evaluate((node) => { node.open = true; });
  await page.locator('#rules-input').setInputFiles(resolve(output, 'rules.json'));
  assert.equal(await page.locator('#download').isDisabled(), true);
  await page.locator('#calendar-input').setInputFiles(resolve(output, 'custom.ics'));
  await exportPlan(oracle.custom);
  await page.locator('#no-calendar').check();
  assert.equal(await page.locator('#calendar-input').isDisabled(), true);
  assert.equal(await page.locator('#download').isDisabled(), true);
  await exportPlan(oracle.none);
  await page.locator('#no-calendar').uncheck();
  await page.locator('#calendar-input').setInputFiles({ name: 'bad.ics', mimeType: 'text/calendar', buffer: Buffer.from('not a calendar') });
  await page.locator('#create-plan').click();
  await page.waitForFunction(() => document.getElementById('message').textContent.includes('Ungültiger ICS'));
  assert.equal(await page.locator('#download').isDisabled(), true);
  await page.locator('#calendar-input').setInputFiles([]);
  await page.locator('#rules-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.locator('#create-plan').click();
  await page.waitForFunction(() => document.getElementById('message').textContent.includes('Fehlende Regelbereiche'));
  assert.equal(await page.locator('#download').isDisabled(), true);
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
  console.log(`Artifacts: ${output}`);
} finally {
  await browser.close();
}
