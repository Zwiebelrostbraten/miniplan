import { normalizeText, parseGermanDate, parseTime } from './normalize.js';

function looksLikeDate(value) {
  return /^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),/.test(normalizeText(value));
}

export function parseRows(rows, source) {
  const services = [];
  const diagnostics = [];
  let date = null;
  let dayInfo = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const [first = '', startValue = '', endValue = '', nameValue = '', locationValue = ''] = row;
    const firstText = normalizeText(first);
    if (firstText) {
      try {
        date = parseGermanDate(firstText);
        dayInfo = [];
        return;
      } catch {
        if (looksLikeDate(firstText)) {
          date = null;
          dayInfo = [];
          diagnostics.push({ level: 'warning', message: 'Ungültiges Datum ignoriert', source, row: rowNumber });
          return;
        }
        if (date && !normalizeText(startValue)) dayInfo.push(firstText);
      }
    }

    const name = normalizeText(nameValue);
    const startText = normalizeText(startValue);
    if (!name || !startText) {
      if (!firstText && [startValue, endValue, nameValue, locationValue].some((value) => normalizeText(value))) {
        diagnostics.push({ level: 'warning', message: 'Unvollständige Gottesdienstzeile übersprungen', source, row: rowNumber });
      }
      return;
    }
    let start;
    try {
      start = parseTime(startValue);
    } catch {
      if (date) diagnostics.push({ level: 'warning', message: 'Ungültige Startzeit ignoriert', source, row: rowNumber });
      return;
    }
    if (!date) {
      diagnostics.push({ level: 'warning', message: 'Gottesdienst ohne vorangehendes Datum übersprungen', source, row: rowNumber });
      return;
    }
    let end = null;
    if (normalizeText(endValue)) {
      try { end = parseTime(endValue); } catch { diagnostics.push({ level: 'warning', message: 'Ungültige Endzeit ignoriert', source, row: rowNumber }); }
    }
    services.push({ date, start, end, name, location: normalizeText(locationValue), dayInfo: dayInfo.join('; '), source, row: rowNumber });
  });

  return { services, diagnostics };
}
