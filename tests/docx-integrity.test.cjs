// Run with: node --test tests/docx-integrity.test.cjs
// Pure preflight regression tests; full DOCX round-trip remains a browser/CI task.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../docx-figure-export-v2.js"), "utf8");
const context = {
  window: {},
  document: { addEventListener() {}, querySelector() { return null; } },
  console,
};
vm.createContext(context);
vm.runInContext(source, context, { filename: "docx-figure-export-v2.js" });

function image(src) {
  return { tagName: "IMG", getAttribute(name) { return name === "src" ? src : null; } };
}
function table(cells) {
  return { tagName: "TABLE", querySelectorAll() { return cells; } };
}
function cell(colSpan = 1, rowSpan = 1, nested = false) {
  return {
    colSpan, rowSpan,
    querySelector() { return nested ? {} : null; }
  };
}
function preview(images) {
  return { querySelectorAll() { return images; } };
}
const png = "data:image/png;base64,iVBORw0KGgo=";
const jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

test("accepts independent embedded PNG and JPEG images", () => {
  const blocks = [image(png), image(jpg), table([cell()])];
  assert.doesNotThrow(() => context.dxValidateExportBlocks(preview(blocks.slice(0, 2)), blocks));
});

test("rejects nested images instead of silently omitting them", () => {
  assert.throws(() => context.dxValidateExportBlocks(preview([image(png)]), []), /contenedores/);
});

test("rejects remote images and unsupported image formats", () => {
  for (const src of ["https://example.com/a.png", "data:image/webp;base64,AAAA", ""]) {
    const img = image(src);
    assert.throws(() => context.dxValidateExportBlocks(preview([img]), [img]), /Imagen no compatible/);
  }
});

test("rejects malformed embedded image content", () => {
  const img = image("data:image/png;base64,INVALID!");
  assert.throws(() => context.dxValidateExportBlocks(preview([img]), [img]), /datos PNG\/JPEG/);
});

test("rejects merged table cells", () => {
  for (const merged of [cell(2, 1), cell(1, 2)]) {
    const blocks = [table([merged])];
    assert.throws(() => context.dxValidateExportBlocks(preview([]), blocks), /combinadas/);
  }
});

test("rejects nested images or tables inside table cells", () => {
  const blocks = [table([cell(1, 1, true)])];
  assert.throws(() => context.dxValidateExportBlocks(preview([]), blocks), /anidada/);
});
