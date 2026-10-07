import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import { normalizeText, parseGermanDate, parseTime } from './normalize.js';

const BOUNDARIES = [70, 121, 160, 400];

function columnFor(x) {
  if (x < BOUNDARIES[0]) return 0;
  if (x < BOUNDARIES[1]) return 1;
  if (x < BOUNDARIES[2]) return 2;
  if (x < BOUNDARIES[3]) return 3;
  return 4;
}

export function rowsFromTextItems(items) {
  const lines = [];
  for (const item of items) {
    const text = normalizeText(item.str);
    if (!text) continue;
    const [,,,, x, y] = item.transform;
    let line = lines.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({ text, x });
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => {
    const columns = ['', '', '', '', ''];
    for (const { text, x } of line.items.sort((a, b) => a.x - b.x)) {
      const column = columnFor(x);
      columns[column] = normalizeText(`${columns[column]} ${text}`);
    }
    return columns;
  });
}

function parseRows(rows, source) {
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
        if (/^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),/.test(firstText)) {
          date = null;
          dayInfo = [];
          diagnostics.push({ level: 'warning', message: 'Ungültiges Datum ignoriert', source, row });
          return;
        }
        if (date && !normalizeText(startValue)) dayInfo.push(firstText);
      }
    }
    const name = normalizeText(nameValue);
    if (!name || !normalizeText(startValue)) return;
    let start;
    try { start = parseTime(startValue); } catch {
      if (date) diagnostics.push({ level: 'warning', message: 'Ungültige Startzeit ignoriert', source, row });
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
    services.push({ date, start, end, name, location: normalizeText(locationValue), dayInfo: dayInfo.join('; '), source, row });
  });
  return { services, diagnostics };
}

export async function parsePdf(input, source = 'Datei.pdf') {
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(input), disableWorker: true }).promise;
  const rows = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    rows.push(...rowsFromTextItems(content.items));
  }
  return parseRows(rows, source);
}
