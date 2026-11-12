// Run: node --test tests/word-local-drafts.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../word-local-drafts.js"), "utf8");

class Element {
  constructor(id = "") {
    this.id = id;
    this.innerHTML = "";
    this.textContent = "";
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.attributes = {};
    this.disabled = false;
  }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  dispatch(name) { for (const fn of this.listeners[name] || []) fn({ type: name }); }
  click() { this.dispatch("click"); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  querySelector() { return null; }
  focus() { this.focused = true; }
}
function initialize(existing = {}) {
  const html = existing.html ?? "<p>Manually edited APA paragraph.</p>";
  const root = new Element("preview");
  root.innerHTML = html;
  const panel = new Element("word-ribbon-panel-archivo");
  const status = new Element("status");
  const clear = new Element("clearBtn");
  const downloadDocx = new Element("downloadDocxBtn");
  const downloadHtml = new Element("downloadHtmlBtn");
  const review = new Element("reauditBtn");
  const audit = new Element("downloadAuditBtn");
  let resets = 0, confirmations = 0;
  let allowConfirm = true, timerIndex = 0;
  const pending = new Map(), data = new Map(Object.entries(existing.storage || {}));
  const localStorage = {
    getItem(key) { return data.get(key) || null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); }
  };
  const elements = new Map([
    ["preview", root], ["word-ribbon-panel-archivo", panel], ["status", status],
    ["clearBtn", clear], ["downloadDocxBtn", downloadDocx],
    ["downloadHtmlBtn", downloadHtml], ["reauditBtn", review],
    ["downloadAuditBtn", audit]
  ]);
  const document = {
    readyState: "complete",
    visibilityState: "visible",
    getElementById(name) { return elements.get(name) || null; },
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
    listeners: {},
    createElement(tag) {
      if (tag === "template") {
        const node = new Element(tag);
        node.content = { querySelectorAll() { return []; } };
        return node;
      }
      return new Element();
    }
  };
  const window = {
    localStorage,
    apaResetProtectedDocument() { resets++; },
    EstiloAPAWordTools: { resetHistory() { resets++; } },
    confirm() { confirmations++; return allowConfirm; }
  };
  const context = vm.createContext({
    document, window,
    setTimeout(fn) { const id = ++timerIndex; pending.set(id, fn); return id; },
    clearTimeout(id) { pending.delete(id); }
  });
  vm.runInContext(source, context);
  return {
    root, panel, clear, document, window, data, pending, status,
    get resets() { return resets; },
    get confirmations() { return confirmations; },
    setConfirm(value) { allowConfirm = value; },
    flush() { for (const [id, fn] of [...pending]) { pending.delete(id); fn(); } },
    button(id) { return panel.children[0].children.find(child => child.id === id); }
  };
}

test("File tab exposes Save Draft, Recover Draft, AutoSave and Delete Draft", () => {
  const h = initialize();
  for (const id of ["wordSaveLocalDraft","wordRecoverLocalDraft","wordToggleAutosave","wordDeleteLocalDraft"]) {
    assert.ok(h.button(id), id);
  }
  assert.equal(h.button("wordToggleAutosave").textContent, "AutoSave: Off");
  assert.equal(h.button("wordRecoverLocalDraft").disabled, true);
});

test("Save Draft stores HTML and date without editing the document", () => {
  const h = initialize();
  const initial = h.root.innerHTML;
  h.button("wordSaveLocalDraft").click();
  const stored = JSON.parse(h.data.get("estiloapa.localDraft.v1"));
  assert.equal(stored.html, initial);
  assert.equal(stored.version, 1);
  assert.ok(stored.savedAt);
  assert.equal(h.root.innerHTML, initial);
  assert.equal(h.button("wordRecoverLocalDraft").disabled, false);
});

test("AutoSave is opt-in, writes after typing, and remembers the setting", () => {
  const h = initialize();
  h.root.innerHTML = "<p>New manual changes</p>";
  h.root.dispatch("input");
  assert.equal(h.pending.size, 0);
  assert.equal(h.data.has("estiloapa.localDraft.v1"), false);
  h.button("wordToggleAutosave").click();
  assert.equal(h.button("wordToggleAutosave").textContent, "AutoSave: On");
  assert.equal(h.data.get("estiloapa.localDraft.autosave.v1"), "true");
  h.flush();
  assert.equal(JSON.parse(h.data.get("estiloapa.localDraft.v1")).html, "<p>New manual changes</p>");
  h.button("wordToggleAutosave").click();
  h.root.dispatch("input");
  assert.equal(h.pending.size, 0);
});

test("Recover Draft asks permission and retains manually edited markup", () => {
  const draft = JSON.stringify({
    version: 1, html: '<p data-apa-editor-indent="none" style="text-indent:0">Restored</p>',
    savedAt: "2026-11-11T12:00:00.000Z"
  });
  const h = initialize({ storage: { "estiloapa.localDraft.v1": draft } });
  h.setConfirm(false);
  h.button("wordRecoverLocalDraft").click();
  assert.equal(h.root.innerHTML, "<p>Manually edited APA paragraph.</p>");
  h.setConfirm(true);
  h.button("wordRecoverLocalDraft").click();
  assert.match(h.root.innerHTML, /data-apa-editor-indent="none"/);
  assert.equal(h.root.dataset.apaReadyForEditing, "true");
  assert.equal(h.resets, 2);
  assert.equal(h.button("wordRecoverLocalDraft").disabled, false);
  assert.equal(h.confirmations, 2);
});

test("Clear Document deletes local saved draft", () => {
  const h = initialize();
  h.button("wordSaveLocalDraft").click();
  assert.ok(h.data.has("estiloapa.localDraft.v1"));
  h.clear.click();
  assert.equal(h.data.has("estiloapa.localDraft.v1"), false);
  assert.equal(h.button("wordRecoverLocalDraft").disabled, true);
});

test("A new APA 7 document is never replaced automatically with a local draft", () => {
  const draft = JSON.stringify({
    version: 1, html: "<p>Previous work</p>", savedAt: "2026-11-11T12:00:00.000Z"
  });
  const h = initialize({ storage: { "estiloapa.localDraft.v1": draft } });
  h.root.innerHTML = "<p>New formatted APA 7 document</p>";
  h.root.dispatch("apa-document-loaded");
  assert.equal(h.root.innerHTML, "<p>New formatted APA 7 document</p>");
  assert.equal(h.confirmations, 0);
});

test("Saving oversized documents fails safely and preserves existing drafts", () => {
  const old = JSON.stringify({
    version: 1, html: "<p>Previous saved copy</p>", savedAt: "2026-11-11T12:00:00.000Z"
  });
  const h = initialize({ storage: { "estiloapa.localDraft.v1": old } });
  h.root.innerHTML = "x".repeat(1700001);
  h.button("wordSaveLocalDraft").click();
  assert.equal(h.data.get("estiloapa.localDraft.v1"), old);
  assert.match(h.status.textContent, /too large/i);
});

test("Draft restoration strips scripts and event-handler attributes", () => {
  assert.match(source, /script,iframe,object,embed,form,meta,base,link,svg,math/);
  assert.match(source, /name\.startsWith\("on"\)/);
  assert.match(source, /srcdoc/);
  assert.match(source, /javascript\|vbscript/);
});

test("Browser draft storage is documented as local and not encrypted", () => {
  assert.match(source, /Stored in this browser only, not encrypted or uploaded/);
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /word-local-drafts\.js/);
});
