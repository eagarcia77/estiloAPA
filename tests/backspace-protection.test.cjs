// Run with: node --test tests/backspace-protection.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function harness(initial = "A".repeat(500), selection = null) {
  let next = 0;
  const timers = new Map();
  const listeners = new Map();
  const status = { textContent: "", className: "" };
  const root = {
    innerHTML: initial, textContent: initial, dataset: {}, classList: { toggle() {} },
    contains() { return true; },
    addEventListener(name, handler) { (listeners.get(name) || listeners.set(name, []).get(name)).push(handler); },
    dispatchEvent() {},
    focus() {},
  };
  // Setting innerHTML on browser DOM updates textContent as well.
  let html = initial;
  Object.defineProperty(root, "innerHTML", {
    get() { return html; },
    set(value) { html = value; root.textContent = value; }
  });
  const document = {
    readyState: "complete", activeElement: root,
    querySelector(selector) { return selector === "#preview" ? root : selector === "#status" ? status : null; },
    addEventListener() {},
  };
  const window = {
    setTimeout(fn) { const id = ++next; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    getSelection() { return selection; },
  };
  const code = fs.readFileSync(path.join(__dirname, "../edit-stability-v348.js"), "utf8");
  vm.runInNewContext(code, { window, document, Node: { ELEMENT_NODE: 1 }, CustomEvent: class {}, console });
  function emit(name, event = {}) {
    for (const handler of listeners.get(name) || []) handler({ type: name, preventDefault() { event.prevented = true; }, ...event });
  }
  function drain() {
    for (const [id, fn] of [...timers]) { if (!timers.has(id)) continue; timers.delete(id); fn(); }
  }
  return { root, status, window, document, listeners, emit, drain };
}

test("ordinary Backspace keeps document and does not trigger restoration", () => {
  const h = harness();
  const original = h.root.innerHTML;
  h.emit("keydown", { key: "Backspace" });
  h.root.innerHTML = original.slice(0, -1);
  h.emit("input");
  h.drain();
  assert.equal(h.root.innerHTML.length, original.length - 1);
  assert.doesNotMatch(h.status.textContent, /restauró/i);
});

test("catastrophic deletion restores the saved document", () => {
  const h = harness();
  const original = h.root.innerHTML;
  h.emit("keydown", { key: "Backspace" });
  h.root.innerHTML = "A";
  h.emit("input");
  h.drain();
  assert.equal(h.root.innerHTML, original);
  assert.match(h.status.textContent, /restauró/i);
});

test("selecting almost the entire document and pressing Backspace is blocked", () => {
  const selected = "A".repeat(490);
  const selection = {
    rangeCount: 1, isCollapsed: false,
    getRangeAt() { return { commonAncestorContainer: {}, toString() { return selected; } }; }
  };
  const h = harness("A".repeat(500), selection);
  const event = { key: "Backspace", prevented: false };
  h.emit("keydown", event);
  assert.equal(event.prevented, true);
  assert.match(h.status.textContent, /bloqueó/i);
});

test("replacing the document invalidates a pending deletion snapshot", () => {
  const h = harness();
  h.emit("keydown", { key: "Backspace" });
  h.window.apaResetProtectedDocument();
  h.root.innerHTML = "Nuevo documento";
  h.window.apaCheckDeleteIntegrity();
  assert.equal(h.root.innerHTML, "Nuevo documento");
});
