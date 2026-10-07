import * as SheetJS from '@e965/xlsx';
import JSZip from 'jszip';
import { germanDate, weekdayIndex, compareText } from './normalize.js';
import { parseRows } from './spreadsheet-reader.js';

const OPEN_FORMATS = new Set(['ods', 'csv']);
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const INFO = 'Standardmäßig 15min. vorher da sein, außer es steht beim jeweiligen Gottesdienst etwas anderes.';

function safeText(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function orderedEntries(entries) {
  return [...entries].sort((a, b) => compareText(a.date, b.date) || compareText(a.start ?? '', b.start ?? ''));
}

function csvRows(entries, parish) {
  return [
    [safeText(`${parish} - Miniplan`)],
    ['Datum', 'Beginn', 'Gottesdienst', 'Dienste'],
    ...orderedEntries(entries).map((item) => [
      germanDate(item.date),
      item.start ?? '',
      safeText(item.label),
      safeText(item.duties.filter(Boolean).join('; ')),
    ]),
  ];
}

function odsRows(entries, parish) {
  const ordered = orderedEntries(entries);
  const rows = [
    [safeText(`${parish} - Miniplan vom ${germanDate(ordered[0].date)} - ${germanDate(ordered.at(-1).date)}`)],
    [INFO],
  ];
  for (const item of ordered) {
    const duties = item.duties.length ? item.duties : [''];
    duties.forEach((duty, index) => rows.push(index === 0
      ? [WEEKDAYS[weekdayIndex(item.date)], germanDate(item.date), item.start ?? '', safeText(item.label), safeText(duty), '', '']
      : ['', '', '', '', safeText(duty), '', '']));
    rows.push([]);
  }
  return rows;
}

const ODS_CELL_STYLES = `
  <style:style style:name="ceTitle" style:family="table-cell">
    <style:table-cell-properties fo:background-color="#D9EAD3" fo:border="0.75pt solid #000000" style:vertical-align="middle" fo:wrap-option="wrap"/>
    <style:paragraph-properties fo:text-align="center"/>
    <style:text-properties fo:font-family="Arial" fo:font-size="18pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="ceInfo" style:family="table-cell">
    <style:table-cell-properties fo:border="0.75pt solid #000000" style:vertical-align="middle" fo:wrap-option="wrap"/>
    <style:paragraph-properties fo:text-align="center"/>
    <style:text-properties fo:font-family="Arial" fo:font-size="10pt" fo:font-style="italic"/>
  </style:style>
  <style:style style:name="ceBody" style:family="table-cell">
    <style:table-cell-properties fo:border="0.75pt solid #000000" style:vertical-align="top" fo:wrap-option="wrap"/>
    <style:text-properties fo:font-family="Arial" fo:font-size="10pt"/>
  </style:style>`;

function styleOdsContent(xml) {
  let rowIndex = 0;
  const styledRows = xml.replace(/<table:table-row\b[\s\S]*?<\/table:table-row>/g, (row) => {
    const style = rowIndex === 0 ? 'ceTitle' : rowIndex === 1 ? 'ceInfo' : 'ceBody';
    rowIndex += 1;
    if (style === 'ceBody') return row.replace(/<table:table-cell\b/g, `<table:table-cell table:style-name="${style}"`);
    return row.replace(/<table:table-cell\b/, `<table:table-cell table:style-name="${style}"`);
  });
  return styledRows.replace('</office:automatic-styles>', `${ODS_CELL_STYLES}\n </office:automatic-styles>`);
}

function styleOdsPage(xml) {
  const pageLayout = `<office:automatic-styles>
  <style:page-layout style:name="mp1">
    <style:page-layout-properties fo:page-width="29.7cm" fo:page-height="21cm" style:print-orientation="landscape" style:scale-to-X="1" style:scale-to-Y="0"/>
  </style:page-layout>
</office:automatic-styles>`;
  return xml.replace('<office:master-styles>', `${pageLayout}<office:master-styles>`);
}

async function applyOdsStyles(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const content = await zip.file('content.xml').async('string');
  const styles = await zip.file('styles.xml').async('string');
  const mime = await zip.file('mimetype').async('string');
  zip.file('content.xml', styleOdsContent(content));
  zip.file('styles.xml', styleOdsPage(styles));
  zip.file('mimetype', mime, { compression: 'STORE' });
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function parseOpenSpreadsheet(input, source = 'Datei.ods') {
  const workbook = SheetJS.read(input, { type: 'array', cellText: true, cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error(`${source}: Keine Tabelle gefunden.`);
  const rows = SheetJS.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
  return parseRows(rows, source);
}

export async function createOpenSpreadsheet(entries, parish = 'St. Georg', format = 'ods') {
  if (!OPEN_FORMATS.has(format)) throw new Error(`Nicht unterstütztes offenes Tabellenformat: ${format}`);
  if (!entries.length) throw new Error('Der Miniplan ist leer; es wird keine Tabelle erzeugt.');
  const workbook = SheetJS.utils.book_new();
  const sheet = SheetJS.utils.aoa_to_sheet(format === 'ods' ? odsRows(entries, parish) : csvRows(entries, parish));
  if (format === 'ods') {
    sheet['!merges'] = [
      { s: { c: 0, r: 0 }, e: { c: 6, r: 0 } },
      { s: { c: 0, r: 1 }, e: { c: 6, r: 1 } },
    ];
    sheet['!cols'] = [5, 13, 8, 22, 18, 20, 20].map((wch) => ({ wch }));
    sheet['!rows'] = [{ hpx: 37.33 }, { hpx: 40 }];
  } else {
    sheet['!cols'] = [{ wch: 13 }, { wch: 10 }, { wch: 32 }, { wch: 45 }];
  }
  SheetJS.utils.book_append_sheet(workbook, sheet, 'Miniplan');
  const bytes = SheetJS.write(workbook, {
    bookType: format,
    type: 'array',
    compression: format === 'ods',
    FS: format === 'csv' ? ';' : undefined,
    RS: format === 'csv' ? '\r\n' : undefined,
  });
  return format === 'ods' ? applyOdsStyles(bytes) : bytes;
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
