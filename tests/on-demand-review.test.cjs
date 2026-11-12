const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = filename => fs.readFileSync(path.join(root, filename), "utf8");

function makeSignal() {
  const listeners = {};
  return {
    open: false,
    addEventListener(event, fn) { (listeners[event] ||= []).push(fn); },
    fire(event) { for (const fn of listeners[event] || []) fn(); },
  };
}

function auditHarness(filename, initialize, renderName, styleName) {
  const review = makeSignal();
  const preview = makeSignal();
  const runAudit = makeSignal();
  preview.textContent = "Manually edited text must remain unchanged.";
  const document = {
    readyState: "loading",
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#simpleReviewDetails") return review;
      if (selector === "#preview") return preview;
      if (selector === "#reauditBtn") return runAudit;
      return null;
    },
  };
  const window = { calls: 0 };
  const context = vm.createContext({ document, window });
  vm.runInContext(
    read(filename) + "\n" +
    styleName + " = () => {};\n" +
    renderName + " = () => { window.calls += 1; };\n" +
    initialize + "();",
    context
  );
  return { review, preview, runAudit, window };
}

for (const [filename, init, render, style] of [
  ["enhancements.js", "initEnhancements", "renderAdvancedAudit", "ensureStyles"],
  ["reference-audit-v30.js", "initializeReferenceAudit", "renderReferenceFormattingAudit", "ensureReferenceAuditStyles"],
]) {
  test(filename + " never audits background typing when review is closed", () => {
    const h = auditHarness(filename, init, render, style);
    assert.equal(h.window.calls, 0);
    h.preview.fire("input");
    h.preview.fire("apa-document-loaded");
    h.runAudit.fire("click");
    assert.equal(h.window.calls, 0);
    assert.equal(h.preview.textContent, "Manually edited text must remain unchanged.");
  });

  test(filename + " refreshes when requested and stops again after Close Review", () => {
    const h = auditHarness(filename, init, render, style);
    h.review.open = true;
    h.review.fire("toggle");
    assert.equal(h.window.calls, 1);
    h.preview.fire("input");
    assert.equal(h.window.calls, 1);
    h.runAudit.fire("click");
    assert.equal(h.window.calls, 2);
    h.review.open = false;
    h.review.fire("toggle");
    h.preview.fire("apa-document-loaded");
    h.runAudit.fire("click");
    assert.equal(h.window.calls, 2);
    h.review.open = true;
    h.review.fire("toggle");
    assert.equal(h.window.calls, 3);
  });
}

test("basic APA audit is no longer bound to each editor input", () => {
  const app = read("app.js");
  assert.doesNotMatch(app, /els\.preview\.addEventListener\("input", debounce\(\(\) => \{\s*if \(hasFormattedContent\(\)\) runAudit\(false\)/);
  assert.match(app, /reviewDetails\?\.addEventListener\("toggle"/);
  assert.match(app, /function downloadAudit\(\) \{[\s\S]*?runAudit\(false\)/);
});

test("desktop drawer reserves space for document instead of covering it", () => {
  const css = read("simple-workspace.css");
  assert.match(css, /body\.simple-review-open:not\(\.apa-focus-mode\) \.preview-panel/);
  assert.match(css, /width:calc\(100% - min\(430px, 40vw\)\)/);
});
