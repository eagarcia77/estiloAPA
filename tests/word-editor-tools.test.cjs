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

function prepareFindDocument(h, initialText) {
  const node = { nodeType: 3, data: initialText, parentNode: h.root, parentElement: h.root };
  const selection = {
    rangeCount: 0, range: null,
    getRangeAt() { return this.range; },
    removeAllRanges() { this.rangeCount = 0; this.range = null; },
    addRange(range) { this.rangeCount = 1; this.range = range; }
  };
  class TextRange {
    startContainer = node;
    endContainer = node;
    startOffset = 0;
    endOffset = 0;
    get commonAncestorContainer() { return h.root; }
    get collapsed() { return this.startOffset === this.endOffset; }
    setStart(target, offset) { this.startContainer = target; this.startOffset = offset; }
    setEnd(target, offset) { this.endContainer = target; this.endOffset = offset; }
    cloneRange() {
      const copy = new TextRange();
      copy.setStart(this.startContainer, this.startOffset);
      copy.setEnd(this.endContainer, this.endOffset);
      return copy;
    }
    deleteContents() {
      node.data = node.data.slice(0, this.startOffset) + node.data.slice(this.endOffset);
      this.endOffset = this.startOffset;
    }
    insertNode(text) {
      node.data = node.data.slice(0, this.startOffset) + text.data +
        node.data.slice(this.startOffset);
      this.startOffset += text.data.length;
      this.endOffset = this.startOffset;
    }
    setStartAfter() {}
    collapse() { this.endOffset = this.startOffset; }
  }
  h.document.createTreeWalker = () => {
    let yielded = false;
    return { nextNode() {
      if (yielded) return null;
      yielded = true;
      return node;
    }};
  };
  h.document.createRange = () => new TextRange();
  h.window.getSelection = () => selection;
  return { node, selection };
}

test("Find identifies text without altering the document", () => {
  const h = setup();
  const { node } = prepareFindDocument(h, "Alpha beta alpha");
  h.window.EstiloAPAWordTools.find();
  const panel = h.shell.parentNode.children.find(el => el.id === "wordFindPanel");
  const row = panel.children[1];
  const searchInput = row.children[0];
  const matchLabel = row.children[row.children.length - 1];
  searchInput.value = "alpha";
  searchInput.dispatchEvent({ type: "input" });
  assert.equal(matchLabel.textContent, "1 of 2 matches");
  assert.equal(node.data, "Alpha beta alpha");
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
});

test("Find supports case-sensitive and whole-word searches", () => {
  const h = setup();
  prepareFindDocument(h, "Cat catalog cat CAT");
  h.window.EstiloAPAWordTools.find();
  const panel = h.shell.parentNode.children.find(el => el.id === "wordFindPanel");
  const find = panel.children[1].children[0];
  const count = panel.children[1].children.at(-1);
  const flags = panel.children[3];
  const sensitive = flags.children[0].children[0];
  const whole = flags.children[1].children[0];
  find.value = "cat";
  find.dispatchEvent({ type: "input" });
  assert.equal(count.textContent, "1 of 4 matches");
  whole.checked = true;
  whole.dispatchEvent({ type: "change" });
  assert.equal(count.textContent, "1 of 3 matches");
  sensitive.checked = true;
  sensitive.dispatchEvent({ type: "change" });
  assert.equal(count.textContent, "1 of 1 matches");
});

test("Replace All changes matching text only, leaving unrelated text intact", () => {
  const h = setup();
  const { node } = prepareFindDocument(h, "alpha beta alpha gamma");
  h.window.EstiloAPAWordTools.replace();
  const panel = h.shell.parentNode.children.find(el => el.id === "wordFindPanel");
  const find = panel.children[1].children[0];
  const replacement = panel.children[2].children[0];
  const replaceAll = panel.children[2].children[2];
  find.value = "alpha";
  find.dispatchEvent({ type: "input" });
  replacement.value = "delta";
  replaceAll.click = () => replaceAll.dispatchEvent({ type: "click" });
  replaceAll.click();
  assert.equal(node.data, "delta beta delta gamma");
});

test("Table operations reject merged-cell structures to protect complex APA tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "../word-editor-tools.js"), "utf8");
  assert.match(source, /rowspan/);
  assert.match(source, /colspan/);
  assert.match(source, /Complex merged tables/);
  for (const tool of ["addRow", "addColumn", "deleteRow", "deleteColumn"]) {
    assert.ok(source.includes('editTable("' + tool + '")'), tool);
  }
});

test("Undo and Redo preserve the chosen No Indent markup", () => {
  const h = setup();
  const api = h.window.EstiloAPAWordTools;
  const withoutIndent = '<p data-apa-editor-indent="none" style="text-indent:0!important;padding-left:0!important">Text</p>';
  fireInput(h, withoutIndent, "formatParagraph");
  api.undo();
  assert.equal(h.root.innerHTML, "<p>Original paragraph.</p>");
  api.redo();
  assert.equal(h.root.innerHTML, withoutIndent);
});

test("Word tools remain optional rather than replacing the APA 7 workflow", () => {
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const editor = fs.readFileSync(path.join(__dirname, "../apa-editor-v30.js"), "utf8");
  assert.match(app, /void formatSelectedFiles\(importRequestId\)/);
  assert.match(editor, /function applyIndent\(value\)/);
  assert.match(editor, /data-indent="none"/);
  assert.match(editor, /data-indent="hanging"/);
});
