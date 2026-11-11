// Run with: node --test tests/ui-english.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "../ui-english.js"), "utf8");
const document = { readyState: "loading", addEventListener() {} };
const context = vm.createContext({ document, Node: { ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4 } });
vm.runInContext(script, context, { filename: "ui-english.js" });

test("ribbon and editor terminology is translated to English", () => {
  assert.equal(vm.runInContext('uiEnglishText("Encabezado nivel 3")', context), "Heading Level 3");
  assert.equal(vm.runInContext('uiEnglishText("Sangría francesa 0.5 pulgadas")', context), "Hanging Indent 0.5 in");
  assert.equal(vm.runInContext('uiEnglishText("+ Insertar imagen")', context), "+ Insert Picture");
});

test("APA citations and ordinary academic content are not reauthored by string translation", () => {
  const citation = "García, E. A. (2026). Innovación educativa.";
  assert.equal(vm.runInContext('uiEnglishText(' + JSON.stringify(citation) + ')', context), citation);
});

test("editable document and uploaded filenames are excluded", () => {
  const preview = { closest(selector) { return selector.includes("#preview") ? {} : null; } };
  const files = { closest(selector) { return selector.includes("#fileList") ? {} : null; } };
  context.previewMock = preview;
  context.fileMock = files;
  assert.equal(vm.runInContext("uiEnglishExcluded(previewMock)", context), true);
  assert.equal(vm.runInContext("uiEnglishExcluded(fileMock)", context), true);
});

test("does not replace command identifiers or hyperlinks", () => {
  assert.equal(vm.runInContext('uiEnglishText("formatBtn")', context), "formatBtn");
  assert.equal(vm.runInContext('uiEnglishText("https://doi.org/10.1234/example")', context), "https://doi.org/10.1234/example");
});
