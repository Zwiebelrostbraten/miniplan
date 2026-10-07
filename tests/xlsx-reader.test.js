import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../src/core/xlsx-reader.js';

describe('parseWorkbook', () => {
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
});
