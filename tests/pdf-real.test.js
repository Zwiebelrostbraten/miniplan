import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { it } from 'vitest';
import { parsePdf } from '../src/core/pdf-reader.js';
import { buildSchedule } from '../src/core/schedule.js';
import { HolidayCalendar } from '../src/core/calendar.js';
import { assertPdfServices, assertPdfPlan } from '../scripts/pdf-semantics.mjs';

const referencePdf = process.env.MINIPLAN_REFERENCE
  ? resolve(process.env.MINIPLAN_REFERENCE, '01.07.2026-04.10.2026.pdf')
  : null;
const referencePdfAvailable = referencePdf !== null && existsSync(referencePdf);

it.skipIf(!referencePdfAvailable)('reads the real PDF according to service semantics rather than the Python reader (requires MINIPLAN_REFERENCE with the PDF fixture)', async () => {
  const bytes = await readFile(referencePdf);
  const { services } = await parsePdf(bytes);
  assertPdfServices(services);
  const rules = JSON.parse(await readFile(new URL('../src/data/services.json', import.meta.url)));
  const texts = await Promise.all(['feiertage', 'ferien', 'faschingsferien_bis_2030'].map((name) => readFile(new URL(`../src/data/${name === 'faschingsferien_bis_2030' ? name : `${name}_baden_wuerttemberg`}.ics`, import.meta.url), 'utf8')));
  assertPdfPlan(buildSchedule(services, rules, HolidayCalendar.fromIcsTexts(texts)));
}, 20000);
