const MODULE_PROFILE_VERSION = "2.5";

const PROFILE_ID = "formatProfile";
const MODULE_PROFILE = "modulo11c";

function normalizeProfileText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function moduleProfileEnabled() {
  return document.querySelector(`#${PROFILE_ID}`)?.value === MODULE_PROFILE;
}

function closestNextBlock(element) {
  let node = element?.nextElementSibling || null;
  while (node && !normalizeProfileText(node.textContent) && node.tagName !== "IMG" && node.tagName !== "TABLE") {
    node = node.nextElementSibling;
  }
  return node;
}

function wrapPrefix(element, prefix, tagName) {
  if (!element || element.dataset.prefixStyled === prefix) return;
  if (element.children.length) return;
  const text = normalizeProfileText(element.textContent);
  if (!text.toLowerCase().startsWith(prefix.toLowerCase())) return;
  const rest = text.slice(prefix.length);
  const tag = document.createElement(tagName);
  tag.textContent = prefix;
  element.replaceChildren(tag, document.createTextNode(rest));
  element.dataset.prefixStyled = prefix;
}

function emphasizeObjectiveVerb(li) {
  if (!li || li.dataset.objectiveVerbStyled === "true") return;
  const verbs = [
    "Explicar", "Distinguir", "Analizar", "Interpretar", "Examinar", "Evaluar", "Proponer",
    "Aplicar", "Comparar", "Identificar", "Describir", "Relacionar", "Clasificar", "Diseñar",
    "Crear", "Determinar", "Justificar", "Integrar", "Formular"
  ];
  const text = normalizeProfileText(li.textContent);
  const verb = verbs.find((candidate) => new RegExp(`^${candidate}\\b`, "i").test(text));
  if (!verb || li.children.length) return;
  const strong = document.createElement("strong");
  strong.textContent = text.slice(0, verb.length);
  li.replaceChildren(strong, document.createTextNode(text.slice(verb.length)));
  li.dataset.objectiveVerbStyled = "true";
}

function linkifyPlainUrls(root) {
  const regex = /https?:\/\/[^\s<]+/g;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest("a")) continue;
    const text = node.nodeValue || "";
    if (!regex.test(text)) {
      regex.lastIndex = 0;
      continue;
    }
    regex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(regex)) {
      fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      const raw = match[0];
      const clean = raw.replace(/[.,;:)\]]+$/, "");
      const trailing = raw.slice(clean.length);
      const anchor = document.createElement("a");
      anchor.href = clean;
      anchor.textContent = clean;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      fragment.append(anchor);
      if (trailing) fragment.append(document.createTextNode(trailing));
      cursor = match.index + raw.length;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}

function classifyApaHeading(block, text) {
  if (/^Referencias$/i.test(text)) return 1;
  if (/^(Introducción|Objetivos del módulo|Palabras clave|Lecturas y recursos requeridos|Integración de conceptos|Conclusión)$/i.test(text)) return 1;
  if (/^Tema\s+\d+\.\s+/i.test(text)) return 2;
  if (/^(Adquiere|Refuerza)$/i.test(text)) return 3;
  return 0;
}

function applyHeadingSemantics(block, level, text) {
  block.classList.remove("level-1", "level-2", "level-3", "apa-heading-level-1", "apa-heading-level-2", "apa-heading-level-3", "topic-heading", "module-subheading");
  block.classList.add("module-heading", `apa-heading-level-${level}`, `level-${level}`, "no-indent");
  block.dataset.apaHeadingLevel = String(level);
  if (/^Tema\s+\d+\./i.test(text)) block.classList.add("topic-heading");
  if (/^(Adquiere|Refuerza)$/i.test(text)) block.classList.add("module-subheading");
  if (/^Referencias$/i.test(text)) block.classList.add("apa-references-heading", "references-heading");
}

function markTableSemantics(preview) {
  preview.querySelectorAll("table").forEach((table) => {
    table.classList.add("module-apa-table", "apa7-strict-table");
    table.setAttribute("role", "table");
    const rows = [...table.rows];
    if (!rows.length) return;

    const firstRow = rows[0];
    firstRow.classList.add("apa-table-header-row");
    [...firstRow.cells].forEach((cell, index) => {
      cell.classList.add("apa-table-header-cell");
      cell.setAttribute("scope", "col");
      cell.dataset.apaColumnIndex = String(index);
    });

    rows.slice(1).forEach((row) => {
      [...row.cells].forEach((cell, index) => {
        cell.dataset.apaColumnIndex = String(index);
        const text = normalizeProfileText(cell.textContent);
        if (/^[-+]?[$€£]?\s*\d[\d,.]*(?:\s*%|\s*[A-Za-z]{0,3})?$/.test(text)) cell.classList.add("apa-numeric-cell");
        else cell.classList.add("apa-text-cell");
      });
    });

    let previous = table.previousElementSibling;
    if (previous && previous.classList.contains("module-table-title")) previous = previous.previousElementSibling;
    if (previous && /^Tabla\s+\d+/i.test(normalizeProfileText(previous.textContent))) previous.classList.add("module-table-label", "no-indent");

    const next = table.nextElementSibling;
    if (next && /^Nota\./i.test(normalizeProfileText(next.textContent))) next.classList.add("apa-note", "module-table-note", "no-indent");
  });
}

function markModuleSemantics(preview) {
  if (!preview || !moduleProfileEnabled()) return;

  preview.classList.add("module11c-profile", "apa7-strict-profile");
  const blocks = [...preview.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li")];

  for (const block of blocks) {
    const text = normalizeProfileText(block.textContent);
    if (!text) continue;

    const headingLevel = classifyApaHeading(block, text);
    if (headingLevel) applyHeadingSemantics(block, headingLevel, text);

    if (/^Figura\s+\d+[A-Za-z]?\s*\.?$/i.test(text)) {
      block.classList.add("apa-figure-label", "no-indent");
      const next = closestNextBlock(block);
      if (next && next.tagName !== "IMG" && !/^Nota\./i.test(normalizeProfileText(next.textContent))) {
        next.classList.add("apa-figure-title", "no-indent");
      }
    }

    if (/^Tabla\s+\d+[A-Za-z]?\s*\.?$/i.test(text)) {
      block.classList.add("module-table-label", "no-indent");
      const next = closestNextBlock(block);
      if (next && next.tagName !== "TABLE") next.classList.add("module-table-title", "no-indent");
    }

    if (/^Nota\./i.test(text)) {
      block.classList.add("apa-note", "no-indent");
      wrapPrefix(block, "Nota.", "em");
    }

    if (/^Ejemplo real\./i.test(text)) {
      block.classList.add("module-example");
      wrapPrefix(block, "Ejemplo real.", "strong");
    }

    if (/^Palabras clave$/i.test(text)) {
      const next = closestNextBlock(block);
      if (next) next.classList.add("module-keywords", "no-indent");
    }

    if (/^Objetivos del módulo$/i.test(text)) {
      const next = closestNextBlock(block);
      if (next?.tagName === "P") next.classList.add("no-indent", "module-lead");
      let cursor = next;
      while (cursor && !cursor.matches("h1,h2,h3,h4,h5,h6,.module-heading")) {
        if (cursor.tagName === "OL") cursor.querySelectorAll(":scope > li").forEach(emphasizeObjectiveVerb);
        cursor = cursor.nextElementSibling;
      }
    }
  }

  const referencesHeading = preview.querySelector(".apa-references-heading,.references-heading");
  if (referencesHeading) {
    let node = referencesHeading.nextElementSibling;
    while (node) {
      if (node.matches("h1,h2,h3,h4,h5,h6") && !node.classList.contains("apa-reference")) break;
      if (node.tagName === "P" && normalizeProfileText(node.textContent)) node.classList.add("apa-reference");
      node = node.nextElementSibling;
    }
  }

  preview.querySelectorAll("img").forEach((image) => {
    if (image.classList.contains("apa-figure-image")) {
      image.classList.add("module-figure-image");
      if (!image.alt?.trim()) image.alt = "Figura del módulo académico";
    }
  });

  markTableSemantics(preview);
  linkifyPlainUrls(preview);
}

function ensureModuleProfileStyles() {
  if (document.querySelector("#module11c-profile-styles")) return;
  const style = document.createElement("style");
  style.id = "module11c-profile-styles";
  style.textContent = `
    .apa-paper.module11c-profile {
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 12pt !important;
      line-height: 2 !important;
    }
    .apa-paper.module11c-profile p { margin: 0 !important; }

    /* APA 7: headings use the same font and size as the body. */
    .apa-paper.module11c-profile .module-heading {
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 12pt !important;
      line-height: 2 !important;
      text-indent: 0 !important;
      color: #000 !important;
    }
    .apa-paper.module11c-profile .apa-heading-level-1 {
      text-align: center !important;
      font-weight: 700 !important;
      font-style: normal !important;
      margin: 1em 0 0 !important;
    }
    .apa-paper.module11c-profile .apa-heading-level-2 {
      text-align: left !important;
      font-weight: 700 !important;
      font-style: normal !important;
      margin: 1em 0 0 !important;
    }
    .apa-paper.module11c-profile .apa-heading-level-3 {
      text-align: left !important;
      font-weight: 700 !important;
      font-style: italic !important;
      margin: 1em 0 0 !important;
    }
    .apa-paper.module11c-profile .references-heading,
    .apa-paper.module11c-profile .apa-references-heading {
      text-align: center !important;
      font-size: 12pt !important;
      font-weight: 700 !important;
      font-style: normal !important;
      margin: 1em 0 0 !important;
    }

    .apa-paper.module11c-profile .module-lead,
    .apa-paper.module11c-profile .module-keywords { text-indent: 0 !important; }
    .apa-paper.module11c-profile .module-keywords { font-weight: 700 !important; }
    .apa-paper.module11c-profile ul,
    .apa-paper.module11c-profile ol { margin: 0 0 .6em .45in !important; padding-left: .25in !important; }
    .apa-paper.module11c-profile li { margin: 0 !important; padding: 0 !important; }

    .apa-paper.module11c-profile .apa-figure-label,
    .apa-paper.module11c-profile .module-table-label {
      font-weight: 700 !important;
      text-indent: 0 !important;
      margin: 1em 0 0 !important;
    }
    .apa-paper.module11c-profile .apa-figure-title,
    .apa-paper.module11c-profile .module-table-title {
      font-style: italic !important;
      text-indent: 0 !important;
      margin: 0 !important;
    }
    .apa-paper.module11c-profile .module-figure-image,
    .apa-paper.module11c-profile img.apa-figure-image {
      display: block !important;
      width: auto !important;
      max-width: 100% !important;
      height: auto !important;
      margin: .35em auto .35em !important;
    }
    .apa-paper.module11c-profile .apa-note,
    .apa-paper.module11c-profile .module-table-note {
      text-indent: 0 !important;
      font-size: 12pt !important;
      margin: .15em 0 .7em !important;
    }
    .apa-paper.module11c-profile .module-example { text-indent: .5in !important; }

    /* APA 7 table presentation: no vertical rules and only essential horizontal rules. */
    .apa-paper.module11c-profile table.apa7-strict-table {
      width: 100% !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      border: 0 !important;
      margin: .25em 0 .35em !important;
      line-height: 1.15 !important;
    }
    .apa-paper.module11c-profile table.apa7-strict-table th,
    .apa-paper.module11c-profile table.apa7-strict-table td {
      border: 0 !important;
      padding: .22em .28em !important;
      vertical-align: top !important;
      line-height: 1.15 !important;
      background: transparent !important;
    }
    .apa-paper.module11c-profile table.apa7-strict-table tr:first-child th,
    .apa-paper.module11c-profile table.apa7-strict-table tr:first-child td {
      border-top: 1.25px solid #000 !important;
      border-bottom: 1px solid #000 !important;
      font-weight: 700 !important;
      text-align: center !important;
    }
    .apa-paper.module11c-profile table.apa7-strict-table tr:first-child th:first-child,
    .apa-paper.module11c-profile table.apa7-strict-table tr:first-child td:first-child {
      text-align: left !important;
    }
    .apa-paper.module11c-profile table.apa7-strict-table tr:last-child td,
    .apa-paper.module11c-profile table.apa7-strict-table tr:last-child th {
      border-bottom: 1.25px solid #000 !important;
    }
    .apa-paper.module11c-profile table.apa7-strict-table td.apa-text-cell { text-align: left !important; }
    .apa-paper.module11c-profile table.apa7-strict-table td.apa-numeric-cell { text-align: right !important; }

    .apa-paper.module11c-profile .apa-reference {
      padding-left: .5in !important;
      text-indent: -.5in !important;
      margin: 0 !important;
    }
    .apa-paper.module11c-profile a { color: #0563c1 !important; text-decoration: underline !important; }
  `;
  document.head.append(style);
}

function applyModuleProfile({ announce = false } = {}) {
  const preview = document.querySelector("#preview");
  if (!preview) return;

  if (!moduleProfileEnabled()) {
    preview.classList.remove("module11c-profile", "apa7-strict-profile");
    return;
  }

  const font = document.querySelector("#fontFamily");
  if (font && font.value !== "Arial") {
    font.value = "Arial";
    font.dispatchEvent(new Event("change", { bubbles: true }));
  }

  for (const id of ["firstLineIndent", "hangingReferences"]) {
    const input = document.querySelector(`#${id}`);
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  markModuleSemantics(preview);

  if (announce) {
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = `Perfil APA 7 estricto v${MODULE_PROFILE_VERSION} aplicado según la estructura del módulo institucional.`;
      status.className = "status success";
    }
  }
}

function initializeModuleProfile() {
  ensureModuleProfileStyles();
  const select = document.querySelector(`#${PROFILE_ID}`);
  if (!select) return;

  select.addEventListener("change", () => applyModuleProfile({ announce: true }));
  applyModuleProfile();

  const preview = document.querySelector("#preview");
  if (!preview) return;
  let timer;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => applyModuleProfile(), 80);
  });
  observer.observe(preview, { childList: true, subtree: true, characterData: true });

  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#formatBtn,#reauditBtn")) return;
    setTimeout(() => applyModuleProfile(), 150);
    setTimeout(() => applyModuleProfile(), 800);
  }, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeModuleProfile, { once: true });
else initializeModuleProfile();
