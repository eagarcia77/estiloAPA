// Run: node --test tests/editor-ribbon-audit.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function editorHarness() {
  const css = new Map();
  const classNames = new Set();
  const block = {
    nodeType: 1,
    tagName: "P",
    dataset: {},
    classList: {
      add(...names) { names.forEach(n => classNames.add(n)); },
      remove(...names) { names.forEach(n => classNames.delete(n)); },
      toggle(name, enabled) { enabled ? classNames.add(name) : classNames.delete(name); },
      contains(name) { return classNames.has(name); },
    },
    style: {
      setProperty(name, value, priority) { css.set(name, { value, priority }); },
      removeProperty(name) { css.delete(name); },
    },
    closest() { return block; },
  };
  const text = { nodeType: 3, parentElement: block, parentNode: block };
  const preview = {
    querySelectorAll() { return [block]; },
    contains(node) { return node === text || node === block; },
    dispatchEvent() {},
  };
  let range = {
    collapsed: true,
    startContainer: text,
    startOffset: 2,
    cloneRange() { return this; },
  };
  const selection = {
    rangeCount: 1,
    anchorNode: text,
    getRangeAt() { return range; },
    removeAllRanges() {},
    addRange() {},
  };
  const status = { textContent: "", className: "" };
  const document = {
    readyState: "loading",
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#preview") return preview;
      if (selector === "#status") return status;
      return null;
    },
  };
  const context = vm.createContext({
    document,
    window: { getSelection() { return selection; } },
    Node: { ELEMENT_NODE: 1 },
    Event: class {},
  });
  vm.runInContext(read("apa-editor-v30.js"), context);
  return { context, block, css, classNames, setRange(next) { range = next; } };
}

test("collapsed cursor selects just its own paragraph", () => {
  const h = editorHarness();
  assert.equal(vm.runInContext("selectedBlocks().length", h.context), 1);
});

test("No Indent overrides APA rules without losing paragraph contents", () => {
  const h = editorHarness();
  const originalText = "The paragraph must be preserved.";
  h.block.textContent = originalText;
  vm.runInContext('applyIndent("none")', h.context);
  assert.equal(h.block.dataset.apaEditorIndent, "none");
  assert.equal(h.css.get("text-indent").value, "0");
  assert.equal(h.css.get("text-indent").priority, "important");
  assert.equal(h.css.get("padding-left").value, "0");
  assert.ok(h.classNames.has("no-indent"));
  assert.equal(h.block.textContent, originalText);
});

test("First Line, Hanging, and No Indent can be used successively", () => {
  const h = editorHarness();
  const run = command => vm.runInContext('applyIndent(' + JSON.stringify(command) + ')', h.context);
  run("first");
  assert.equal(h.css.get("text-indent").value, ".5in");
  run("hanging");
  assert.equal(h.css.get("text-indent").value, "-.5in");
  assert.equal(h.css.get("padding-left").value, ".5in");
  run("none");
  assert.equal(h.css.get("text-indent").value, "0");
  assert.equal(h.css.get("padding-left").value, "0");
});

test("Alignment and Line Spacing override profile CSS", () => {
  const h = editorHarness();
  vm.runInContext('applyAlignment("right")', h.context);
  vm.runInContext('applyLineSpacing("1.5")', h.context);
  assert.equal(h.css.get("text-align").value, "right");
  assert.equal(h.css.get("text-align").priority, "important");
  assert.equal(h.css.get("line-height").value, "1.5");
  assert.equal(h.css.get("line-height").priority, "important");
});

test("app font refresh does not overwrite manual paragraph indents", () => {
  const app = read("app.js");
  assert.match(app, /\["none", "first", "hanging"\]\.includes\(p\.dataset\.apaEditorIndent\)/);
  assert.match(app, /\["none", "first", "hanging"\]\.includes\(ref\.dataset\.apaEditorIndent\)/);
});

test("all DOCX pipelines honor manual indentation", () => {
  for (const file of ["app.js", "docx-enhance.js", "docx-figure-export-v2.js", "thesis-docx.js"]) {
    const source = read(file);
    assert.match(source, /element\.dataset\.apaEditorIndent/, file + " lacks editor override");
    assert.match(source, /userIndent === "none"/, file + " lacks No Indent");
    assert.match(source, /userIndent === "hanging"/, file + " lacks Hanging Indent");
  }
});

test("the HTML export synchronizer retains explicit indentation", () => {
  const source = read("apa-editor-export-v30.js");
  assert.match(source, /block\.style\.setProperty\("text-indent"/);
  assert.match(source, /block\.classList\.toggle\("no-indent"/);
});

test("the Ribbon preserves all six tabs and original button handlers", () => {
  const source = read("word-ribbon.js");
  for (const name of ["File", "Home", "Insert", "APA Layout", "Review", "View"]) {
    assert.ok(source.includes(JSON.stringify(name)), name);
  }
  assert.match(source, /target\.append\(group\)/);
});
