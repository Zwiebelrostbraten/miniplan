// One focused interaction and layout check; run after npm run build. Generated data only.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
const fixture = {
  name: 'Gottesdienstplan-mit-einem-sehr-langen-Dateinamen-fuer-die-mobile-Importbestaetigung-Juli-2026.csv', mimeType: 'text/csv',
  buffer: Buffer.from('Donnerstag, 2. Juli 2026\n' + Array.from({ length: 9 }, (_, i) =>
    `;18:30;19:30;${i === 1 ? 'Langer Gottesdienstname mit gemeinsamer Feier aller Familien und anschliessendem Gemeindetreffen' : `Tauffeier ${i + 1}`};${i === 8 ? 'Andere Kirche' : 'Kirche St. Georg'}`).join('\n')),
};
const rows = (page) => page.locator('#services .service-row');
async function upload(page, files = fixture) {
  await page.locator('#file-input').setInputFiles(files);
  await page.waitForFunction(() => ['success', 'error'].includes(document.querySelector('#import-feedback').dataset.state));
  await page.evaluate(() => new Promise(requestAnimationFrame));
}
async function layout(page, width) {
  const metrics = await page.evaluate(() => {
    const table = document.querySelector('.table-scroll');
    const actualTable = table.querySelector('table');
    const row = document.querySelector('.service-row');
    return {
      page: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
      table: [table.clientWidth, table.scrollWidth],
      actualTable: [actualTable.clientWidth, actualTable.scrollWidth],
      rowHeight: row?.getBoundingClientRect().height,
      actions: [...document.querySelectorAll('.service-row td:last-child')].every((cell) => cell.getBoundingClientRect().right <= table.getBoundingClientRect().right),
      buttons: [...document.querySelectorAll('.service-actions button')].map(el => ({ height: el.getBoundingClientRect().height, decoration: getComputedStyle(el).textDecorationLine, border: getComputedStyle(el).borderTopStyle })),
      editor: [...document.querySelectorAll('.service-editor input, .service-editor button')].map((el) => ({ height: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el).fontSize), input: el.tagName === 'INPUT' })),
    };
  });
  assert.equal(metrics.page[0], metrics.page[1], `page overflow at ${width}`);
  assert.equal(metrics.table[0], metrics.table[1], `table overflow at ${width}`);
  assert.equal(metrics.actualTable[0], metrics.actualTable[1], `actual table overflow at ${width}`);
  assert.ok(metrics.actions, `actions clipped at ${width}`);
  if (width > 700 && metrics.rowHeight) assert.ok(metrics.rowHeight >= 36 && metrics.rowHeight <= 60, `short row density ${metrics.rowHeight}`);
  for (const button of metrics.buttons) { assert.equal(button.decoration, 'none'); assert.equal(button.border, 'solid'); if (width <= 700) assert.ok(button.height >= 44); }
  if (width <= 700) for (const control of metrics.editor) {
    assert.ok(control.height >= 44, 'editor touch target');
    if (control.input) assert.ok(control.font >= 16, 'editor input font');
  }
  return metrics;
}
try {
  for (const width of process.argv.includes('--screenshots-only') ? [] : [360, 390, 1024, 1280, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, locale: 'de-DE', isMobile: width < 700, hasTouch: width < 700 });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(resolve('dist/miniplan.html')).href);
    if (width === 1280) await page.screenshot({ path: '/tmp/miniplan-claude-desktop-empty.png', fullPage: true });
    assert.equal(await page.locator('#load-demo').isVisible(), false, 'example is inside collapsed help');
    await page.evaluate(() => {
      const original = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = function () {
        return new Promise((resolve) => {
          window.finishImport = () => { File.prototype.arrayBuffer = original; resolve(original.call(this)); };
        });
      };
    });
    await page.locator('#file-input').setInputFiles(fixture);
    assert.equal(await page.locator('#import-feedback').getAttribute('data-state'), 'processing');
    assert.match(await page.locator('#message').textContent(), /ausgewählt.*verarbeitet/);
    assert.equal(await page.locator('#review-import').isVisible(), false, 'selected is not yet success');
    await page.evaluate(() => window.finishImport());
    await page.waitForFunction(() => document.querySelector('#import-feedback').dataset.state === 'success');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.match(await page.locator('#message').textContent(), /9 Gottesdienste.*Vorherige Daten wurden ersetzt/);
    assert.ok((await page.locator('#selected-files').textContent()).includes(fixture.name));
    const result = await page.locator('#import-feedback').boundingBox();
    assert.ok(result.y >= 0 && result.y + result.height <= 844, `success and next action visible without manual scroll at ${width}`);
    assert.equal(await page.locator('#services input').count(), 0, 'read-first table');
    assert.equal(await rows(page).count(), 5);
    assert.equal(await page.locator('th[scope=col]').count(), 7);
    assert.equal(await rows(page).first().locator('td').first().textContent(), '02.07.2026');
    assert.equal(await rows(page).first().locator('td').nth(1).textContent(), '18:30');
    assert.match(await page.locator('#service-count').textContent(), /8 eigene Gemeinde · 9 insgesamt/);
    for (const button of await page.locator('.service-actions button').all()) {
      assert.ok(await button.getAttribute('aria-label'));
      await button.focus();
      assert.equal(await button.locator('.tooltip').isVisible(), true);
      await button.hover();
      assert.equal(await button.locator('.tooltip').isVisible(), true);
    }
    const importOutcome = await page.locator('#message').textContent();
    if (width === 390) { await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); }); await page.screenshot({ path: '/tmp/miniplan-claude-mobile-import.png' }); }
    await page.locator('#review-import').click();
    assert.equal(await page.locator('#review-title').evaluate((el) => el === document.activeElement), true);
    await layout(page, width);
    if (width === 1280) await page.screenshot({ path: '/tmp/miniplan-claude-desktop-loaded.png', fullPage: true });
    await page.locator('#services-toggle').click();
    assert.equal(await rows(page).count(), 8);
    if (width === 390) {
      await page.locator('#review-import').click();
      await page.evaluate(() => document.activeElement.blur());
      await page.screenshot({ path: '/tmp/miniplan-claude-mobile-loaded.png', fullPage: true });
    }
    await page.locator('#services-toggle').click(); assert.equal(await rows(page).count(), 5);
    let draftDialogs = 0;
    const rejectDraftLoss = async (dialog) => { draftDialogs++; await dialog.dismiss(); };
    page.on('dialog', rejectDraftLoss);
    await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
    await rows(page).nth(1).getByRole('button', { name: /bearbeiten/i }).click();
    assert.equal(draftDialogs, 0, 'unchanged draft switches without nuisance confirmation');
    await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
    await page.locator('.service-editor input[name=name]').fill('Entwurf verwerfen');
    await rows(page).nth(1).getByRole('button', { name: /bearbeiten/i }).click();
    await page.locator('#file-input').setInputFiles(fixture);
    assert.equal(draftDialogs, 2, 'dirty draft protects editing and replacement import');
    assert.equal(await page.locator('.service-editor input[name=name]').inputValue(), 'Entwurf verwerfen');
    page.off('dialog', rejectDraftLoss);
    await layout(page, width);
    if (width === 390) { await page.locator('.service-editor').scrollIntoViewIfNeeded(); await page.screenshot({ path: '/tmp/miniplan-claude-mobile-edit.png' }); }
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    assert.equal(await rows(page).first().locator('td').nth(3).textContent(), 'Tauffeier 1');
    await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
    await page.locator('.service-editor input[name=name]').fill('Gespeicherte Änderung');
    await page.locator('#show-other-services').check();
    assert.equal(await page.locator('.service-editor input[name=name]').inputValue(), 'Gespeicherte Änderung', 'draft survives filter');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.locator('#show-other-services').uncheck();
    assert.equal(await rows(page).first().locator('td').nth(3).textContent(), 'Gespeicherte Änderung');
    await page.locator('#show-other-services').check(); await page.locator('#services-toggle').click();
    assert.equal(await rows(page).count(), 9);
    await rows(page).last().getByRole('button', { name: /bearbeiten/i }).click();
    await page.locator('.service-editor input[name=name]').fill('Fremder Ort geändert');
    await page.locator('#show-other-services').uncheck();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.locator('#show-other-services').check(); await page.locator('#services-toggle').click();
    assert.equal(await rows(page).last().locator('td').nth(3).textContent(), 'Fremder Ort geändert', 'hidden source saved safely');
    let dialogs = 0;
    page.on('dialog', async (dialog) => { dialogs++; await dialog.dismiss(); });
    await page.locator('#parish').fill('Andere');
    await page.locator('#show-other-services').uncheck();
    assert.equal(await rows(page).count(), 1);
    await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
    await rows(page).first().getByRole('button', { name: /löschen/i }).click();
    assert.equal(await rows(page).count(), 0, 'filtered delete uses source identity');
    assert.equal(await page.locator('.service-editor').count(), 0, 'removed editor closes');
    await page.locator('#parish').fill('St. Georg');
    await page.locator('#show-other-services').check();
    await page.locator('#services-toggle').click();
    assert.equal(await rows(page).count(), 8);
    assert.equal(await rows(page).first().locator('td').nth(3).textContent(), 'Gespeicherte Änderung', 'delete affects correct source');
    await page.locator('#add-service').click();
    assert.equal(await page.locator('.service-editor input[name=date]').evaluate((el) => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click(); assert.equal(await rows(page).count(), 8, 'add cancel leaves no blank');
    await page.locator('#add-service').click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    assert.equal(await page.locator('.service-editor').count(), 1, 'blank draft not committed');
    await page.locator('.service-editor input[name=date]').fill('2026-07-03');
    await page.locator('.service-editor input[name=start]').fill('10:00');
    await page.locator('.service-editor input[name=name]').fill('Neuer Gottesdienst');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click(); assert.equal(await rows(page).count(), 9);
    await page.locator('#show-other-services').uncheck();
    await page.locator('#create-plan').click(); await page.waitForFunction(() => !document.querySelector('#download').disabled);
    assert.equal(await page.locator('#message').textContent(), importOutcome, 'planning does not erase import result');
    const preview = await page.locator('#plan-preview').textContent();
    await page.locator('#show-other-services').check();
    assert.equal(await page.locator('#download').isDisabled(), false, 'view filter preserves export');
    await page.locator('#show-other-services').uncheck();
    assert.equal(await page.locator('#plan-preview').textContent(), preview, 'view filter preserves plan');
    await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
    await page.locator('.service-editor input[name=name]').fill('Plan muss neu erstellt werden');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click(); assert.equal(await page.locator('#download').isDisabled(), true);
    await page.locator('#create-plan').click(); await page.waitForFunction(() => !document.querySelector('#download').disabled);
    await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
    await page.locator('.service-editor input[name=name]').fill('Entwurf bleibt erhalten');
    await rows(page).nth(1).getByRole('button', { name: /löschen/i }).click();
    assert.equal(await page.locator('#download').isDisabled(), true, 'direct delete invalidates export');
    assert.equal(await page.locator('#plan-preview').isVisible(), false);
    assert.equal(await page.locator('.service-editor input[name=name]').inputValue(), 'Entwurf bleibt erhalten', 'other row draft survives delete');
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    assert.equal(dialogs, 0, 'delete never requests confirmation');
    await upload(page, [fixture, { name: 'broken.txt', mimeType: 'text/plain', buffer: Buffer.from('broken') }]);
    assert.match(await page.locator('#message').textContent(), /Keine der 2 ausgewählten Dateien wurde übernommen/);
    assert.equal(await page.locator('#download').isDisabled(), true); assert.equal(await rows(page).count(), 0); assert.equal(await page.locator('#plan-preview').isVisible(), false);
    await upload(page, { name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('') });
    assert.equal(await page.locator('#import-feedback').getAttribute('data-state'), 'error');
    assert.equal(await page.locator('#review-import').isVisible(), false);
    await layout(page, width); assert.deepEqual(errors, []);
    console.log(`${width}px: upload visibility, read-first density, overflow, draft/filter CRUD, expansion, stable result, export invalidation and failures PASS`);
    await context.close();
  }

  // Generated preview fixture: realistic services, no personal data.
  const previewFixture = { name: 'Gottesdienstplan-Juli-2026.csv', mimeType: 'text/csv', buffer: Buffer.from([
    'Donnerstag, 2. Juli 2026', ';18:30;19:30;Eucharistiefeier;Kirche St. Georg',
    'Sonntag, 5. Juli 2026', ';10:00;11:00;Wortgottesdienst mit Kommunionfeier;Kirche St. Georg',
    ';11:30;12:15;Tauffeier;Kirche St. Maria',
    'Mittwoch, 8. Juli 2026', ';09:00;10:00;Eucharistiefeier;Kirche St. Georg',
    'Donnerstag, 9. Juli 2026', ';18:30;19:30;Eucharistiefeier;Kirche St. Georg',
    'Sonntag, 12. Juli 2026', ';10:30;11:30;Familiengottesdienst mit gemeinsamer Feier und anschliessendem Gemeindetreffen;Kirche St. Georg',
    'Mittwoch, 15. Juli 2026', ';09:00;10:00;Eucharistiefeier;Kirche St. Georg',
    'Sonntag, 19. Juli 2026', ';10:00;11:00;Wortgottesdienst;Kirche St. Georg',
  ].join('\n')) };
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: 'de-DE', isMobile: width === 390, hasTouch: width === 390 });
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve('dist/miniplan.html')).href);
    await upload(page, previewFixture);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 1280) await page.screenshot({ path: '/tmp/miniplan-claude-desktop-loaded.png', fullPage: true });
    else {
      await page.screenshot({ path: '/tmp/miniplan-claude-mobile-import.png' });
      await page.locator('#review-import').click();
      await page.evaluate(() => document.activeElement.blur());
      await page.screenshot({ path: '/tmp/miniplan-claude-mobile-loaded.png', fullPage: true });
      await rows(page).first().getByRole('button', { name: /bearbeiten/i }).click();
      await page.locator('.service-editor').scrollIntoViewIfNeeded();
      await page.screenshot({ path: '/tmp/miniplan-claude-mobile-edit.png' });
    }
    await context.close();
  }
} finally { await browser.close(); }
