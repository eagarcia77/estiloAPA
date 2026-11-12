const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('async function readPdf(file) {');
const end = source.indexOf('\nasync function readFile(file)', start);
assert.ok(start >= 0 && end > start, 'PDF reader must exist');
const readPdfSource = source.slice(start, end);
function harness(textItems) {
  const context = {
    console,
    getPdfJs: async () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({getTextContent: async () => ({items: textItems})})
        })
      })
    }),
    textToHtml: text => '<p>' + text + '</p>'
  };
  vm.runInNewContext(readPdfSource, context);
  return context.readPdf;
}
const pdf = () => ({
  arrayBuffer: async () => Uint8Array.from([37,80,68,70,45,49,46,55]).buffer
});
test('imports a PDF with selectable text', async () => {
  const html = await harness([{str:'Contenido PDF',hasEOL:true}])(pdf());
  assert.match(html,/Contenido PDF/);
});
test('rejects scanned or empty-text PDFs instead of importing blank content', async () => {
  await assert.rejects(harness([])(pdf()), /OCR/);
});
test('rejects empty PDF bytes even if file size metadata is inaccurate', async () => {
  await assert.rejects(harness([])({size:120,arrayBuffer:async()=>new ArrayBuffer(0)}),/0 bytes/);
});
