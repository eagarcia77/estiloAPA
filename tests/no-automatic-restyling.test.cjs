const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("new imports announce document-loaded after applying initial formatting", () => {
  const s = source("app.js");
  assert.equal((s.match(/dispatchEvent\(new Event\("apa-document-loaded"\)\)/g) || []).length, 2);
  assert.match(s, /replaceChildren\(\.\.\.wrapper\.childNodes\);[\s\S]*?dispatchEvent\(new Event\("apa-document-loaded"\)\)/);
  assert.match(s, /replaceChildren\(demo\);[\s\S]*?dispatchEvent\(new Event\("apa-document-loaded"\)\)/);
});
test("module profiles do not re-run on each DOM/input mutation or delayed click", () => {
  const s = source("module-profile.js");
  assert.doesNotMatch(s, /new MutationObserver/);
  assert.doesNotMatch(s, /setTimeout\(\(\) => applyModuleProfile/);
  assert.match(s, /addEventListener\("apa-document-loaded"/);
  assert.match(s, /select\.addEventListener\("change"/);
});
test("thesis profiles do not re-run on each DOM mutation", () => {
  const s = source("thesis-profile.js");
  assert.doesNotMatch(s, /new MutationObserver/);
  assert.match(s, /addEventListener\("apa-document-loaded"/);
});
test("reference formatting does not run on delayed startup, formatting clicks or re-audit", () => {
  const s = source("reference-format-v345.js");
  const init = s.slice(s.indexOf("function initializeReferenceFormatting()"));
  assert.doesNotMatch(init, /scheduleReferences\(/);
  assert.doesNotMatch(init, /#reauditBtn/);
  assert.doesNotMatch(init, /#formatBtn/);
  assert.match(init, /addEventListener\("apa-document-loaded"/);
  assert.match(init, /#formatReferenceList/);
});
test("list and media normalizers do not run for every user input or DOM change", () => {
  for (const f of ["list-normalizer-v31.js", "table-figure-v32.js"]) {
    const s = source(f);
    assert.doesNotMatch(s, /new MutationObserver/);
    assert.doesNotMatch(s, /root\.addEventListener\("input"/);
    assert.match(s, /root\.addEventListener\("apa-document-loaded"/);
    assert.doesNotMatch(s, /setTimeout\(\(\) => \{ normalize(?:NumberedLists|Media)\(\)/);
  }
});
test("manual No Indent remains a persistent explicit editor instruction", () => {
  const s = source("apa-editor-v30.js");
  assert.match(s, /block\.dataset\.apaEditorIndent = value;/);
  assert.match(s, /enforceEditorIndent\(block\)/);
  assert.match(s, /"text-indent", "0", "important"/);
  assert.match(s, /"padding-left", "0", "important"/);
});
