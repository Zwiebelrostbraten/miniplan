import { describe, expect, it } from 'vitest';
import { normalizeText, parseGermanDate, parseTime } from '../src/core/normalize.js';

describe('normalization', () => {
  it('parses long German dates without locale APIs', () => {
    expect(parseGermanDate('Mittwoch, 1. Juli 2026')).toBe('2026-07-01');
  });

  it('rejects malformed dates', () => {
    expect(() => parseGermanDate('1/7/26')).toThrow(/deutsches Datum/);
  });

  it('parses common time formats', () => {
    expect(parseTime('07:45')).toBe('07:45');
    expect(parseTime('18:30 Uhr')).toBe('18:30');
    expect(parseTime('18:30:00')).toBe('18:30');
  });

  it('normalizes whitespace from PDF text', () => {
    expect(normalizeText(' Kirche  St.\n Georg ')).toBe('Kirche St. Georg');
  });
});
