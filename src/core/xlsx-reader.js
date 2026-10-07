import ExcelJS from 'exceljs';
import { parseRows } from './spreadsheet-reader.js';

function cellValue(cell) {
  if (!cell || cell.value == null) return '';
  const value = cell.value;
  if (typeof value !== 'object') return value;
  if ('result' in value) return value.result ?? '';
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value) return value.text;
  return value;
}

export async function parseWorkbook(input, source = 'Datei.xlsx') {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);
  const activeTab = workbook.views?.[0]?.activeTab ?? 0;
  const sheet = workbook.worksheets[activeTab] ?? workbook.worksheets[0];
  const rows = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push([1, 2, 3, 4, 5].map((column) => cellValue(row.getCell(column))));
  });
  return parseRows(rows, source);
}
