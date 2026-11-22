const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  try {
    await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#preview').waitFor({ timeout: 20000 });
    assert.equal(await page.locator('a[href="help.html"]').count(), 1, 'Help link must be visible in header');
    await page.locator('#preview').click();
    await page.locator('#preview').fill('<p>Prueba del editor</p>'); // contenteditable literal text
    assert.match(await page.locator('#preview').innerText(), /Prueba del editor/, 'Editor must be editable');
    await page.waitForTimeout(1500);
    const ruler = await page.evaluate(() => window.EstiloAPAWordRulers?.diagnose?.() ?? null);
    if (!ruler) errors.push('Ruler diagnostics are unavailable');
    else if (!ruler.ok) errors.push('Ruler misaligned: ' + JSON.stringify(ruler));
    // Exercise the ruler at common viewport widths and browser zoom levels.
    const rulerMatrix = [];
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const zoom of [1, 1.25]) {
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
        await page.evaluate(() => window.EstiloAPAWordRulers?.update?.());
        await page.waitForTimeout(250);
        const measured = await page.evaluate(() => window.EstiloAPAWordRulers?.diagnose?.() ?? null);
        rulerMatrix.push({ width, zoom, ...measured });
        if (!measured?.ok) errors.push('Ruler mismatch at ' + width + 'px, zoom ' + zoom + ': ' + JSON.stringify(measured));
      }
    }
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.EstiloAPAWordRulers?.update?.());
    await page.waitForTimeout(300);
    const placement = await page.evaluate(() => {
      const paper = document.querySelector('.paper-wrap');
      const gemini = document.getElementById('geminiAssistant');
      const access = document.querySelector('.accessibility-controls');
      return { paper: !!paper, geminiAfterPaper: !!gemini && !!paper && Boolean(paper.compareDocumentPosition(gemini) & Node.DOCUMENT_POSITION_FOLLOWING), accessPresent: !!access, accessAfterPaper: !!access && !!paper && Boolean(paper.compareDocumentPosition(access) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    if (!placement.geminiAfterPaper) errors.push('Gemini section must follow paper editor');
    if (!placement.accessAfterPaper) errors.push('Accessibility controls must exist after paper editor');
    await page.locator('a[href="help.html"]').click();
    await page.waitForURL('**/help.html');
    await page.locator('#search').fill('Gemini');
    assert.ok(await page.locator('main section:visible').count() >= 1, 'Help search must find Gemini');
    console.log(JSON.stringify({ ruler, rulerMatrix, placement, helpSearch: 'ok' }, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
