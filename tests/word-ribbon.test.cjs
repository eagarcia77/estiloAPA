// Run: node --test tests/word-ribbon.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.className = "";
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.classList = {
      add: (...names) => { for (const name of names) if (!this.className.split(/\s+/).includes(name)) this.className += " " + name; },
      contains: name => this.className.split(/\s+/).includes(name),
    };
  }
  append(...elements) {
    for (const el of elements) { if (el.parent) el.parent.children = el.parent.children.filter(x => x !== el); el.parent = this; this.children.push(el); }
  }
  prepend(el) {
    if (el.parent) el.parent.children = el.parent.children.filter(x => x !== el);
    el.parent = this;
    this.children.unshift(el);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  click() { for (const fn of this.listeners.click || []) fn({ key: "", preventDefault() {} }); }
  focus() { this.focused = true; }
}

function setup() {
  const shell = new Element();
  const toolbar = new Element();
  const preview = new Element();
  const els = new Map([["apaEditorShell", shell], ["apaEditorToolbar", toolbar], ["preview", preview]]);
  const initialGroups = [];
  for (let i = 0; i < 8; i += 1) {
    const group = new Element();
    group.className = "tool-group";
    toolbar.append(group);
    initialGroups.push(group);
  }
  for (const id of ["formatBtn", "demoBtn", "clearBtn", "downloadDocxBtn", "downloadHtmlBtn", "reauditBtn", "downloadAuditBtn", "formatProfile", "fontFamily"]) {
    const target = new Element("button");
    target.id = id;
    target.called = 0;
    target.click = () => { target.called += 1; };
    els.set(id, target);
  }

  const document = {
    readyState: "complete",
    createElement: tag => new Element(tag),
    getElementById: id => els.get(id) || null,
    querySelector: () => null,
  };
  class MutationObserver { observe() {} }
  const window = {};
  const code = fs.readFileSync(path.join(__dirname, "../word-ribbon.js"), "utf8");
  vm.runInNewContext(code, { document, window, MutationObserver });
  return { shell, toolbar, preview, initialGroups, els, window };
}

test("six ribbon tabs are created with Inicio selected", () => {
  const h = setup();
  const tabs = h.shell.children.find(child => child.id === "wordRibbonTabs");
  const panels = h.shell.children.find(child => child.id === "wordRibbonPanels");
  assert.equal(tabs.children.length, 6);
  assert.equal(panels.children.length, 6);
  assert.equal(panels.children.filter(panel => !panel.hidden).length, 1);
  assert.equal(panels.children.find(panel => !panel.hidden).id, "word-ribbon-panel-inicio");
});

test("moving existing toolbar groups preserves their node identities", () => {
  const h = setup();
  const panels = h.shell.children.find(child => child.id === "wordRibbonPanels");
  assert.equal(h.toolbar.children.length, 0);
  const moved = panels.children.flatMap(panel => panel.children).filter(el => h.initialGroups.includes(el));
  assert.equal(moved.length, 8);
  assert.equal(new Set(moved).size, 8);
});

test("Archivo proxy runs the original DOCX export action", () => {
  const h = setup();
  const panels = h.shell.children.find(child => child.id === "wordRibbonPanels");
  const filePanel = panels.children.find(panel => panel.id === "word-ribbon-panel-archivo");
  const downloadButton = filePanel.children.flatMap(g => g.children).find(b => b.textContent === "Descargar Word");
  assert.ok(downloadButton);
  downloadButton.click();
  assert.equal(h.els.get("downloadDocxBtn").called, 1);
});

test("ribbon switches tabs without modifying preview content", () => {
  const h = setup();
  h.preview.textContent = "Texto de prueba intacto.";
  h.window.EstiloAPARibbon.activate("insertar");
  const panels = h.shell.children.find(child => child.id === "wordRibbonPanels");
  assert.equal(panels.children.find(panel => !panel.hidden).id, "word-ribbon-panel-insertar");
  assert.equal(h.preview.textContent, "Texto de prueba intacto.");
});
