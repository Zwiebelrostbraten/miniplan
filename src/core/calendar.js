import { addDays } from './normalize.js';

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function toIso(value) {
  const raw = value.split(':').at(-1);
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(raw);
  if (!match || (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59))) throw new Error(`Ungültiges ICS-Datum: ${value}`);
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Ungültiges ICS-Datum: ${value}`);
  }
  return iso;
}

function parseEvents(text) {
  const lines = unfold(text);
  if (lines[0] !== 'BEGIN:VCALENDAR' || !lines.includes('END:VCALENDAR')) {
    throw new Error('Ungültiger ICS-Kalender');
  }
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      if (current) throw new Error('Ungültiger ICS-Kalender: verschachteltes Ereignis');
      current = {};
    } else if (line === 'END:VEVENT' && current) {
      if (!current.start) throw new Error('Ungültiger ICS-Kalender: DTSTART fehlt');
      events.push(current);
      current = null;
    } else if (current && line.startsWith('DTSTART')) {
      current.start = toIso(line);
      current.allDay = line.includes('VALUE=DATE');
    } else if (current && line.startsWith('DTEND')) {
      current.end = toIso(line);
      const raw = line.split(':').at(-1);
      current.endAllDay = /^\d{8}$/.test(raw);
      current.endsAtMidnight = /T000000(?:Z)?$/.test(raw);
    }
  }
  if (current) throw new Error('Ungültiger ICS-Kalender: END:VEVENT fehlt');
  return events;
}

export class HolidayCalendar {
  constructor(intervals = []) {
    this.intervals = intervals;
  }

  static fromIcsTexts(texts) {
    const intervals = texts.flatMap((text) => parseEvents(text).map((event) => {
      let end = event.end ?? event.start;
      if (event.end && (event.endAllDay || event.endsAtMidnight)) end = addDays(end, -1);
      if (end < event.start) end = event.start;
      return [event.start, end];
    }));
    return new HolidayCalendar(intervals.sort(([a], [b]) => a.localeCompare(b)));
  }

  contains(date) {
    return this.intervals.some(([start, end]) => start <= date && date <= end);
  }
}
