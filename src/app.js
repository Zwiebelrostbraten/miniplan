import { serviceView } from './core/service-view.js';
import defaultRules from './data/services.json';
import holidays from './data/feiertage_baden_wuerttemberg.ics';
import schoolHolidays from './data/ferien_baden_wuerttemberg.ics';
import carnivalHolidays from './data/faschingsferien_bis_2030.ics';
import { HolidayCalendar } from './core/calendar.js';
import { parsePdf } from './core/pdf-reader.js';
import { buildSchedule, validateRules } from './core/schedule.js';
import { createMiniplanWorkbook, downloadWorkbook } from './core/xlsx-export.js';
import { createOpenSpreadsheet, downloadOpenSpreadsheet, parseOpenSpreadsheet } from './core/open-spreadsheet.js';
import { parseWorkbook } from './core/xlsx-reader.js';
import { miniplanFilename } from './core/filename.js';

const defaultCalendar = HolidayCalendar.fromIcsTexts([holidays, schoolHolidays, carnivalHolidays]);
const state = { services: [], servicesExpanded: false, diagnostics: [], plan: [], busy: false, editor: null };
const $ = (id) => document.getElementById(id);
const fields = ['date', 'start', 'end', 'name', 'location', 'dayInfo'];
const labels = { date: 'Datum', start: 'Beginn', end: 'Ende', name: 'Gottesdienst', location: 'Ort', dayInfo: 'Info' };
const iconPaths = {
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  settings: '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = iconPaths[name];
  return svg;
}
function actionIcon(button, name, tooltip) {
  button.classList.add('icon-button'); button.append(icon(name));
  const hint = document.createElement('span'); hint.className = 'tooltip'; hint.textContent = tooltip;
  hint.setAttribute('aria-hidden', 'true'); button.append(hint);
}
function discardEditor() {
  if (!state.editor) return true;
  const changed = fields.some((field) => (state.editor.draft[field] ?? '') !== (state.editor.original[field] ?? ''));
  if (changed && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return false;
  state.editor = null;
  return true;
}
window.addEventListener('beforeunload', (event) => {
  if (state.editor && fields.some((field) => (state.editor.draft[field] ?? '') !== (state.editor.original[field] ?? ''))) {
    event.preventDefault(); event.returnValue = '';
  }
});


function message(text, problem = false, target = 'export') {
  const node = $(target === 'import' ? 'message' : `${target}-message`);
  node.textContent = text;
  node.style.color = problem ? '#91444c' : '';
}

function invalidatePlan() {
  state.plan = [];
  $('download').disabled = true;
  $('create-plan').disabled = state.busy || !state.services.length;
  const preview = $('plan-preview');
  preview.hidden = true;
  preview.replaceChildren();
}

function focusReview() {
  $('review-title').focus({ preventScroll: true });
  $('review-title').scrollIntoView({ block: 'start' });
}

function openEditor(service = null) {
  if (!discardEditor()) return;
  state.editor = { service, draft: { ...(service || { date: '', start: '', end: '', name: '', location: $('parish').value, dayInfo: '', source: 'manuell', row: state.services.length + 1 }) } };
  state.editor.original = { ...state.editor.draft };
  renderServices();
  const input = $('services').querySelector('.service-editor input');
  input.focus({ preventScroll: true });
  input.scrollIntoView({ block: 'center' });
}

function editorRow() {
  const { service, draft } = state.editor;
  const row = document.createElement('tr'); row.className = 'editor-row';
  const cell = document.createElement('td'); cell.colSpan = 7;
  const form = document.createElement('form'); form.className = 'service-editor';
  const title = document.createElement('strong'); title.textContent = service ? 'Gottesdienst bearbeiten' : 'Neuer Gottesdienst';
  form.append(title);
  const grid = document.createElement('div'); grid.className = 'editor-fields';
  fields.forEach((field) => {
    const label = document.createElement('label'); label.textContent = labels[field];
    const input = document.createElement('input'); input.name = field;
    input.type = 'text';
    if (field === 'date') { input.placeholder = 'TT.MM.JJJJ'; input.pattern = '(?:[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})'; }
    if (['start', 'end'].includes(field)) { input.placeholder = 'HH:MM'; input.pattern = '(?:[01][0-9]|2[0-3]):[0-5][0-9]'; input.inputMode = 'numeric'; }
    input.value = field === 'date' ? germanDate(draft[field]).replace('–', '') : draft[field] ?? ''; input.required = ['date', 'start', 'name'].includes(field);
    input.addEventListener('input', () => {
      draft[field] = field === 'date' && /^\d{2}\.\d{2}\.\d{4}$/.test(input.value) ? input.value.split('.').reverse().join('-') : input.value;
      if (field === 'date') {
        const parsed = new Date(`${draft[field]}T12:00:00Z`);
        input.setCustomValidity(!input.value || (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === draft[field]) ? '' : 'Bitte ein gültiges Datum eingeben.');
      }
    });
    label.append(input); grid.append(label);
  });
  form.append(grid);
  const actions = document.createElement('div'); actions.className = 'editor-actions';
  const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary'; save.textContent = 'Speichern';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'ghost'; cancel.textContent = 'Abbrechen';
  cancel.addEventListener('click', () => { state.editor = null; renderServices(); focusReview(); });
  actions.append(save, cancel);
  form.append(actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (service) Object.assign(service, draft); else { state.services.push(draft); state.servicesExpanded = true; }
    state.editor = null; invalidatePlan(); renderServices(); focusReview(); message('Gottesdienst gespeichert.', false, 'review');
  });
  cell.append(form); row.append(cell); return row;
}

function germanDate(value) { return value ? value.split('-').reverse().join('.') : '–'; }

function renderServices() {
  const body = $('services'); const toggle = $('services-toggle');
  const displayed = serviceView(state.services, $('parish').value, $('show-other-services').checked);
  const own = serviceView(state.services, $('parish').value, false).length;
  $('service-count').textContent = state.services.length ? `${own} eigene Gemeinde · ${state.services.length} insgesamt` : 'Noch keine Einträge';
  const total = displayed.length;
  if (total <= 5) state.servicesExpanded = false;
  toggle.hidden = total <= 5;
  toggle.setAttribute('aria-expanded', String(state.servicesExpanded));
  toggle.textContent = state.servicesExpanded ? `Auf 5 Gottesdienste reduzieren (${total} insgesamt)` : `${total - 5} weitere Gottesdienste anzeigen (${total} insgesamt)`;
  toggle.append(icon('chevron'));
  body.replaceChildren();
  if (!total && !state.editor) {
    const row = document.createElement('tr'); row.className = 'empty';
    const cell = document.createElement('td'); cell.colSpan = 7;
    cell.textContent = !state.services.length ? 'Noch keine Gottesdienste geladen.' : !$('parish').value.trim() ? 'Bitte eine Gemeinde eingeben oder andere Orte anzeigen.' : 'Keine Gottesdienste passen zu dieser Gemeinde. Andere Orte anzeigen oder Gemeinde prüfen.';
    row.append(cell); body.append(row);
  }
  let editorShown = false;
  (state.servicesExpanded ? displayed : displayed.slice(0, 5)).forEach(({ service, index }) => {
    const row = document.createElement('tr'); row.className = 'service-row'; row.dataset.index = index;
    fields.forEach((field) => {
      const cell = document.createElement('td'); cell.dataset.label = labels[field];
      if (field === 'dayInfo' && !service[field]) cell.dataset.empty = 'true';
      cell.textContent = field === 'date' ? germanDate(service[field]) : service[field] || '–';
      row.append(cell);
    });
    const action = document.createElement('td');
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-service'; actionIcon(edit, 'edit', 'Bearbeiten');
    edit.setAttribute('aria-label', `${service.name || 'Gottesdienst'} am ${germanDate(service.date)} bearbeiten`);
    edit.addEventListener('click', () => openEditor(service));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-service'; actionIcon(remove, 'trash', 'Löschen');
    remove.setAttribute('aria-label', `${service.name || 'Gottesdienst'} am ${germanDate(service.date)} löschen`);
    remove.addEventListener('click', () => {
      const sourceIndex = state.services.indexOf(service);
      if (sourceIndex < 0) return;
      state.services.splice(sourceIndex, 1);
      if (state.editor?.service === service) state.editor = null;
      invalidatePlan(); renderServices(); focusReview(); message('Gottesdienst gelöscht.', false, 'review');
    });
    action.className = 'service-actions'; action.append(edit, remove); row.append(action); body.append(row);
    if (state.editor?.service === service) { body.append(editorRow()); editorShown = true; }
  });
  if (state.editor && !editorShown) body.append(editorRow());
}

function uploadResult(text, status) {
  message(text, status === 'error', 'import');
  $('import-feedback').dataset.state = status;
  $('source-panel').classList.toggle('has-source', status !== 'idle');
  $('review-import').hidden = status !== 'success';
  requestAnimationFrame(() => {
    const panel = $('import-feedback'); const rect = panel.getBoundingClientRect();
    if (rect.bottom > window.innerHeight || rect.top < 0) panel.scrollIntoView({ block: 'center' });
  });
}

function renderDiagnostics() {
  const disclosure = $('diagnostics-disclosure');
  disclosure.open = false;
  disclosure.hidden = state.diagnostics.length === 0;
  $('diagnostics-summary').textContent = `Importhinweise anzeigen / ausblenden (${state.diagnostics.length})`;
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
  if (state.busy || !discardEditor()) return;
  document.querySelector('.advanced-options').open = false;
  setBusy(true);
  state.servicesExpanded = false;
  state.editor = null;
  state.services = [];
  renderServices();
  invalidatePlan();
  renderSelectedFiles(files);
  uploadResult('Dateien ausgewählt · werden lokal verarbeitet …', 'processing');
  try {
    const results = await Promise.all([...files].map(importFile));
    state.services = results.flatMap((result) => result.services);
    state.diagnostics = results.flatMap((result) => result.diagnostics);
    invalidatePlan();
    renderServices(); renderDiagnostics();
    uploadResult(state.services.length ? `${state.services.length} Gottesdienste aus ${files.length} Datei${files.length === 1 ? '' : 'en'} eingelesen. Vorherige Daten wurden ersetzt. Bitte Angaben prüfen.${state.diagnostics.length ? ` ${state.diagnostics.length} Importhinweise unter der Tabelle.` : ''}` : 'Keine Gottesdienste erkannt. Dateiformat und Inhalt prüfen oder eine andere Datei auswählen.', state.services.length ? 'success' : 'error');
  } catch (error) {
    state.services = [];
    state.diagnostics = [];
    invalidatePlan();
    renderServices();
    renderDiagnostics();
    uploadResult(`Import abgebrochen. Keine der ${files.length} ausgewählten Dateien wurde übernommen. ${error.message || 'Die Datei konnte nicht gelesen werden.'} Bitte Dateien prüfen und erneut auswählen.`, 'error');
  } finally { setBusy(false); }
}

function setBusy(busy) {
  state.busy = busy;
  for (const id of ['file-input', 'load-demo', 'add-service', 'create-plan', 'rules-input', 'no-calendar', 'parish']) $(id).disabled = busy;
  $('calendar-input').disabled = busy || $('no-calendar').checked;
  $('services').closest('.card').setAttribute('aria-busy', String(busy));
  $('create-plan').disabled = busy || !state.services.length;
}

function addService() { openEditor(); }

function loadDemo() {
  if (!discardEditor()) return;
  document.querySelector('.advanced-options').open = false;
  $('file-input').value = '';
  renderSelectedFiles([{ name: 'Beispieldaten geladen · 2 Gottesdienste (keine Datei).' }]);
  state.servicesExpanded = false;
  state.editor = null;
  state.services = [
    { date: '2026-07-01', start: '18:30', end: '19:30', name: 'Eucharistiefeier', location: 'Kirche St. Georg', dayInfo: '', source: 'Beispiel', row: 1 },
    { date: '2026-07-05', start: '10:00', end: '11:00', name: 'Wortgottesdienst', location: 'Kirche St. Georg', dayInfo: '', source: 'Beispiel', row: 2 },
  ]; state.diagnostics = []; invalidatePlan(); renderServices(); renderDiagnostics(); uploadResult('Beispieldaten geladen · 2 Gottesdienste. Vorherige Daten wurden ersetzt.', 'success');
}

async function planningConfig() {
  let rules = defaultRules;
  const ruleFile = $('rules-input').files[0];
  if (ruleFile) rules = JSON.parse(await ruleFile.text());
  validateRules(rules);

  if ($('no-calendar').checked) return { rules, calendar: new HolidayCalendar() };
  const calendarFiles = [...$('calendar-input').files];
  if (!calendarFiles.length) return { rules, calendar: defaultCalendar };
  return { rules, calendar: HolidayCalendar.fromIcsTexts(await Promise.all(calendarFiles.map((file) => file.text()))) };
}

async function createPlan() {
  if (state.editor) { message('Bitte den Entwurf zuerst speichern oder abbrechen.', true, 'review'); return; }
  invalidatePlan();
  setBusy(true);
  message('Miniplan wird vorbereitet …');
  try {
    const parish = $('parish').value.trim() || 'St. Georg';
    const { rules, calendar } = await planningConfig();
    state.plan = buildSchedule(state.services, rules, calendar, parish);
    if (!state.plan.length) { message('Keine passenden Gottesdienste für diese Gemeinde gefunden.', true); return; }
    $('plan-preview').hidden = false;
    const preview = $('plan-preview'); preview.replaceChildren();
    const title = document.createElement('h3'); title.textContent = `${state.plan.length} Einträge für den Miniplan`;
    const list = document.createElement('ul');
    state.plan.slice(0, 6).forEach((item) => { const line = document.createElement('li'); line.textContent = `${germanDate(item.date)} · ${item.start ?? '–'} · ${item.label} (${item.duties.filter(Boolean).join(', ') || 'Wochendienst'})`; list.append(line); });
    if (state.plan.length > 6) { const more = document.createElement('li'); more.textContent = `… und ${state.plan.length - 6} weitere`; list.append(more); }
    preview.append(title, list); $('download').disabled = false; message('Miniplan ist bereit zum Export.');
  } catch (error) {
    invalidatePlan();
    message(error.message || 'Regeln oder Kalender konnten nicht gelesen werden.', true);
  } finally { setBusy(false); }
}

async function download() {
  $('download').disabled = true;
  message('Datei wird erstellt …');
  try {
    const parish = $('parish').value.trim() || 'St. Georg';
    const format = $('export-format').value;
    if (!state.plan.length) { message('Bitte zuerst den Miniplan vorbereiten.', true); return; }
    const first = state.plan[0].date.split('-').reverse().join('.');
    const last = state.plan.at(-1).date.split('-').reverse().join('.');
    const filename = miniplanFilename(parish, first, last, format);
    if (format === 'xlsx') {
      const bytes = await createMiniplanWorkbook(state.plan, parish);
      downloadWorkbook(bytes, filename);
    } else {
      const bytes = await createOpenSpreadsheet(state.plan, parish, format);
      downloadOpenSpreadsheet(bytes, filename, format);
    }
    message(`${format.toUpperCase()}-Datei wurde heruntergeladen.`);
  } catch (error) { message(error.message || 'Die Datei konnte nicht erstellt werden.', true); }
  finally { $('download').disabled = !state.plan.length; }
}

$('review-import').addEventListener('click', focusReview);
$('file-input').addEventListener('change', (event) => importFiles(event.target.files));
$('services-toggle').addEventListener('click', () => {
  state.servicesExpanded = !state.servicesExpanded;
  renderServices();
});
$('add-service').addEventListener('click', addService);
$('load-demo').addEventListener('click', loadDemo);
$('create-plan').addEventListener('click', createPlan);
$('download').addEventListener('click', download);
$('parish').addEventListener('input', () => { invalidatePlan(); renderServices(); });
$('show-other-services').addEventListener('change', () => { state.servicesExpanded = false; renderServices(); });
function renderCalendarHelp() {
  $('calendar-help').textContent = $('no-calendar').checked
    ? 'Der Miniplan wird ohne Ferien- und Feiertagsprüfung erstellt.'
    : $('calendar-input').files.length
      ? 'Ferien und Feiertage aus deinen ausgewählten Kalendern werden berücksichtigt.'
      : 'Ferien und Feiertage in Baden-Württemberg werden berücksichtigt.';
}
for (const id of ['rules-input', 'calendar-input']) $(id).addEventListener('change', () => { invalidatePlan(); renderCalendarHelp(); });
$('no-calendar').addEventListener('change', () => {
  $('calendar-input').disabled = $('no-calendar').checked;
  renderCalendarHelp();
  invalidatePlan();
});
for (const eventName of ['dragenter', 'dragover']) $('file-input').closest('.dropzone').addEventListener(eventName, (event) => { event.preventDefault(); event.currentTarget.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) $('file-input').closest('.dropzone').addEventListener(eventName, (event) => { event.preventDefault(); event.currentTarget.classList.remove('dragging'); });
$('file-input').closest('.dropzone').addEventListener('drop', (event) => importFiles(event.dataTransfer.files));
invalidatePlan();

for (const node of document.querySelectorAll('[data-icon]')) node.prepend(icon(node.dataset.icon));

const settings = document.querySelector('.advanced-options');
const closeSettings = document.createElement('button');
closeSettings.type = 'button'; closeSettings.className = 'settings-close';
closeSettings.setAttribute('aria-label', 'Einstellungen schließen');
actionIcon(closeSettings, 'close', 'Schließen');
settings.querySelector('.settings-panel').prepend(closeSettings);
closeSettings.addEventListener('click', () => { settings.open = false; settings.querySelector('summary').focus(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settings.open) { settings.open = false; settings.querySelector('summary').focus(); }
});

document.addEventListener('pointerdown', (event) => { if (settings.open && !settings.contains(event.target)) settings.open = false; });
