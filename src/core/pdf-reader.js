import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { normalizeText, parseGermanDate, parseTime } from './normalize.js';

// pdfjs-dist v4 requires an explicit worker source in the browser (the Node
// fallback only auto-configures itself). The fake worker (disableWorker) then
// dynamically imports this module, which build.mjs copies into dist/.
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'miniplan.worker.js';
}

const Y_TOLERANCE = 2.5;
const IGNORED_TEXT = ['Terminkalender', 'Ausdruck vom', 'Custos', 'Seite '];

function looksLikeDate(value) {
  return /^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),/i.test(normalizeText(value));
}

function columnFor(x, width) {
  const boundaries = [width * 0.135, width * 0.21, width * 0.29, width * 0.67];
  return boundaries.filter((boundary) => x >= boundary).length;
}

export function rowsFromTextItems(items, width = 595.247) {
  const ordered = items
    .flatMap((item) => {
      const text = normalizeText(item.str);
      const words = [...text.matchAll(/\S+/g)];
      const unit = Number.isFinite(item.width) && text.length ? item.width / text.length : 0;
      return words.map((match) => ({
        text: match[0],
        x: item.transform[4] + (match.index * unit),
        y: item.transform[5],
      }));
    })
    .filter((item) => item.text)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const item of ordered) {
    let line = lines.at(-1);
    if (!line || Math.abs(line.y - item.y) > Y_TOLERANCE) {
      line = { y: item.y, count: 0, items: [] };
      lines.push(line);
    }
    line.y = ((line.y * line.count) + item.y) / (line.count + 1);
    line.count += 1;
    line.items.push({ text: item.text, x: item.x });
  }

  const rows = [];
  for (const line of lines) {
    const lineText = normalizeText(line.items.map(({ text }) => text).join(' '));
    if (IGNORED_TEXT.some((prefix) => lineText.startsWith(prefix))) continue;
    const columns = ['', '', '', '', ''];
    for (const { text, x } of line.items.sort((a, b) => a.x - b.x)) {
      const column = columnFor(x, width);
      columns[column] = normalizeText(`${columns[column]} ${text}`);
    }
    if (looksLikeDate(columns[0])) rows.push([normalizeText(columns.join(' ')), '', '', '', '']);
    else rows.push(columns);
  }
  return rows;
}

export function parseRows(rows, source) {
  const services = [];
  const diagnostics = [];
  let date = null;
  let dayInfo = [];
  rows.forEach(([first = '', startValue = '', endValue = '', nameValue = '', locationValue = ''], index) => {
    const row = index + 1;
    const firstText = normalizeText(first);
    if (firstText) {
      try {
        date = parseGermanDate(firstText);
        dayInfo = [];
        return;
      } catch {
        if (looksLikeDate(firstText)) {
          date = null;
          dayInfo = [];
          diagnostics.push({ level: 'warning', message: 'Ungültiges Datum ignoriert', source, row });
          return;
        }
        if (date && !normalizeText(startValue)) dayInfo.push(firstText);
      }
    }

    const name = normalizeText(nameValue);
    const location = normalizeText(locationValue);
    const startText = normalizeText(startValue);
    if (!firstText && !startText && (name || location)) {
      const previous = services.at(-1);
      if (previous && date && previous.date === date) {
        previous.name = normalizeText(`${previous.name} ${name}`);
        previous.location = normalizeText(`${previous.location} ${location}`);
      } else {
        diagnostics.push({ level: 'warning', message: 'Unvollständige Gottesdienstzeile übersprungen', source, row });
      }
      return;
    }
    if (!name || !startText) {
      if (startText) diagnostics.push({ level: 'warning', message: 'Unvollständige Gottesdienstzeile übersprungen', source, row });
      return;
    }
    let start;
    try { start = parseTime(startValue); } catch {
      diagnostics.push({ level: 'warning', message: 'Ungültige Startzeit ignoriert', source, row });
      return;
    }
    if (!date) {
      diagnostics.push({ level: 'warning', message: 'Gottesdienst ohne vorangehendes Datum übersprungen', source, row });
      return;
    }
    let end = null;
    if (normalizeText(endValue)) {
      try { end = parseTime(endValue); } catch { diagnostics.push({ level: 'warning', message: 'Ungültige Endzeit ignoriert', source, row }); }
    }
    services.push({ date, start, end, name, location, dayInfo: dayInfo.join('; '), source, row });
  });
  return { services, diagnostics };
}

export async function parsePdf(input, source = 'Datei.pdf') {
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(input), disableWorker: true }).promise;
  const rows = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const width = page.view[2] - page.view[0];
    rows.push(...rowsFromTextItems(content.items, width));
  }
  const result = parseRows(rows, source);
  if (!result.services.length) result.diagnostics.push({ level: 'error', message: 'Im PDF wurden keine Gottesdienste erkannt', source, row: null });
  return result;
}
