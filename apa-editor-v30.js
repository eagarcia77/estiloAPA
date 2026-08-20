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
  sel.removeAllRanges();
  sel.addRange(savedRange);
  return true;
}

function selectedBlocks() {
  restoreEditorSelection();
  const root = preview();
  const sel = window.getSelection();
  if (!root || !sel || !sel.rangeCount) return [];
  const range = sel.getRangeAt(0);
  const candidates = [...root.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li")];
  const selected = candidates.filter((el) => {
    try { return range.intersectsNode(el); } catch { return false; }
  });
  if (selected.length) return selected;
  const node = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const block = node?.closest?.("p,h1,h2,h3,h4,h5,h6,li");
  return block && root.contains(block) ? [block] : [];
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
  }
  dispatchEditorChange(`APA 7 v${APA_EDITOR_VERSION}: estilo aplicado a ${blocks.length} bloque(s).`);
}

function applyAlignment(value) {
  const blocks = selectedBlocks();
  for (const block of blocks) {
    block.dataset.apaEditorAlign = value;
    block.style.textAlign = value;
  }
  dispatchEditorChange();
}

function applyIndent(value) {
  const blocks = selectedBlocks();
  for (const block of blocks) {
    block.dataset.apaEditorIndent = value;
    block.style.paddingLeft = "";
    block.style.textIndent = "";
    if (value === "first") block.style.textIndent = ".5in";
    else if (value === "hanging") {
      block.style.paddingLeft = ".5in";
      block.style.textIndent = "-.5in";
    } else block.style.textIndent = "0";
  }
  dispatchEditorChange();
}

function applyLineSpacing(value) {
  const blocks = selectedBlocks();
  for (const block of blocks) {
    block.dataset.apaEditorLine = value;
    block.style.lineHeight = value;
  }
  dispatchEditorChange();
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
  const title = window.prompt("Título de la tabla (APA 7):", "Título descriptivo de la tabla");
  if (title === null) return;
  const rows = Math.max(2, Math.min(20, Number(window.prompt("Cantidad de filas, incluyendo encabezado:", "4")) || 4));
  const cols = Math.max(2, Math.min(8, Number(window.prompt("Cantidad de columnas:", "3")) || 3));
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
  const title = window.prompt("Título de la figura:", "Título descriptivo de la figura");
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
  const url = window.prompt("URL del enlace (https://...):", "https://");
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
    block.dataset.apaEditorStyle = "normal";
    block.dataset.apaEditorAlign = "left";
    block.dataset.apaEditorIndent = "first";
    block.dataset.apaEditorLine = "2";
    block.style.textAlign = "left";
    block.style.textIndent = ".5in";
    block.style.paddingLeft = "";
    block.style.lineHeight = "2";
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
    block.style.textAlign = "left";
    block.style.paddingLeft = ".5in";
    block.style.textIndent = "-.5in";
    block.style.lineHeight = "2";
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
    <div id="apaEditorToolbar" class="apa-editor-toolbar" role="toolbar" aria-label="Herramientas de edición y formato APA 7">
      <div class="tool-group" aria-label="Historial">
        <button type="button" class="icon-tool" data-cmd="undo" title="Deshacer" aria-label="Deshacer">↶</button>
        <button type="button" class="icon-tool" data-cmd="redo" title="Rehacer" aria-label="Rehacer">↷</button>
      </div>
      <div class="tool-group" aria-label="Formato de texto">
        <button type="button" class="icon-tool" data-cmd="bold" title="Negrita" aria-label="Negrita"><strong>B</strong></button>
        <button type="button" class="icon-tool" data-cmd="italic" title="Cursiva" aria-label="Cursiva"><em>I</em></button>
        <button type="button" class="icon-tool" data-cmd="underline" title="Subrayado" aria-label="Subrayado"><u>U</u></button>
        <button type="button" data-cmd="removeFormat" title="Quitar formato de caracteres">Limpiar</button>
      </div>
      <div class="tool-group">
        <label class="sr-only" for="apaBlockStyle">Estilo de bloque</label>
        <select id="apaBlockStyle" title="Estilo APA 7 del bloque">
          <option value="">Estilo APA 7…</option>
          <option value="normal">Párrafo normal</option>
          <option value="title">Título del trabajo</option>
          <option value="h1">Encabezado nivel 1</option>
          <option value="h2">Encabezado nivel 2</option>
          <option value="h3">Encabezado nivel 3</option>
          <option value="h4">Encabezado nivel 4</option>
          <option value="h5">Encabezado nivel 5</option>
          <option value="reference">Referencia APA</option>
          <option value="note">Nota de tabla/figura</option>
          <option value="table-label">Rótulo de tabla</option>
          <option value="table-title">Título de tabla</option>
          <option value="figure-label">Rótulo de figura</option>
          <option value="figure-title">Título de figura</option>
        </select>
      </div>
      <div class="tool-group" aria-label="Alineación">
        <button type="button" data-align="left" title="Alinear a la izquierda">Izq.</button>
        <button type="button" data-align="center" title="Centrar">Centro</button>
        <button type="button" data-align="right" title="Alinear a la derecha">Der.</button>
      </div>
      <div class="tool-group" aria-label="Sangría e interlineado">
        <button type="button" data-indent="first" title="Sangría de primera línea 0.5 pulgadas">1ª línea .5″</button>
        <button type="button" data-indent="hanging" title="Sangría francesa 0.5 pulgadas">Francesa .5″</button>
        <button type="button" data-indent="none" title="Quitar sangría">Sin sangría</button>
        <select id="apaLineSpacing" title="Interlineado">
          <option value="">Interlineado…</option>
          <option value="1">Sencillo</option>
          <option value="1.5">1.5</option>
          <option value="2">Doble</option>
        </select>
      </div>
      <div class="tool-group" aria-label="Presets APA 7">
        <button type="button" id="apaParagraphPreset">Párrafo APA</button>
        <button type="button" id="apaReferencePreset">Referencia APA</button>
        <button type="button" id="insertReferencesHeading">Referencias</button>
      </div>
      <div class="tool-group" aria-label="Insertar">
        <button type="button" id="insertApaTable">+ Tabla APA</button>
        <button type="button" id="insertFigureCaption">+ Figura</button>
        <button type="button" id="insertApaLink">Enlace</button>
        <button type="button" id="insertPageBreak">Salto pág.</button>
      </div>
      <div class="tool-group">
        <button type="button" id="toggleApaRules" aria-expanded="false" aria-controls="apaRulesPanel">Reglas APA 7</button>
      </div>
    </div>
    <div id="apaRulesPanel" class="apa-rules-panel" hidden>
      <div class="apa-rules-grid">
        <div class="apa-rule-card"><strong>Texto del cuerpo</strong>Izquierda, doble espacio y sangría de primera línea de 0.5 pulg. Evite justificar el margen derecho.</div>
        <div class="apa-rule-card"><strong>Encabezados</strong>Nivel 1 centrado/negrita; nivel 2 izquierda/negrita; nivel 3 izquierda/negrita/cursiva; niveles 4–5 con sangría y texto en la misma línea.</div>
        <div class="apa-rule-card"><strong>Referencias</strong>Encabezado centrado y en negrita, doble espacio, orden alfabético, sin viñetas y sangría francesa de 0.5 pulg.</div>
        <div class="apa-rule-card"><strong>DOI y URL</strong>DOI como https://doi.org/...; no añada punto final después de DOI o URL.</div>
        <div class="apa-rule-card"><strong>Tablas</strong>Número en negrita, título en cursiva, sin líneas verticales y solo reglas horizontales necesarias.</div>
        <div class="apa-rule-card"><strong>Figuras</strong>Número en negrita, título en cursiva y nota debajo cuando sea necesaria para fuente o aclaración.</div>
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
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeApaEditor);
else initializeApaEditor();
