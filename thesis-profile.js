const THESIS_PROFILE_VERSION = "2.7";
const THESIS_DOCTORAL = "thesis-doctoral";
const THESIS_MASTERS = "thesis-masters";

function thesisProfileValue() {
  return document.querySelector("#formatProfile")?.value || "";
}

function thesisProfileEnabled() {
  return [THESIS_DOCTORAL, THESIS_MASTERS].includes(thesisProfileValue());
}

function thesisDegreeLabel() {
  return thesisProfileValue() === THESIS_DOCTORAL ? "Disertación doctoral" : "Tesis de maestría";
}

function thesisText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function thesisNextBlock(element) {
  let node = element?.nextElementSibling || null;
  while (node && !thesisText(node.textContent) && !["IMG", "TABLE"].includes(node.tagName)) node = node.nextElementSibling;
  return node;
}

function isPreliminaryHeading(text) {
  return /^(Página de aprobación|Certificación de autoría|Dedicatoria|Agradecimientos?|Resumen|Abstract|Tabla de contenido|Índice de figuras|Índice de tablas)$/i.test(text);
}

function isMajorThesisHeading(text) {
  return isPreliminaryHeading(text) || /^Capítulo\s+[IVXLC]+\b/i.test(text) || /^(Referencias|Apéndices)$/i.test(text);
}

function thesisStructureInfo(preview) {
  const blocks = [...preview.querySelectorAll("h1,h2,h3,h4,h5,h6,p")].filter((el) => thesisText(el.textContent));
  const texts = blocks.map((el) => thesisText(el.textContent));
  const approvalIndex = texts.findIndex((text) => /^Página de aprobación$/i.test(text));
  const firstPrelimIndex = texts.findIndex((text) => isPreliminaryHeading(text));
  const chapterIndex = texts.findIndex((text) => /^Capítulo\s+I\b/i.test(text));
  const moduleSignals = [
    /Objetivos del módulo/i,
    /Palabras clave/i,
    /Lecturas y recursos requeridos/i,
    /^Tema\s+1\./im,
    /Contenido del módulo/i,
  ].filter((pattern) => pattern.test(thesisText(preview.textContent))).length;

  let mode = "body-only";
  if (chapterIndex >= 0 && firstPrelimIndex >= 0) mode = "full-thesis";
  else if (chapterIndex >= 0) mode = "body-with-chapter";
  else if (firstPrelimIndex >= 0) mode = "prelim-only";
  if (moduleSignals >= 2) mode = "module-like";

  const coverBoundary = chapterIndex >= 0
    ? (approvalIndex > 0 ? approvalIndex : (firstPrelimIndex > 0 ? firstPrelimIndex : chapterIndex))
    : (approvalIndex > 0 ? approvalIndex : (firstPrelimIndex > 0 ? firstPrelimIndex : 0));

  return { blocks, texts, approvalIndex, firstPrelimIndex, chapterIndex, moduleSignals, mode, coverBoundary };
}

function clearThesisSemanticClasses(preview) {
  const classes = [
    "thesis-cover-block", "thesis-major-heading", "thesis-prelim-heading", "thesis-page-start",
    "thesis-chapter-heading", "thesis-chapter-title", "thesis-section-heading", "thesis-references-heading",
    "thesis-reference", "thesis-table-label", "thesis-table-title", "thesis-figure-label", "thesis-figure-title",
    "thesis-note", "thesis-figure-image"
  ];
  preview.querySelectorAll("*").forEach((el) => {
    classes.forEach((name) => el.classList.remove(name));
    if (el.dataset?.thesisChapter) delete el.dataset.thesisChapter;
  });
}

function markThesisReferences(preview) {
  const heading = [...preview.querySelectorAll("h1,h2,h3,h4,h5,h6,p")]
    .find((el) => /^Referencias$/i.test(thesisText(el.textContent)));
  if (!heading) return;
  heading.classList.add("thesis-major-heading", "thesis-page-start", "thesis-references-heading", "no-indent");
  let node = heading.nextElementSibling;
  while (node) {
    const text = thesisText(node.textContent);
    if (!text) { node = node.nextElementSibling; continue; }
    if (isMajorThesisHeading(text) && !/^Referencias$/i.test(text)) break;
    if (node.tagName === "P") node.classList.add("apa-reference", "thesis-reference");
    node = node.nextElementSibling;
  }
}

function markThesisTablesAndFigures(preview) {
  const blocks = [...preview.querySelectorAll("h1,h2,h3,h4,h5,h6,p")];
  for (const block of blocks) {
    const text = thesisText(block.textContent);
    if (/^Tabla\s+\d+[A-Za-z]?\.?$/i.test(text)) {
      block.classList.add("thesis-table-label", "no-indent");
      const next = thesisNextBlock(block);
      if (next && next.tagName !== "TABLE") next.classList.add("thesis-table-title", "no-indent");
    }
    if (/^Figura\s+\d+[A-Za-z]?\.?$/i.test(text)) {
      block.classList.add("apa-figure-label", "thesis-figure-label", "no-indent");
      const next = thesisNextBlock(block);
      if (next && next.tagName !== "IMG" && !/^Nota\./i.test(thesisText(next.textContent))) next.classList.add("apa-figure-title", "thesis-figure-title", "no-indent");
    }
    if (/^Nota\./i.test(text)) block.classList.add("apa-note", "thesis-note", "no-indent");
  }
  preview.querySelectorAll("table").forEach((table) => table.classList.add("thesis-apa-table", "apa7-strict-table"));
  preview.querySelectorAll("img.apa-figure-image").forEach((img) => img.classList.add("thesis-figure-image"));
}

function markThesisStructure(preview) {
  clearThesisSemanticClasses(preview);
  const structure = thesisStructureInfo(preview);
  preview.dataset.thesisStructureMode = structure.mode;

  for (let i = 0; i < structure.blocks.length; i += 1) {
    const block = structure.blocks[i];
    const text = structure.texts[i];

    if (structure.coverBoundary > 0 && i < structure.coverBoundary) {
      block.classList.add("thesis-cover-block", "no-indent");
    }

    if (isPreliminaryHeading(text)) {
      block.classList.add("thesis-major-heading", "thesis-prelim-heading", "thesis-page-start", "no-indent");
    }

    if (/^Capítulo\s+[IVXLC]+\b/i.test(text)) {
      block.classList.add("thesis-major-heading", "thesis-chapter-heading", "thesis-page-start", "no-indent");
      block.dataset.thesisChapter = text.match(/^Capítulo\s+[IVXLC]+/i)?.[0] || text;
      const next = thesisNextBlock(block);
      if (next && !/^\d+\.\d+\s+/.test(thesisText(next.textContent))) next.classList.add("thesis-chapter-title", "no-indent");
    }

    if (/^\d+\.\d+(?:\.\d+)?\s+\S+/i.test(text)) {
      block.classList.add("thesis-section-heading", "no-indent");
    }

    if (/^(Referencias|Apéndices)$/i.test(text)) {
      block.classList.add("thesis-major-heading", "thesis-page-start", "no-indent");
    }
  }

  markThesisReferences(preview);
  markThesisTablesAndFigures(preview);
  return structure;
}

function ensureThesisStyles() {
  if (document.querySelector("#thesis-profile-styles")) return;
  const style = document.createElement("style");
  style.id = "thesis-profile-styles";
  style.textContent = `
    .apa-paper.thesis-profile {
      font-family: "Times New Roman", Times, serif !important;
      font-size: 12pt !important;
      line-height: 2 !important;
      padding: 1in 1in 1in 1.5in !important;
    }
    .apa-paper.thesis-profile p { margin: 0 !important; text-indent: .5in !important; }
    .apa-paper.thesis-profile .no-indent,
    .apa-paper.thesis-profile .thesis-cover-block,
    .apa-paper.thesis-profile .thesis-major-heading,
    .apa-paper.thesis-profile .thesis-section-heading,
    .apa-paper.thesis-profile .thesis-chapter-title,
    .apa-paper.thesis-profile .apa-reference { text-indent: 0 !important; }

    .apa-paper.thesis-profile .thesis-cover-block { text-align: center !important; }
    .apa-paper.thesis-profile .thesis-major-heading,
    .apa-paper.thesis-profile .thesis-chapter-heading,
    .apa-paper.thesis-profile .thesis-chapter-title,
    .apa-paper.thesis-profile .thesis-references-heading {
      font: inherit !important;
      font-weight: 700 !important;
      text-align: center !important;
      margin: 0 !important;
    }
    .apa-paper.thesis-profile .thesis-section-heading {
      font: inherit !important;
      font-weight: 700 !important;
      text-align: left !important;
      margin: 0 !important;
    }
    .apa-paper.thesis-profile .thesis-page-start { break-before: page; page-break-before: always; }
    .apa-paper.thesis-profile .thesis-cover-block:first-child { break-before: auto; page-break-before: auto; }

    .apa-paper.thesis-profile .apa-reference,
    .apa-paper.thesis-profile .thesis-reference {
      padding-left: .5in !important;
      text-indent: -.5in !important;
      margin: 0 !important;
    }
    .apa-paper.thesis-profile .thesis-table-label,
    .apa-paper.thesis-profile .thesis-figure-label { font-weight: 700 !important; text-indent: 0 !important; margin: 0 !important; }
    .apa-paper.thesis-profile .thesis-table-title,
    .apa-paper.thesis-profile .thesis-figure-title { font-style: italic !important; text-indent: 0 !important; margin: 0 !important; }
    .apa-paper.thesis-profile .thesis-note { text-indent: 0 !important; margin: 0 0 .5em !important; }
    .apa-paper.thesis-profile .thesis-figure-image { display: block !important; max-width: 100% !important; height: auto !important; margin: .25em auto !important; }

    .apa-paper.thesis-profile table.thesis-apa-table { width: 100% !important; border-collapse: collapse !important; border: 0 !important; line-height: 1.2 !important; margin: .25em 0 !important; }
    .apa-paper.thesis-profile table.thesis-apa-table th,
    .apa-paper.thesis-profile table.thesis-apa-table td { border: 0 !important; padding: .2em .3em !important; vertical-align: top !important; }
    .apa-paper.thesis-profile table.thesis-apa-table tr:first-child th,
    .apa-paper.thesis-profile table.thesis-apa-table tr:first-child td { border-top: 1.25px solid #000 !important; border-bottom: 1px solid #000 !important; font-weight: 700 !important; }
    .apa-paper.thesis-profile table.thesis-apa-table tr:last-child th,
    .apa-paper.thesis-profile table.thesis-apa-table tr:last-child td { border-bottom: 1.25px solid #000 !important; }
  `;
  document.head.append(style);
}

function thesisAudit(preview) {
  const text = thesisText(preview.textContent);
  const findings = [];
  const doctoral = thesisProfileValue() === THESIS_DOCTORAL;
  const structure = thesisStructureInfo(preview);
  const requiredCommon = ["Resumen", "Abstract", "Tabla de contenido", "Capítulo I", "Referencias"];
  const requiredDoctoral = ["Página de aprobación", "Certificación de autoría", "Capítulo II", "Capítulo III", "Capítulo IV", "Capítulo V"];

  if (structure.mode === "module-like") {
    findings.push("El archivo parece ser un módulo académico, no una tesis/disertación. No se aplicará numeración romana a todo el documento; el DOCX se tratará como cuerpo académico con numeración arábiga desde 1.");
  } else if (structure.chapterIndex < 0 && structure.firstPrelimIndex < 0) {
    findings.push("No se detectaron preliminares ni Capítulo I. El DOCX se exportará como cuerpo académico y comenzará en página 1 arábiga.");
  } else if (structure.chapterIndex < 0) {
    findings.push("Se detectaron páginas preliminares, pero no Capítulo I. Solo los preliminares usarán números romanos hasta que el documento incluya el cuerpo de la tesis.");
  }

  for (const label of requiredCommon) {
    if (!new RegExp(label.replace(" ", "\\s+"), "i").test(text)) findings.push(`Falta o no se detectó: ${label}.`);
  }
  if (doctoral) {
    for (const label of requiredDoctoral) if (!new RegExp(label.replace(" ", "\\s+"), "i").test(text)) findings.push(`Perfil doctoral: falta o no se detectó ${label}.`);
    if (!/3\.7\s+Consideraciones Éticas/i.test(text)) findings.push("Perfil doctoral: no se detectó la sección 3.7 Consideraciones Éticas indicada por la plantilla.");
  }

  const headings = [...preview.querySelectorAll(".thesis-major-heading,.thesis-section-heading")].length;
  const refs = preview.querySelectorAll(".thesis-reference,.apa-reference").length;
  return { findings, headings, refs, structure };
}

function appendThesisAudit() {
  if (!thesisProfileEnabled()) return;
  const preview = document.querySelector("#preview");
  const list = document.querySelector("#auditList");
  if (!preview || !list || preview.querySelector(".placeholder")) return;
  list.querySelectorAll("li[data-thesis-audit]").forEach((li) => li.remove());
  const result = thesisAudit(preview);
  const summary = document.createElement("li");
  summary.dataset.thesisAudit = "true";
  summary.className = result.findings.length ? "warn" : "ok";
  const modeLabels = {
    "full-thesis": "tesis completa",
    "body-with-chapter": "cuerpo con capítulos",
    "prelim-only": "solo preliminares",
    "body-only": "cuerpo académico",
    "module-like": "módulo académico detectado",
  };
  summary.textContent = `${thesisDegreeLabel()}: ${result.headings} encabezado(s), ${result.refs} referencia(s). Estructura: ${modeLabels[result.structure.mode] || result.structure.mode}.`;
  list.append(summary);
  for (const finding of result.findings.slice(0, 10)) {
    const li = document.createElement("li");
    li.dataset.thesisAudit = "true";
    li.className = "warn";
    li.textContent = finding;
    list.append(li);
  }
}

function applyThesisProfile({ announce = false } = {}) {
  const preview = document.querySelector("#preview");
  if (!preview) return;
  preview.classList.remove("thesis-profile", "thesis-doctoral-profile", "thesis-masters-profile");
  if (!thesisProfileEnabled()) return;

  preview.classList.remove("module11c-profile", "apa7-strict-profile");
  preview.classList.add("thesis-profile", thesisProfileValue() === THESIS_DOCTORAL ? "thesis-doctoral-profile" : "thesis-masters-profile");

  const font = document.querySelector("#fontFamily");
  if (font && font.value !== "Times New Roman") {
    font.value = "Times New Roman";
    font.dispatchEvent(new Event("change", { bubbles: true }));
  }
  for (const id of ["firstLineIndent", "hangingReferences", "pageNumbers"]) {
    const input = document.querySelector(`#${id}`);
    if (input && !input.checked) { input.checked = true; input.dispatchEvent(new Event("change", { bubbles: true })); }
  }

  const structure = markThesisStructure(preview);
  setTimeout(appendThesisAudit, 80);

  if (announce) {
    const status = document.querySelector("#status");
    if (status) {
      const special = structure.mode === "module-like"
        ? " Se detectó contenido de módulo; se conservará como cuerpo académico y no como preliminares."
        : (structure.chapterIndex < 0 && structure.firstPrelimIndex < 0 ? " No se detectó Capítulo I ni preliminares; la exportación iniciará en página 1 arábiga." : "");
      status.textContent = `${thesisDegreeLabel()} — perfil institucional v${THESIS_PROFILE_VERSION} aplicado: TNR 12, doble espacio, margen izquierdo 1.5\", demás 1\".${special}`;
      status.className = structure.mode === "module-like" ? "status error" : "status success";
    }
  }
}

function initializeThesisProfiles() {
  ensureThesisStyles();
  const select = document.querySelector("#formatProfile");
  if (!select) return;
  select.addEventListener("change", () => applyThesisProfile({ announce: thesisProfileEnabled() }));

  const preview = document.querySelector("#preview");
  if (preview) {
    let timer;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (thesisProfileEnabled()) applyThesisProfile(); }, 100);
    }).observe(preview, { childList: true, subtree: true });
  }

  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(appendThesisAudit, 100));
  applyThesisProfile();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeThesisProfiles);
else initializeThesisProfiles();