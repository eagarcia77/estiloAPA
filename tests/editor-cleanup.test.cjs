const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("automatic normalization jobs are discarded, never replayed after editing", () => {
  const source = read("edit-stability-v348.js");
  const win = { setTimeout() { return 9; }, clearTimeout() {}, getSelection() { return null; } };
  const document = { readyState: "loading", addEventListener() {} };
  const runtime = new Function("window", "document", source +
    "\nreturn {queue:aesQueueNormalization,flush:aesFlushPendingNormalizations,reset:aesResetDocument,pending:()=>aesPendingNormalizations.size};"
  )(win, document);
  let calls = 0;
  runtime.queue(1, () => { calls++; }, [], 0);
  assert.equal(runtime.pending(), 1);
  runtime.flush();
  assert.equal(runtime.pending(), 0);
  assert.equal(calls, 0);
  runtime.queue(2, () => { calls++; }, [], 0);
  runtime.reset();
  assert.equal(runtime.pending(), 0);
  assert.equal(calls, 0);
});

test("idle editing no longer generates repetitive saved status banners", () => {
  const source = read("edit-stability-v348.js");
  assert.doesNotMatch(source, /Cambios de texto conservados/);
  assert.doesNotMatch(source, /apaEditStatus/);
  assert.match(source, /Backspace Protection:/);
});

test("obsolete HTML export module cannot overwrite global version and editor help", () => {
  const html = read("html-enhance.js");
  assert.doesNotMatch(html, /updateV347Ui/);
  assert.match(html, /async function downloadInstitutionalHtml/);
  assert.match(html, /#downloadHtmlBtn/);
});

test("advanced settings and review disappear completely when not requested", () => {
  const css = read("simple-workspace.css");
  assert.match(css, /\.layout > \.controls:has\(#simpleDocumentOptions:not\(\[open\]\)\)/);
  assert.match(css, /\.layout > \.audit:has\(#simpleReviewDetails:not\(\[open\]\)\)/);
  assert.match(css, /section\.audit > \.advanced-audit,[\s\S]*?section\.audit > \.reference-format-audit\s*\{\s*display:none !important/);
});

test("APA 7 import and editor file drop remain active", () => {
  const app = read("app.js");
  assert.match(app, /void formatSelectedFiles\(importRequestId\)/);
  assert.match(app, /editorDropArea\?\.addEventListener\("drop"/);
  assert.match(app, /setFiles\(event\.dataTransfer\.files\)/);
  assert.doesNotMatch(app, /function debounce\(/);
});
