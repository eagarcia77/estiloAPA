const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const app = source("app.js");
const html = source("index.html");
const simple = source("simple-workspace.js");

test("selecting or dropping files starts APA 7 import without another click", () => {
  assert.match(app, /function setFiles\(fileList\)\s*\{[\s\S]*?void formatSelectedFiles\(importRequestId\)/);
  assert.match(app, /els\.files\.addEventListener\("change",[\s\S]*?setFiles\(files\)/);
  assert.match(app, /els\.dropZone\.addEventListener\("drop",\s*\(event\) => setFiles\(event\.dataTransfer\.files\)\)/);
  assert.match(app, /event\.target\.value = ""/);
});

test("standard APA 7 is the default profile for new uploads", () => {
  assert.match(html, /<option value="apa7" selected>Standard APA 7<\/option>/);
  assert.doesNotMatch(html, /<option value="modulo11c" selected>/);
});

test("APA formatting completes before the document becomes editable", () => {
  const start = app.indexOf("async function formatSelectedFiles(");
  const end = app.indexOf("function loadDemo()", start);
  const body = app.slice(start, end);
  const order = [
    "await readFile(file)",
    "applyApaRules(section)",
    "els.preview.replaceChildren(...wrapper.childNodes)",
    "applyPreviewStyles()",
    'dispatchEvent(new Event("apa-document-loaded"))',
    "renderAudit(auditDocument(els.preview))",
    "enableDownloads()",
    'els.preview.dataset.apaReadyForEditing = "true"'
  ].map(s => body.indexOf(s));
  assert.ok(order.every(n => n >= 0), "All import steps are present");
  assert.deepEqual(order, [...order].sort((a,b) => a-b), "APA 7 runs before editable document is ready");
});

test("audit or ongoing editing does not reapply APA 7 styling", () => {
  const audit = app.slice(app.indexOf("function runAudit("), app.indexOf("async function formatSelectedFiles("));
  assert.doesNotMatch(audit, /applyPreviewStyles\(/);
  assert.doesNotMatch(audit, /applyApaRules\(/);
  assert.match(audit, /renderAudit\(auditDocument\(els\.preview\)\)/);
  assert.doesNotMatch(app, /els\.preview\.addEventListener\("input",\s*debounce\(/);
  assert.match(app, /reviewDetails\?\.addEventListener\("toggle"/);
});

test("reapplying APA 7 is optional and requires confirmation before replacing edits", () => {
  assert.match(app, /els\.formatBtn\.addEventListener\("click",[\s\S]*?!window\.confirm\(/);
  assert.match(simple, /if \(format\) toolsContent\.append\(format\)/);
  const content = simple.slice(simple.indexOf("actions.prepend(open)"), simple.indexOf("const quickStatus"));
  assert.doesNotMatch(content, /actions\.append\(format\)/);
});

test("stale imports cannot overwrite a more recent upload or a sample", () => {
  assert.match(app, /importRequestId \+= 1;/);
  assert.match(app, /if \(requestId !== importRequestId\) return;/);
  assert.match(app, /async function formatSelectedFiles\(requestId = importRequestId\)/);
  const demo = app.slice(app.indexOf("function loadDemo()"), app.indexOf("function hasFormattedContent()"));
  assert.match(demo, /importRequestId \+= 1;/);
});

test("dropping a file on the document uses the same safe import path", () => {
  assert.match(app, /const editorDropArea = document\.querySelector\("\.paper-wrap"\)/);
  assert.match(app, /editorDropArea\?\.addEventListener\("drop"/);
  assert.match(app, /setFiles\(event\.dataTransfer\.files\)/);
});
