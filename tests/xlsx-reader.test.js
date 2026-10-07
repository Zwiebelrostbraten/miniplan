import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../src/core/xlsx-reader.js';

describe('parseWorkbook', () => {
  it('reads native Excel times without timezone shifts and retains physical row numbers', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plan');
    sheet.getCell('A1').value = 'Donnerstag, 2. Juli 2026';
    sheet.getCell('B4').value = new Date('1899-12-30T18:30:00Z');
    sheet.getCell('D4').value = 'Eucharistiefeier';
    sheet.getCell('E4').value = 'St. Georg';
    sheet.getCell('B7').value = 'morgen';
    sheet.getCell('D7').value = 'Tauffeier';
    const result = await parseWorkbook(await workbook.xlsx.writeBuffer(), 'plan.xlsx');
    expect(result.services).toContainEqual(expect.objectContaining({ date: '2026-07-02', start: '18:30', row: 4 }));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Ungültige Startzeit ignoriert', row: 7 }));
  });

  it('carries a dated heading forward and reports malformed service rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plan');
    sheet.addRow(['Mittwoch, 1. Juli 2026']);
    sheet.addRow(['Hochfest Peter und Paul']);
    sheet.addRow(['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St. Georg']);
    sheet.addRow(['', 'morgen', '', 'Ungültig', 'Kirche St. Georg']);

    const result = await parseWorkbook(await workbook.xlsx.writeBuffer(), 'plan.xlsx');

    expect(result.services).toEqual([{
      date: '2026-07-01', start: '18:30', end: '19:30', name: 'Eucharistiefeier', location: 'Kirche St. Georg', dayInfo: 'Hochfest Peter und Paul', source: 'plan.xlsx', row: 3,
    }]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toMatch(/Startzeit/);
  });

  it('reads cached formula results instead of dropping formula objects', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plan');
    sheet.getCell('A1').value = { formula: '=CONCATENATE("Mittwoch, ","1. Juli 2026")', result: 'Mittwoch, 1. Juli 2026' };
    sheet.getCell('B2').value = '18:30';
    sheet.getCell('C2').value = '19:30';
    sheet.getCell('D2').value = { formula: '=CONCATENATE("Eucharistie","feier")', result: 'Eucharistiefeier' };
    sheet.getCell('E2').value = 'Kirche St. Georg';

    const result = await parseWorkbook(await workbook.xlsx.writeBuffer(), 'plan.xlsx');
    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({ date: '2026-07-01', start: '18:30', name: 'Eucharistiefeier' });
  });

  it('clears the current date after a lowercase malformed date header', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plan');
    sheet.addRow(['Mittwoch, 1. Juli 2026']);
    sheet.addRow(['', '18:30', '', 'Eucharistiefeier', 'Kirche St. Georg']);
    sheet.addRow(['donnerstag, 32. Juli 2026']);
    sheet.addRow(['', '10:00', '', 'Tauffeier', 'Kirche St. Georg']);

    const result = await parseWorkbook(await workbook.xlsx.writeBuffer(), 'plan.xlsx');
    expect(result.services).toHaveLength(1);
    expect(result.services[0].name).toBe('Eucharistiefeier');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Ungültiges Datum ignoriert', row: 3 }));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Gottesdienst ohne vorangehendes Datum übersprungen', row: 4 }));
  });

  it('rejects an unformatted numeric time like the Python reader', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plan');
    sheet.addRow(['Mittwoch, 1. Juli 2026']);
    sheet.addRow(['', 0.5, '', 'Eucharistiefeier', 'Kirche St. Georg']);

    const result = await parseWorkbook(await workbook.xlsx.writeBuffer(), 'plan.xlsx');
    expect(result.services).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Ungültige Startzeit ignoriert', row: 2 }));
  });

  it('reads the active worksheet rather than always the first sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Hinweise').addRow(['nur Notizen']);
    const plan = workbook.addWorksheet('Plan');
    plan.addRow(['Mittwoch, 1. Juli 2026']);
    plan.addRow(['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St. Georg']);
    workbook.views = [{ activeTab: 1 }];

    const result = await parseWorkbook(await workbook.xlsx.writeBuffer(), 'plan.xlsx');
    expect(result.services).toHaveLength(1);
    expect(result.services[0].name).toBe('Eucharistiefeier');
  });
});
