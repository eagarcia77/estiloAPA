const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
    const visualOrder = await page.evaluate(() => {
      const ribbon = document.getElementById('apaEditorShell');
      const paper = document.querySelector('.paper-wrap');
      const gemini = document.getElementById('geminiAssistant');
      const access = document.querySelector('.accessibility-controls');
      const rect = el => el?.getBoundingClientRect();
      return {
        ribbonFound: !!ribbon,
        ribbonAbovePaper: !!ribbon && !!paper && rect(ribbon).bottom <= rect(paper).top + 2,
        geminiBelowPaper: !!gemini && !!paper && rect(gemini).top >= rect(paper).bottom - 2,
        accessBelowPaper: !!access && !!paper && rect(access).top >= rect(paper).bottom - 2
      };
    });
    if (!visualOrder.ribbonFound) errors.push('Word ribbon not found');
    if (!visualOrder.ribbonAbovePaper) errors.push('Word ribbon must appear above the document');
    if (!visualOrder.geminiBelowPaper) errors.push('Gemini panel visually overlaps or precedes the document');
    if (!visualOrder.accessBelowPaper) errors.push('Accessibility controls visually overlap or precede the document');
    if (!placement.geminiAfterPaper) errors.push('Gemini section must follow paper editor');
    if (!placement.accessAfterPaper) errors.push('Accessibility controls must exist after paper editor');
    const uniqueControls = await page.evaluate(() => ({
      editor: document.querySelectorAll('#preview').length,
      gemini: document.querySelectorAll('#geminiAssistant').length,
      accessibilityChecker: document.querySelectorAll('#accessibilityCheckBtn').length,
      accessibilityPanels: document.querySelectorAll('.accessibility-controls').length,
      ruler: document.querySelectorAll('#wordRulerHorizontal').length,
      moreMenu: document.querySelectorAll('#simpleToolsMenu').length
    }));
    for (const [name, count] of Object.entries(uniqueControls)) {
      if (count !== 1) errors.push('Duplicate or missing control ' + name + ': ' + count);
    }
    // Check that reapplying APA formatting does not duplicate document text.
    await page.evaluate(() => document.getElementById('demoBtn')?.click());
    await page.waitForFunction(() => {
      const el = document.getElementById('preview');
      return el && el.innerText.trim().length > 120 && !el.innerText.includes('Formatted content will appear here.');
    }, { timeout: 15000 });
    const beforeReapply = await page.locator('#preview').innerText();
    await page.evaluate(() => document.getElementById('formatBtn')?.click());
    await page.waitForTimeout(700);
    const firstReapply = await page.locator('#preview').innerText();
    await page.evaluate(() => document.getElementById('formatBtn')?.click());
    await page.waitForTimeout(700);
    const secondReapply = await page.locator('#preview').innerText();
    if (!firstReapply.trim() || !secondReapply.trim()) errors.push('APA reapply emptied the document');
    if (firstReapply !== secondReapply) errors.push('APA reapply changed document text on the second application');
    if (secondReapply.length > beforeReapply.length * 1.5) errors.push('APA reapply may have duplicated text');
    // A non-sticky ruler must scroll out of the way rather than cover paragraphs.
    const rulerScroll = await page.evaluate(() => {
      const ruler = document.getElementById('wordRulerHorizontal');
      const wrap = document.querySelector('.paper-wrap');
      const editor = document.getElementById('preview');
      if (!ruler || !wrap || !editor) return { found: false };
      const before = ruler.getBoundingClientRect().top;
      const positioning = getComputedStyle(ruler).position;
      const original = wrap.scrollTop;
      wrap.scrollTop = Math.min(300, wrap.scrollHeight - wrap.clientHeight);
      const scrolled = wrap.scrollTop;
      const after = ruler.getBoundingClientRect().top;
      wrap.scrollTop = original;
      return { found: true, positioning, scrolled, delta: after - before };
    });
    if (!rulerScroll.found) errors.push('Horizontal ruler not found for scroll test');
    else if (rulerScroll.positioning === 'sticky' || rulerScroll.positioning === 'fixed') errors.push('Ruler must not overlay scrolled text');
    else if (rulerScroll.scrolled > 40 && rulerScroll.delta > -30) errors.push('Ruler did not move with document scroll: ' + JSON.stringify(rulerScroll));
    // Import a synthetic Word document based on the structural features of a course module.
    await page.locator('#files').setInputFiles('test-results/apa7-module-fixture.docx');
    // Selecting a file automatically starts import via the input change handler.
    try {
      await page.waitForFunction(() => document.getElementById('preview')?.innerText.includes('MÓDULO DE PRUEBA APA 7'), null, { timeout: 30000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        selectedFiles: Array.from(document.getElementById('files')?.files || []).map(file => ({ name: file.name, size: file.size })),
        editorText: document.getElementById('preview')?.innerText.slice(0, 1000),
        auditText: document.getElementById('auditList')?.innerText.slice(0, 1000),
        status: document.getElementById('simpleQuickStatus')?.innerText.slice(0, 1000),
        downloadEnabled: !document.getElementById('downloadDocxBtn')?.disabled,
        mammothLoaded: typeof window.mammoth !== 'undefined',
        importButton: document.getElementById('importSelectedBtn')?.outerHTML.slice(0, 500),
        alerts: Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.innerText.slice(0, 500))
      }));
      throw new Error('DOCX import timeout: ' + JSON.stringify(diagnostic) + '\\n' + error.message);
    }
    const imported = await page.locator('#preview').innerText();
    for (const phrase of ['MÓDULO DE PRUEBA APA 7', 'Analítica de datos', 'Computación en la nube', 'Referencias']) {
      if (!imported.includes(phrase)) errors.push('DOCX import missing content: ' + phrase);
    }
    if (await page.locator('#preview table').count() < 1) errors.push('DOCX import lost the table');
    const importedImages = await page.locator('#preview img[src^="data:image/"]').count();
    if (importedImages < 1) errors.push('DOCX import lost its embedded figure');
    // Export the imported module and verify that a nonempty DOCX ZIP was downloaded.
    const exportButton = page.locator('#downloadDocxBtn');
    if (!(await exportButton.isEnabled())) {
      errors.push('DOCX export button is disabled after importing a Word document');
    } else {
      const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
      await exportButton.click();
      const download = await downloadPromise;
      const exportedPath = await download.path();
      const bytes = fs.readFileSync(exportedPath);
      if (!/\\.docx$/i.test(download.suggestedFilename())) errors.push('Export filename is not DOCX: ' + download.suggestedFilename());
      if (bytes.length < 500 || bytes.subarray(0, 2).toString('ascii') !== 'PK') errors.push('Exported DOCX is empty or not a ZIP package');
      // Round-trip the exported file through the same visible import workflow.
      if (bytes.length >= 500 && bytes.subarray(0, 2).toString('ascii') === 'PK') {
        await page.locator('#preview').fill('Round-trip pending');
        await page.locator('#files').setInputFiles({ name: 'round-trip.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: bytes });
        await page.waitForFunction(() => document.getElementById('preview')?.innerText.includes('MÓDULO DE PRUEBA APA 7'), null, { timeout: 20000 });
        const roundTrip = await page.locator('#preview').innerText();
        for (const phrase of ['MÓDULO DE PRUEBA APA 7', 'Analítica de datos', 'Computación en la nube', 'Referencias']) {
          if (!roundTrip.includes(phrase)) errors.push('DOCX round-trip missing content: ' + phrase);
        }
        if (await page.locator('#preview table').count() < 1) errors.push('DOCX round-trip lost the table');
        if (await page.locator('#preview img').count() < 1) errors.push('DOCX round-trip lost its embedded figure');
      }
    }
    await page.locator('a[href="help.html"]').click();
    await page.waitForURL('**/help.html');
    await page.locator('#search').fill('Gemini');
    assert.ok(await page.locator('main section:visible').count() >= 1, 'Help search must find Gemini');
    console.log(JSON.stringify({ ruler, rulerMatrix, placement, visualOrder, uniqueControls, helpSearch: 'ok' }, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
  } catch (error) {
    fs.mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/editor-failure.png', fullPage: true }).catch(() => {});
    fs.writeFileSync('test-results/error.txt', String(error?.stack || error));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
