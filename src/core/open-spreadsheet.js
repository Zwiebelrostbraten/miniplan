import * as SheetJS from '@e965/xlsx';
import { germanDate } from './normalize.js';
import { parseRows } from './spreadsheet-reader.js';

const OPEN_FORMATS = new Set(['ods', 'csv']);

function safeText(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function exportRows(entries, parish) {
  const ordered = [...entries].sort((a, b) => `${a.date} ${a.start ?? '00:00'}`.localeCompare(`${b.date} ${b.start ?? '00:00'}`));
  return [
    [safeText(`${parish} - Miniplan`)],
    ['Datum', 'Beginn', 'Gottesdienst', 'Dienste'],
    ...ordered.map((item) => [
      germanDate(item.date),
      item.start ?? '',
      safeText(item.label),
      safeText(item.duties.filter(Boolean).join('; ')),
    ]),
  ];
}

export function parseOpenSpreadsheet(input, source = 'Datei.ods') {
  const workbook = SheetJS.read(input, { type: 'array', cellText: true, cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error(`${source}: Keine Tabelle gefunden.`);
  const rows = SheetJS.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
  return parseRows(rows, source);
}

export function createOpenSpreadsheet(entries, parish = 'St. Georg', format = 'ods') {
  if (!OPEN_FORMATS.has(format)) throw new Error(`Nicht unterstütztes offenes Tabellenformat: ${format}`);
  if (!entries.length) throw new Error('Der Miniplan ist leer; es wird keine Tabelle erzeugt.');
  const workbook = SheetJS.utils.book_new();
  const sheet = SheetJS.utils.aoa_to_sheet(exportRows(entries, parish));
  sheet['!cols'] = [{ wch: 13 }, { wch: 10 }, { wch: 32 }, { wch: 45 }];
  SheetJS.utils.book_append_sheet(workbook, sheet, 'Miniplan');
  return SheetJS.write(workbook, {
    bookType: format,
    type: 'array',
    compression: format === 'ods',
    FS: format === 'csv' ? ';' : undefined,
    RS: format === 'csv' ? '\r\n' : undefined,
  });
}

export function downloadOpenSpreadsheet(bytes, filename, format) {
  const type = format === 'ods'
    ? 'application/vnd.oasis.opendocument.spreadsheet'
    : 'text/csv;charset=utf-8';
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
