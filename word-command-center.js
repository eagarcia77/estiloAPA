// EstiloAPA Command Center — discoverable, keyboard-accessible Word actions.
// All commands reuse current editor controls. Search and UI never rewrite #preview.
(function () {
  "use strict";
  const root = () => document.getElementById("preview");
  const byId = id => document.getElementById(id);
  const ribbon = () => window.EstiloAPARibbon;
  let dialog, input, resultList, hint, launcher, shortcutsPanel, floatingBar;
  let selectedIndex = 0, filtered = [], lastFocus = null, lastSelection = null;
  let recent = [];
  let raf = 0;
  let contextEnabled = true;

  function inEditor(node) {
    const editor = root();
    return !!editor && !!node && (node === editor || editor.contains(node));
  }
  function selectedRange() {
    const selection = window.getSelection?.();
    if (!selection?.rangeCount || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    return inEditor(range.commonAncestorContainer) ? range : null;
  }
  function storeSelection() {
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (inEditor(range.commonAncestorContainer)) {
      lastSelection = range.cloneRange();
      window.EstiloAPAEditorSelection?.saveEditorSelection?.();
    }
  }
  function restoreSelection() {
    window.EstiloAPAEditorSelection?.restoreEditorSelection?.();
    if (!lastSelection || !inEditor(lastSelection.commonAncestorContainer)) return;
    const selection = window.getSelection?.();
    if (!selection) return;
    try {
      selection.removeAllRanges();
      selection.addRange(lastSelection);
    } catch { /* The document may have changed while the menu was open. */ }
  }
  function originalButton(selector) {
    const button = document.querySelector(selector);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }
  function action(id,label,category,keywords,execute,enabled = () => true,shortcut = "") {
    return {id,label,category,keywords,execute,enabled,shortcut};
  }
  function documentReady() {
    return !!root() && !root().querySelector?.(".placeholder");
  }
  function commands() {
    const tools = window.EstiloAPAWordTools;
    const simple = window.EstiloAPASimple;
    const actions = [
      action("open","Open File","File","import upload docx pdf",()=>originalButton("#simpleOpenBtn")),
      action("export","Download Word Document","File","save export docx download",()=>originalButton("#downloadDocxBtn"),
        ()=>!!byId("downloadDocxBtn") && !byId("downloadDocxBtn").disabled,"Ctrl+S"),
      action("html","Download HTML","File","export web",()=>originalButton("#downloadHtmlBtn"),
        ()=>!!byId("downloadHtmlBtn") && !byId("downloadHtmlBtn").disabled),
      action("savedraft","Save Draft","File","local save backup",()=>originalButton("#wordSaveLocalDraft"),
        ()=>!!byId("wordSaveLocalDraft") && !byId("wordSaveLocalDraft").disabled),
      action("recover","Recover Draft","File","restore recovery backup",()=>originalButton("#wordRecoverLocalDraft"),
        ()=>!!byId("wordRecoverLocalDraft") && !byId("wordRecoverLocalDraft").disabled),
      action("undo","Undo","Home","history back",()=>tools?.undo?.(),()=>!!tools,"Ctrl+Z"),
      action("redo","Redo","Home","history forward",()=>tools?.redo?.(),()=>!!tools,"Ctrl+Y"),
      action("bold","Bold","Home","strong text",()=>originalButton('#apaEditorShell button[data-cmd="bold"]'),documentReady,"Ctrl+B"),
      action("italic","Italic","Home","emphasis text",()=>originalButton('#apaEditorShell button[data-cmd="italic"]'),documentReady,"Ctrl+I"),
      action("underline","Underline","Home","emphasis text",()=>originalButton('#apaEditorShell button[data-cmd="underline"]'),documentReady,"Ctrl+U"),
      action("clearformat","Clear Character Formatting","Home","remove font style",()=>originalButton('#apaEditorShell button[data-cmd="removeFormat"]'),documentReady),
      action("indent-none","No Indent","Home","zero first line left indent",()=>originalButton('#apaEditorShell button[data-indent="none"]'),documentReady),
      action("indent-first","First Line Indent","Home","paragraph first indent half inch",()=>originalButton('#apaEditorShell button[data-indent="first"]'),documentReady),
      action("indent-hanging","Hanging Indent","Home","references indent hanging",()=>originalButton('#apaEditorShell button[data-indent="hanging"]'),documentReady),
      action("align-left","Align Left","Home","paragraph alignment",()=>originalButton('#apaEditorShell button[data-align="left"]'),documentReady),
      action("align-center","Center Text","Home","paragraph alignment",()=>originalButton('#apaEditorShell button[data-align="center"]'),documentReady),
      action("align-right","Align Right","Home","paragraph alignment",()=>originalButton('#apaEditorShell button[data-align="right"]'),documentReady),
      action("find","Find in Document","Home","search text",()=>tools?.find?.(),()=>!!tools,"Ctrl+F"),
      action("replace","Find and Replace","Home","change text search replace",()=>tools?.replace?.(),()=>!!tools,"Ctrl+H"),
      action("selectall","Select All","Home","highlight document",()=>tools?.selectAll?.(),()=>!!tools,"Ctrl+A"),
      action("insert-table","Insert APA Table","Insert","table columns rows",()=>originalButton("#insertApaTable"),documentReady),
      action("insert-figure","Insert Figure","Insert","caption image",()=>originalButton("#insertFigureCaption"),documentReady),
      action("insert-link","Insert Link","Insert","hyperlink url",()=>originalButton("#insertApaLink"),documentReady),
      action("insert-page-break","Insert Page Break","Insert","next page",()=>originalButton("#insertPageBreak"),documentReady),
      action("add-row","Add Table Row","Insert","table rows",()=>originalButton("#wordTableAddRow"),documentReady),
      action("layout","Page Layout","Layout","page size orientation margins",()=>ribbon()?.activate?.("pagina"),()=>!!ribbon()),
      action("apa-layout","APA Layout","APA Layout","academic style paragraph",()=>ribbon()?.activate?.("diseno"),()=>!!ribbon()),
      action("review","Review APA 7","Review","citations references audit",()=>{
        const review = byId("simpleReviewDetails");
        if (review && !review.open) simple?.toggleReview?.();
        else byId("reauditBtn")?.click();
      },()=>!!byId("simpleReviewDetails")),
      action("document-outline","Document Outline","View","navigate headings",()=>originalButton("#wordDocumentOutlineButton"),
        ()=>!!byId("wordDocumentOutlineButton")),
      action("rulers","Show or Hide Rulers","View","measure inches indent",()=>originalButton("#wordRulerToggleButton"),
        ()=>!!byId("wordRulerToggleButton")),
      action("focus","Focus Mode","View","distraction-free fullscreen",()=>originalButton("#wordRibbonFocus")),
      action("selection-toolbar","Toggle Selection Toolbar","View","contextual floating quick formatting",
        ()=>originalButton("#wordContextToggle"),()=>!!byId("wordContextToggle")),
      action("pageview","Page View / Full Width","View","zoom screen document width",()=>originalButton("#wordPageViewButton"),
        ()=>!!byId("wordPageViewButton")),
      action("print","Print Document","File","printer",()=>window.print?.()),
      action("shortcuts","Keyboard Shortcuts","Help","learn help key commands",openShortcuts,()=>true,"Ctrl+Shift+P")
    ];
    return actions.filter(c => c.enabled());
  }
  const normalize = value => String(value||"").toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").trim();
  function search(query,source = commands()) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return source.filter(command => {
      const haystack = normalize(command.label+" "+command.category+" "+command.keywords+" "+command.shortcut);
      return words.every(w => haystack.includes(w));
    }).sort((a,b) => {
      const aa = recent.indexOf(a.id), bb = recent.indexOf(b.id);
      const recentA = aa<0?100:aa, recentB = bb<0?100:bb;
      return words.length ? a.label.localeCompare(b.label) : recentA-recentB || a.category.localeCompare(b.category) || a.label.localeCompare(b.label);
    }).slice(0,30);
  }
  function make(tag,className,text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function updateSelected() {
    const children = [...resultList.children].filter(node=>node.getAttribute("role")==="option");
    children.forEach((node,i) => {
      node.setAttribute("aria-selected",String(i===selectedIndex));
      node.tabIndex = -1;
    });
    input.setAttribute("aria-activedescendant",children[selectedIndex]?.id||"");
    children[selectedIndex]?.scrollIntoView?.({block:"nearest"});
  }
  function render() {
    filtered = search(input.value);
    selectedIndex = Math.min(selectedIndex,Math.max(0,filtered.length-1));
    resultList.replaceChildren();
    if (!filtered.length) {
      const empty = make("p","word-command-empty","No matching commands. Try 'indent', 'page', 'find' or 'save'.");
      resultList.append(empty);
    } else {
      for (const [i,cmd] of filtered.entries()) {
        const row = make("button","word-command-result");
        row.id="wordCommandOption"+i;
        row.type="button";
        row.setAttribute("role","option");
        row.setAttribute("aria-selected",String(i===selectedIndex));
        const title=make("span","word-command-result-title",cmd.label);
        const details=make("small","word-command-result-category",cmd.category);
        row.append(title,details);
        if(cmd.shortcut) row.append(make("kbd","word-command-shortcut",cmd.shortcut));
        row.addEventListener("mouseenter",()=>{selectedIndex=i;updateSelected();});
        row.addEventListener("click",()=>runCommand(cmd));
        resultList.append(row);
      }
    }
    hint.textContent=filtered.length+" commands available · ↑↓ select · Enter run · Esc close";
    updateSelected();
  }
  function open() {
    if (!dialog) return;
    if (dialog.hidden) {
      storeSelection();
      lastFocus=document.activeElement;
    }
    floatingBar.hidden=true;
    dialog.hidden=false;
    dialog.setAttribute("aria-hidden","false");
    input.value="";
    selectedIndex=0;
    shortcutsPanel.hidden=true;
    resultList.hidden=false;
    render();
    input.focus();
  }
  function close(restoreFocus=true) {
    if (!dialog || dialog.hidden) return;
    dialog.hidden=true;
    dialog.setAttribute("aria-hidden","true");
    if (restoreFocus && lastFocus?.isConnected) lastFocus.focus?.({preventScroll:true});
  }
  function runCommand(command) {
    if (!command || !command.enabled()) return false;
    close(false);
    // Preserve the caret for formatting/insertion commands only. File actions
    // must retain native user activation for their download/file picker.
    const editorActions = new Set([
      "bold","italic","underline","clearformat",
      "indent-none","indent-first","indent-hanging",
      "align-left","align-center","align-right",
      "insert-table","insert-figure","insert-link","insert-page-break",
      "add-row"
    ]);
    if (editorActions.has(command.id)) restoreSelection();
    const result=command.execute();
    recent=[command.id,...recent.filter(id=>id!==command.id)].slice(0,8);
    if (!byId("wordFindPanel") || byId("wordFindPanel").hidden) {
      if (command.id !== "open" && command.id !== "review" &&
          command.id !== "layout" && command.id !== "apa-layout" &&
          command.id !== "shortcuts") root()?.focus?.({preventScroll:true});
    }
    return result !== false;
  }
  function openShortcuts() {
    dialog.hidden=false;
    shortcutsPanel.hidden=false;
    resultList.hidden=true;
    hint.textContent="Keyboard shortcuts · Esc to close";
    const shortcuts = [
      ["Command Search","Ctrl/Cmd + Shift + P"],
      ["Word Help","Alt + Q"],
      ["Undo / Redo","Ctrl/Cmd + Z / Y"],
      ["Find / Replace","Ctrl/Cmd + F / H"],
      ["Download DOCX","Ctrl/Cmd + S"],
      ["Bold / Italic / Underline","Ctrl/Cmd + B / I / U"],
      ["Close Search or Dialog","Esc"]
    ];
    shortcutsPanel.replaceChildren();
    const heading=make("h3","", "Keyboard Shortcuts");
    shortcutsPanel.append(heading);
    for(const [name,key] of shortcuts) {
      const row=make("div","word-shortcut-row");
      row.append(make("span","",name),make("kbd","",key));
      shortcutsPanel.append(row);
    }
    const back=make("button","word-command-back","Back to Commands");
    back.type="button";
    back.addEventListener("click",()=>{shortcutsPanel.hidden=true;resultList.hidden=false;render();input.focus();});
    shortcutsPanel.append(back);
    input.focus();
  }
  function makeDialog() {
    dialog=make("div","word-command-backdrop");
    dialog.id="wordCommandDialog";
    dialog.hidden=true;
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-modal","true");
    dialog.setAttribute("aria-label","Command Search");
    dialog.setAttribute("aria-hidden","true");
    const panel=make("section","word-command-panel");
    const header=make("div","word-command-header");
    header.append(make("strong","","Command Search"));
    const closeButton=make("button","word-command-close","Close");
    closeButton.type="button";
    closeButton.addEventListener("click",()=>close());
    header.append(closeButton);
    input=make("input","word-command-input");
    input.id="wordCommandInput";
    input.type="search";
    input.placeholder="Search Word and APA 7 tools...";
    input.setAttribute("aria-label","Search commands");
    input.setAttribute("role","combobox");
    input.setAttribute("aria-controls","wordCommandResults");
    input.setAttribute("aria-autocomplete","list");
    input.setAttribute("aria-expanded","true");
    resultList=make("div","word-command-results");
    resultList.id="wordCommandResults";
    resultList.setAttribute("role","listbox");
    hint=make("p","word-command-hint");
    shortcutsPanel=make("div","word-command-help");
    shortcutsPanel.hidden=true;
    panel.append(header,input,resultList,shortcutsPanel,hint);
    dialog.append(panel);
    dialog.addEventListener("pointerdown",event=>{if(event.target===dialog)close();});
    dialog.addEventListener("keydown",event=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key==="Tab") {
        const controls=[input,...resultList.querySelectorAll("button"),...shortcutsPanel.querySelectorAll("button"),closeButton]
          .filter(n=>!n.disabled && n.offsetParent!==null);
        if(!controls.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    input.addEventListener("input",()=>{selectedIndex=0;render();});
    input.addEventListener("keydown",event=>{
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        event.preventDefault();
        if(filtered.length){selectedIndex=(selectedIndex+(event.key==="ArrowDown"?1:-1)+filtered.length)%filtered.length;updateSelected();}
      } else if(event.key==="Enter"){
        event.preventDefault();
        if(!shortcutsPanel.hidden)return;
        runCommand(filtered[selectedIndex]);
      }
    });
    document.body.append(dialog);
  }
  function makeFloating() {
    floatingBar=make("div","word-context-toolbar");
    floatingBar.id="wordContextToolbar";
    floatingBar.hidden=true;
    floatingBar.setAttribute("role","toolbar");
    floatingBar.setAttribute("aria-label","Selected text formatting");
    const buttons=[
      ["Bold","bold"],["Italic","italic"],["Underline","underline"],
      ["No Indent","indent-none"],["Find","find"]
    ];
    for(const [label,id] of buttons) {
      const b=make("button","word-context-button",label);
      b.type="button";
      b.addEventListener("pointerdown",event=>{event.preventDefault();storeSelection();});
      b.addEventListener("click",()=>{
        storeSelection();
        const match=commands().find(item=>item.id===id);
        if(match)runCommand(match);
        floatingBar.hidden=true;
      });
      floatingBar.append(b);
    }
    document.body.append(floatingBar);
  }
  function positionFloating() {
    raf=0;
    if(!floatingBar || !contextEnabled || !dialog.hidden) return;
    const range=selectedRange();
    if(!range || (typeof document.hasFocus==="function" && !document.hasFocus())) {floatingBar.hidden=true;return;}
    const rect=range.getBoundingClientRect?.();
    if(!rect || !Number.isFinite(rect.left) || !rect.width) {floatingBar.hidden=true;return;}
    // Tiny selections have no useful contextual target; do not obscure typing.
    if(rect.width<3 && rect.height<4) {floatingBar.hidden=true;return;}
    floatingBar.hidden=false;
    const width=floatingBar.offsetWidth||300;
    const maxX=Math.max(8,(window.innerWidth||1024)-width-8);
    const left=Math.max(8,Math.min(maxX,rect.left+rect.width/2-width/2));
    const above=rect.top-(floatingBar.offsetHeight||46)-10;
    floatingBar.style.left=left+"px";
    floatingBar.style.top=(above>4?above:Math.min((window.innerHeight||768)-55,rect.bottom+8))+"px";
  }
  function scheduleFloating() {
    if(raf || !floatingBar)return;
    raf=window.requestAnimationFrame?.(positionFloating) || window.setTimeout(positionFloating,16);
  }
  function makeLauncher() {
    const actions=byId("wordRibbonActions") || byId("simplePrimaryActions");
    launcher=make("button","word-command-launcher","Search Commands");
    launcher.type="button";
    launcher.id="wordCommandLauncher";
    launcher.setAttribute("aria-label","Search Word and APA 7 commands");
    launcher.setAttribute("aria-keyshortcuts","Control+Shift+P Alt+Q");
    launcher.setAttribute("aria-haspopup","dialog");
    launcher.title="Find tools and commands (Ctrl+Shift+P or Alt+Q)";
    // A pointer click can otherwise clear highlighted text before the
    // command search opens. Keep the selection without stealing keyboard focus.
    launcher.addEventListener("pointerdown",event=>{
      if (selectedRange()) { event.preventDefault();storeSelection(); }
    });
    launcher.addEventListener("click",open);
    actions?.prepend(launcher);
  }
  function keydown(event) {
    if(event.defaultPrevented || event.isComposing)return;
    const key=String(event.key||"").toLowerCase();
    if(event.key==="Escape" && dialog && !dialog.hidden) {
      event.preventDefault();close();return;
    }
    const shortcut=((event.ctrlKey||event.metaKey)&&event.shiftKey&&key==="p") ||
      (event.altKey && !event.ctrlKey && !event.metaKey && key==="q");
    if(shortcut) {
      event.preventDefault();
      if(dialog?.hidden)open();else close();
    }
  }
  function init() {
    if(!root() || !byId("wordRibbonActions") || byId("wordCommandDialog"))return;
    makeDialog();makeFloating();makeLauncher();
    const view=byId("word-ribbon-panel-vista");
    if(view) {
      const toggle=make("button","word-ribbon-action","Selection Toolbar: On");
      toggle.type="button";
      toggle.id="wordContextToggle";
      toggle.setAttribute("aria-pressed","true");
      toggle.title="Show compact formatting tools only when text is selected";
      toggle.addEventListener("click",()=>{
        contextEnabled=!contextEnabled;
        toggle.textContent="Selection Toolbar: "+(contextEnabled?"On":"Off");
        toggle.setAttribute("aria-pressed",String(contextEnabled));
        if(!contextEnabled) floatingBar.hidden=true;
        else scheduleFloating();
      });
      const group=make("div","word-ribbon-group");
      group.append(make("span","word-ribbon-group-label","Quick Formatting"),toggle);
      view.append(group);
    }
    document.addEventListener("keydown",keydown,true);
    document.addEventListener("selectionchange",scheduleFloating);
    root().addEventListener("input",()=>{floatingBar.hidden=true;});
    root().addEventListener("apa-document-loaded",()=>{lastSelection=null;floatingBar.hidden=true;});
    document.addEventListener("scroll",()=>{floatingBar.hidden=true;},{capture:true,passive:true});
    window.addEventListener("resize",()=>{floatingBar.hidden=true;});
    window.EstiloAPACommandCenter={
      open,close,search:(query)=>search(query).map(({id,label,category})=>({id,label,category})),
      execute:id=>{const match=commands().find(c=>c.id===id);return match?runCommand(match):false;},
      shortcuts:openShortcuts
    };
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
