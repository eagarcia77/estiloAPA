// APA7 Academic Formatter v3.4.5
// Conservative APA 7 reference formatting. It fixes visible layout, DOI/URL form,
// ordering and safe italics patterns without inventing missing bibliographic data.

const REFERENCE_FORMAT_VERSION = "3.4.5";
let refFormatTimer = null;

const rfQ = (selector, root = document) => root.querySelector(selector);
const rfQA = (selector, root = document) => [...root.querySelectorAll(selector)];
const rfText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const rfEscape = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function rfInstitutional() {
  return rfQ("#formatProfile")?.value === "modulo11c";
}

function rfHeadingRegex(text) {
  return /^(Referencias(?: bibliogr[aá]ficas)?|References|Lista de referencias)$/i.test(rfText(text));
}

function rfReferenceSections(root) {
  const sections = rfQA("section[data-source-file]", root);
  return sections.length ? sections : [root];
}

function rfReferenceNodes(root = rfQ("#preview")) {
  if (!root) return [];
  const found = [];

  for (const section of rfReferenceSections(root)) {
    const blocks = [...section.children];
    let inReferences = false;
    for (const block of blocks) {
      const text = rfText(block.textContent);
      if (!text) continue;
      if (rfHeadingRegex(text)) {
        block.classList.add("apa-references-heading", "references-heading", "apa-heading-level-1", "no-indent");
        block.dataset.apaHeadingLevel = "1";
        inReferences = true;
        continue;
      }
      if (inReferences && /^H[1-6]$/.test(block.tagName) && !block.classList.contains("apa-reference")) {
        inReferences = false;
      }
      if (!inReferences) continue;

      if (["P", "DIV", "LI"].includes(block.tagName) && text) {
        block.classList.add("apa-reference", "no-indent");
        block.dataset.apaReference = "true";
        found.push(block);
      }
    }
  }

  return [...new Set([...found, ...rfQA(".apa-reference", root)])];
}

function normalizeDoiString(text) {
  let value = rfText(text);
  value = value.replace(/https?:\/\/dx\.doi\.org\//gi, "https://doi.org/");
  value = value.replace(/\bdoi\s*:\s*(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi, "https://doi.org/$1");
  if (!/https:\/\/doi\.org\//i.test(value)) {
    value = value.replace(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i, "https://doi.org/$1");
  }
  return value.replace(/(https?:\/\/\S+?)[.,;:]$/i, "$1");
}

function linkifyReferenceText(text) {
  const normalized = normalizeDoiString(text);
  const regex = /(https?:\/\/[^\s<]+)/gi;
  let html = "";
  let cursor = 0;
  for (const match of normalized.matchAll(regex)) {
    html += rfEscape(normalized.slice(cursor, match.index));
    const raw = match[0];
    const clean = raw.replace(/[.,;:)\]]+$/, "");
    const trailing = raw.slice(clean.length);
    html += `<a href="${rfEscape(clean)}" target="_blank" rel="noopener noreferrer">${rfEscape(clean)}</a>`;
    if (trailing) html += rfEscape(trailing);
    cursor = match.index + raw.length;
  }
  html += rfEscape(normalized.slice(cursor));
  return html;
}

function detectReferenceKind(text) {
  const value = rfText(text);
  if (/\b(dissertation|doctoral dissertation|master'?s thesis|tesis|disertaci[oó]n)\b/i.test(value)) return "thesis";
  if (/\b(report|informe|technical report|policy brief)\b/i.test(value)) return "report";
  if (/\b\d+\s*\(\d+\)\s*,\s*(?:\d|Article\b)/i.test(value) || /,\s*\d+(?:\(\d+\))?,\s*(?:\d|Article\b)/i.test(value)) return "article";
  if (/https?:\/\/(?!doi\.org)/i.test(value)) return "web";
  if (/\b(Pearson|Routledge|Springer|Wiley|SAGE|Sage|Press|Publishing|McGraw|Elsevier)\b/.test(value)) return "book";
  return "other";
}

function conservativeReferenceHtml(text) {
  const normalized = normalizeDoiString(text);
  const kind = detectReferenceKind(normalized);
  const year = normalized.match(/\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)\.\s*/i);
  if (!year) return linkifyReferenceText(normalized);

  const afterYear = (year.index || 0) + year[0].length;

  if (kind === "article") {
    const rest = normalized.slice(afterYear);
    const titleEnd = rest.indexOf(". ");
    if (titleEnd > 3) {
      const sourceStart = afterYear + titleEnd + 2;
      const sourceAndMore = normalized.slice(sourceStart);
      const volume = sourceAndMore.match(/,\s*(\d+)(\([^)]*\))?\s*,/);
      if (volume?.index > 1) {
        const journal = sourceAndMore.slice(0, volume.index).trim();
        const vol = volume[1];
        const issue = volume[2] || "";
        const before = normalized.slice(0, sourceStart);
        const after = sourceAndMore.slice((volume.index || 0) + volume[0].length);
        return `${linkifyReferenceText(before)}<em>${rfEscape(journal)}, ${rfEscape(vol)}</em>${rfEscape(issue)}, ${linkifyReferenceText(after)}`;
      }
    }
  }

  if (["book", "web", "report", "thesis"].includes(kind)) {
    const rest = normalized.slice(afterYear);
    const titleEnd = rest.indexOf(". ");
    if (titleEnd > 3) {
      const title = rest.slice(0, titleEnd).trim();
      if (title.split(/\s+/).length >= 2) {
        const before = normalized.slice(0, afterYear);
        const after = rest.slice(titleEnd + 2);
        return `${linkifyReferenceText(before)}<em>${rfEscape(title)}</em>. ${linkifyReferenceText(after)}`;
      }
    }
  }

  return linkifyReferenceText(normalized);
}

function applyReferenceTypography(node) {
  const original = rfText(node.textContent);
  if (!original) return;

  const alreadyItalicized = Boolean(node.querySelector("em,i"));
  if (alreadyItalicized) {
    node.querySelectorAll("a[href]").forEach((anchor) => {
      const value = normalizeDoiString(anchor.getAttribute("href") || anchor.textContent || "");
      if (/^https?:\/\//i.test(value)) {
        anchor.href = value;
        anchor.textContent = value;
      }
    });
    return;
  }

  node.innerHTML = conservativeReferenceHtml(original);
}

function referenceSortKey(node) {
  const text = rfText(node.textContent);
  const year = text.match(/\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)/i);
  const author = year ? text.slice(0, year.index) : text;
  return author
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sortReferenceNodes(nodes) {
  if (rfQ("#sortReferences")?.checked === false || nodes.length < 2) return;
  const grouped = new Map();
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (!grouped.has(parent)) grouped.set(parent, []);
    grouped.get(parent).push(node);
  }

  for (const [parent, entries] of grouped) {
    const heading = [...parent.children].find((node) => rfHeadingRegex(node.textContent));
    if (!heading || entries.length < 2) continue;
    entries.sort((a, b) => referenceSortKey(a).localeCompare(referenceSortKey(b), "es", { sensitivity: "base" }));
    let anchor = heading;
    for (const entry of entries) {
      anchor.after(entry);
      anchor = entry;
    }
  }
}

function formatReferencesApa7(root = rfQ("#preview"), { announce = false } = {}) {
  if (!root || root.querySelector(".placeholder") || !rfInstitutional()) return 0;
  const nodes = rfReferenceNodes(root);

  for (const node of nodes) {
    node.classList.add("apa-reference", "no-indent");
    node.dataset.apaReference = "true";
    node.dataset.apaEditorStyle = "reference";
    node.dataset.apaEditorAlign = "left";
    node.dataset.apaEditorIndent = "hanging";
    node.dataset.apaEditorLine = "2";
    node.style.fontFamily = "Arial, Helvetica, sans-serif";
    node.style.fontSize = "12pt";
    node.style.lineHeight = "2";
    node.style.textAlign = "left";
    node.style.paddingLeft = ".5in";
    node.style.textIndent = "-.5in";
    node.style.margin = "0";
    applyReferenceTypography(node);
  }

  sortReferenceNodes(nodes);

  const headings = rfQA(".apa-references-heading,.references-heading", root);
  headings.forEach((heading) => {
    heading.classList.add("apa-heading-level-1", "no-indent");
    heading.dataset.apaHeadingLevel = "1";
    heading.style.fontFamily = "Arial, Helvetica, sans-serif";
    heading.style.fontSize = "12pt";
    heading.style.fontWeight = "700";
    heading.style.fontStyle = "normal";
    heading.style.textAlign = "center";
    heading.style.textIndent = "0";
    heading.style.margin = "1em 0 0";
  });

  root.dataset.apaReferencesFormatted = String(nodes.length);

  if (announce && nodes.length) {
    const status = rfQ("#status");
    if (status) {
      status.textContent = `Referencias APA 7 v${REFERENCE_FORMAT_VERSION}: ${nodes.length} entrada(s) formateada(s) con doble espacio, sangría francesa, orden alfabético y DOI/URL normalizados cuando estaban presentes.`;
      status.className = "status success";
    }
  }
  return nodes.length;
}

function installReferenceStyles() {
  if (rfQ("#reference-format-v345-style")) return;
  const style = document.createElement("style");
  style.id = "reference-format-v345-style";
  style.textContent = `
    .apa-paper.module11c-profile .apa-references-heading,
    .apa-paper.module11c-profile .references-heading {
      text-align:center !important;
      font-weight:700 !important;
      font-style:normal !important;
      font-size:12pt !important;
      line-height:2 !important;
      text-indent:0 !important;
      margin:1em 0 0 !important;
    }
    .apa-paper.module11c-profile .apa-reference {
      font-family:Arial,Helvetica,sans-serif !important;
      font-size:12pt !important;
      line-height:2 !important;
      text-align:left !important;
      padding-left:.5in !important;
      text-indent:-.5in !important;
      margin:0 !important;
    }
    .apa-paper.module11c-profile .apa-reference a {
      color:#0563c1 !important;
      text-decoration:underline !important;
    }
  `;
  document.head.append(style);
}

function scheduleReferences(delay = 180, announce = false) {
  clearTimeout(refFormatTimer);
  refFormatTimer = setTimeout(() => formatReferencesApa7(rfQ("#preview"), { announce }), delay);
}

function initializeReferenceFormatting() {
  installReferenceStyles();
  rfQ("#formatBtn")?.addEventListener("click", () => scheduleReferences(1250));
  rfQ("#reauditBtn")?.addEventListener("click", () => scheduleReferences(180));
  rfQ("#sortReferences")?.addEventListener("change", () => scheduleReferences(80));
  rfQ("#formatReferenceList")?.addEventListener("click", () => scheduleReferences(40, true));
  scheduleReferences(900);
}

window.formatReferencesApa7 = formatReferencesApa7;
window.REFERENCE_FORMAT_VERSION = REFERENCE_FORMAT_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeReferenceFormatting, { once: true });
else initializeReferenceFormatting();
