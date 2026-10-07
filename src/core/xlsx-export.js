import ExcelJS from 'exceljs';
import { germanDate, weekdayIndex } from './normalize.js';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const INFO = 'Standardmäßig 15min. vorher da sein, außer es steht beim jeweiligen Gottesdienst etwas anderes.';

function safeText(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function createMiniplanWorkbook(entries, parish = 'St. Georg') {
  if (!entries.length) throw new Error('Der Miniplan ist leer; es wird keine Excel-Datei erzeugt.');
  const ordered = [...entries].sort((a, b) => `${a.date} ${a.start ?? '00:00'}`.localeCompare(`${b.date} ${b.start ?? '00:00'}`));
  const start = ordered[0].date;
  const end = ordered.at(-1).date;
  const title = `${parish} - Miniplan vom ${germanDate(start)} - ${germanDate(end)}`;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Miniplan', { views: [{ showGridLines: false, state: 'frozen', ySplit: 2 }] });
  sheet.mergeCells('A1:G1');
  sheet.mergeCells('A2:G2');
  sheet.getCell('A1').value = safeText(title);
  sheet.getCell('A2').value = INFO;
  sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true };
  sheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 30;
  sheet.columns = [5, 13, 8, 22, 18, 20, 20].map((width) => ({ width }));

  for (const item of ordered) {
    const duties = item.duties.length ? item.duties : [''];
    duties.forEach((duty, index) => sheet.addRow(index === 0
      ? [WEEKDAYS[weekdayIndex(item.date)], germanDate(item.date), item.start ?? '', safeText(item.label), safeText(duty), '', '']
      : ['', '', '', '', safeText(duty), '', '']));
    sheet.addRow([]);
  }
  const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= 7; column += 1) {
      const cell = row.getCell(column);
      cell.border = border;
      if (rowNumber > 2) {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'top', wrapText: true };
      }
    }
  }
  sheet.pageSetup = { orientation: 'landscape', fitToWidth: 1, fitToPage: true, printArea: `A1:G${sheet.rowCount}`, printTitlesRow: '1:2' };
  return workbook.xlsx.writeBuffer();
}

export function downloadWorkbook(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
