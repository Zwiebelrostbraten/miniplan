import { describe, expect, it } from 'vitest';
import { HolidayCalendar } from '../src/core/calendar.js';

const ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260730\r\nDTEND;VALUE=DATE:20260912\r\nSUMMARY:Sommerferien\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261003T100000Z\r\nDTEND:20261004T000000Z\r\nSUMMARY:Feiertag\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

describe('HolidayCalendar', () => {
  it('rejects malformed custom calendars and impossible event dates', () => {
    expect(() => HolidayCalendar.fromIcsTexts(['not a calendar'])).toThrow();
    expect(() => HolidayCalendar.fromIcsTexts(['BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260230\nEND:VEVENT\nEND:VCALENDAR'])).toThrow();
  });

  it('rejects incomplete events and invalid clock values', () => {
    for (const body of ['BEGIN:VEVENT\nEND:VEVENT', 'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260702', 'BEGIN:VEVENT\nDTSTART:20260702T990000Z\nEND:VEVENT']) {
      expect(() => HolidayCalendar.fromIcsTexts([`BEGIN:VCALENDAR\n${body}\nEND:VCALENDAR`])).toThrow();
    }
  });

  it('recognizes date-only ends even without VALUE=DATE like Python', () => {
    const calendar = HolidayCalendar.fromIcsTexts(['BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260702\nDTEND:20260703\nEND:VEVENT\nEND:VCALENDAR']);
    expect(calendar.contains('2026-07-02')).toBe(true);
    expect(calendar.contains('2026-07-03')).toBe(false);
  });

  it('handles exclusive all-day and midnight ends', () => {
    const calendar = HolidayCalendar.fromIcsTexts([ICS]);
    expect(calendar.contains('2026-07-30')).toBe(true);
    expect(calendar.contains('2026-09-11')).toBe(true);
    expect(calendar.contains('2026-09-12')).toBe(false);
    expect(calendar.contains('2026-10-03')).toBe(true);
    expect(calendar.contains('2026-10-04')).toBe(false);
  });
});
