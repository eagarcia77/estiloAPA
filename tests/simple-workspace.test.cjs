const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class El {
  constructor(id="") {
    this.id=id; this.children=[]; this.listeners={}; this.open=false;
    this.attributes={}; this.classList={add(){}};
    this.textContent=""; this.clicked=0; this.disabled=false;
  }
  append(...nodes) {
    for(const node of nodes){
      if(node.parent) node.parent.children=node.parent.children.filter(x=>x!==node);
      node.parent=this; this.children.push(node);
    }
  }
  prepend(node) {
    if(node.parent) node.parent.children=node.parent.children.filter(x=>x!==node);
    node.parent=this; this.children.unshift(node);
  }
  addEventListener(k,f){(this.listeners[k]??=[]).push(f)}
  click(){this.clicked++;for(const f of this.listeners.click||[])f({})}
  setAttribute(k,v){this.attributes[k]=String(v)}
  getAttribute(k){return this.attributes[k]}
  scrollIntoView(){}
}
function boot(){
  const nodes=new Map();
  for(const id of ["simplePrimaryActions","simpleDocumentOptions","simpleReviewDetails","files","preview","simpleQuickStatus","status","demoBtn","formatBtn","downloadDocxBtn","downloadHtmlBtn"]){nodes.set(id,new El(id))}
  const controls=new El("controls");
  for(const id of ["demoBtn","formatBtn","status"]){controls.append(nodes.get(id))}
  const actions=nodes.get("simplePrimaryActions");
  for(const id of ["downloadDocxBtn","downloadHtmlBtn"])actions.append(nodes.get(id));
  const doc={readyState:"complete",getElementById:id=>nodes.get(id)||null,createElement:()=>new El(),querySelector:()=>null};
  const window={};
  const source=fs.readFileSync(path.join(__dirname,"../simple-workspace.js"),"utf8");
  vm.runInNewContext(source,{document:doc,window});
  const find=id=>actions.children.find(n=>n.id===id);
  return{nodes,controls,actions,window,find};
}
test("workflow exposes one original instance of each command",()=>{
  const h=boot();
  const ids=h.actions.children.map(n=>n.id);
  for(const name of ["simpleOpenBtn","demoBtn","formatBtn","downloadDocxBtn","downloadHtmlBtn","simpleSettingsBtn","simpleReviewBtn"]){
    assert.equal(ids.filter(x=>x===name).length,1,name);
  }
  assert.equal(h.nodes.get("demoBtn"),h.find("demoBtn"));
  assert.equal(h.nodes.get("formatBtn"),h.find("formatBtn"));
  assert.equal(h.nodes.get("downloadDocxBtn"),h.find("downloadDocxBtn"));
});
test("Open File expands document options and triggers the real input",()=>{
  const h=boot();
  h.find("simpleOpenBtn").click();
  assert.equal(h.nodes.get("simpleDocumentOptions").open,true);
  assert.equal(h.nodes.get("files").clicked,1);
});
test("advanced setup and review can be toggled independently",()=>{
  const h=boot();
  h.find("simpleSettingsBtn").click();
  assert.equal(h.nodes.get("simpleDocumentOptions").open,true);
  assert.equal(h.nodes.get("simpleReviewDetails").open,false);
  h.find("simpleReviewBtn").click();
  assert.equal(h.nodes.get("simpleReviewDetails").open,true);
  h.find("simpleSettingsBtn").click();
  assert.equal(h.nodes.get("simpleDocumentOptions").open,false);
});
test("document and original status remain untouched",()=>{
  const h=boot();
  const text="An academic paragraph with APA citations (2026).";
  h.nodes.get("preview").textContent=text;
  h.find("simpleSettingsBtn").click();
  h.find("simpleReviewBtn").click();
  assert.equal(h.nodes.get("preview").textContent,text);
  assert.equal(h.nodes.get("status").parent,h.nodes.get("simpleQuickStatus"));
});
test("the editor appears before setup and review in the document",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  const p=html.indexOf('class="panel preview-panel"');
  const c=html.indexOf('class="panel controls simple-secondary"');
  const r=html.indexOf('class="panel audit simple-secondary"');
  assert.ok(p>=0&&p<c&&c<r);
  assert.match(html, /id="simpleDocumentOptions"/);
  assert.match(html, /id="simpleReviewDetails"/);
});

test("the Word Ribbon defaults to compact mode without removing its controls",()=>{
  const ribbon=fs.readFileSync(path.join(__dirname,"../word-ribbon.js"),"utf8");
  assert.match(ribbon,/shell\.classList\.add\("word-ribbon-collapsed"\)/);
  assert.match(ribbon,/activate\("inicio"\)/);
  assert.match(ribbon,/window\.EstiloAPARibbon/);
});
test("the application retains document input, all format profiles and export actions",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  for(const id of ["files","formatProfile","fontFamily","firstLineIndent","hangingReferences","pageNumbers","formatBtn","downloadDocxBtn","downloadHtmlBtn","reauditBtn","clearBtn","preview"]){
    assert.match(html,new RegExp('id="'+id+'"'),id);
  }
  for(const profile of ["modulo11c","thesis-doctoral","thesis-masters","apa7"]) assert.ok(html.includes('value="'+profile+'"'));
});
