import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const template = new URL('../src/index.html', import.meta.url);
const app = new URL('../src/app.js', import.meta.url);

describe('upload UI', () => {
  it('includes a dedicated visible area for selected file names', async () => {
    const html = await readFile(template, 'utf8');
    expect(html).toContain('id="selected-files"');
  });

  it('uses OpenDocument as the default in a visual format picker', async () => {
    const html = await readFile(template, 'utf8');
    expect(html).toContain('class="format-grid"');
    expect(html).toMatch(/type="radio" name="export-format" value="ods" checked/);
    expect(html).toContain('class="format-card"');
    expect(html).toContain('class="export-actions"');
  });

  it('renders the plan preview as scannable columns', async () => {
    const source = await readFile(app, 'utf8');
    expect(source).toContain("className = 'preview-date'");
    expect(source).toContain("className = 'preview-time'");
    expect(source).toContain("className = 'preview-service'");
    expect(source).toContain("className = 'preview-duties'");
  });
});
