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
  it('sorts simultaneous custom labels by Python codepoint order', () => {
    const rules = { ...RULES, Tauffeier: { Bezeichnung: 'ä', Dienste: [] }, Trauung: { Bezeichnung: 'Z', Dienste: [] } };
    const services = ['Tauffeier', 'Trauung'].map((name) => ({ date: '2026-07-04', start: '10:00', name, location: 'St. Georg' }));
    expect(buildSchedule(services, rules, calendar).map((entry) => entry.label)).toEqual(['Z', 'ä']);
  });

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

  it('rejects incomplete custom rules before attempting plan creation', () => {
    expect(() => buildSchedule([], {}, { contains: () => false })).toThrow('Fehlende Regelbereiche');
  });

  it('matches Python casefold and partial complex-date semantics for custom rules', () => {
    const customRules = {
      ...RULES,
      Sondergottesdienste: {
        simple: [],
        complex: [{
          Name: 'Messe Strasse', Datum: '05.07', 'Zusatz Info': '', Ort: 'Gross St. Georg',
          Bezeichnung: 'Sondermesse', Dienste: ['Altar'],
        }],
      },
    };
    const entries = buildSchedule([
      { date: '2026-07-05', start: '10:00', name: 'Messe Straße', location: 'Kirche Groß St. Georg', dayInfo: '' },
    ], customRules, { contains: () => false }, 'Gross St. Georg');

    expect(entries).toContainEqual({ date: '2026-07-05', start: '10:00', label: 'Sondermesse', duties: ['Altar'] });
  });
});
