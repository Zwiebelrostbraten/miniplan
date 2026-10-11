// Focused layout regression check; run after npm run build.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox'],
});
const fixture = {
  name: 'responsive-demo.csv', mimeType: 'text/csv',
  buffer: Buffer.from('Donnerstag, 2. Juli 2026\n' + Array.from({ length: 8 }, (_, i) =>
    `;${i % 2 ? '10:00' : '18:30'};${i % 2 ? '11:00' : '19:30'};Gottesdienst ${i + 1};Kirche ${i === 7 ? 'Andere' : 'St. Georg'}`).join('\n')),
};
async function measure(page, width) {
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height, bottom, right };
    };
    const scroll = document.querySelector('.table-scroll');
    const native = [...document.querySelectorAll('td input[type=date],td input[type=time]')].map((input) => {
      // Chromium's content sizing includes native date/time segments, AM/PM and picker icon.
      const probe = input.cloneNode();
      probe.style.cssText = 'position:absolute;visibility:hidden;width:auto;field-sizing:content';
      input.parentElement.append(probe);
      const needed = probe.getBoundingClientRect().width;
      probe.remove();
      return { type: input.type, width: input.getBoundingClientRect().width, needed };
    });
    return {
      table: [scroll.clientWidth, scroll.scrollWidth], heading: rect('#review-title'),
      description: rect('#review-title + p'), button: rect('#add-service'),
      marker: rect('#review-title').x - rect('.section-heading .step').x,
      checkbox: rect('#show-other-services'), label: rect('.service-filter'),
      wrap: rect('.table-wrap'), toggle: rect('#services-toggle'),
      delete: document.querySelector('.remove') ? rect('.remove') : null,
      native,
      textWidths: [...document.querySelectorAll('#services tr:first-child td:nth-child(4) input, #services tr:first-child td:nth-child(5) input')].map((x) => x.getBoundingClientRect().width),
    };
  });
  assert.equal(metrics.table[1], metrics.table[0], `table overflow at ${width}`);
  assert.ok(metrics.checkbox.width <= 20 && metrics.checkbox.y - metrics.label.y <= 3, 'checkbox top aligned at natural width');
  if (width <= 900) {
    assert.ok(metrics.heading.width >= metrics.wrap.width - 44, 'heading uses available width');
    assert.ok(metrics.button.y >= metrics.description.bottom + 10, 'button below full description');
    assert.ok(Math.abs(metrics.button.width - metrics.wrap.width) <= 2, 'button full width');
    assert.ok(metrics.description.height <= 70, 'description remains readable');
    if (metrics.delete) {
      assert.equal(await page.locator('.field-label:visible').count(), 48);
    }
  } else if (metrics.delete) {
    assert.ok(metrics.delete.right <= metrics.wrap.right, 'delete control fits table');
    assert.ok(metrics.textWidths.every((w) => w >= 150), 'name and place remain useful');
  }
  for (const field of metrics.native) assert.ok(field.width >= field.needed, `${field.type}: ${field.width} < native content ${field.needed}`);
  return metrics;
}
try {
  for (const locale of ['de-DE', 'en-US']) {
    for (const [width, mobile] of [[360, false], [390, false], [768, false], [1024, false], [1280, false], [1440, false], [360, true], [390, true]]) {
      const context = await browser.newContext({
        ...(mobile ? devices['iPhone 13'] : {}), locale,
        viewport: { width, height: mobile ? 844 : 900 },
      });
      const page = await context.newPage();
      await page.goto(pathToFileURL(resolve('dist/miniplan.html')).href);
      const empty = await measure(page, width);
      assert.ok(await page.locator('.empty').evaluate((x) => x.getBoundingClientRect().height) <= 100, 'compact empty state');
      const saveMobile = locale === 'de-DE' && mobile && width === 390;
      if (saveMobile) await page.screenshot({ path: '/tmp/miniplan-mobile-390-empty.png', fullPage: true });
      await page.locator('#file-input').setInputFiles(fixture);
      await page.waitForFunction(() => document.querySelectorAll('#services tr:not(.empty)').length === 5);
      await page.locator('#services-toggle').click();
      assert.equal(await page.locator('#services tr:not(.empty)').count(), 7);
      await page.locator('#show-other-services').check();
      await page.locator('#services-toggle').click();
      assert.equal(await page.locator('#services tr:not(.empty)').count(), 8);
      const name = page.locator('#services tr:first-child td:nth-child(4) input');
      await name.fill('Bearbeiteter Gottesdienst');
      await page.locator('#show-other-services').uncheck();
      assert.equal(await name.inputValue(), 'Bearbeiteter Gottesdienst', 'edit survives filtering');
      await page.locator('#show-other-services').check();
      await page.locator('#services-toggle').click();
      assert.equal(await name.inputValue(), 'Bearbeiteter Gottesdienst', 'all data retained');
      const loaded = await measure(page, width);
      assert.ok(Math.abs(loaded.toggle.width - loaded.wrap.width) <= 2, 'attached expander full width');
      if (saveMobile) await page.screenshot({ path: '/tmp/miniplan-mobile-390-loaded.png', fullPage: true });
      if (locale === 'en-US' && !mobile && width === 1280) await page.screenshot({ path: '/tmp/miniplan-desktop-1280-loaded.png', fullPage: true });
      console.log(`${locale} ${mobile ? 'native mobile' : 'viewport'} ${width}: empty/loaded table ${empty.table.join('/')} / ${loaded.table.join('/')}; heading ${loaded.heading.width}px, button gap ${(loaded.button.y - loaded.description.bottom).toFixed(1)}px; native fields fit; state retained`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
