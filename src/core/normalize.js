const MONTHS = new Map([
  ['januar', 1], ['februar', 2], ['märz', 3], ['maerz', 3],
  ['april', 4], ['mai', 5], ['juni', 6], ['juli', 7],
  ['august', 8], ['september', 9], ['oktober', 10],
  ['november', 11], ['dezember', 12],
]);

const DATE_PATTERN = /^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*(\d{1,2})\.\s+([A-Za-zÄÖÜäöüß]+)\s+(\d{4})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*Uhr)?$/;

export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

export function parseGermanDate(value) {
  const text = normalizeText(value);
  const match = DATE_PATTERN.exec(text);
  if (!match) throw new Error(`Kein gültiges deutsches Datum: ${text}`);
  const [, dayText, monthText, yearText] = match;
  const month = MONTHS.get(monthText.toLocaleLowerCase('de-DE'));
  const day = Number(dayText);
  const year = Number(yearText);
  if (!month || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    throw new Error(`Kein gültiges deutsches Datum: ${text}`);
  }
  return `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseTime(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }
  const text = normalizeText(value);
  const match = TIME_PATTERN.exec(text);
  if (!match) throw new Error(`Keine gültige Uhrzeit: ${text}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Keine gültige Uhrzeit: ${text}`);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function germanDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export function weekdayIndex(isoDate) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
