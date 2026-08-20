const THESIS_PROFILE_VERSION = "2.6";
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
  const blocks = [...preview.querySelectorAll("h1,h2,h3,h4,h5,h6,p")];
  let beforeApproval = true;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const text = thesisText(block.textContent);
    if (!text) continue;

    if (/^Página de aprobación$/i.test(text)) beforeApproval = false;
    if (beforeApproval) block.classList.add("thesis-cover-block", "no-indent");

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
  const requiredCommon = ["Resumen", "Abstract", "Tabla de contenido", "Capítulo I", "Referencias"];
  const requiredDoctoral = ["Página de aprobación", "Certificación de autoría", "Capítulo II", "Capítulo III", "Capítulo IV", "Capítulo V"];

  for (const label of requiredCommon) {
    if (!new RegExp(label.replace(" ", "\\s+"), "i").test(text)) findings.push(`Falta o no se detectó: ${label}.`);
  }
  if (doctoral) {
    for (const label of requiredDoctoral) if (!new RegExp(label.replace(" ", "\\s+"), "i").test(text)) findings.push(`Perfil doctoral: falta o no se detectó ${label}.`);
    if (!/3\.7\s+Consideraciones Éticas/i.test(text)) findings.push("Perfil doctoral: no se detectó la sección 3.7 Consideraciones Éticas indicada por la plantilla.");
  }

  const headings = [...preview.querySelectorAll(".thesis-major-heading,.thesis-section-heading")].length;
  const refs = preview.querySelectorAll(".thesis-reference,.apa-reference").length;
  return { findings, headings, refs };
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
  summary.textContent = `${thesisDegreeLabel()}: ${result.headings} encabezado(s) estructurales y ${result.refs} referencia(s) detectadas.`;
  list.append(summary);
  for (const finding of result.findings.slice(0, 8)) {
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

  markThesisStructure(preview);
  setTimeout(appendThesisAudit, 80);

  if (announce) {
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = `${thesisDegreeLabel()} — perfil institucional v${THESIS_PROFILE_VERSION} aplicado: TNR 12, doble espacio, margen izquierdo 1.5\", demás 1\", preliminares y capítulos.`;
      status.className = "status success";
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
