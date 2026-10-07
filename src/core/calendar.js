import { addDays } from './normalize.js';

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function toIso(value) {
  const raw = value.split(':').at(-1);
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw);
  if (!match) throw new Error(`Ungültiges ICS-Datum: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseEvents(text) {
  const events = [];
  let current = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT' && current) {
      if (current.start) events.push(current);
      current = null;
    } else if (current && line.startsWith('DTSTART')) {
      current.start = toIso(line);
      current.allDay = line.includes('VALUE=DATE');
    } else if (current && line.startsWith('DTEND')) {
      current.end = toIso(line);
      current.endAllDay = line.includes('VALUE=DATE');
      const raw = line.split(':').at(-1);
      current.endsAtMidnight = /T000000(?:Z)?$/.test(raw);
    }
  }
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
