import { describe, expect, it } from 'vitest';
import { parseRows, rowsFromTextItems } from '../src/core/pdf-reader.js';

const item = (str, x, y, width = str.length * 5) => ({ str, width, transform: [1, 0, 0, 1, x, y] });
const PAGE_WIDTH = 595.247;

describe('rowsFromTextItems', () => {
  it.each([false, true])('keeps a long source name run in its starting column (glyph widths: %s)', (withGlyphWidths) => {
    const name = 'Wortgottesdienst mit Kommunionfeier (Tausch mit St. Maria';
    const run = item(name, 166.4, 640, 264.29);
    if (withGlyphWidths) run.characterWidths = Array.from(name, () => run.width / name.length);
    expect(rowsFromTextItems([
      item('10:30', 90.95, 640), item('11:30', 126.15, 640),
      run, item('Kirche St. Georg', 442.95, 640, 73.85),
    ], PAGE_WIDTH)).toEqual([['', '10:30', '11:30', name, 'Kirche St. Georg']]);
  });

  it('keeps a wrapped celebrant name together using glyph widths', () => {
    const run = item('/ Pfr. Stegmaier', 166.4, 640, 69.37);
    run.characterWidths = [2.77, 2.77, 6.66, 2.77, 3.33, 2.77, 2.77, 6.66, 2.77, 5.56, 5.56, 8.33, 5.56, 2.22, 5.56, 3.33];
    expect(rowsFromTextItems([run], PAGE_WIDTH)).toEqual([['', '', '', '/ Pfr. Stegmaier', '']]);
  });

  it('groups PDF text by row and maps five relative columns', () => {
    const rows = rowsFromTextItems([
      item('Mittwoch,', 20, 700), item('1. Juli 2026', 180, 700),
      item('18:30', 90, 680), item('19:30', 140, 680), item('Eucharistiefeier', 180, 680), item('Kirche St. Georg', 410, 680),
    ], PAGE_WIDTH);
    expect(rows).toEqual([
      ['Mittwoch, 1. Juli 2026', '', '', '', ''],
      ['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St. Georg'],
    ]);
  });

  it('keeps the leading service word in the name column for the real Pfarrbüro PDF', () => {
    const rows = rowsFromTextItems([
      item('07:45', 90.95, 640), item('08:15', 126.15, 640), item('Schülergottesdienst', 166.4, 640), item('Kirche St. Georg', 442.95, 640),
    ], PAGE_WIDTH);
    expect(rows).toEqual([['', '07:45', '08:15', 'Schülergottesdienst', 'Kirche St. Georg']]);
  });

  it('splits PDF.js text runs into words before assigning service columns', () => {
    const rows = rowsFromTextItems([
      item('18:30', 90.95, 640), item('19:30', 126.15, 640), item('Eucharistiefeier - Erntedank', 166.4, 640, 130), item('Kirche St. Georg', 442.95, 640, 80),
    ], PAGE_WIDTH);
    expect(rows).toEqual([['', '18:30', '19:30', 'Eucharistiefeier - Erntedank', 'Kirche St. Georg']]);
  });

  it('drops PDF boilerplate lines before parsing rows', () => {
    const rows = rowsFromTextItems([
      item('Terminkalender', 20, 700), item('Seite 1', 450, 700),
      item('18:30', 90, 680), item('19:30', 140, 680), item('Eucharistiefeier', 180, 680), item('Kirche St. Georg', 410, 680),
    ], PAGE_WIDTH);
    expect(rows).toEqual([['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St. Georg']]);
  });
});

describe('parseRows', () => {
  it('appends wrapped name and location text to the previous service', () => {
    const result = parseRows([
      ['Mittwoch, 1. Juli 2026', '', '', '', ''],
      ['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St.'],
      ['', '', '', 'mit Totengedenken', 'Georg'],
    ], 'plan.pdf');

    expect(result.services).toEqual([{
      date: '2026-07-01', start: '18:30', end: '19:30', name: 'Eucharistiefeier mit Totengedenken', location: 'Kirche St. Georg', dayInfo: '', source: 'plan.pdf', row: 2,
    }]);
    expect(result.diagnostics).toEqual([]);
  });
});

it('ends continuation at day notes and readings', () => {
    const result = parseRows([
      ['Sonntag, 5. Juli 2026'],
      ['', '10:30', '11:30', 'Wortgottesdienst', 'Kirche St. Georg'],
      ['14. Sonntag', 'im', 'Jahreskreis', 'L1: Sach 9', 'Ev: Mt 11'],
      ['', '', '', '25-30', ''],
      ['', '', '', 'L2: Röm 8', ''],
    ], 'plan.pdf');
    expect(result.services[0].name).toBe('Wortgottesdienst');
    expect(result.services[0].location).toBe('Kirche St. Georg');
});
