// Run: node --test tests/word-docx-styles.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function converter() {
  const window = {};
  vm.runInNewContext(read("word-docx-styles.js"), { window });
  return window.EstiloAPAWordDocxStyles;
}
function element(tagName, style = {}, attrs = {}) {
  return {
    nodeType: 1, tagName, style,
    getAttribute: name => attrs[name] || null
  };
}

test("Word font family, exact size and text color are converted to DOCX runs", () => {
  const tools = converter();
  const span = element("SPAN", {
    fontFamily: 'Arial, sans-serif',
    fontSize: "14pt",
    color: "rgb(255, 0, 150)"
  });
  const options = tools.runOptions(tools.childStyle(span), "Times New Roman", 24);
  assert.equal(options.font, "Arial");
  assert.equal(options.size, 28);
  assert.equal(options.color, "FF0096");
});

test("highlight, strike, superscript and subscript are preserved", () => {
  const tools = converter();
  const marked = element("SPAN", {
    backgroundColor: "#ff0",
    textDecorationLine: "line-through"
  });
  const highlight = tools.runOptions(tools.childStyle(marked));
  assert.deepEqual(JSON.parse(JSON.stringify(highlight.shading)), { fill: "FFFF00" });
  assert.equal(highlight.strike, true);
  const superior = tools.childStyle(element("SUP"), { italics: true });
  assert.equal(superior.superScript, true);
  assert.equal(superior.italics, true);
  const inferior = tools.childStyle(element("SUB"), superior);
  assert.equal(inferior.superScript, false);
  assert.equal(inferior.subScript, true);
});

test("APA 7 defaults remain intact when no manual font formatting is present", () => {
  const tools = converter();
  const options = tools.runOptions(tools.childStyle(element("SPAN")), "Georgia", 22);
  assert.equal(options.font, "Georgia");
  assert.equal(options.size, 22);
  assert.equal(options.color, undefined);
  assert.equal(options.shading, undefined);
});

test("Word color/size conversions accept CSS pt, px, rgb and hex values", () => {
  const tools = converter();
  assert.equal(tools.size("16px"), 24);
  assert.equal(tools.size("12pt"), 24);
  assert.equal(tools.size("999pt"), null);
  assert.equal(tools.color("#abc"), "AABBCC");
  assert.equal(tools.color("rgb(1, 2, 3)"), "010203");
});

test("all four DOCX exporters use shared manual character-style conversion", () => {
  const paths = ["app.js", "docx-enhance.js", "docx-figure-export-v2.js", "thesis-docx.js"];
  for (const file of paths) {
    const source = read(file);
    assert.match(source, /EstiloAPAWordDocxStyles/, file);
    assert.match(source, /\.runOptions\(inherited,/, file);
    assert.match(source, /\.childStyle\(node, inherited\)/, file);
    assert.doesNotMatch(source, /runs = \[new TextRun\(\{ text, font, size, bold: true \}\)\]/,
      file + " flattens rich heading text");
  }
});
