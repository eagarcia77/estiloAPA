// Run with: node --test tests/no-indent-persistence.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname,"..",name),"utf8");

function harness() {
  const styles = new Map();
  const block = {
    nodeType: 1, dataset: { apaEditorIndent: "none" },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {
      setProperty(name,value,priority="") { styles.set(name,{value,priority}); },
      getPropertyValue(name) { return styles.get(name)?.value || ""; },
      getPropertyPriority(name) { return styles.get(name)?.priority || ""; },
      removeProperty(name) { styles.delete(name); },
      set textIndent(value) { styles.set("text-indent",{value,priority:""}); },
      get textIndent() { return styles.get("text-indent")?.value || ""; },
      set paddingLeft(value) { styles.set("padding-left",{value,priority:""}); },
      get paddingLeft() { return styles.get("padding-left")?.value || ""; },
    },
    matches() { return true; },
    querySelectorAll() { return []; }
  };
  const root = { nodeType:1, dataset:{}, contains(node){return node===block}, matches(){return false}, querySelectorAll(){return [block]} };
  const document = { readyState:"loading", addEventListener() {}, querySelector(selector){return selector==="#preview"?root:null} };
  let observeCallback;
  class MutationObserver { constructor(callback){observeCallback=callback} observe(){} }
  const ctx=vm.createContext({document,window:{getSelection(){return null}},Node:{ELEMENT_NODE:1},MutationObserver, Event:class{}});
  vm.runInContext(read("apa-editor-v30.js"),ctx);
  vm.runInContext("initializeIndentPersistence()",ctx);
  return {ctx,styles,block,mutate(){observeCallback([{type:"attributes",target:block}])}};
}
test("No Indent remains zero after a delayed style replacement", () => {
  const h=harness();
  h.mutate();
  assert.equal(h.styles.get("text-indent").value,"0");
  assert.equal(h.styles.get("padding-left").value,"0");
  h.block.style.textIndent=".5in";
  h.mutate();
  assert.equal(h.styles.get("text-indent").value,"0");
  assert.equal(h.styles.get("text-indent").priority,"important");
});
test("No Indent remains zero after 1250ms formatter-style rewrite", () => {
  const h=harness();
  h.mutate();
  // Simulate delayed APA reference routine overwriting inline declarations.
  h.block.style.textIndent="-.5in";
  h.block.style.paddingLeft=".5in";
  h.mutate();
  assert.equal(h.styles.get("text-indent").value,"0");
  assert.equal(h.styles.get("padding-left").value,"0");
});
test("manual First Line and Hanging Indent also persist after rewrites", () => {
  const h=harness();
  for(const [kind,expectedText,expectedLeft] of [["first",".5in","0"],["hanging","-.5in",".5in"]]) {
    h.block.dataset.apaEditorIndent=kind;
    h.block.style.textIndent="0";
    h.block.style.paddingLeft="0";
    h.mutate();
    assert.equal(h.styles.get("text-indent").value,expectedText);
    assert.equal(h.styles.get("padding-left").value,expectedLeft);
  }
});
test("reference formatter does not reset explicit manual indent", () => {
  const source=read("reference-format-v345.js");
  assert.match(source,/const manualIndent = \["none", "first", "hanging"\]/);
  assert.match(source,/if \(!manualIndent\) node\.dataset\.apaEditorIndent = "hanging";/);
  assert.match(source,/manualIndent === "none"/);
  assert.match(source,/node\.style\.setProperty\("text-indent", "0", "important"\)/);
});
test("indent protection observes style, class and user intent changes", () => {
  const source=read("apa-editor-v30.js");
  assert.match(source,/attributeFilter: \["style", "class", "data-apa-editor-indent"\]/);
});
