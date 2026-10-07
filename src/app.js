import rules from './data/services.json';
import holidays from './data/feiertage_baden_wuerttemberg.ics';
import schoolHolidays from './data/ferien_baden_wuerttemberg.ics';
import carnivalHolidays from './data/faschingsferien_bis_2030.ics';
import { HolidayCalendar } from './core/calendar.js';
import { parsePdf } from './core/pdf-reader.js';
import { buildSchedule } from './core/schedule.js';
import { createMiniplanWorkbook, downloadWorkbook } from './core/xlsx-export.js';
import { createOpenSpreadsheet, downloadOpenSpreadsheet, parseOpenSpreadsheet } from './core/open-spreadsheet.js';
import { parseWorkbook } from './core/xlsx-reader.js';

const calendar = HolidayCalendar.fromIcsTexts([holidays, schoolHolidays, carnivalHolidays]);
const state = { services: [], diagnostics: [], plan: [] };
const $ = (id) => document.getElementById(id);
const fields = ['date', 'start', 'end', 'name', 'location', 'dayInfo'];
const labels = { date: 'Datum', start: 'Beginn', end: 'Ende', name: 'Gottesdienst', location: 'Ort', dayInfo: 'Info' };

function message(text, problem = false) {
  const node = $('message');
  node.textContent = text;
  node.style.color = problem ? '#91444c' : '';
}

function invalidatePlan() {
  state.plan = [];
  $('download').disabled = true;
  const preview = $('plan-preview');
  preview.hidden = true;
  preview.replaceChildren();
}

function inputFor(service, field, index) {
  const input = document.createElement('input');
  input.type = field === 'date' ? 'date' : field === 'start' || field === 'end' ? 'time' : 'text';
  input.value = service[field] ?? '';
  input.setAttribute('aria-label', `${labels[field]} für Zeile ${index + 1}`);
  input.addEventListener('input', () => { service[field] = input.value; invalidatePlan(); });
  return input;
}

function renderServices() {
  const body = $('services');
  body.replaceChildren();
  if (!state.services.length) {
    const row = document.createElement('tr'); row.className = 'empty';
    const cell = document.createElement('td'); cell.colSpan = 7; cell.textContent = 'Noch keine Daten geladen.';
    row.append(cell); body.append(row); return;
  }
  state.services.forEach((service, index) => {
    const row = document.createElement('tr');
    fields.forEach((field) => { const cell = document.createElement('td'); cell.append(inputFor(service, field, index)); row.append(cell); });
    const action = document.createElement('td');
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `Zeile ${index + 1} löschen`);
    remove.addEventListener('click', () => { state.services.splice(index, 1); invalidatePlan(); renderServices(); });
    action.append(remove); row.append(action); body.append(row);
  });
}

function renderDiagnostics() {
  const root = $('diagnostics'); root.replaceChildren();
  state.diagnostics.forEach((item) => { const node = document.createElement('p'); node.className = 'diagnostic'; node.textContent = `${item.source}, Zeile ${item.row}: ${item.message}`; root.append(node); });
}

function renderSelectedFiles(files) {
  const root = $('selected-files');
  root.replaceChildren();
  for (const file of files) {
    const item = document.createElement('li');
    item.textContent = file.name;
    root.append(item);
  }
}

async function importFile(file) {
  const input = await file.arrayBuffer();
  const extension = file.name.toLocaleLowerCase('de-DE').split('.').at(-1);
  if (extension === 'xlsx') return parseWorkbook(input, file.name);
  if (extension === 'ods' || extension === 'csv') return parseOpenSpreadsheet(input, file.name);
  if (extension === 'pdf') return parsePdf(input, file.name);
  throw new Error(`${file.name}: Unterstützt werden PDF, XLSX, ODS und CSV.`);
}

async function importFiles(files) {
  if (!files.length) return;
  renderSelectedFiles(files);
  message('Dateien werden lokal verarbeitet …');
  try {
    const results = await Promise.all([...files].map(importFile));
    state.services = results.flatMap((result) => result.services);
    state.diagnostics = results.flatMap((result) => result.diagnostics);
    invalidatePlan();
    renderServices(); renderDiagnostics();
    message(`${state.services.length} Gottesdienste eingelesen. Bitte kurz prüfen.`);
  } catch (error) { message(error.message || 'Die Datei konnte nicht gelesen werden.', true); }
}

function addService() {
  state.services.push({ date: '', start: '', end: '', name: '', location: $('parish').value, dayInfo: '', source: 'manuell', row: state.services.length + 1 });
  invalidatePlan();
  renderServices();
}

function loadDemo() {
  state.services = [
    { date: '2026-07-01', start: '18:30', end: '19:30', name: 'Eucharistiefeier', location: 'Kirche St. Georg', dayInfo: '', source: 'Beispiel', row: 1 },
    { date: '2026-07-05', start: '10:00', end: '11:00', name: 'Wortgottesdienst', location: 'Kirche St. Georg', dayInfo: '', source: 'Beispiel', row: 2 },
  ]; state.diagnostics = []; invalidatePlan(); renderServices(); renderDiagnostics(); message('Beispieldaten geladen.');
}

function createPlan() {
  const parish = $('parish').value.trim() || 'St. Georg';
  state.plan = buildSchedule(state.services, rules, calendar, parish);
  if (!state.plan.length) { message('Keine passenden Gottesdienste für diese Gemeinde gefunden.', true); return; }
  $('plan-preview').hidden = false;
  const preview = $('plan-preview'); preview.replaceChildren();
  const title = document.createElement('h3'); title.textContent = `${state.plan.length} Einträge für den Miniplan`;
  const list = document.createElement('ul');
  state.plan.slice(0, 6).forEach((item) => { const line = document.createElement('li'); line.textContent = `${item.date} · ${item.start ?? '–'} · ${item.label} (${item.duties.filter(Boolean).join(', ') || 'Wochendienst'})`; list.append(line); });
  if (state.plan.length > 6) { const more = document.createElement('li'); more.textContent = `… und ${state.plan.length - 6} weitere`; list.append(more); }
  preview.append(title, list); $('download').disabled = false; message('Miniplan ist bereit zum Export.');
}

async function download() {
  try {
    const parish = $('parish').value.trim() || 'St. Georg';
    const format = $('export-format').value;
    if (!state.plan.length) { message('Bitte zuerst den Miniplan vorbereiten.', true); return; }
    const first = state.plan[0].date.split('-').reverse().join('.');
    const last = state.plan.at(-1).date.split('-').reverse().join('.');
    const filename = `${parish} - Miniplan vom ${first} - ${last}.${format}`;
    if (format === 'xlsx') {
      const bytes = await createMiniplanWorkbook(state.plan, parish);
      downloadWorkbook(bytes, filename);
    } else {
      const bytes = await createOpenSpreadsheet(state.plan, parish, format);
      downloadOpenSpreadsheet(bytes, filename, format);
    }
    message(`${format.toUpperCase()}-Datei wurde heruntergeladen.`);
  } catch (error) { message(error.message || 'Die Datei konnte nicht erstellt werden.', true); }
}

$('file-input').addEventListener('change', (event) => importFiles(event.target.files));
$('add-service').addEventListener('click', addService);
$('load-demo').addEventListener('click', loadDemo);
$('create-plan').addEventListener('click', createPlan);
$('download').addEventListener('click', download);
$('parish').addEventListener('input', invalidatePlan);
for (const eventName of ['dragenter', 'dragover']) $('file-input').closest('.dropzone').addEventListener(eventName, (event) => { event.preventDefault(); event.currentTarget.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) $('file-input').closest('.dropzone').addEventListener(eventName, (event) => { event.preventDefault(); event.currentTarget.classList.remove('dragging'); });
$('file-input').closest('.dropzone').addEventListener('drop', (event) => importFiles(event.dataTransfer.files));
