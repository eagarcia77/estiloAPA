const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
function fixture(profile="apa7"){
 const vars={};const root={dataset:{},innerHTML:"<p>Keep my edits</p>",
   style:{setProperty(k,v){vars[k]=v}},
   dispatchEvent(e){this.last=e.type;}};
 const style={};const doc={head:{append(x){this.last=x;}},
   getElementById(k){return k==="preview"?root:k==="formatProfile"?{value:profile}:style[k]||null;},
   createElement(){return {id:"",textContent:""};}};
 const win={};class Event{constructor(type){this.type=type;}}
 vm.runInNewContext(read("word-layout-model.js"),{window:win,document:doc,Event});
 return {m:win.EstiloAPAWordPageLayout,root,vars,doc};
}
function para(){
 const data={};return {dataset:{},innerHTML:"<b>Preserve my paragraph</b>",
   style:{setProperty(k,v,p){data[k]={value:v,priority:p}}},data};
}
test("APA 7 defaults to Letter portrait, one inch",()=>{
 const {m}=fixture();assert.deepEqual(JSON.parse(JSON.stringify(m.getDocxPage())),{
 size:{width:12240,height:15840,orientation:"portrait"},
 margin:{top:1440,right:1440,bottom:1440,left:1440}});
});
test("thesis maintains its initial 1.5 inch left margin",()=>{
 const {m}=fixture("thesis-doctoral");
 assert.equal(m.getDocxPage({thesis:true}).margin.left,2160);
});
test("A4 landscape and custom margins round-trip to DOCX without editing text",()=>{
 const {m,root,vars}=fixture(),before=root.innerHTML;
 assert.equal(m.apply(root,{size:"a4",orientation:"landscape",
 margins:{left:.75,right:1,top:.6,bottom:1.1}}),true);
 assert.equal(root.innerHTML,before);
 assert.equal(vars["--word-page-width"],"11.6929in");
 assert.equal(vars["--word-page-height"],"8.2677in");
 const data=m.getDocxPage();
 assert.equal(data.size.width,11906);assert.equal(data.size.height,16838);
 assert.equal(data.size.orientation,"landscape");
 assert.equal(data.margin.left,1080);assert.equal(data.margin.top,864);
});
test("margins leaving too little text space are rejected safely",()=>{
 const {m,root}=fixture(),before=root.innerHTML;
 assert.equal(m.apply(root,{size:"a4",orientation:"landscape",
 margins:{left:2.5,right:2.5,top:2.5,bottom:2.5}}),false);
 assert.equal(root.innerHTML,before);
 assert.equal(root.dataset.wordPageCustomized,undefined);
});
test("reset returns to APA 7 defaults",()=>{
 const {m,root}=fixture();
 m.apply(root,{size:"legal",orientation:"portrait",
 margins:{left:.5,right:.5,top:.5,bottom:.5}});
 m.reset(root);assert.equal(m.read(root).size,"letter");
 assert.equal(root.dataset.wordPageCustomized,"false");
});
test("paragraph spacing and page flow survive as Word properties",()=>{
 const {m}=fixture(),p=para(),before=p.innerHTML;
 m.setParagraph(p,{before:12,after:6,keepNext:true,keepLines:true});
 const out={spacing:{line:480}};
 m.decorateParagraph(p,out);
 assert.equal(out.spacing.before,240);assert.equal(out.spacing.after,120);
 assert.equal(out.spacing.line,480);
 assert.equal(out.keepNext,true);assert.equal(out.keepLines,true);
 assert.equal(p.data["margin-top"].value,"12pt");
 assert.equal(p.innerHTML,before);
});
test("custom left, right and dotted-leader tab stops map to twips",()=>{
 const {m}=fixture(),p=para();
 m.setTabs(p,[{position:4,type:"right",leader:"dot"},
 {position:1.5,type:"left",leader:"none"},
 {position:4,type:"right",leader:"none"}]);
 const out=m.decorateParagraph(p,{});
 assert.equal(out.tabStops.length,2);
 assert.equal(out.tabStops[0].position,2160);
 assert.equal(out.tabStops[1].position,5760);
 assert.equal(out.tabStops[1].type,"right");
 assert.equal(out.tabStops[1].leader,"dot");
 assert.equal(m.parseTabs("invalid").length,0);
 assert.equal(p.innerHTML,"<b>Preserve my paragraph</b>");
});
test("all DOCX routes accept custom page and paragraph layout",()=>{
 for(const p of ["app.js","docx-enhance.js","docx-figure-export-v2.js","thesis-docx.js"]){
  const s=read(p);
  assert.match(s,/EstiloAPAWordPageLayout\?\.getDocxPage\(/,p);
  assert.match(s,/EstiloAPAWordPageLayout\?\.decorateParagraph\(element, options\)/,p);
 }
});
test("both HTML exporters and drafts keep explicit page layout",()=>{
 for(const p of ["app.js","thesis-html.js"])assert.match(read(p),/const pageCss = paper/);
 const local=read("word-local-drafts.js");
 assert.match(local,/version: 1, html, savedAt: when, pageSettings/);
 assert.match(local,/if \(draft.pageSettings\) pageLayout.apply/);
});
test("Word Layout tab and controls stay outside editor content",()=>{
 const ribbon=read("word-ribbon.js"),ui=read("word-page-layout.js"),html=read("index.html");
 assert.match(ribbon,/\["pagina", "Layout"\]/);
 assert.match(ui,/word-ribbon-panel-pagina/);
 assert.match(ui,/Tab Stops/);
 assert.match(ui,/Reset APA 7 Page/);
 assert.doesNotMatch(ui,/preview\(\)\.addEventListener\("input"/);
 assert.match(html,/word-layout-model\.js/);
 assert.match(html,/word-page-layout\.js/);
 assert.match(html,/word-page-layout\.css/);
});
