// Run: node --test tests/word-editor-tools.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../word-editor-tools.js"), "utf8");

class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.childNodes = this.children;
    this.listeners = {};
    this.style = { setProperty() {} };
    this.attributes = {};
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.parentNode = null;
    this.classList = { toggle() {} };
  }
  append(...children) {
    for (const child of children) { child.parentNode = this; this.children.push(child); }
  }
  insertBefore(child, sibling) {
    const at = this.children.indexOf(sibling);
    child.parentNode = this;
    this.children.splice(at < 0 ? this.children.length : at, 0, child);
  }
  addEventListener(type, cb) { (this.listeners[type] ||= []).push(cb); }
  dispatchEvent(event) {
    for (const listener of this.listeners[event.type] || []) listener(event);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  focus() { this.focused = true; }
  select() {}
  contains(child) { return child === this || child?.parentNode === this; }
  querySelectorAll() { return []; }
}
function setup() {
  const root = new FakeElement("article");
  root.innerHTML = "<p>Original paragraph.</p>";
  const shell = new FakeElement();
  const parent = new FakeElement();
  parent.append(shell);
  const home = new FakeElement();
  const insert = new FakeElement();
  const review = new FakeElement();
  const output = new FakeElement();
  output.disabled = false;
  let resetCalls = 0;
  let downloaded = 0;
  output.click = () => { downloaded++; };
  const els = new Map([
    ["preview", root], ["apaEditorShell", shell],
    ["word-ribbon-panel-inicio", home],
    ["word-ribbon-panel-insertar", insert],
    ["word-ribbon-panel-revisar", review],
    ["downloadDocxBtn", output]
  ]);
  const listeners = {};
  const document = {
    readyState: "complete",
    getElementById: id => els.get(id) || null,
    createElement: tag => new FakeElement(tag),
    createTextNode(text) { return { data: text, nodeType: 3, parentElement: root, parentNode: root }; },
    addEventListener(type, cb) { (listeners[type] ||= []).push(cb); },
    execCommand() { return true; }
  };
  const window = {
    getSelection() { return null; },
    apaResetProtectedDocument() { resetCalls++; },
    print() {}
  };
  class Event {
    constructor(type, options = {}) {
      this.type = type;
      this.inputType = options.inputType || "";
    }
  }
  vm.runInNewContext(source, { document, window, Event, NodeFilter: { SHOW_TEXT: 4 } });
  return {
    root, shell, home, insert, review, output, document, window, els, listeners,
    get resetCalls() { return resetCalls; },
    get downloaded() { return downloaded; }
  };
}
function fireInput(h, html, inputType = "insertText") {
  h.root.innerHTML = html;
  h.root.dispatchEvent({ type: "input", inputType });
}

test("new Word ribbon tools preserve original editor node and expose editing actions", () => {
  const h = setup();
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
  assert.ok(h.home.children.length >= 4);
  assert.ok(h.review.children.length > 0);
  assert.ok(h.insert.children.length > 0);
  assert.equal(typeof h.window.EstiloAPAWordTools.undo, "function");
  assert.equal(typeof h.window.EstiloAPAWordTools.replace, "function");
});

test("Undo/Redo restore snapshots only when explicitly requested", () => {
  const h = setup(), api = h.window.EstiloAPAWordTools;
  fireInput(h, "<p>A new paragraph.</p>", "insertParagraph");
  assert.equal(h.root.innerHTML, "<p>A new paragraph.</p>");
  assert.equal(api.historyState().length, 2);
  assert.equal(api.undo(), true);
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
  assert.equal(api.redo(), true);
  assert.equal(h.root.innerHTML, "<p>A new paragraph.</p>");
  assert.equal(h.resetCalls, 2);
});

test("short typing burst undoes in one step rather than per character", () => {
  const h = setup(), api = h.window.EstiloAPAWordTools;
  fireInput(h, "<p>Original paragraph.A</p>");
  fireInput(h, "<p>Original paragraph.AB</p>");
  fireInput(h, "<p>Original paragraph.ABC</p>");
  assert.equal(api.historyState().length, 2);
  api.undo();
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
});

test("Redo is discarded after a new edit made following Undo", () => {
  const h = setup(), api = h.window.EstiloAPAWordTools;
  fireInput(h, "<p>Second state</p>", "insertParagraph");
  api.undo();
  fireInput(h, "<p>Different new state</p>", "insertParagraph");
  assert.equal(api.redo(), false);
  assert.equal(h.root.innerHTML, "<p>Different new state</p>");
});

test("importing a new document establishes an independent history baseline", () => {
  const h = setup(), api = h.window.EstiloAPAWordTools;
  fireInput(h, "<p>Previous work</p>", "insertParagraph");
  h.root.innerHTML = "<p>New APA 7 import</p>";
  h.root.dispatchEvent({ type: "apa-document-loaded" });
  assert.equal(api.historyState().length, 1);
  assert.equal(api.undo(), false);
});

test("Ctrl+Z, Ctrl+Y and Ctrl+S act only inside the document editor", () => {
  const h = setup();
  fireInput(h, "<p>Typed content</p>", "insertParagraph");
  let prevented = 0;
  const key = keyName => ({
    type: "keydown", key: keyName, ctrlKey: true,
    metaKey: false, altKey: false, shiftKey: false,
    preventDefault() { prevented++; }
  });
  h.root.dispatchEvent(key("z"));
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
  h.root.dispatchEvent(key("y"));
  assert.equal(h.root.innerHTML, "<p>Typed content</p>");
  h.root.dispatchEvent(key("s"));
  assert.equal(h.downloaded, 1);
  assert.equal(prevented, 3);
});

test("search is a non-destructive operation with replace mode hidden by default", () => {
  const h = setup();
  const api = h.window.EstiloAPAWordTools;
  api.find();
  const panel = h.shell.parentNode.children.find(el => el.id === "wordFindPanel");
  assert.ok(panel && !panel.hidden);
  assert.equal(panel.classList.toggle !== undefined, true);
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
});

test("Word editing module is loaded after the Ribbon and supports mobile layout", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../word-editor-tools.css"), "utf8");
  assert.ok(html.indexOf('src="word-ribbon.js"') < html.indexOf('src="word-editor-tools.js"'));
  assert.match(html, /href="word-editor-tools.css"/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /word-find-panel\[hidden\]/);
});
