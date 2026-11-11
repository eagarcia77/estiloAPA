// Run locally: node --test tests/edit-stability.test.cjs
// Regression tests for the v3.4.8 editing guard (no browser dependencies).
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function harness() {
  let nextId = 0;
  const timers = new Map();
  const calls = [];
  const preview = {
    dataset: { apaUserEditing: "false" },
    classList: { toggle() {} },
    contains() { return false; },
    addEventListener() {},
    dispatchEvent() {},
  };
  const document = {
    readyState: "loading",
    activeElement: null,
    querySelector(selector) { return selector === "#preview" ? preview : null; },
    addEventListener() {},
  };
  const window = {
    setTimeout(callback) { const id = ++nextId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    getSelection() { return null; },
  };
  const source = fs.readFileSync(path.join(__dirname, "../edit-stability-v348.js"), "utf8");
  vm.runInNewContext(source, {
    window, document, console,
    Node: { ELEMENT_NODE: 1 },
    CustomEvent: class {},
  }, { filename: "edit-stability-v348.js" });
  function fire(id) {
    const task = timers.get(id);
    assert.ok(task, `Timer ${id} must exist`);
    timers.delete(id);
    task();
  }
  // The recognizable function name intentionally exercises legacy timer interception.
  function schedule(label) {
    return window.setTimeout(function normalizeMedia() { calls.push(label); }, 10);
  }
  return { window, preview, calls, fire, schedule };
}

test("defers while editing and flushes after editing", () => {
  const h = harness();
  h.preview.dataset.apaUserEditing = "true";
  h.fire(h.schedule("first"));
  assert.deepEqual(h.calls, []);
  h.preview.dataset.apaUserEditing = "false";
  h.window.apaFlushPendingNormalizations();
  assert.deepEqual(h.calls, ["first"]);
});

test("clearTimeout cancels normalizations already queued", () => {
  const h = harness();
  h.preview.dataset.apaUserEditing = "true";
  const id = h.schedule("canceled");
  h.fire(id);
  h.window.clearTimeout(id);
  h.preview.dataset.apaUserEditing = "false";
  h.window.apaFlushPendingNormalizations();
  assert.deepEqual(h.calls, []);
});

test("replacing the document discards queued callbacks", () => {
  const h = harness();
  h.preview.dataset.apaUserEditing = "true";
  h.fire(h.schedule("obsolete"));
  h.window.apaResetProtectedDocument();
  h.window.apaFlushPendingNormalizations();
  assert.deepEqual(h.calls, []);
});

test("replacing the document invalidates scheduled callbacks", () => {
  const h = harness();
  const id = h.schedule("obsolete");
  h.window.apaResetProtectedDocument();
  h.fire(id);
  assert.deepEqual(h.calls, []);
});

test("normalization of current document still executes", () => {
  const h = harness();
  h.fire(h.schedule("current"));
  assert.deepEqual(h.calls, ["current"]);
});
