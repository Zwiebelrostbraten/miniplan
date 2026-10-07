import { addDays, weekdayIndex, compareText } from './normalize.js';

function fold(value) {
  return String(value).toLocaleLowerCase('de-DE').replaceAll('ß', 'ss');
}

function matchesLocation(rule, location) {
  return !rule.Ort || fold(location).includes(fold(rule.Ort));
}

function entry(service, rule) {
  return { date: service.date, start: service.start, label: rule.Bezeichnung, duties: [...rule.Dienste] };
}

function classify(service, rules, calendar) {
  const name = fold(service.name);
  if (['friedensgebet', 'entfällt', 'totengedenken'].some((term) => name.includes(term))) return null;

  const special = rules.Sondergottesdienste ?? {};
  const dateText = `${service.date.slice(8, 10)}.${service.date.slice(5, 7)}.${service.date.slice(0, 4)}`;
  for (const rule of [...(special.complex ?? [])].sort((a, b) => b.Name.length - a.Name.length)) {
    const dateMatches = rule.Datum && dateText.includes(rule.Datum);
    const infoMatches = rule['Zusatz Info'] && fold(service.dayInfo).includes(fold(rule['Zusatz Info']));
    if (name.includes(fold(rule.Name)) && (dateMatches || infoMatches) && matchesLocation(rule, service.location)) return entry(service, rule);
  }
  for (const rule of [...(special.simple ?? [])].sort((a, b) => b.Name.length - a.Name.length)) {
    if (name.includes(fold(rule.Name)) && matchesLocation(rule, service.location)) return entry(service, rule);
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

export function validateRules(rules) {
  const required = ['Eucharistiefeier', 'Wortgottesdienst', 'Schülergottesdienst', 'Trauung', 'Tauffeier', 'Sondergottesdienste'];
  const missing = required.filter((key) => !Object.hasOwn(rules ?? {}, key));
  if (missing.length) throw new Error(`Fehlende Regelbereiche: ${missing.sort().join(', ')}`);
}

export function buildSchedule(services, rules, calendar, parish = 'St. Georg') {
  validateRules(rules);
  const relevant = services.filter((service) => {
    const location = fold(service.location);
    return location.includes(fold(parish)) || location === 'extern' || location === 'dorffest';
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
  }).sort((a, b) => compareText(a.date, b.date) || compareText(a.start ?? '00:00', b.start ?? '00:00') || compareText(a.label, b.label));
}
