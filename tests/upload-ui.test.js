import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const template = new URL('../src/index.html', import.meta.url);

describe('upload UI', () => {
  it('includes a dedicated visible area for selected file names', async () => {
    const html = await readFile(template, 'utf8');
    expect(html).toContain('id="selected-files"');
  });

  it('exposes the Python pipeline overrides for custom rules and calendars', async () => {
    const html = await readFile(template, 'utf8');
    expect(html).toContain('id="rules-input"');
    expect(html).toContain('id="calendar-input"');
    expect(html).toContain('id="no-calendar"');
  });

  it('uses OpenDocument as the default export in a styled format control', async () => {
    const html = await readFile(template, 'utf8');
    expect(html).toContain('class="format-field"');
    expect(html).toMatch(/<option value="ods" selected>/);
  });
});
