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
    readyState: "loading", activeElement: root,
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
  // Initialize registered DOMContentLoaded listeners separately by evaluating with readyState "complete".
  return { root, status, window, document, listeners, emit, drain };
}

function live(initial = "A".repeat(500), selection = null) {
  const h = harness(initial, selection);
  // Dispatch events are installed only on DOMContentLoaded. The standalone
  // simulation re-evaluates with readyState complete to register them.
  h.document.readyState = "complete";
  // Build a fresh harness with a document that starts complete instead.
  return h;
}

test("code exposes a catastrophic deletion check", () => {
  const h = harness();
  assert.equal(typeof h.window.apaCheckDeleteIntegrity, "function");
});
