import { describe, expect, it } from 'vitest';
import { HolidayCalendar } from '../src/core/calendar.js';

const ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260730\r\nDTEND;VALUE=DATE:20260912\r\nSUMMARY:Sommerferien\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261003T100000Z\r\nDTEND:20261004T000000Z\r\nSUMMARY:Feiertag\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

describe('HolidayCalendar', () => {
  it('handles exclusive all-day and midnight ends', () => {
    const calendar = HolidayCalendar.fromIcsTexts([ICS]);
    expect(calendar.contains('2026-07-30')).toBe(true);
    expect(calendar.contains('2026-09-11')).toBe(true);
    expect(calendar.contains('2026-09-12')).toBe(false);
    expect(calendar.contains('2026-10-03')).toBe(true);
    expect(calendar.contains('2026-10-04')).toBe(false);
  });
});
