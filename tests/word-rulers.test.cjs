// Run: node --test tests/word-rulers.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
function helper() {
  const window = {};
  vm.runInNewContext(read("word-ruler-indents.js"), { window });
  return window.EstiloAPAWordRulerIndents;
}
function block(indent) {
  const values = new Map();
  const classes = new Set();
  const target = {
    dataset: { apaEditorIndent: indent || "" },
    innerHTML: "<strong>Preserved APA 7 text.</strong>",
    style: {
      setProperty(name, value, priority) { values.set(name, { value, priority }); },
      getPropertyValue(name) { return values.get(name)?.value || ""; },
      getPropertyPriority(name) { return values.get(name)?.priority || ""; },
      removeProperty(name) { values.delete(name); }
    },
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
  return { target, values, classes };
}
test("built-in APA 7 presets have the same positions as Word rulers", () => {
  const model = helper();
  assert.equal(model.read(block("none").target).first, 0);
  assert.equal(model.read(block("first").target).first, .5);
  assert.equal(model.read(block("hanging").target).left, .5);
  assert.equal(model.read(block("hanging").target).first, 0);
});
test("ruler markers apply CSS indents without replacing content", () => {
  const model = helper(), p = block("first");
  const before = p.target.innerHTML;
  assert.equal(model.apply(p.target, { left: .75, first: 1.0, right: .25 }), true);
  assert.equal(p.target.dataset.apaEditorIndent, "custom");
  assert.equal(p.values.get("padding-left").value, ".75in");
  assert.equal(p.values.get("text-indent").value, ".25in");
  assert.equal(p.values.get("padding-right").value, ".25in");
  assert.equal(p.values.get("text-indent").priority, "important");
  assert.equal(p.target.innerHTML, before);
});
test("hanging and right indents become correct DOCX twips", () => {
  const model = helper(), p = block();
  model.apply(p.target, { left: .5, first: 0, right: .25 });
  const docx = model.toDocx(p.target);
  assert.equal(docx.left, 720);
  assert.equal(docx.right, 360);
  assert.equal(docx.hanging, 720);
  assert.equal(docx.firstLine, undefined);
});
test("first line ruler offset becomes Word firstLine twips", () => {
  const model = helper(), p = block();
  model.apply(p.target, { left: .75, first: 1.0, right: 0 });
  const docx = model.toDocx(p.target);
  assert.equal(docx.left, 1080);
  assert.equal(docx.firstLine, 360);
  assert.equal(docx.right, 0);
  assert.equal(docx.hanging, undefined);
});
test("No Indent can be applied after a custom ruler value", () => {
  const model = helper(), p = block();
  model.apply(p.target, { left: 0, first: 0, right: 0 });
  assert.equal(p.classes.has("no-indent"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(model.toDocx(p.target))),
    { left: 0, right: 0, firstLine: 0 });
  const editor = read("apa-editor-v30.js");
  assert.match(editor, /delete block\.dataset\.apaEditorIndentLeft/);
  assert.match(editor, /delete block\.dataset\.apaEditorIndentFirst/);
  assert.match(editor, /delete block\.dataset\.apaEditorIndentRight/);
  assert.match(editor, /block\.style\.removeProperty\("padding-right"\)/);
});
test("every DOCX exporter supports explicit custom ruler indents", () => {
  for (const name of ["app.js","docx-enhance.js","docx-figure-export-v2.js","thesis-docx.js"]) {
    const s = read(name);
    assert.match(s, /EstiloAPAWordRulerIndents\?\.toDocx\(element\)/, name);
    assert.match(s, /if \(rulerIndent\) options\.indent = rulerIndent;/, name);
  }
});
test("rulers are outside editable HTML, responsive and excluded from print", () => {
  const s = read("word-rulers.js"), css = read("word-rulers.css");
  assert.match(s, /wrap\.prepend\(horizontal\)/);
  assert.match(s, /wrap\.append\(vertical\)/);
  assert.match(s, /role", "slider"/);
  assert.match(s, /pointerdown/);
  assert.match(s, /ArrowLeft", "ArrowRight", "Home"/);
  assert.match(s, /"Rulers"/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /@media print/);
  assert.match(css, /#wordRulerHorizontal, #wordRulerVertical \{ display:none !important;/);
  const html = read("index.html");
  assert.match(html, /src="word-rulers\.js"/);
  assert.match(html, /href="word-rulers\.css"/);
});
test("custom ruler indentation is protected from delayed APA normalizers", () => {
  const s = read("apa-editor-v30.js");
  assert.match(s, /\["none", "first", "hanging", "custom"\]/);
  assert.match(s, /window\.EstiloAPAWordRulerIndents\?\.read\(block\)/);
  assert.match(s, /properties\.push\(\["padding-right", values\.right \+ "in"\]\)/);
});
