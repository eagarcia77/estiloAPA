// Run: node --test tests/responsive-workspace.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const ribbon = fs.readFileSync(path.join(root, "word-ribbon.js"), "utf8");

test("workspace uses full available width", () => {
  assert.match(css, /\.layout\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;/);
  assert.match(css, /\.apa-paper\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;/);
});

test("editor dimensions use responsive padding and prevent horizontal overflow", () => {
  assert.match(css, /\.paper-wrap\s*\{[\s\S]*?overflow-x:\s*auto;/);
  assert.match(css, /\.apa-paper\s*\{[\s\S]*?padding:\s*clamp\(/);
  assert.match(css, /@media \(max-width:\s*480px\)/);
  assert.match(css, /@media \(max-width:\s*820px\)/);
});

test("Page View constrains document to US Letter width", () => {
  assert.match(css, /body\.apa-page-view \.apa-paper\s*\{[\s\S]*?width:\s*min\(8\.5in, 100%\)/);
  assert.match(ribbon, /ribbonButton\("Page View"/);
  assert.match(ribbon, /classList\.toggle\("apa-page-view"\)/);
  assert.match(ribbon, /"Full Width"/);
});

test("print rules always retain physical letter-size page", () => {
  assert.match(css, /@media print\s*\{[\s\S]*?width:\s*8\.5in !important;/);
  assert.match(css, /@media print\s*\{[\s\S]*?padding:\s*1in !important;/);
  assert.match(css, /@media print\s*\{[\s\S]*?zoom:\s*1 !important;/);
});

test("default layout has no page-view mode preselected", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, /<body[^>]*class=["'][^"']*apa-page-view/);
});
