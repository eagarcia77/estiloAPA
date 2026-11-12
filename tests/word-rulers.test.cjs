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
  assert.equal(p.values.get("padding-left").value, "0.75in");
  assert.equal(p.values.get("text-indent").value, "0.25in");
  assert.equal(p.values.get("padding-right").value, "0.25in");
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

class UiNode {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.childNodes = this.children;
    this.parentElement = null;
    this.parentNode = null;
    this.dataset = {};
    this.listeners = {};
    this.attrs = {};
    this.textContent = "";
    this.style = {
      setProperty(k,v) { this[k] = v; },
      getPropertyValue(k) { return this[k] || ""; },
      getPropertyPriority() { return ""; }
    };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(n => classes.add(n)),
      contains: n => classes.has(n),
      toggle: (n, value) => {
        const yes = value === undefined ? !classes.has(n) : Boolean(value);
        if (yes) classes.add(n); else classes.delete(n);
        return yes;
      }
    };
  }
  append(...nodes) {
    for (const n of nodes) {
      const items = n.fragment ? [...n.children] : [n];
      for (const child of items) {
        child.parentNode = this;
        child.parentElement = this;
        this.children.push(child);
      }
    }
  }
  prepend(node) {
    const items = node.fragment ? [...node.children] : [node];
    for (const child of items.reverse()) {
      child.parentNode = this;
      child.parentElement = this;
      this.children.unshift(child);
    }
  }
  remove() {
    const p = this.parentNode;
    if (p) p.children = p.children.filter(n => n !== this);
  }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
  dispatchEvent(event) { this.emit(event.type, event); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] || null; }
  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() {
    if (this.id === "preview") return {left:120,top:90,width:816,height:1056};
    if (this.id === "wrap") return {left:80,top:40,width:950,height:1250};
    return {left:0,top:0,width:0,height:0};
  }
  querySelectorAll(selector) {
    const items = [];
    const visit = node => {
      for (const child of node.children) {
        if (selector === ".word-ruler-tick" &&
            (child.classList.contains("word-ruler-tick") ||
              String(child.className || "").split(" ").includes("word-ruler-tick"))) items.push(child);
        visit(child);
      }
    };
    visit(this);
    return items;
  }
  closest(selector) {
    return selector.includes("p,") && this.tagName === "P" ? this : null;
  }
  contains(node) {
    return node === this || this.children.some(child => child.contains(node));
  }
}
function uiHarness() {
  const model = helper();
  const wrap = new UiNode(), root = new UiNode("article");
  const p = new UiNode("p"), view = new UiNode(), status = new UiNode();
  wrap.id = "wrap"; root.id = "preview"; view.id = "word-ribbon-panel-vista";
  wrap.classList.add("paper-wrap");
  wrap.scrollLeft = 0; wrap.scrollTop = 0;
  root.append(p); wrap.append(root);
  p.dataset.apaEditorIndent = "none";
  const text = { nodeType: 3, parentElement: p, parentNode: p };
  let selection = {
    rangeCount: 1,
    getRangeAt() { return { startContainer: text }; }
  };
  let scheduled = [], inputCount = 0;
  const body = new UiNode();
  const document = {
    readyState:"complete", body,
    createElement: tag => new UiNode(tag),
    createDocumentFragment() { const el = new UiNode(); el.fragment = true; return el; },
    getElementById(id) {
      return [root,wrap,view,status,...wrap.children,...view.children]
        .find(node => node.id === id) || null;
    },
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
    listeners: {},
  };
  root.addEventListener("input", () => { inputCount++; });
  const window = {
    EstiloAPAWordRulerIndents: model,
    getSelection: () => selection,
    getComputedStyle: el => el === root ?
      { zoom:"1",paddingLeft:"96px",paddingRight:"96px",paddingTop:"96px"} :
      {paddingLeft:"0px",paddingRight:"0px",textIndent:"0px"},
    requestAnimationFrame(fn) { scheduled.push(fn); return scheduled.length; },
    addEventListener() {}
  };
  class Event { constructor(type) { this.type = type; } }
  vm.runInNewContext(read("word-rulers.js"), { document, window, Event });
  function flush() { while (scheduled.length) scheduled.shift()(); }
  flush();
  return {
    model, p, view, root, wrap, document, window, status,
    flush, get inputCount() { return inputCount; },
    ruler() { return wrap.children.find(n => n.id === "wordRulerHorizontal"); },
    markers() { return this.ruler().children.filter(n => n.dataset.rulerKind); },
    toggle() {
      return view.children.flatMap(n => n.children)
        .find(n => n.textContent === "Hide Rulers" || n.textContent === "Show Rulers");
    }
  };
}
test("rulers render outside the contenteditable document, with three adjustable sliders", () => {
  const h = uiHarness();
  assert.ok(h.ruler());
  assert.ok(h.wrap.children.some(n => n.id === "wordRulerVertical"));
  assert.equal(h.markers().length, 3);
  assert.equal(h.root.children.length, 1);
  assert.equal(h.ruler().querySelectorAll(".word-ruler-tick").length > 3, true);
  assert.equal(h.toggle().textContent, "Hide Rulers");
});
test("keyboard ruler adjustment preserves the paragraph node and emits one edit", () => {
  const h = uiHarness(), block = h.p;
  const first = h.markers().find(n => n.dataset.rulerKind === "first");
  first.emit("keydown", { key:"ArrowRight", preventDefault(){} });
  assert.equal(h.p, block);
  assert.equal(h.p.dataset.apaEditorIndent, "custom");
  assert.equal(h.p.dataset.apaEditorIndentFirst, "0.125");
  assert.equal(h.inputCount, 1);
});
test("rulers can be hidden or shown without changing the document", () => {
  const h = uiHarness();
  h.toggle().emit("click", {});
  assert.equal(h.document.body.classList.contains("word-rulers-hidden"), true);
  assert.equal(h.toggle().textContent, "Show Rulers");
  assert.equal(h.p.dataset.apaEditorIndent, "none");
  h.toggle().emit("click", {});
  h.flush();
  assert.equal(h.document.body.classList.contains("word-rulers-hidden"), false);
});
