import { describe, expect, it } from 'vitest';
import { miniplanFilename } from '../src/core/filename.js';

describe('miniplanFilename', () => {
  it('matches Python filename sanitization for an unsafe parish name', () => {
    expect(miniplanFilename('St. Georg/West: Test', '01.07.2026', '03.10.2026', 'ods'))
      .toBe('St. Georg_West_ Test - Miniplan vom 01.07.2026 - 03.10.2026.ods');
  });
});
