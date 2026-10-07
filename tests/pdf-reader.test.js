import { describe, expect, it } from 'vitest';
import { rowsFromTextItems } from '../src/core/pdf-reader.js';

const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe('rowsFromTextItems', () => {
  it('groups PDF text by row and maps five columns', () => {
    const rows = rowsFromTextItems([
      item('Mittwoch, 1. Juli 2026', 20, 700),
      item('18:30', 90, 680), item('19:30', 140, 680), item('Eucharistiefeier', 180, 680), item('Kirche St. Georg', 410, 680),
    ]);
    expect(rows).toEqual([
      ['Mittwoch, 1. Juli 2026', '', '', '', ''],
      ['', '18:30', '19:30', 'Eucharistiefeier', 'Kirche St. Georg'],
    ]);
  });

  it('uses the actual Pfarrbüro column boundaries', () => {
    const rows = rowsFromTextItems([
      item('07:45', 90.95, 640), item('08:15', 126.15, 640), item('Schülergottesdienst', 166.4, 640), item('Kirche St. Georg', 442.95, 640),
    ]);
    expect(rows).toEqual([['', '07:45', '08:15', 'Schülergottesdienst', 'Kirche St. Georg']]);
  });
});
