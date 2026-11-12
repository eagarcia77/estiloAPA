const APA_EDITOR_VERSION = "3.0";

const preview = () => document.querySelector("#preview");
let savedRange = null;

function editorEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectionInsidePreview() {
  const sel = window.getSelection();
  const root = preview();
  if (!sel || !sel.rangeCount || !root) return false;
  const node = sel.anchorNode;
  return Boolean(node && root.contains(node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode));
}

function saveEditorSelection() {
  if (!selectionInsidePreview()) return;
  const sel = window.getSelection();
  savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreEditorSelection() {
  if (!savedRange) return false;
  const root = preview();
  if (!root || !root.contains(savedRange.commonAncestorContainer)) return false;
  const sel = window.getSelection();
  // An actual selection in the document takes priority over an old saved one.
  // Restoring a stale range could format (or delete) a different paragraph.
  if (selectionInsidePreview()) return true;
  sel.removeAllRanges();
  sel.addRange(savedRange);
  return true;
}

function selectedBlocks() {
  const root = preview();
  if (!root) return [];
  if (!selectionInsidePreview()) restoreEditorSelection();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !selectionInsidePreview()) return [];
  const range = sel.getRangeAt(0);
  const candidates = [...root.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li")];
  // For a caret selection, target ONLY the current paragraph: intersectsNode
  // can report adjacent blocks at a shared boundary.
  if (range.collapsed) {
    let node = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer : range.startContainer.parentElement;
    const block = node?.closest?.("p,h1,h2,h3,h4,h5,h6,li");
    if (block && root.contains(block)) return [block];
    // Browser may position caret in a section or the editor root.
    if (node === root || node?.matches?.("section[data-source-file]")) {
      const child = range.startContainer.childNodes?.[range.startOffset] ||
        range.startContainer.childNodes?.[range.startOffset - 1];
      node = child?.nodeType === Node.ELEMENT_NODE ? child : child?.parentElement;
      const fallback = node?.matches?.("p,h1,h2,h3,h4,h5,h6,li") ?
        node : node?.closest?.("p,h1,h2,h3,h4,h5,h6,li");
      if (fallback && root.contains(fallback)) return [fallback];
    }
    return [];
  }
  return candidates.filter(el => {
    try { return range.intersectsNode(el); } catch { return false; }
  });
}

function dispatchEditorChange(message = "") {
  const root = preview();
  root?.dispatchEvent(new Event("input", { bubbles: true }));
  saveEditorSelection();
  if (message) {
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = message;
      status.className = "status success";
    }
  }
}

function execInline(command, value = null) {
  restoreEditorSelection();
  document.execCommand(command, false, value);
  dispatchEditorChange();
}

function clearApaEditorClasses(block) {
  const classes = [
    "apa-editor-title", "apa-heading-level-1", "apa-heading-level-2", "apa-heading-level-3",
    "apa-heading-level-4", "apa-heading-level-5", "apa-reference", "apa-note",
    "apa-table-label", "apa-table-title", "apa-figure-label", "apa-figure-title", "no-indent"
  ];
  classes.forEach((name) => block.classList.remove(name));
}

function applyEditorBlockStyle(styleName) {
  const blocks = selectedBlocks();
  if (!blocks.length) return;
  for (const block of blocks) {
    clearApaEditorClasses(block);
    // Choosing another paragraph style replaces the previous explicit indent.
    delete block.dataset.apaEditorIndent;
    delete block.dataset.apaEditorIndentLeft;
    delete block.dataset.apaEditorIndentFirst;
    delete block.dataset.apaEditorIndentRight;
    block.style.removeProperty("text-indent");
    block.style.removeProperty("padding-left");
    block.style.removeProperty("padding-right");
    block.style.removeProperty("margin-left");
    block.style.removeProperty("text-align");
    block.dataset.apaEditorStyle = styleName;
    block.style.fontWeight = "";
    block.style.fontStyle = "";
    block.style.textAlign = "left";
    block.style.textIndent = "";
    block.style.paddingLeft = "";

    if (styleName === "normal") {
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "first";
    } else if (styleName === "title") {
      block.classList.add("apa-editor-title", "no-indent");
      block.dataset.apaEditorAlign = "center";
      block.dataset.apaEditorIndent = "none";
      block.style.fontWeight = "700";
      block.style.textAlign = "center";
    } else if (["h1", "h2", "h3", "h4", "h5"].includes(styleName)) {
      const level = Number(styleName.slice(1));
      block.classList.add(`apa-heading-level-${level}`, "no-indent");
      block.dataset.apaHeadingLevel = String(level);
      block.dataset.apaEditorAlign = level === 1 ? "center" : "left";
      block.dataset.apaEditorIndent = level >= 4 ? "first" : "none";
      block.style.textAlign = level === 1 ? "center" : "left";
      block.style.fontWeight = "700";
      block.style.fontStyle = [3, 5].includes(level) ? "italic" : "normal";
      if (level >= 4) block.classList.remove("no-indent");
    } else if (styleName === "reference") {
      block.classList.add("apa-reference", "no-indent");
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "hanging";
      block.dataset.apaEditorLine = "2";
      block.style.textAlign = "left";
      block.style.paddingLeft = ".5in";
      block.style.textIndent = "-.5in";
      block.style.lineHeight = "2";
    } else if (styleName === "note") {
      block.classList.add("apa-note", "no-indent");
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "none";
    } else if (styleName === "table-label") {
      block.classList.add("apa-table-label", "thesis-table-label", "no-indent");
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "none";
      block.style.fontWeight = "700";
    } else if (styleName === "table-title") {
      block.classList.add("apa-table-title", "thesis-table-title", "no-indent");
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "none";
      block.style.fontStyle = "italic";
    } else if (styleName === "figure-label") {
      block.classList.add("apa-figure-label", "no-indent");
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "none";
      block.style.fontWeight = "700";
    } else if (styleName === "figure-title") {
      block.classList.add("apa-figure-title", "no-indent");
      block.dataset.apaEditorAlign = "left";
      block.dataset.apaEditorIndent = "none";
      block.style.fontStyle = "italic";
    }
    // Keep the visual state consistent with the newly chosen paragraph style.
    if (["first", "hanging", "none"].includes(block.dataset.apaEditorIndent)) {
      const indent = block.dataset.apaEditorIndent;
      block.style.setProperty("padding-left", indent === "hanging" ? ".5in" : "0", "important");
      block.style.setProperty("text-indent", indent === "first" ? ".5in" : indent === "hanging" ? "-.5in" : "0", "important");
    }
    if (block.dataset.apaEditorAlign) {
      block.style.setProperty("text-align", block.dataset.apaEditorAlign, "important");
    }
  }
  dispatchEditorChange(`APA 7 style applied to ${blocks.length} paragraph(s).`);
}

function markRibbonButtonState(attribute, value) {
  document.querySelectorAll(`#apaEditorShell [${attribute}]`).forEach(button => {
    button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value));
  });
}

function applyAlignment(value) {
  if (!["left", "center", "right"].includes(value)) return;
  const blocks = selectedBlocks();
  if (!blocks.length) return;
  for (const block of blocks) {
    block.dataset.apaEditorAlign = value;
    block.style.setProperty("text-align", value, "important");
  }
  markRibbonButtonState("data-align", value);
  dispatchEditorChange(`Alignment: ${value} (${blocks.length} paragraph(s)).`);
}

// Single source of truth for explicit indent commands. Automatic APA profile
// formatters may update class/style asynchronously, but must not overwrite the
// user's direct Ribbon choice. Mutations are corrected only if a value changed.
function enforceEditorIndent(block) {
  if (!block || !block.dataset) return false;
  const indent = block.dataset.apaEditorIndent;
  if (!["none", "first", "hanging", "custom"].includes(indent)) return false;
  const values = indent === "custom" ? window.EstiloAPAWordRulerIndents?.read(block) : null;
  if (indent === "custom" && !values) return false;
  const expectedText = values ?
    (Math.round((values.first - values.left) * 1000) / 1000) + "in" :
    indent === "first" ? ".5in" : indent === "hanging" ? "-.5in" : "0";
  const expectedLeft = values ? values.left + "in" : indent === "hanging" ? ".5in" : "0";
  const properties = [["text-indent", expectedText], ["padding-left", expectedLeft]];
  if (values) properties.push(["padding-right", values.right + "in"]);
  let changed = false;
  for (const [property, expected] of properties) {
    if (block.style.getPropertyValue(property) !== expected ||
        block.style.getPropertyPriority(property) !== "important") {
      block.style.setProperty(property, expected, "important");
      changed = true;
    }
  }
  if (["none", "custom"].includes(indent) &&
    (block.style.getPropertyValue("margin-left") !== "0" ||
    block.style.getPropertyPriority("margin-left") !== "important")) {
    block.style.setProperty("margin-left", "0", "important");
    changed = true;
  }
  return changed;
}

function initializeIndentPersistence() {
  const root = preview();
  if (!root || typeof MutationObserver !== "function") return;
  const active = new Set();
  let enforcing = false;
  const track = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches?.("[data-apa-editor-indent]")) active.add(node);
    node.querySelectorAll?.("[data-apa-editor-indent]").forEach(el => active.add(el));
  };
  track(root);
  const observer = new MutationObserver(records => {
    if (enforcing) return;
    enforcing = true;
    try {
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach(track);
        } else {
          track(record.target);
        }
      }
      for (const block of active) {
        if (!root.contains(block)) { active.delete(block); continue; }
        enforceEditorIndent(block);
      }
    } finally { enforcing = false; }
  });
  observer.observe(root, {
    subtree: true, attributes: true, childList: true,
    attributeFilter: ["style", "class", "data-apa-editor-indent"]
  });
}

function applyIndent(value) {
  if (!["first", "hanging", "none"].includes(value)) return;
  const blocks = selectedBlocks();
  if (!blocks.length) {
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = "Place the cursor inside a paragraph to change its indentation.";
      status.className = "status error";
    }
    return;
  }
  for (const block of blocks) {
    // Explicit editor choice overrides inherited APA styles and legacy classes.
    block.dataset.apaEditorIndent = value;
    block.classList.toggle("no-indent", value === "none");
    block.style.removeProperty("padding-left");
    block.style.removeProperty("text-indent");
    if (value === "first") {
      block.style.setProperty("padding-left", "0", "important");
      block.style.setProperty("text-indent", ".5in", "important");
    } else if (value === "hanging") {
      block.style.setProperty("padding-left", ".5in", "important");
      block.style.setProperty("text-indent", "-.5in", "important");
    } else {
      block.style.setProperty("padding-left", "0", "important");
      block.style.setProperty("text-indent", "0", "important");
      block.style.setProperty("margin-left", "0", "important");
    }
    delete block.dataset.apaEditorIndentLeft;
    delete block.dataset.apaEditorIndentFirst;
    delete block.dataset.apaEditorIndentRight;
    block.style.removeProperty("padding-right");
    enforceEditorIndent(block);
  }
  markRibbonButtonState("data-indent", value);
  const labels = { none: "No Indent", first: "First Line Indent", hanging: "Hanging Indent" };
  dispatchEditorChange(`${labels[value]} applied to ${blocks.length} paragraph(s).`);
}

function applyLineSpacing(value) {
  if (!["1", "1.5", "2"].includes(value)) return;
  const blocks = selectedBlocks();
  if (!blocks.length) return;
  for (const block of blocks) {
    block.dataset.apaEditorLine = value;
    block.style.setProperty("line-height", value, "important");
  }
  dispatchEditorChange(`Line Spacing: ${value} (${blocks.length} paragraph(s)).`);
}

function nextNumber(kind) {
  const root = preview();
  const selector = kind === "table" ? ".apa-table-label,.thesis-table-label" : ".apa-figure-label,.thesis-figure-label";
  const numbers = [...(root?.querySelectorAll(selector) || [])]
    .map((el) => Number((el.textContent.match(/\d+/) || [0])[0]))
    .filter(Number.isFinite);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function insertionAnchor() {
  const blocks = selectedBlocks();
  return blocks[blocks.length - 1] || preview()?.lastElementChild || null;
}

function insertAfter(anchor, nodes) {
  const root = preview();
  if (!root) return;
  let point = anchor;
  for (const node of nodes) {
    if (point?.parentNode) point.after(node);
    else root.append(node);
    point = node;
  }
}

function insertApaTable() {
  const title = window.prompt("APA 7 table title:", "Descriptive table title");
  if (title === null) return;
  const rows = Math.max(2, Math.min(20, Number(window.prompt("Number of rows, including the header:", "4")) || 4));
  const cols = Math.max(2, Math.min(8, Number(window.prompt("Number of columns:", "3")) || 3));
  const number = nextNumber("table");
  const label = document.createElement("p");
  label.className = "apa-table-label thesis-table-label no-indent";
  label.dataset.apaEditorStyle = "table-label";
  label.innerHTML = `<strong>Tabla ${number}</strong>`;
  const titleP = document.createElement("p");
  titleP.className = "apa-table-title thesis-table-title no-indent";
  titleP.dataset.apaEditorStyle = "table-title";
  titleP.innerHTML = `<em>${editorEscape(title || "Título de la tabla")}</em>`;
  const table = document.createElement("table");
  table.className = "apa-table apa7-table-strict thesis-apa-table";
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  for (let c = 0; c < cols; c += 1) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = `Encabezado ${c + 1}`;
    hr.append(th);
  }
  thead.append(hr);
  const tbody = document.createElement("tbody");
  for (let r = 1; r < rows; r += 1) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c += 1) {
      const td = document.createElement("td");
      td.textContent = "Dato";
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  insertAfter(insertionAnchor(), [label, titleP, table]);
  dispatchEditorChange(`Tabla ${number} insertada con estructura APA 7.`);
}

function insertFigureCaption() {
  const title = window.prompt("Figure title:", "Descriptive figure title");
  if (title === null) return;
  const number = nextNumber("figure");
  const label = document.createElement("p");
  label.className = "apa-figure-label no-indent";
  label.innerHTML = `<strong>Figura ${number}</strong>`;
  const titleP = document.createElement("p");
  titleP.className = "apa-figure-title no-indent";
  titleP.innerHTML = `<em>${editorEscape(title || "Título de la figura")}</em>`;
  const note = document.createElement("p");
  note.className = "apa-note no-indent";
  note.innerHTML = "<em>Nota.</em> Describa la fuente o aclaración de la figura cuando corresponda.";
  insertAfter(insertionAnchor(), [label, titleP, note]);
  dispatchEditorChange(`Rótulo APA 7 para Figura ${number} insertado.`);
}

function insertLink() {
  restoreEditorSelection();
  const url = window.prompt("Link URL (https://...):", "https://");
  if (!url) return;
  document.execCommand("createLink", false, url);
  dispatchEditorChange();
}

function insertPageBreak() {
  const p = document.createElement("p");
  p.className = "apa-page-break no-indent";
  p.dataset.apaPageBreak = "true";
  p.style.breakBefore = "page";
  p.style.pageBreakBefore = "always";
  p.innerHTML = "<span contenteditable=\"false\" class=\"page-break-marker\">— Salto de página —</span>";
  insertAfter(insertionAnchor(), [p]);
  dispatchEditorChange("Salto de página insertado.");
}

function insertReferencesHeading() {
  const p = document.createElement("p");
  p.className = "apa-references-heading apa-heading-level-1 no-indent";
  p.dataset.apaEditorStyle = "h1";
  p.dataset.apaHeadingLevel = "1";
  p.style.fontWeight = "700";
  p.style.textAlign = "center";
  p.textContent = "Referencias";
  insertAfter(insertionAnchor(), [p]);
  dispatchEditorChange("Encabezado Referencias insertado en formato APA 7.");
}

function applyApaParagraphPreset() {
  const blocks = selectedBlocks();
  for (const block of blocks) {
    block.classList.remove("no-indent");
    block.dataset.apaEditorStyle = "normal";
    block.dataset.apaEditorAlign = "left";
    block.dataset.apaEditorIndent = "first";
    block.dataset.apaEditorLine = "2";
    block.style.setProperty("text-align", "left", "important");
    block.style.setProperty("text-indent", ".5in", "important");
    block.style.setProperty("padding-left", "0", "important");
    block.style.setProperty("line-height", "2", "important");
  }
  dispatchEditorChange("Párrafo APA 7 aplicado: izquierda, doble espacio y sangría inicial de 0.5 pulg.");
}

function applyApaReferencePreset() {
  const blocks = selectedBlocks();
  for (const block of blocks) {
    clearApaEditorClasses(block);
    block.classList.add("apa-reference", "no-indent");
    block.dataset.apaEditorStyle = "reference";
    block.dataset.apaEditorAlign = "left";
    block.dataset.apaEditorIndent = "hanging";
    block.dataset.apaEditorLine = "2";
    block.style.setProperty("text-align", "left", "important");
    block.style.setProperty("padding-left", ".5in", "important");
    block.style.setProperty("text-indent", "-.5in", "important");
    block.style.setProperty("line-height", "2", "important");
  }
  dispatchEditorChange("Referencia APA 7 aplicada: doble espacio y sangría francesa de 0.5 pulg.");
}

function ensureEditorStyles() {
  if (document.querySelector("#apa-editor-v30-styles")) return;
  const style = document.createElement("style");
  style.id = "apa-editor-v30-styles";
  style.textContent = `
    .apa-editor-shell { margin:.85rem 0 1rem; border:1px solid #cbd6d3; border-radius:12px; background:#f8fbfa; }
    .apa-editor-toolbar { display:flex; flex-wrap:wrap; gap:.35rem; padding:.55rem; align-items:center; border-bottom:1px solid #d9e1df; position:sticky; top:0; z-index:5; background:#f8fbfa; }
    .apa-editor-toolbar .tool-group { display:flex; gap:.25rem; align-items:center; padding-right:.35rem; border-right:1px solid #d9e1df; }
    .apa-editor-toolbar .tool-group:last-child { border-right:0; }
    .apa-editor-toolbar button { min-height:36px; padding:.35rem .55rem; border-radius:7px; }
    .apa-editor-toolbar select { min-height:36px; width:auto; max-width:210px; padding:.3rem .45rem; }
    .apa-editor-toolbar .icon-tool { min-width:38px; }
    .apa-rules-panel { padding:.75rem 1rem; background:white; border-radius:0 0 12px 12px; }
    .apa-rules-panel[hidden] { display:none; }
    .apa-rules-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:.65rem; }
    .apa-rule-card { border:1px solid #e0e7e5; border-radius:9px; padding:.65rem; }
    .apa-rule-card strong { display:block; margin-bottom:.2rem; }
    /* Editor indentation is a direct user command and overrides profile rules. */
    .apa-paper [data-apa-editor-indent="none"] { text-indent:0 !important; padding-left:0 !important; margin-left:0 !important; }
    .apa-paper [data-apa-editor-indent="first"] { text-indent:.5in !important; padding-left:0 !important; }
    .apa-paper [data-apa-editor-indent="hanging"] { text-indent:-.5in !important; padding-left:.5in !important; }
    .apa-paper .apa-editor-title { text-align:center !important; font-weight:700 !important; text-indent:0 !important; }
    .apa-paper .apa-heading-level-1 { text-align:center !important; font-weight:700 !important; text-indent:0 !important; }
    .apa-paper .apa-heading-level-2 { text-align:left !important; font-weight:700 !important; text-indent:0 !important; }
    .apa-paper .apa-heading-level-3 { text-align:left !important; font-weight:700 !important; font-style:italic !important; text-indent:0 !important; }
    .apa-paper .apa-heading-level-4 { text-align:left !important; font-weight:700 !important; text-indent:.5in !important; }
    .apa-paper .apa-heading-level-5 { text-align:left !important; font-weight:700 !important; font-style:italic !important; text-indent:.5in !important; }
    .apa-paper .apa-page-break { min-height:1.2rem; border-top:1px dashed #aaa; color:#666; text-align:center !important; text-indent:0 !important; margin:.7rem 0 !important; }
    .page-break-marker { font:12px Arial,sans-serif; }
    @media print { .apa-editor-shell { display:none !important; } .apa-paper .apa-page-break { border:0; color:transparent; } .page-break-marker { display:none; } }
  `;
  document.head.append(style);
}

function ensureEditorToolbar() {
  const panel = document.querySelector(".preview-panel");
  const help = document.querySelector("#previewHelp");
  if (!panel || document.querySelector("#apaEditorShell")) return;
  const shell = document.createElement("div");
  shell.id = "apaEditorShell";
  shell.className = "apa-editor-shell";
  shell.innerHTML = `
    <div id="apaEditorToolbar" class="apa-editor-toolbar" role="toolbar" aria-label="APA 7 editing and formatting tools">
      <div class="tool-group" aria-label="History">
        <button type="button" class="icon-tool" data-cmd="undo" title="Undo" aria-label="Undo">↶</button>
        <button type="button" class="icon-tool" data-cmd="redo" title="Redo" aria-label="Redo">↷</button>
      </div>
      <div class="tool-group" aria-label="Text formatting">
        <button type="button" class="icon-tool" data-cmd="bold" title="Bold" aria-label="Bold"><strong>B</strong></button>
        <button type="button" class="icon-tool" data-cmd="italic" title="Italic" aria-label="Italic"><em>I</em></button>
        <button type="button" class="icon-tool" data-cmd="underline" title="Underline" aria-label="Underline"><u>U</u></button>
        <button type="button" data-cmd="removeFormat" title="Clear character formatting">Clear</button>
      </div>
      <div class="tool-group">
        <label class="sr-only" for="apaBlockStyle">Block Style</label>
        <select id="apaBlockStyle" title="APA 7 paragraph style">
          <option value="">APA 7 Style…</option>
          <option value="normal">Normal Paragraph</option>
          <option value="title">Paper Title</option>
          <option value="h1">Heading Level 1</option>
          <option value="h2">Heading Level 2</option>
          <option value="h3">Heading Level 3</option>
          <option value="h4">Heading Level 4</option>
          <option value="h5">Heading Level 5</option>
          <option value="reference">APA Reference</option>
          <option value="note">Table/Figure Note</option>
          <option value="table-label">Table Label</option>
          <option value="table-title">Table Title</option>
          <option value="figure-label">Figure Label</option>
          <option value="figure-title">Figure Title</option>
        </select>
      </div>
      <div class="tool-group" aria-label="Alignment">
        <button type="button" data-align="left" title="Align Left">Left</button>
        <button type="button" data-align="center" title="Align Center">Center</button>
        <button type="button" data-align="right" title="Align Right">Right</button>
      </div>
      <div class="tool-group" aria-label="Indentation and Line Spacing">
        <button type="button" data-indent="first" title="First Line Indent 0.5 in">First Line .5″</button>
        <button type="button" data-indent="hanging" title="Hanging Indent 0.5 in">Hanging .5″</button>
        <button type="button" data-indent="none" title="No Indent">No Indent</button>
        <select id="apaLineSpacing" title="Line Spacing">
          <option value="">Line Spacing…</option>
          <option value="1">Single</option>
          <option value="1.5">1.5</option>
          <option value="2">Double</option>
        </select>
      </div>
      <div class="tool-group" aria-label="APA 7 Presets">
        <button type="button" id="apaParagraphPreset">APA Paragraph</button>
        <button type="button" id="apaReferencePreset">APA Reference</button>
        <button type="button" id="insertReferencesHeading">References</button>
      </div>
      <div class="tool-group" aria-label="Insert">
        <button type="button" id="insertApaTable">+ APA Table</button>
        <button type="button" id="insertFigureCaption">+ Figure</button>
        <button type="button" id="insertApaLink">Link</button>
        <button type="button" id="insertPageBreak">Page Break</button>
      </div>
      <div class="tool-group">
        <button type="button" id="toggleApaRules" aria-expanded="false" aria-controls="apaRulesPanel">APA 7 Rules</button>
      </div>
    </div>
    <div id="apaRulesPanel" class="apa-rules-panel" hidden>
      <div class="apa-rules-grid">
        <div class="apa-rule-card"><strong>Body Text</strong>Left-aligned, double-spaced, with a 0.5-inch first-line indent. Do not justify the right margin.</div>
        <div class="apa-rule-card"><strong>Headings</strong>Level 1 centered and bold; level 2 left and bold; level 3 left, bold, italic; levels 4–5 indented and run-in.</div>
        <div class="apa-rule-card"><strong>Referencias</strong>Centered bold heading; double spacing, alphabetical order, no bullets, and a 0.5-inch hanging indent.</div>
        <div class="apa-rule-card"><strong>DOIs and URLs</strong>Format DOI links as https://doi.org/...; do not add a period after a DOI or URL.</div>
        <div class="apa-rule-card"><strong>Tables</strong>Bold number, italic title, no vertical borders, and only necessary horizontal rules.</div>
        <div class="apa-rule-card"><strong>Figures</strong>Bold number, italic title, and a note below when required for the source or explanation.</div>
      </div>
    </div>`;
  help?.after(shell);

  const toolbar = shell.querySelector("#apaEditorToolbar");
  toolbar.querySelectorAll("button").forEach((button) => button.addEventListener("mousedown", (event) => event.preventDefault()));
  toolbar.querySelectorAll("button[data-cmd]").forEach((button) => button.addEventListener("click", () => execInline(button.dataset.cmd)));
  toolbar.querySelectorAll("button[data-align]").forEach((button) => button.addEventListener("click", () => applyAlignment(button.dataset.align)));
  toolbar.querySelectorAll("button[data-indent]").forEach((button) => button.addEventListener("click", () => applyIndent(button.dataset.indent)));
  shell.querySelector("#apaBlockStyle")?.addEventListener("change", (event) => {
    if (event.target.value) applyEditorBlockStyle(event.target.value);
    event.target.value = "";
  });
  shell.querySelector("#apaLineSpacing")?.addEventListener("change", (event) => {
    if (event.target.value) applyLineSpacing(event.target.value);
    event.target.value = "";
  });
  shell.querySelector("#apaParagraphPreset")?.addEventListener("click", applyApaParagraphPreset);
  shell.querySelector("#apaReferencePreset")?.addEventListener("click", applyApaReferencePreset);
  shell.querySelector("#insertReferencesHeading")?.addEventListener("click", insertReferencesHeading);
  shell.querySelector("#insertApaTable")?.addEventListener("click", insertApaTable);
  shell.querySelector("#insertFigureCaption")?.addEventListener("click", insertFigureCaption);
  shell.querySelector("#insertApaLink")?.addEventListener("click", insertLink);
  shell.querySelector("#insertPageBreak")?.addEventListener("click", insertPageBreak);
  shell.querySelector("#toggleApaRules")?.addEventListener("click", (event) => {
    const rules = shell.querySelector("#apaRulesPanel");
    rules.hidden = !rules.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!rules.hidden));
  });
}

function initializeApaEditor() {
  ensureEditorStyles();
  ensureEditorToolbar();
  document.addEventListener("selectionchange", saveEditorSelection);
  preview()?.addEventListener("keyup", saveEditorSelection);
  preview()?.addEventListener("mouseup", saveEditorSelection);
  initializeIndentPersistence();
  // Share the existing selection-safe paragraph resolver with Word Layout.
  window.EstiloAPAEditorSelection = {
    selectedBlocks, restoreEditorSelection, saveEditorSelection
  };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeApaEditor);
else initializeApaEditor();
