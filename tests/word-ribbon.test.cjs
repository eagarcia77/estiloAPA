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
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(n => n && !names.includes(n)).join(" "); },
      toggle: (name, force) => {
        const has = this.classList.contains(name);
        const add = force === undefined ? !has : Boolean(force);
        if (add) this.classList.add(name);
        else this.classList.remove(name);
        return add;
      },
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
    body: new Element("body"),
    listeners: {},
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); },
    createElement: tag => new Element(tag),
    getElementById: id => els.get(id) || null,
    querySelector: () => null,
  };
  class MutationObserver { observe() {} }
  const window = {};
  const code = fs.readFileSync(path.join(__dirname, "../word-ribbon.js"), "utf8");
  vm.runInNewContext(code, { document, window, MutationObserver });
  return { shell, toolbar, preview, initialGroups, els, window, document };
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
  const downloadButton = filePanel.children.flatMap(g => g.children).find(b => b.textContent === "Export to Word");
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

test("Collapse Ribbon preserves tabs, editor content and original command nodes", () => {
  const h = setup();
  h.preview.textContent = "Preserved content.";
  const actions = h.shell.children.find(child => child.id === "wordRibbonActions");
  assert.ok(actions);
  const collapse = actions.children.find(child => child.id === "wordRibbonCollapse");
  assert.ok(collapse);
  // Compact Ribbon is the default. Clicking the toggle expands it.
  assert.equal(h.shell.classList.contains("word-ribbon-collapsed"), true);
  assert.equal(collapse.getAttribute("aria-expanded"), "false");
  collapse.click();
  assert.equal(h.shell.classList.contains("word-ribbon-collapsed"), false);
  assert.equal(collapse.getAttribute("aria-expanded"), "true");
  h.window.EstiloAPARibbon.setCollapsed(true);
  assert.equal(h.preview.textContent, "Preserved content.");
  assert.equal(h.toolbar.children.length, 0);
  h.window.EstiloAPARibbon.activate("insertar");
  assert.equal(h.shell.classList.contains("word-ribbon-collapsed"), false);
  assert.equal(collapse.getAttribute("aria-expanded"), "true");
});

test("Focus Mode hides secondary panels through body class and can be exited", () => {
  const h = setup();
  h.preview.textContent = "Academic document stays intact";
  const actions = h.shell.children.find(child => child.id === "wordRibbonActions");
  const focus = actions.children.find(child => child.id === "wordRibbonFocus");
  assert.ok(focus);
  focus.click();
  assert.equal(h.document.body.classList.contains("apa-focus-mode"), true);
  assert.equal(focus.getAttribute("aria-pressed"), "true");
  assert.equal(focus.textContent, "Exit Focus Mode");
  const esc = { key: "Escape" };
  for (const listener of h.document.listeners.keydown || []) listener(esc);
  assert.equal(h.document.body.classList.contains("apa-focus-mode"), false);
  assert.equal(focus.getAttribute("aria-pressed"), "false");
  assert.equal(h.preview.textContent, "Academic document stays intact");
});

test("Focus Mode and Ribbon state can be controlled independently", () => {
  const h = setup();
  h.window.EstiloAPARibbon.setCollapsed(true);
  h.window.EstiloAPARibbon.setFocusMode(true);
  assert.equal(h.shell.classList.contains("word-ribbon-collapsed"), true);
  assert.equal(h.document.body.classList.contains("apa-focus-mode"), true);
  h.window.EstiloAPARibbon.setFocusMode(false);
  assert.equal(h.shell.classList.contains("word-ribbon-collapsed"), true);
  h.window.EstiloAPARibbon.setCollapsed(false);
  assert.equal(h.shell.classList.contains("word-ribbon-collapsed"), false);
});

test("Review APA 7 Ribbon action opens a visible panel instead of auditing invisibly", () => {
  const h = setup();
  const review = new Element("details");
  review.open = false;
  h.els.set("simpleReviewDetails", review);
  h.window.EstiloAPASimple = {
    toggleReview() { review.open = !review.open; },
  };
  const panels = h.shell.children.find(child => child.id === "wordRibbonPanels");
  const reviewPanel = panels.children.find(panel => panel.id === "word-ribbon-panel-revisar");
  const command = reviewPanel.children.flatMap(group => group.children)
    .find(el => el.textContent === "Review APA 7");
  assert.ok(command, "The review command should exist");
  command.click();
  assert.equal(review.open, true);
  assert.equal(h.els.get("reauditBtn").called, 0);
  command.click();
  assert.equal(h.els.get("reauditBtn").called, 1);
});
