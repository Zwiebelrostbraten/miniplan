import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
import { normalizeText, parseGermanDate, parseTime } from './normalize.js';

// Keep PDF processing available when the packaged HTML is opened via file://.
if (typeof window !== 'undefined') {
  // Bundle the worker handler into the offline app. PDF.js then uses this
  // in-process fake worker instead of dynamically importing a file:// module,
  // which browsers deliberately block for a locally opened HTML file.
  globalThis.pdfjsWorker = { WorkerMessageHandler };
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('miniplan.worker.js', window.location.href).href;
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
      const text = item.str;
      const words = [...text.matchAll(/\S+/g)];
      const unit = Number.isFinite(item.width) && text.length ? item.width / text.length : 0;
      return words.map((match) => ({
        text: match[0],
        x: item.transform[4] + (item.characterWidths
          ? item.characterWidths.slice(0, match.index).reduce((sum, width) => sum + width, 0)
          : match.index * unit),
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
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(input), disableWorker: true, fontExtraProperties: true }).promise;
  const rows = [];
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    // Loading the operators exposes the embedded font metrics. PDF.js 4.10
    // exports these when fontExtraProperties is enabled; retain the geometric
    // fallback for fonts without a usable Unicode map.
    await page.getOperatorList();
    const content = await page.getTextContent();
    const fontWidths = new Map();
    for (const item of content.items) {
      if (!item.str || !item.fontName) continue;
      if (!fontWidths.has(item.fontName)) {
        const font = page.commonObjs.get(item.fontName);
        const widths = new Map();
        Object.entries(font.toUnicode?._map ?? {}).forEach(([code, character]) => {
          widths.set(character, font.widths?.[code] ?? font.defaultWidth);
        });
        fontWidths.set(item.fontName, widths);
      }
      const widths = fontWidths.get(item.fontName);
      const characters = item.str.split('');
      if (characters.every((character) => widths.has(character))) {
        const advances = characters.map((character) => widths.get(character));
        const total = advances.reduce((sum, width) => sum + width, 0);
        if (total > 0) item.characterWidths = advances.map((width) => width * item.width / total);
      }
    }
    const width = page.view[2] - page.view[0];
    const pageRows = rowsFromTextItems(content.items, width);
    rows.push(...pageRows);
    pages.push(...pageRows.map(() => pageNumber));
  }
  const result = parseRows(rows, source);
  for (const item of [...result.services, ...result.diagnostics]) {
    item.row = pages[item.row - 1];
  }
  if (!result.services.length) result.diagnostics.push({ level: 'error', message: 'Im PDF wurden keine Gottesdienste erkannt', source, row: null });
  return result;
}
