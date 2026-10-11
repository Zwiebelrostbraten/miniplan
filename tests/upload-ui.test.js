import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const template = new URL('../src/index.html', import.meta.url);

it('provides an accessible GitHub repository link in the footer', async () => {
  const html = await readFile(template, 'utf8');
  const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1];
  expect(footer).toMatch(/<a\b[^>]*href="https:\/\/github\.com\/Zwiebelrostbraten\/miniplan"[^>]*aria-label="MiniPlan auf GitHub"[^>]*><svg\b[^>]*aria-hidden="true"[^>]*focusable="false"[^>]*>[\s\S]*?<\/svg><span>GitHub<\/span><\/a>/);
});

describe('upload UI', () => {
  it('includes a dedicated visible area for selected file names', async () => {
    const html = await readFile(template, 'utf8');
    expect(html).toContain('id="selected-files"');
  });

  it('offers custom planning rules and calendars', async () => {
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

it('uses clear copy, an unchecked location filter and a connected accessible footer', async () => {
  const html = await readFile(template, 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  expect(html).not.toMatch(/Python|Server|Browser/);
  expect(html).toMatch(/id="show-other-services" type="checkbox"(?! checked)/);
  expect(html).toContain('id="calendar-help"');
  expect(html).toMatch(/class="table-wrap"[\s\S]*class="table-scroll"[\s\S]*<\/table><\/div>\s*<button id="services-toggle"/);
  expect(css).toMatch(/\.services-toggle\s*\{[^}]*width:\s*100%/);
  expect(css).toMatch(/\.table-scroll\s*\{[^}]*\boverflow\s*:\s*auto\s*(?:;|\})/);
  expect(css).toContain('.services-toggle:focus-visible');
});
