import { describe, expect, it } from 'vitest';
import { buildSchedule } from '../src/core/schedule.js';

const RULES = {
  Eucharistiefeier: { Dienste: ['Leuchter', 'Altar', 'Sammler', 'Sammler'], Bezeichnung: 'Eu', 'Dienste in Ferien': ['Leuchter', 'Altar'] },
  Wortgottesdienst: { Dienste: ['Leuchter', 'Sammler'], Bezeichnung: 'WGF' },
  Schülergottesdienst: { Dienste: ['Leuchter'], Bezeichnung: 'SchGD' },
  Trauung: { Dienste: ['Altar'], Bezeichnung: 'Trauung' },
  Tauffeier: { Dienste: ['Altar'], Bezeichnung: 'Tauffeier' },
  Sondergottesdienste: { simple: [], complex: [] },
};

const calendar = { contains: (date) => date === '2026-08-06' };

describe('buildSchedule', () => {
  it('filters to the parish, applies holiday rules, and adds a Sunday Wochendienst', () => {
    const entries = buildSchedule([
      { date: '2026-08-06', start: '18:30', name: 'Eucharistiefeier', location: 'Kirche St. Georg', dayInfo: '' },
      { date: '2026-08-08', start: '18:30', name: 'Wortgottesdienst', location: 'Kirche St. Georg', dayInfo: '' },
      { date: '2026-08-08', start: '18:30', name: 'Wortgottesdienst', location: 'Andere Kirche', dayInfo: '' },
    ], RULES, calendar);

    expect(entries).toEqual([
      { date: '2026-08-06', start: '18:30', label: 'Eu', duties: ['Leuchter', 'Altar'] },
      { date: '2026-08-08', start: '18:30', label: 'WGF', duties: ['Leuchter', 'Sammler'] },
    ]);
  });

  it('does not schedule excluded or ordinary Thursday services', () => {
    const entries = buildSchedule([
      { date: '2026-08-06', start: '18:30', name: 'Eucharistiefeier entfällt', location: 'Kirche St. Georg', dayInfo: '' },
      { date: '2026-08-13', start: '18:30', name: 'Eucharistiefeier', location: 'Kirche St. Georg', dayInfo: '' },
    ], RULES, { contains: () => false });
    expect(entries).toEqual([{ date: '2026-08-09', start: null, label: 'Wochendienst', duties: [''] }]);
  });
});
