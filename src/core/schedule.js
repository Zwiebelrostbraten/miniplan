import { addDays, weekdayIndex } from './normalize.js';

function matchesLocation(rule, location) {
  return !rule.Ort || String(location).toLocaleLowerCase('de-DE').includes(String(rule.Ort).toLocaleLowerCase('de-DE'));
}

function entry(service, rule) {
  return { date: service.date, start: service.start, label: rule.Bezeichnung, duties: [...rule.Dienste] };
}

function classify(service, rules, calendar) {
  const name = String(service.name).toLocaleLowerCase('de-DE');
  if (['friedensgebet', 'entfällt', 'totengedenken'].some((term) => name.includes(term))) return null;

  const special = rules.Sondergottesdienste ?? {};
  for (const rule of [...(special.complex ?? [])].sort((a, b) => b.Name.length - a.Name.length)) {
    const dateMatches = rule.Datum && rule.Datum !== 'Kein Datum' && service.date.slice(8, 10) + '.' + service.date.slice(5, 7) + '.' === rule.Datum;
    const infoMatches = rule['Zusatz Info'] && String(service.dayInfo).toLocaleLowerCase('de-DE').includes(rule['Zusatz Info'].toLocaleLowerCase('de-DE'));
    if (name.includes(rule.Name.toLocaleLowerCase('de-DE')) && (dateMatches || infoMatches) && matchesLocation(rule, service.location)) return entry(service, rule);
  }
  for (const rule of [...(special.simple ?? [])].sort((a, b) => b.Name.length - a.Name.length)) {
    if (name.includes(rule.Name.toLocaleLowerCase('de-DE')) && matchesLocation(rule, service.location)) return entry(service, rule);
  }

  const weekday = weekdayIndex(service.date);
  const holiday = calendar.contains(service.date);
  if (name.includes('eucharistiefeier')) {
    if (weekday === 3 && !holiday) return null;
    const rule = rules.Eucharistiefeier;
    return { date: service.date, start: service.start, label: rule.Bezeichnung, duties: [...(weekday === 3 ? rule['Dienste in Ferien'] : rule.Dienste)] };
  }
  if (name.includes('wortgottesdienst')) {
    if (weekday === 3 && !holiday) return null;
    return entry(service, rules.Wortgottesdienst);
  }
  if (name.includes('tauffeier')) return entry(service, rules.Tauffeier);
  if (name.includes('trauung')) return entry(service, rules.Trauung);
  if (name.includes('schülergottesdienst') && !name.includes('kein') && !holiday) return entry(service, rules.Schülergottesdienst);
  return null;
}

export function buildSchedule(services, rules, calendar, parish = 'St. Georg') {
  const relevant = services.filter((service) => {
    const location = String(service.location).toLocaleLowerCase('de-DE');
    return location.includes(parish.toLocaleLowerCase('de-DE')) || location === 'extern' || location === 'dorffest';
  });
  if (!relevant.length) return [];

  const entries = relevant.map((service) => classify(service, rules, calendar)).filter(Boolean);
  const dates = relevant.map((service) => service.date).sort();
  let sunday = addDays(dates[0], (6 - weekdayIndex(dates[0]) + 7) % 7);
  while (sunday <= dates.at(-1)) {
    entries.push({ date: sunday, start: null, label: 'Wochendienst', duties: [''] });
    sunday = addDays(sunday, 7);
  }
  const seen = new Set();
  return entries.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => `${a.date} ${a.start ?? '00:00'} ${a.label}`.localeCompare(`${b.date} ${b.start ?? '00:00'} ${b.label}`));
}
