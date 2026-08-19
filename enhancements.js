const ENHANCEMENT_VERSION = "2.1";

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bet\s+al\.?\b/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAuthorKey(authorText) {
  const normalized = normalizeToken(authorText);
  if (!normalized) return "";
  return normalized.split(/[\s,;]+/).find(Boolean) || "";
}

function getPreview() {
  return document.querySelector("#preview");
}

function getReferenceElements() {
  return [...(getPreview()?.querySelectorAll(".apa-reference") || [])];
}

function getBodyTextWithoutReferences() {
  const preview = getPreview();
  if (!preview) return "";
  const clone = preview.cloneNode(true);
  clone.querySelectorAll(".apa-reference,.apa-references-heading").forEach((node) => node.remove());
  return clone.innerText || clone.textContent || "";
}

function parseReference(element, index) {
  const text = element.textContent.replace(/\s+/g, " ").trim();
  const yearMatch = text.match(/\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)/i);
  const year = yearMatch ? yearMatch[1].toLowerCase() : "";
  const lead = yearMatch ? text.slice(0, yearMatch.index).replace(/[.\s]+$/g, "").trim() : text.split(".")[0].trim();
  const author = firstAuthorKey(lead);
  const key = author && year ? `${author}|${year}` : "";
  return { index, element, text, year, lead, author, key };
}

function extractCitations(text) {
  const citations = [];
  const seen = new Set();

  const addCitation = (authorText, year, raw, kind) => {
    const author = firstAuthorKey(authorText);
    const normalizedYear = String(year || "").toLowerCase();
    if (!author || !normalizedYear) return;
    const key = `${author}|${normalizedYear}`;
    const identity = `${key}|${raw}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    citations.push({ author, year: normalizedYear, key, raw: raw.trim(), kind });
  };

  const parenthetical = /\(([^()]{1,180}?)\)/g;
  for (const group of text.matchAll(parenthetical)) {
    const content = group[1];
    for (const part of content.split(";")) {
      const match = part.match(/^\s*(.+?),\s*((?:19|20)\d{2}[a-z]?)\s*(?:,.*)?$/i);
      if (match) addCitation(match[1], match[2], `(${part.trim()})`, "parentética");
    }
  }

  const narrative = /\b([A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü'’.-]+)(?:\s+et\s+al\.)?\s*\(((?:19|20)\d{2}[a-z]?)\)/g;
  for (const match of text.matchAll(narrative)) {
    addCitation(match[1], match[2], match[0], "narrativa");
  }

  return citations;
}

function normalizeReferenceText(text) {
  let value = String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  value = value.replace(/^\s*(?:\d+[.)]|[-•])\s+/, "");
  value = value.replace(/\b(?:doi\s*:\s*|DOI\s*:\s*)(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s]+)\b/gi, "https://doi.org/$1");
  value = value.replace(/https?:\/\/dx\.doi\.org\//gi, "https://doi.org/");
  value = value.replace(/https?:\/\/doi\.org\/https?:\/\/(?:dx\.)?doi\.org\//gi, "https://doi.org/");
  value = value.replace(/\(\s*((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\s*\)\s*\./gi, "($1).");
  value = value.replace(/\s+([,.;:])/g, "$1");
  value = value.replace(/(https?:\/\/\S+?)[.,;:]+$/i, "$1");
  return value.trim();
}

function referenceIssues(ref, duplicateKeys) {
  const issues = [];
  const text = ref.text;

  if (!ref.year) issues.push("No se detecta año entre paréntesis.");
  if (!ref.author) issues.push("No se identifica claramente el autor o autor corporativo.");
  if (/\bdoi\s*:/i.test(text)) issues.push("El DOI debe expresarse como URL: https://doi.org/…");
  if (/https?:\/\/dx\.doi\.org\//i.test(text)) issues.push("Use https://doi.org/ en lugar de dx.doi.org.");
  if (/(https?:\/\/\S+)[.,;:]$/i.test(text)) issues.push("La URL/DOI termina con puntuación; APA 7 normalmente no añade punto después de la URL.");
  if (/^\s*(?:\d+[.)]|[-•])\s+/.test(text)) issues.push("La referencia comienza con viñeta o numeración; la lista APA no se numera.");
  if (/\s{2,}/.test(text)) issues.push("Contiene espacios consecutivos.");
  if (ref.key && duplicateKeys.has(ref.key)) issues.push("Puede ser una referencia duplicada para el mismo autor y año.");
  return issues;
}

function analyzeAdvanced() {
  const refs = getReferenceElements().map(parseReference);
  const citations = extractCitations(getBodyTextWithoutReferences());
  const referenceKeys = new Set(refs.map((ref) => ref.key).filter(Boolean));
  const citationKeys = new Set(citations.map((citation) => citation.key));

  const duplicateCount = new Map();
  refs.forEach((ref) => {
    if (ref.key) duplicateCount.set(ref.key, (duplicateCount.get(ref.key) || 0) + 1);
  });
  const duplicateKeys = new Set([...duplicateCount.entries()].filter(([, count]) => count > 1).map(([key]) => key));

  const unmatchedCitations = citations.filter((citation) => !referenceKeys.has(citation.key));
  const uncitedReferences = refs.filter((ref) => ref.key && !citationKeys.has(ref.key));
  const referenceReview = refs.map((ref) => ({ ...ref, issues: referenceIssues(ref, duplicateKeys) }));
  const issueCount = referenceReview.reduce((sum, ref) => sum + ref.issues.length, 0);

  return {
    refs,
    citations,
    unmatchedCitations,
    uncitedReferences,
    referenceReview,
    duplicateKeys,
    issueCount,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensureStyles() {
  if (document.querySelector("#apa-enhancement-styles")) return;
  const style = document.createElement("style");
  style.id = "apa-enhancement-styles";
  style.textContent = `
    .advanced-audit { margin-top: 1rem; border-top: 1px solid #d9e1df; padding-top: 1rem; }
    .advanced-audit h3 { margin: 0 0 .6rem; font-size: 1.05rem; }
    .advanced-actions { display:flex; flex-wrap:wrap; gap:.55rem; margin:.75rem 0; }
    .advanced-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:.55rem; margin:.75rem 0; }
    .advanced-card { border:1px solid #d9e1df; border-radius:10px; padding:.65rem; background:#f8fbfa; }
    .advanced-card strong { display:block; font-size:1.15rem; }
    .advanced-table-wrap { overflow:auto; max-height:360px; border:1px solid #d9e1df; border-radius:10px; }
    .advanced-table { width:100%; border-collapse:collapse; font-size:.9rem; }
    .advanced-table th,.advanced-table td { border-bottom:1px solid #e4e9e7; padding:.55rem; text-align:left; vertical-align:top; }
    .advanced-table th { position:sticky; top:0; background:#f4f7f6; z-index:1; }
    .advanced-ok { color:#136b3f; font-weight:700; }
    .advanced-warn { color:#7a5b00; font-weight:700; }
    .advanced-bad { color:#a32424; font-weight:700; }
    .advanced-note { color:#5d6966; font-size:.9rem; }
  `;
  document.head.append(style);
}

function ensurePanel() {
  const audit = document.querySelector("section.audit");
  if (!audit) return null;
  let panel = document.querySelector("#advancedApaAudit");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "advancedApaAudit";
  panel.className = "advanced-audit";
  panel.innerHTML = `
    <h3>Revisión avanzada de citas y referencias</h3>
    <p class="advanced-note">Correcciones automáticas limitadas a cambios seguros de presentación. Los datos bibliográficos deben verificarse con la fuente original.</p>
    <div class="advanced-actions">
      <button type="button" id="safeFixReferences">Aplicar correcciones seguras</button>
      <button type="button" id="refreshAdvancedAudit">Revisar ahora</button>
      <button type="button" id="downloadAdvancedCsv">Descargar matriz CSV</button>
    </div>
    <div id="advancedAuditContent" aria-live="polite"></div>
  `;
  audit.append(panel);

  panel.querySelector("#safeFixReferences").addEventListener("click", applySafeReferenceFixes);
  panel.querySelector("#refreshAdvancedAudit").addEventListener("click", renderAdvancedAudit);
  panel.querySelector("#downloadAdvancedCsv").addEventListener("click", downloadAdvancedCsv);
  return panel;
}

function renderAdvancedAudit() {
  const panel = ensurePanel();
  const target = panel?.querySelector("#advancedAuditContent");
  if (!target) return;

  const analysis = analyzeAdvanced();
  if (!analysis.refs.length && !analysis.citations.length) {
    target.innerHTML = '<p class="advanced-note">Todavía no hay citas o referencias detectadas para revisar.</p>';
    return;
  }

  const rows = analysis.referenceReview.map((ref) => {
    const status = ref.issues.length ? `<span class="advanced-warn">${ref.issues.length} observación(es)</span>` : '<span class="advanced-ok">Sin alertas básicas</span>';
    const issues = ref.issues.length ? `<ul>${ref.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>` : "—";
    return `<tr><td>${ref.index + 1}</td><td>${escapeHtml(ref.text)}</td><td>${status}</td><td>${issues}</td></tr>`;
  }).join("");

  const unmatched = analysis.unmatchedCitations.length
    ? analysis.unmatchedCitations.map((citation) => `<li>${escapeHtml(citation.raw)} — no se encontró coincidencia por primer autor y año.</li>`).join("")
    : '<li class="advanced-ok">Todas las citas detectadas tienen una coincidencia básica por autor y año.</li>';

  const uncited = analysis.uncitedReferences.length
    ? analysis.uncitedReferences.map((ref) => `<li>${escapeHtml(ref.text)}</li>`).join("")
    : '<li class="advanced-ok">No se detectaron referencias claramente no citadas.</li>';

  target.innerHTML = `
    <div class="advanced-summary">
      <div class="advanced-card"><span>Citas detectadas</span><strong>${analysis.citations.length}</strong></div>
      <div class="advanced-card"><span>Referencias</span><strong>${analysis.refs.length}</strong></div>
      <div class="advanced-card"><span>Citas sin referencia</span><strong>${analysis.unmatchedCitations.length}</strong></div>
      <div class="advanced-card"><span>Observaciones</span><strong>${analysis.issueCount}</strong></div>
    </div>
    <details ${analysis.unmatchedCitations.length ? "open" : ""}>
      <summary><strong>Citas sin referencia detectada (${analysis.unmatchedCitations.length})</strong></summary>
      <ul>${unmatched}</ul>
    </details>
    <details>
      <summary><strong>Referencias sin cita detectada (${analysis.uncitedReferences.length})</strong></summary>
      <ul>${uncited}</ul>
    </details>
    <details>
      <summary><strong>Revisión individual de referencias</strong></summary>
      <div class="advanced-table-wrap">
        <table class="advanced-table">
          <thead><tr><th>#</th><th>Referencia</th><th>Estado</th><th>Observaciones</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">No se detectaron referencias.</td></tr>'}</tbody>
        </table>
      </div>
    </details>
  `;
}

function applySafeReferenceFixes() {
  const refs = getReferenceElements();
  if (!refs.length) {
    renderAdvancedAudit();
    return;
  }

  let changed = 0;
  let skippedRichText = 0;
  for (const ref of refs) {
    const before = ref.textContent.trim();
    const after = normalizeReferenceText(before);
    if (after === before) continue;

    // No reemplazamos contenido enriquecido porque podría eliminar cursivas, enlaces u otro marcado útil.
    if (ref.children.length > 0) {
      skippedRichText += 1;
      continue;
    }

    ref.textContent = after;
    changed += 1;
  }

  const preview = getPreview();
  preview?.dispatchEvent(new Event("input", { bubbles: true }));
  renderAdvancedAudit();

  const status = document.querySelector("#status");
  if (status) {
    const skippedMessage = skippedRichText
      ? ` ${skippedRichText} referencia(s) con cursivas/enlaces se dejaron intactas para preservar el formato.`
      : "";
    status.textContent = changed
      ? `APA7 v${ENHANCEMENT_VERSION}: se aplicaron correcciones seguras a ${changed} referencia(s).${skippedMessage} Revise los datos bibliográficos manualmente.`
      : `APA7 v${ENHANCEMENT_VERSION}: no se aplicaron cambios automáticos.${skippedMessage}`;
    status.className = "status success";
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadAdvancedCsv() {
  const analysis = analyzeAdvanced();
  const lines = [["tipo", "autor_clave", "anio", "texto", "estado"]];

  for (const citation of analysis.citations) {
    lines.push([
      "cita",
      citation.author,
      citation.year,
      citation.raw,
      analysis.unmatchedCitations.some((item) => item.key === citation.key && item.raw === citation.raw) ? "sin referencia" : "coincidencia básica",
    ]);
  }

  for (const ref of analysis.referenceReview) {
    lines.push([
      "referencia",
      ref.author,
      ref.year,
      ref.text,
      ref.issues.length ? ref.issues.join(" | ") : "sin alertas básicas",
    ]);
  }

  const csv = "\ufeff" + lines.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "auditoria-APA7-citas-referencias.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(renderAdvancedAudit, 450);
}

function initEnhancements() {
  ensureStyles();
  ensurePanel();
  renderAdvancedAudit();

  const preview = getPreview();
  preview?.addEventListener("input", scheduleRefresh);

  const observer = new MutationObserver(scheduleRefresh);
  if (preview) observer.observe(preview, { childList: true, subtree: true });

  document.querySelector("#formatBtn")?.addEventListener("click", () => setTimeout(renderAdvancedAudit, 700));
  document.querySelector("#demoBtn")?.addEventListener("click", () => setTimeout(renderAdvancedAudit, 300));
  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(renderAdvancedAudit, 100));
  document.querySelector("#clearBtn")?.addEventListener("click", () => setTimeout(renderAdvancedAudit, 100));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEnhancements, { once: true });
} else {
  initEnhancements();
}
