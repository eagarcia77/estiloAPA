// Run: node --test tests/word-command-center.test.cjs
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../word-command-center.js"),"utf8");

class Element {
  constructor(tag="div",doc=null){
    this.tagName=tag.toUpperCase();this.doc=doc;
    this.children=[];this.childNodes=this.children;this.listeners={};
    this.attrs={};this.style={};this.hidden=false;
    this.textContent="";this.value="";this.disabled=false;
    this.isConnected=true;this.offsetWidth=280;this.offsetHeight=45;
    this.dataset={};this.id="";this.className="";
  }
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
  prepend(node){node.parentNode=this;this.children.unshift(node);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]||null;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  emit(type,event={}){for(const fn of this.listeners[type]||[])fn(event);}
  click(){this.clicks=(this.clicks||0)+1;this.emit("click",{target:this});}
  focus(){if(this.doc)this.doc.activeElement=this;}
  contains(other){return other===this || this.children.some(node=>node.contains?.(other));}
  scrollIntoView(){}
  querySelectorAll(selector) {
    const found=[];
    const visit=(node)=>{
      for(const child of node.children){
        if(selector==="button"&&child.tagName==="BUTTON")found.push(child);
        visit(child);
      }
    };
    visit(this);return found;
  }
}
function setup() {
  const elements=new Map(),selectorMap=new Map(),listeners={};
  const document={
    readyState:"complete",activeElement:null,hasFocus:()=>true,
    body:new Element("body"),
    createElement(tag){return new Element(tag,document);},
    getElementById(id){return elements.get(id)||null;},
    querySelector(selector){return selectorMap.get(selector)||null;},
    addEventListener(type,fn){(listeners[type]||=[]).push(fn);},
    emit(type,event={}){for(const fn of listeners[type]||[])fn(event);}
  };
  const root=new Element("article",document);
  root.id="preview";
  root.textContent="Research paragraph";
  root.querySelector=()=>null;
  const actions=new Element("div",document);
  const open=new Element("button",document);
  const download=new Element("button",document);
  const noIndent=new Element("button",document);
  elements.set("preview",root);
  elements.set("wordRibbonActions",actions);
  elements.set("downloadDocxBtn",download);
  selectorMap.set("#simpleOpenBtn",open);
  selectorMap.set('#apaEditorShell button[data-indent="none"]',noIndent);
  selectorMap.set("#downloadDocxBtn",download);
  const printed=[];
  let selectionSaved=0,selectionRestored=0;
  let range=null,selectedCount=0;
  const selection={
    get rangeCount(){return range?1:0;},
    get isCollapsed(){return !range;},
    getRangeAt(){return range;},
    removeAllRanges(){selectedCount++;},
    addRange(next){range=next;selectedCount++;}
  };
  const frames=[];
  const ribbonTabs=[];
  const window={
    getSelection(){return selection;},
    requestAnimationFrame(fn){frames.push(fn);return frames.length;},
    setTimeout(fn){frames.push(fn);return frames.length;},
    innerWidth:1000,innerHeight:700,
    addEventListener(){},
    print(){printed.push("print");},
    EstiloAPARibbon:{activate(tab){ribbonTabs.push(tab);}},
    EstiloAPAWordTools:{undo(){return true;},redo(){return true;},
      find(){return true;},replace(){return true;},selectAll(){return true;}},
    EstiloAPAEditorSelection:{
      saveEditorSelection(){selectionSaved++;},
      restoreEditorSelection(){selectionRestored++;}
    }
  };
  const ctx=vm.createContext({document,window});
  vm.runInContext(source,ctx);
  return {
    document,window,root,actions,open,download,noIndent,printed,ribbonTabs,
    elements,selectorMap,frames,
    get saved(){return selectionSaved;},
    get restored(){return selectionRestored;},
    get selectedCount(){return selectedCount;},
    setRange(next){range=next;},
    palette(){return document.body.children.find(e=>e.id==="wordCommandDialog");},
    contextual(){return document.body.children.find(e=>e.id==="wordContextToolbar");},
    launcher(){return actions.children.find(e=>e.id==="wordCommandLauncher");},
    searchInput(){return this.palette().children[0].children[1];},
    resultList(){return this.palette().children[0].children[2];},
    flush(){while(frames.length)frames.shift()();}
  };
}

test("Command Search button and dialog initialize outside editor without changing the document",()=>{
  const h=setup(),before=h.root.textContent;
  assert.ok(h.launcher());assert.ok(h.palette());assert.ok(h.contextual());
  assert.equal(h.palette().hidden,true);
  assert.equal(h.contextual().hidden,true);
  assert.equal(h.root.textContent,before);
  assert.equal(h.launcher().getAttribute("aria-haspopup"),"dialog");
});
test("search finds existing commands without cloning original editor handlers",()=>{
  const h=setup();
  const matched=h.window.EstiloAPACommandCenter.search("indent");
  assert.ok(matched.some(x=>x.id==="indent-none"));
  assert.ok(matched.some(x=>x.id==="indent-first"));
  assert.ok(h.window.EstiloAPACommandCenter.search("page").some(x=>x.id==="layout"));
  assert.equal(h.open.clicks,undefined);
  assert.equal(h.root.textContent,"Research paragraph");
});
test("clicking a search result dispatches the original Word command",()=>{
  const h=setup();
  h.launcher().click();
  assert.equal(h.palette().hidden,false);
  const input=h.searchInput();
  input.value="no indent";input.emit("input");
  const row=h.resultList().children.find(node=>node.textContent!== "No matching commands. Try 'indent', 'page', 'find' or 'save'.");
  assert.ok(row);
  row.click();
  assert.equal(h.noIndent.clicks,1);
  assert.equal(h.palette().hidden,true);
});
test("Ctrl+Shift+P and Alt+Q open the same accessible Command Search",()=>{
  const h=setup(),evt=(key,altKey,ctrlKey,shiftKey)=>({
    key,altKey,ctrlKey,metaKey:false,shiftKey,
    preventDefault(){this.prevented=true;},
    defaultPrevented:false
  });
  const a=evt("p",false,true,true);
  h.document.emit("keydown",a);
  assert.equal(a.prevented,true);
  assert.equal(h.palette().hidden,false);
  const b=evt("Escape",false,false,false);
  h.document.emit("keydown",b);
  assert.equal(h.palette().hidden,true);
  const c=evt("q",true,false,false);
  h.document.emit("keydown",c);
  assert.equal(h.palette().hidden,false);
});
test("commands can activate Layout tab and download without changing editor text",()=>{
  const h=setup(),before=h.root.textContent;
  assert.equal(h.window.EstiloAPACommandCenter.execute("layout"),true);
  assert.deepEqual(h.ribbonTabs,["pagina"]);
  assert.equal(h.window.EstiloAPACommandCenter.execute("export"),true);
  assert.equal(h.download.clicks,1);
  assert.equal(h.root.textContent,before);
});
test("command menu remembers and restores selected editor range",()=>{
  const h=setup(),range={
    commonAncestorContainer:h.root,
    getBoundingClientRect(){return {left:210,top:150,right:320,bottom:165,width:110,height:15};},
    cloneRange(){return this;}
  };
  h.setRange(range);
  h.launcher().click();
  assert.equal(h.saved,1);
  assert.equal(h.window.EstiloAPACommandCenter.execute("indent-none"),true);
  assert.equal(h.noIndent.clicks,1);
  assert.ok(h.restored>=1);
  assert.ok(h.selectedCount>=2);
});
test("contextual formatting appears only for selected text, not when typing",()=>{
  const h=setup(),range={
    commonAncestorContainer:h.root,
    getBoundingClientRect(){return {left:210,top:150,right:320,bottom:165,width:110,height:15};},
    cloneRange(){return this;}
  };
  h.setRange(range);h.document.emit("selectionchange");h.flush();
  assert.equal(h.contextual().hidden,false);
  assert.equal(h.contextual().children.length,5);
  h.root.emit("input");
  assert.equal(h.contextual().hidden,true);
});
test("Keyboard Shortcuts help opens on demand and closes without editing",()=>{
  const h=setup();
  h.window.EstiloAPACommandCenter.open();
  assert.equal(h.window.EstiloAPACommandCenter.execute("shortcuts"),true);
  const help=h.palette().children[0].children[3];
  assert.equal(help.hidden,false);
  assert.equal(h.resultList().hidden,true);
  assert.equal(h.root.textContent,"Research paragraph");
});
test("search is disabled for export when the original export button is disabled",()=>{
  const h=setup();
  h.download.disabled=true;
  assert.equal(h.window.EstiloAPACommandCenter.search("download word").some(x=>x.id==="export"),false);
});
test("command search styles remain responsive and are excluded from print",()=>{
  const css=fs.readFileSync(path.join(__dirname,"../word-command-center.css"),"utf8");
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  assert.match(css,/word-command-backdrop\[hidden\]/);
  assert.match(css,/@media\(pointer:coarse\)/);
  assert.match(css,/@media print/);
  assert.match(html,/src="word-command-center\.js"/);
  assert.match(html,/href="word-command-center\.css"/);
});
