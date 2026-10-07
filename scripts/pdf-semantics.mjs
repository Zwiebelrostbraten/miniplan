import assert from 'node:assert/strict';

export function assertPdfServices(services) {
  assert.equal(services.length, 153);
  for (const [date, word] of [['2026-07-29', 'kein'], ['2026-09-16', 'kein'], ['2026-09-27', 'entfällt']]) {
    const service = services.find((s) => s.date === date && s.name.includes(date === '2026-09-27' ? 'Wortgottesdienst' : 'Schülergottesdienst'));
    assert.ok(service?.name.toLowerCase().includes(word), `Cancellation retained on ${date}`);
  }
  assert.ok(services.some((s) => s.date === '2026-09-27' && s.start === '15:00' && s.name.includes('Investitur')));
  assert.ok(services.some((s) => s.date === '2026-07-12' && s.name.includes('barmherzigen Samariter') && s.location === 'Kindergarten St. Elisabeth'));
  assert.ok(services.every((s) => !/\b(?:L1:|L2:|Ev:|Jahreskreis|Kollekte:)/.test(`${s.name} ${s.location}`)));
}

export function assertPdfPlan(plan) {
  assert.equal(plan.length, 43);
  const counts = {};
  for (const entry of plan) counts[entry.label] = (counts[entry.label] ?? 0) + 1;
  assert.deepEqual(counts, { SchGD: 6, Eu: 16, Wochendienst: 13, WGF: 3, Tauffeier: 3, Investitur: 1, Erntedank: 1 });
  for (const date of ['2026-07-29', '2026-09-16']) assert.ok(!plan.some((e) => e.date === date && e.label === 'SchGD'));
  assert.ok(!plan.some((e) => e.date === '2026-09-27' && e.label === 'WGF'));
  assert.ok(plan.some((e) => e.date === '2026-09-27' && e.start === '15:00' && e.label === 'Investitur'));
}
