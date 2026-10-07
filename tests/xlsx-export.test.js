import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createMiniplanWorkbook } from '../src/core/xlsx-export.js';

describe('createMiniplanWorkbook', () => {
  it('creates the printable Miniplan layout and protects formula-like text', async () => {
    const bytes = await createMiniplanWorkbook([
      { date: '2026-07-01', start: '18:30', label: '=Eu', duties: ['+Altar', 'Sammler'] },
    ], 'St. Georg');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('Miniplan');

    expect(sheet.getCell('A1').value).toBe('St. Georg - Miniplan vom 01.07.2026 - 01.07.2026');
    expect(sheet.getCell('A3').value).toBe('Mi');
    expect(sheet.getCell('D3').value).toBe("'=Eu");
    expect(sheet.getCell('E3').value).toBe("'+Altar");
    expect(sheet.getCell('E4').value).toBe('Sammler');
    expect(sheet.getCell('A1').fill.fgColor.argb).toBe('FFD9EAD3');
    expect(sheet.columns.map((column) => column.width)).toEqual([5, 13, 8, 22, 18, 20, 20]);
  });

  it('borders every row through the final spacer like the Python writer', async () => {
    const bytes = await createMiniplanWorkbook([
      { date: '2026-07-01', start: '18:30', label: 'Eucharistiefeier', duties: ['Leuchter', 'Altar'] },
    ], 'St. Georg');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('Miniplan');

    expect(sheet.rowCount).toBe(5);
    for (let row = 1; row <= sheet.rowCount; row += 1) {
      for (let column = 1; column <= 7; column += 1) {
        expect(sheet.getRow(row).getCell(column).border?.top?.style).toBe('thin');
      }
    }
  });
});
