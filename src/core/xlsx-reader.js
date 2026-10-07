import ExcelJS from 'exceljs';
import { parseRows } from './spreadsheet-reader.js';

function cellValue(cell) {
  const value = cell?.value;
  if (value && typeof value === 'object' && 'text' in value) return value.text;
  return value ?? '';
}

export async function parseWorkbook(input, source = 'Datei.xlsx') {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);
  const sheet = workbook.worksheets[0];
  const rows = [];
  sheet.eachRow((row) => {
    rows.push([1, 2, 3, 4, 5].map((column) => cellValue(row.getCell(column))));
  });
  return parseRows(rows, source);
}
