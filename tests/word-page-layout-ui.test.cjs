const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
class Element{
 constructor(tag="div") {
  this.tagName=tag.toUpperCase();this.children=[];this.listeners={};
  this.nodeType=1;this.dataset={};this.attrs={};this.value="";
  this.innerHTML="";this.textContent="";this.style={setProperty(){}};
 }
 append(...children){this.children.push(...children);}
 addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
 dispatchEvent(e){for(const fn of this.listeners[e.type]||[])fn(e);}
 emit(k){this.dispatchEvent({type:k});}
 setAttribute(k,v){this.attrs[k]=String(v);}
}
function setup(){
 const root=new Element("article");
 root.innerHTML='<p data-apa-editor-indent="none">Keep user formatting</p>';
 const p=new Element("p"),status=new Element(),layout=new Element();
 const control=new Element("select");control.value="apa7";
 const map={preview:root,formatProfile:control,status,
  "word-ribbon-panel-pagina":layout};
 const head=new Element("head");
 const document={
  readyState:"complete",head,
  createElement(tag){return new Element(tag);},
  getElementById(id){return map[id]||head.children.find(n=>n.id===id)||null;},
  addEventListener(){}
 };
 let inputs=0,tabs=0;
 root.addEventListener("input",()=>inputs++);
 const window={EstiloAPAEditorSelection:{
   selectedBlocks:()=>[p],restoreEditorSelection(){}
 },EstiloAPAWordRulers:{update(){} } };
 document.execCommand=(cmd,ui,val)=>{if(cmd==="insertText"&&val==="\t"){tabs++;return true;}return false;};
 class Event{constructor(type){this.type=type;}}
 const context=vm.createContext({document,window,Event});
 vm.runInContext(read("word-layout-model.js"),context);
 vm.runInContext(read("word-page-layout.js"),context);
 return {root,p,status,layout,window,document,
  get inputs(){return inputs;},get tabs(){return tabs;}};
}
test("Layout Ribbon initializes three groups without touching user text",()=>{
 const h=setup();assert.equal(h.layout.children.length,3);
 assert.equal(h.layout.children[0].children[0].textContent,"Page Setup");
 assert.equal(h.layout.children[1].children[0].textContent,"Paragraph Spacing");
 assert.equal(h.layout.children[2].children[0].textContent,"Tab Stops");
 assert.equal(h.root.innerHTML,'<p data-apa-editor-indent="none">Keep user formatting</p>');
 assert.equal(h.root.dataset.wordPageCustomized,"false");
});
test("page controls change landscape settings and keep content unchanged",()=>{
 const h=setup(),page=h.layout.children[0],before=h.root.innerHTML;
 const orientation=page.children[2];orientation.value="landscape";orientation.emit("change");
 assert.equal(h.window.EstiloAPAWordPageLayout.read(h.root).orientation,"landscape");
 assert.equal(h.root.dataset.wordPageCustomized,"true");
 assert.equal(h.window.EstiloAPAWordPageLayout.getDocxPage().size.orientation,"landscape");
 assert.equal(h.root.innerHTML,before);
});
test("paragraph and tab controls only edit the selected paragraph",()=>{
 const h=setup();
 const spacing=h.layout.children[1],tabs=h.layout.children[2];
 const before=spacing.children[1];before.value="12";before.emit("change");
 assert.equal(h.p.dataset.wordSpacingBefore,"12");
 const tabPosition=tabs.children[1].children[1];tabPosition.value="2.5";
 const align=tabs.children[2];align.value="right";
 const leader=tabs.children[3];leader.value="dot";
 tabs.children[4].emit("click");
 assert.equal(JSON.parse(h.p.dataset.wordTabStops)[0].position,2.5);
 assert.equal(JSON.parse(h.p.dataset.wordTabStops)[0].leader,"dot");
 tabs.children[6].emit("click");
 assert.equal(h.tabs,1);
 assert.equal(h.root.innerHTML,'<p data-apa-editor-indent="none">Keep user formatting</p>');
});
test("document import resets page settings, not the current paragraph content",()=>{
 const h=setup();
 h.window.EstiloAPAWordLayoutControls.updatePage({size:"legal"});
 assert.equal(h.window.EstiloAPAWordPageLayout.read(h.root).size,"legal");
 const before=h.root.innerHTML;
 h.root.emit("apa-document-loaded");
 assert.equal(h.window.EstiloAPAWordPageLayout.read(h.root).size,"letter");
 assert.equal(h.root.innerHTML,before);
});
