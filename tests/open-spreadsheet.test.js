import * as SheetJS from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { parseOpenSpreadsheet, createOpenSpreadsheet } from '../src/core/open-spreadsheet.js';

function createOds(rows) {
  const workbook = SheetJS.utils.book_new();
  SheetJS.utils.book_append_sheet(workbook, SheetJS.utils.aoa_to_sheet(rows), 'Plan');
  return SheetJS.write(workbook, { bookType: 'ods', type: 'array' });
}

describe('parseOpenSpreadsheet', () => {
  it('reads an OpenDocument Spreadsheet using the same Miniplan row rules', async () => {
    const bytes = createOds([
      ['Mittwoch, 1. Juli 2026'],
      ['Hochfest Peter und Paul'],
      ['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St. Georg'],
    ]);

    expect(parseOpenSpreadsheet(bytes, 'plan.ods')).toMatchObject({
      services: [{
        date: '2026-07-01',
        start: '18:30',
        end: '19:30',
        name: 'Eucharistiefeier',
        location: 'Kirche St. Georg',
        dayInfo: 'Hochfest Peter und Paul',
        source: 'plan.ods',
        row: 3,
      }],
      diagnostics: [],
    });
  });

  it('creates an OpenDocument Spreadsheet that remains readable', () => {
    const bytes = createOpenSpreadsheet([{
      date: '2026-07-01', start: '18:30', label: 'Eucharistiefeier', duties: ['Leuchter', 'Altar'],
    }], 'St. Georg', 'ods');
    const workbook = SheetJS.read(bytes, { type: 'array', cellText: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    expect(SheetJS.utils.sheet_to_json(sheet, { header: 1, raw: false })).toEqual([
      ['St. Georg - Miniplan'],
      ['Datum', 'Beginn', 'Gottesdienst', 'Dienste'],
      ['01.07.2026', '18:30', 'Eucharistiefeier', 'Leuchter; Altar'],
    ]);
  });

  it('creates a UTF-8 CSV using German semicolons', () => {
    const bytes = createOpenSpreadsheet([{
      date: '2026-07-01', start: '18:30', label: 'Eucharistiefeier', duties: ['Leuchter', 'Altar'],
    }], 'St. Georg', 'csv');
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('Datum;Beginn;Gottesdienst;Dienste');
    expect(text).toContain('"Leuchter; Altar"');
    const workbook = SheetJS.read(bytes, { type: 'array', FS: ';' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(SheetJS.utils.sheet_to_json(sheet, { header: 1, raw: false })).toContainEqual([
      '01.07.2026', '18:30', 'Eucharistiefeier', 'Leuchter; Altar',
    ]);
  });
});
