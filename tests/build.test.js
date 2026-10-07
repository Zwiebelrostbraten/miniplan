import { access } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const worker = new URL('../dist/miniplan.worker.js', import.meta.url);

describe('static build', () => {
  it('ships the PDF.js worker required by the browser PDF importer', async () => {
    const exists = await access(worker).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
