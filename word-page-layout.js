// Word-style Page Layout & Paragraph Ribbon controls.
// Commands apply only on explicit user interaction, never during typing.
(function () {
  "use strict";
  const model=()=>window.EstiloAPAWordPageLayout;
  const preview=()=>document.getElementById("preview");
  const profile=()=>document.getElementById("formatProfile")?.value || "apa7";
  const selected=()=>window.EstiloAPAEditorSelection?.selectedBlocks?.() || [];
  let size,orientation,preset,marginFields={},before,after,tabPosition,tabAlign,tabLeader,tabReadout;
  function notify(message,error=false) {
    const el=document.getElementById("status");
    if(el) {el.textContent=message;el.className=error?"status error":"status success";}
  }
  function btn(text,handler) {
    const b=document.createElement("button");
    b.type="button"; b.className="word-ribbon-action";
    b.textContent=text;
    b.addEventListener("click",handler);
    return b;
  }
  function select(label,values,handler) {
    const el=document.createElement("select");
    el.setAttribute("aria-label",label);
    for(const [value,text] of values) {
      const option=document.createElement("option");
      option.value=String(value);option.textContent=text;
      el.append(option);
    }
    el.addEventListener("change",handler);
    return el;
  }
  function group(name) {
    const el=document.createElement("div");
    el.className="word-ribbon-group word-layout-group";
    const caption=document.createElement("span");
    caption.className="word-ribbon-group-label";
    caption.textContent=name;
    el.append(caption);
    return el;
  }
  function textField(label,min,max,step,value,handler) {
    const field=document.createElement("label");
    field.className="word-layout-field";
    const caption=document.createElement("span");caption.textContent=label;
    const input=document.createElement("input");
    input.type="number";input.min=String(min);input.max=String(max);
    input.step=String(step);input.value=String(value);
    input.setAttribute("aria-label",label);
    input.addEventListener("change",handler);
    field.append(caption,input);
    return {field,input};
  }
  function sync() {
    const state=model()?.read(preview(),profile());
    if(!state) return;
    size.value=state.size;orientation.value=state.orientation;
    const presets=model().MARGINS;
    const entry=Object.entries(presets).find(([,values])=>
      ["top","right","bottom","left"].every(k=>values[k]===state.margins[k]));
    preset.value=entry?.[0] || "custom";
    for(const k of Object.keys(marginFields)) marginFields[k].value=String(state.margins[k]);
  }
  function updatePage(patch) {
    const current=model()?.read(preview(),profile());
    if(!current) return;
    const next={...current,...patch,margins:{...current.margins,...(patch.margins||{})}};
    if(!model().apply(preview(),next,true)) {
      notify("Margins leave insufficient space for text. Adjust the page settings.",true);
      sync();return;
    }
    sync();
    window.EstiloAPAWordRulers?.update?.();
    notify("Page Layout updated. Your document text was not changed.");
  }
  function useBlocks(callback,message) {
    const blocks=selected();
    if(!blocks.length) {
      notify("Place the cursor or select paragraphs in Document Editor first.",true);
      return;
    }
    for(const block of blocks) callback(block);
    preview().dispatchEvent(new Event("input",{bubbles:true}));
    window.EstiloAPAWordRulers?.update?.();
    if(message)notify(message);
  }
  function updateParagraph(patch) {
    useBlocks(block=>model().setParagraph(block,patch),
      "Paragraph settings applied to the selected text.");
  }
  function refreshTabs(block) {
    const chosen=block || selected()[0];
    const data=model()?.parseTabs(chosen?.dataset?.wordTabStops || "");
    if(tabReadout)tabReadout.textContent=data.length ?
      data.map(x=>x.position+" in "+x.type+(x.leader==="dot"?" dotted":"")).join(" · ") :
      "No custom tab stops";
  }
  function addTab() {
    const position=Number(tabPosition.value);
    if(!Number.isFinite(position)||position<.25||position>10) {
      notify("Tab positions must be between 0.25 and 10 inches.",true);return;
    }
    useBlocks(block=>{
      const existing=model().parseTabs(block.dataset.wordTabStops);
      const next=existing.filter(x=>Math.abs(x.position-position)>.01);
      next.push({position,type:tabAlign.value,leader:tabLeader.value});
      model().setTabs(block,next);
    },"Tab stop added for DOCX export.");
    refreshTabs();
  }
  function clearTabs() {
    useBlocks(block=>model().setTabs(block,[]),"Custom tab stops cleared.");
    refreshTabs();
  }
  function insertTab() {
    if(!selected().length) {
      notify("Place the cursor inside Document Editor first.",true);return;
    }
    window.EstiloAPAEditorSelection?.restoreEditorSelection?.();
    // Keep the ordinary Tab key available for keyboard-accessible navigation.
    const ok=document.execCommand?.("insertText",false,"\t");
    if(ok)preview().dispatchEvent(new Event("input",{bubbles:true}));
    else notify("This browser could not insert a tab. Use the desktop DOCX editor.",true);
  }
  function init() {
    const layoutPanel=document.getElementById("word-ribbon-panel-pagina");
    if(!layoutPanel || !preview() || !model() ||
        document.getElementById("wordPageLayoutControls")) return;
    const page=group("Page Setup");
    page.id="wordPageLayoutControls";
    size=select("Paper Size",[
      ["letter","US Letter 8.5 × 11"],
      ["a4","A4 210 × 297 mm"],
      ["legal","US Legal 8.5 × 14"]
    ],()=>updatePage({size:size.value}));
    orientation=select("Page Orientation",[
      ["portrait","Portrait"],["landscape","Landscape"]
    ],()=>updatePage({orientation:orientation.value}));
    preset=select("Margin Preset",[
      ["apa","APA 7 · 1 in"],
      ["thesis","Thesis · 1.5 in left"],
      ["narrow","Narrow · 0.5 in"],
      ["moderate","Moderate · 0.75 in"],
      ["wide","Wide · 1.25 in"],
      ["custom","Custom Margins"]
    ],()=>{
      if(preset.value==="custom") {
        marginDetails.open=true;return;
      }
      updatePage({margins:model().MARGINS[preset.value]});
    });
    const marginDetails=document.createElement("details");
    marginDetails.className="word-layout-margins";
    const summary=document.createElement("summary");
    summary.textContent="Custom Margins";
    const custom=document.createElement("div");
    custom.className="word-layout-custom";
    for(const key of ["top","right","bottom","left"]) {
      const field=textField(key[0].toUpperCase()+key.slice(1)+" (in)",.25,2.5,.05,1,()=>{
        const margins={};
        for(const k of Object.keys(marginFields))margins[k]=Number(marginFields[k].value);
        updatePage({margins});
      });
      marginFields[key]=field.input;
      custom.append(field.field);
    }
    marginDetails.append(summary,custom);
    page.append(size,orientation,preset,marginDetails,
      btn("Reset APA 7 Page",()=>{
        model().reset(preview());sync();
        window.EstiloAPAWordRulers?.update?.();
        notify("APA 7 page defaults restored.");
      }));
    layoutPanel.append(page);

    const paragraph=group("Paragraph Spacing");
    before=select("Space Before",[
      ["0","Before 0 pt"],["6","Before 6 pt"],["12","Before 12 pt"],
      ["18","Before 18 pt"],["24","Before 24 pt"]
    ],()=>updateParagraph({before:Number(before.value)}));
    after=select("Space After",[
      ["0","After 0 pt"],["6","After 6 pt"],["12","After 12 pt"],
      ["18","After 18 pt"],["24","After 24 pt"]
    ],()=>updateParagraph({after:Number(after.value)}));
    const next=btn("Keep with Next",()=>updateParagraph({keepNext:true}));
    const together=btn("Keep Lines Together",()=>updateParagraph({keepLines:true}));
    const clearKeep=btn("Allow Page Breaks",()=>updateParagraph({keepNext:false,keepLines:false}));
    paragraph.append(before,after,next,together,clearKeep);
    layoutPanel.append(paragraph);

    const tabGroup=group("Tab Stops");
    const tabField=textField("Tab Position (in)",.25,10,.25,1.5,()=>{});
    tabPosition=tabField.input;
    tabAlign=select("Tab Alignment",[
      ["left","Left Tab"],["center","Center Tab"],["right","Right Tab"]
    ],()=>{});
    tabLeader=select("Tab Leader",[
      ["none","No Leader"],["dot","Dotted Leader"]
    ],()=>{});
    tabReadout=document.createElement("span");
    tabReadout.className="word-layout-tab-readout";
    tabReadout.setAttribute("role","status");
    tabGroup.append(tabField.field,tabAlign,tabLeader,
      btn("Set Tab Stop",addTab),btn("Clear Tab Stops",clearTabs),
      btn("Insert Tab",insertTab),tabReadout);
    layoutPanel.append(tabGroup);

    preview().addEventListener("apa-document-loaded",()=>{
      model().reset(preview());sync();refreshTabs();
    });
    document.getElementById("formatProfile")?.addEventListener("change",()=>{
      if(preview().dataset.wordPageCustomized!=="true") {
        model().reset(preview());sync();
      }
    });
    document.addEventListener("selectionchange",()=>{
      refreshTabs();
    });
    model().apply(preview(),model().defaults(),false);
    sync();refreshTabs();
    window.EstiloAPAWordLayoutControls={sync,updatePage,updateParagraph,addTab,clearTabs};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
