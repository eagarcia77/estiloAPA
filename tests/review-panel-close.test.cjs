const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("advanced citation and reference audit panels mount inside review details", () => {
  for (const file of ["enhancements.js", "reference-audit-v30.js"]) {
    const s = read(file);
    assert.match(s, /document\.querySelector\("section\.audit \.simple-details-inner"\)/, file);
    assert.match(s, /audit\.append\(panel\)/, file);
  }
});
test("a visible Close Review action dismisses the panel", () => {
  const s = read("simple-workspace.js");
  assert.match(s, /button\("simpleCloseReviewBtn", "Close Review"/);
  assert.match(s, /review\.open = false/);
  assert.match(s, /reviewInner\.prepend\(closeReview\)/);
});
test("Escape and outside clicks dismiss review without touching editable content", () => {
  const s = read("simple-workspace.js");
  assert.match(s, /document\.addEventListener\("keydown", event =>/);
  assert.match(s, /document\.addEventListener\("pointerdown", event =>/);
  assert.match(s, /review\.open && !review\.contains\(target\)/);
  assert.doesNotMatch(s, /preview\.innerHTML\s*=/);
  assert.doesNotMatch(s, /preview\.replaceChildren\(/);
});
test("closed review never leaves advanced results visibly outside its details", () => {
  const css = read("simple-workspace.css");
  assert.match(css, /section\.audit > \.advanced-audit,[\s\S]*?section\.audit > \.reference-format-audit\s*\{\s*display:none !important/);
  assert.match(css, /#simpleReviewDetails:not\(\[open\]\) \.simple-details-inner\s*\{\s*display:none !important/);
  const html = read("index.html");
  assert.match(html, /<details id="simpleReviewDetails">/);
});
