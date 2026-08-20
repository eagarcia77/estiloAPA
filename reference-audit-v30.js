const APA_REFERENCE_AUDIT_VERSION = "3.0";

function refAuditText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function referenceNodes() {
  const root = document.querySelector("#preview");
  if (!root) return [];
  const nodes = [...root.querySelectorAll(".apa-reference,.thesis-reference")];
  return [...new Set(nodes)];
}

function normalizeSortKey(text) {
  return refAuditText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(a|an|the)\s+/i, "")
    .toLowerCase();
}

function detectReferenceType(text) {
  const value = refAuditText(text);
  if (/\b(dissertation|doctoral dissertation|master'?s thesis|tesis|disertaci[oó]n)\b/i.test(value)) return "Tesis/disertación";
  if (/\b(report|informe|technical report|policy brief)\b/i.test(value)) return "Informe";
  if (/https?:\/\/(?!doi\.org)/i.test(value) && !/\b\d+\s*\(\d+\)\s*,/i.test(value)) return "Página web";
  if (/\b\d+\s*\(\d+\)\s*,\s*(?:\d|Article\b)/i.test(value) || /https:\/\/doi\.org\//i.test(value) && /,\s*\d+(?:\(\d+\))?,/i.test(value)) return "Artículo de revista";
  if (/\((?:\d+(?:st|nd|rd|th)?\s+ed\.|ed\.)\)/i.test(value) || /\b(Pearson|Routledge|Springer|Wiley|SAGE|Sage|Press|Publishing)\b/.test(value)) return "Libro";
  return "Otro";
}

function hasItalicMarkup(node) {
  if (node.querySelector("em,i")) return true;
  for (const child of node.querySelectorAll("*")) {
    if (getComputedStyle(child).fontStyle === "italic") return true;
  }
  return false;
}

function hasHangingIndent(node) {
  const style = getComputedStyle(node);
  const indent = parseFloat(style.textIndent || "0") || 0;
  const padding = parseFloat(style.paddingLeft || "0") || 0;
  const margin = parseFloat(style.marginLeft || "0") || 0;
  return indent < -5 && (padding > 5 || margin > 5) || node.classList.contains("apa-reference") || node.classList.contains("thesis-reference");
}

function isDoubleSpaced(node) {
  const style = getComputedStyle(node);
  const line = parseFloat(style.lineHeight || "0");
  const font = parseFloat(style.fontSize || "16");
  if (!Number.isFinite(line) || !Number.isFinite(font) || font <= 0) return false;
  return line / font >= 1.8;
}

function issue(label, severity = "review") {
  return { label, severity };
}

function validateReferenceNode(node, index, allNodes) {
  const text = refAuditText(node.textContent);
  const type = detectReferenceType(text);
  const issues = [];
  const year = text.match(/\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)/i);
  const yearEnd = year ? (year.index || 0) + year[0].length : -1;
  const beforeYear = year ? text.slice(0, year.index).trim() : "";
  const afterYear = year ? text.slice(yearEnd).trim() : "";

  if (/^\s*(?:\d+[.)]|[-•▪◦])\s+/.test(text)) issues.push(issue("La lista de referencias APA 7 no debe estar numerada ni usar viñetas.", "error"));
  if (!year) issues.push(issue("No se detecta una fecha/año entre paréntesis.", "error"));
  if (year && !/^\./.test(afterYear)) issues.push(issue("La fecha debe ir seguida de punto: (2026).", "error"));
  if (year && beforeYear && !/[.]$/.test(beforeYear)) issues.push(issue("El elemento de autor debe terminar con punto antes de la fecha.", "review"));
  if (year && afterYear.replace(/^\.\s*/, "").length < 4) issues.push(issue("No se identifica claramente el título y la fuente después de la fecha.", "error"));

  if (/\bdoi\s*:/i.test(text)) issues.push(issue("El DOI debe presentarse como URL: https://doi.org/...", "error"));
  if (/https?:\/\/dx\.doi\.org\//i.test(text)) issues.push(issue("Reemplace dx.doi.org por https://doi.org/.", "error"));
  const rawDoi = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  if (rawDoi && !/https:\/\/doi\.org\//i.test(text)) issues.push(issue("Se detecta un DOI que no está expresado como https://doi.org/...", "error"));
  if (/https?:\/\/\S+[.,;:]$/i.test(text)) issues.push(issue("No añada puntuación final después de un DOI o URL.", "error"));
  if (/\bRetrieved from\b/i.test(text) && !/Retrieved\s+.+?,\s+(?:19|20)\d{2},\s+from/i.test(text)) issues.push(issue("“Retrieved from” normalmente no se usa en APA 7 salvo cuando corresponde una fecha de recuperación.", "review"));
  if (/\s+and\s+/i.test(beforeYear) && /,\s*[A-ZÁÉÍÓÚÑ](?:\.|,)/.test(beforeYear)) issues.push(issue("En una lista de autores personales, APA 7 usa & antes del último autor, no “and”.", "review"));

  if (!hasHangingIndent(node)) issues.push(issue("Falta sangría francesa de 0.5 pulg.", "error"));
  if (!isDoubleSpaced(node)) issues.push(issue("La referencia debe estar a doble espacio.", "review"));

  const needsItalic = ["Artículo de revista", "Libro", "Informe", "Tesis/disertación", "Página web"].includes(type);
  if (needsItalic && !hasItalicMarkup(node)) {
    const message = type === "Artículo de revista"
      ? "No se detecta cursiva; en artículos el título de la revista y el volumen deben ir en cursiva."
      : "No se detecta la cursiva esperada para el título o fuente de este tipo de referencia.";
    issues.push(issue(message, "review"));
  }

  if (type === "Artículo de revista") {
    if (!/,\s*\d+(?:\(\d+\))?,/i.test(text)) issues.push(issue("Revise volumen, número de edición y paginación/número de artículo.", "review"));
    if (!/(?:\d+[-–]\d+|Article\s+[A-Za-z0-9.-]+|\b\d{5,}\b)/i.test(afterYear)) issues.push(issue("No se detecta claramente rango de páginas o número de artículo.", "review"));
  }

  if (type === "Libro" && year) {
    const after = afterYear.replace(/^\.\s*/, "");
    const parts = after.split(".").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) issues.push(issue("Revise que la referencia de libro incluya título y editorial.", "review"));
  }

  if (type === "Página web" && !/https?:\/\/\S+/i.test(text)) issues.push(issue("No se detecta URL en la referencia de página web.", "error"));

  const currentKey = normalizeSortKey(beforeYear || text);
  if (index > 0) {
    const previousText = refAuditText(allNodes[index - 1].textContent);
    const prevYear = previousText.match(/\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)/i);
    const prevAuthor = prevYear ? previousText.slice(0, prevYear.index).trim() : previousText;
    const previousKey = normalizeSortKey(prevAuthor);
    if (currentKey.localeCompare(previousKey, "es", { sensitivity: "base" }) < 0) issues.push(issue("La entrada parece estar fuera del orden alfabético de la lista de referencias.", "review"));
  }

  const errors = issues.filter((item) => item.severity === "error").length;
  const reviews = issues.filter((item) => item.severity === "review").length;
  const status = errors ? "error" : reviews ? "review" : "pass";
  return { node, index, text, type, issues, errors, reviews, status };
}

function analyzeReferenceFormatting() {
  const nodes = referenceNodes();
  const entries = nodes.map((node, index) => validateReferenceNode(node, index, nodes));
  return {
    entries,
    pass: entries.filter((entry) => entry.status === "pass").length,
    review: entries.filter((entry) => entry.status === "review").length,
    error: entries.filter((entry) => entry.status === "error").length,
  };
}

function ensureReferenceAuditStyles() {
  if (document.querySelector("#reference-audit-v30-styles")) return;
  const style = document.createElement("style");
  style.id = "reference-audit-v30-styles";
  style.textContent = `
    .reference-format-audit { margin-top:1rem; border-top:1px solid #d9e1df; padding-top:1rem; }
    .reference-format-audit h3 { margin:.1rem 0 .35rem; }
    .ref-audit-summary { display:grid; grid-template-columns:repeat(4,minmax(110px,1fr)); gap:.5rem; margin:.75rem 0; }
    .ref-audit-card { border:1px solid #d9e1df; border-radius:9px; padding:.6rem; background:#f8fbfa; }
    .ref-audit-card strong { display:block; font-size:1.15rem; }
    .ref-audit-table-wrap { overflow:auto; max-height:430px; border:1px solid #d9e1df; border-radius:9px; }
    .ref-audit-table { width:100%; border-collapse:collapse; font-size:.88rem; }
    .ref-audit-table th,.ref-audit-table td { padding:.5rem; text-align:left; vertical-align:top; border-bottom:1px solid #e3e8e6; }
    .ref-audit-table th { position:sticky; top:0; background:#f4f7f6; z-index:1; }
    .ref-status-pass { color:#136b3f; font-weight:800; }
    .ref-status-review { color:#7a5b00; font-weight:800; }
    .ref-status-error { color:#a32424; font-weight:800; }
    .ref-audit-actions { display:flex; flex-wrap:wrap; gap:.5rem; margin:.65rem 0; }
    .reference-audit-highlight { outline:3px solid #0b6cff !important; outline-offset:3px; background:#fff8c5 !important; }
    @media (max-width:820px) { .ref-audit-summary { grid-template-columns:1fr 1fr; } }
  `;
  document.head.append(style);
}

function ensureReferenceAuditPanel() {
  const audit = document.querySelector("section.audit");
  if (!audit) return null;
  let panel = document.querySelector("#referenceFormatAudit");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "referenceFormatAudit";
  panel.className = "reference-format-audit";
  panel.innerHTML = `
    <h3>Validación del formato de referencias APA 7</h3>
    <p class="muted">Revisa formato visible y patrones bibliográficos. El estado “Cumple controles automáticos” significa que no se detectaron problemas en las reglas comprobables por el programa; los datos de la fuente original todavía deben verificarse.</p>
    <div class="ref-audit-actions">
      <button type="button" id="auditReferencesNow">Auditar referencias</button>
      <button type="button" id="formatReferenceList">Aplicar formato de lista APA 7</button>
    </div>
    <div id="referenceAuditContent" aria-live="polite"></div>`;
  audit.append(panel);
  panel.querySelector("#auditReferencesNow")?.addEventListener("click", renderReferenceFormattingAudit);
  panel.querySelector("#formatReferenceList")?.addEventListener("click", formatReferenceListLayout);
  return panel;
}

function statusLabel(status) {
  if (status === "pass") return '<span class="ref-status-pass">Cumple controles automáticos</span>';
  if (status === "review") return '<span class="ref-status-review">Revisar</span>';
  return '<span class="ref-status-error">Error</span>';
}

function escapeRefAudit(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderReferenceFormattingAudit() {
  const panel = ensureReferenceAuditPanel();
  const target = panel?.querySelector("#referenceAuditContent");
  if (!target) return;
  const analysis = analyzeReferenceFormatting();
  const total = analysis.entries.length;
  const percent = total ? Math.round((analysis.pass / total) * 100) : 0;

  if (!total) {
    target.innerHTML = '<p class="muted">No se detectaron entradas marcadas como referencias. Use el estilo “Referencia APA” de la barra o formatee el documento primero.</p>';
    return;
  }

  const rows = analysis.entries.map((entry) => {
    const details = entry.issues.length
      ? `<ul>${entry.issues.map((item) => `<li class="ref-status-${item.severity === "error" ? "error" : "review"}">${escapeRefAudit(item.label)}</li>`).join("")}</ul>`
      : '<span class="ref-status-pass">Sin observaciones detectadas.</span>';
    return `<tr>
      <td>${entry.index + 1}</td>
      <td>${escapeRefAudit(entry.type)}</td>
      <td>${statusLabel(entry.status)}</td>
      <td>${escapeRefAudit(entry.text)}</td>
      <td>${details}</td>
      <td><button type="button" data-ref-jump="${entry.index}">Ver</button></td>
    </tr>`;
  }).join("");

  target.innerHTML = `
    <div class="ref-audit-summary">
      <div class="ref-audit-card"><span>Referencias</span><strong>${total}</strong></div>
      <div class="ref-audit-card"><span>Cumplen</span><strong>${analysis.pass}</strong></div>
      <div class="ref-audit-card"><span>Revisar / error</span><strong>${analysis.review + analysis.error}</strong></div>
      <div class="ref-audit-card"><span>Cumplimiento automático</span><strong>${percent}%</strong></div>
    </div>
    <div class="ref-audit-table-wrap">
      <table class="ref-audit-table">
        <thead><tr><th>#</th><th>Tipo probable</th><th>Estado</th><th>Referencia</th><th>Reglas APA 7</th><th>Editor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  target.querySelectorAll("button[data-ref-jump]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.refJump);
    const node = referenceNodes()[index];
    if (!node) return;
    document.querySelectorAll(".reference-audit-highlight").forEach((el) => el.classList.remove("reference-audit-highlight"));
    node.classList.add("reference-audit-highlight");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    node.focus?.();
    setTimeout(() => node.classList.remove("reference-audit-highlight"), 4500);
  }));
}

function formatReferenceListLayout() {
  const nodes = referenceNodes();
  if (!nodes.length) {
    renderReferenceFormattingAudit();
    return;
  }

  nodes.forEach((node) => {
    node.classList.add("apa-reference", "no-indent");
    node.dataset.apaEditorStyle = "reference";
    node.dataset.apaEditorAlign = "left";
    node.dataset.apaEditorIndent = "hanging";
    node.dataset.apaEditorLine = "2";
    node.style.textAlign = "left";
    node.style.paddingLeft = ".5in";
    node.style.textIndent = "-.5in";
    node.style.lineHeight = "2";
    node.style.marginTop = "0";
    node.style.marginBottom = "0";
  });

  const parent = nodes[0].parentElement;
  if (parent && nodes.every((node) => node.parentElement === parent)) {
    const sorted = [...nodes].sort((a, b) => normalizeSortKey(a.textContent).localeCompare(normalizeSortKey(b.textContent), "es", { sensitivity: "base" }));
    for (const node of sorted) parent.append(node);
  }

  const root = document.querySelector("#preview");
  const heading = [...(root?.querySelectorAll("p,h1,h2,h3,h4,h5,h6") || [])].find((el) => /^Referencias$/i.test(refAuditText(el.textContent)));
  if (heading) {
    heading.classList.add("apa-references-heading", "apa-heading-level-1", "no-indent");
    heading.dataset.apaEditorStyle = "h1";
    heading.style.textAlign = "center";
    heading.style.fontWeight = "700";
    heading.style.textIndent = "0";
  }

  root?.dispatchEvent(new Event("input", { bubbles: true }));
  renderReferenceFormattingAudit();
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = `APA 7 v${APA_REFERENCE_AUDIT_VERSION}: se aplicó doble espacio, sangría francesa de 0.5 pulg. y orden alfabético a ${nodes.length} referencia(s). Los datos bibliográficos no fueron inventados ni sustituidos.`;
    status.className = "status success";
  }
}

function initializeReferenceAudit() {
  ensureReferenceAuditStyles();
  ensureReferenceAuditPanel();
  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(renderReferenceFormattingAudit, 120));
  document.querySelector("#preview")?.addEventListener("input", () => {
    clearTimeout(window.__apaRefAuditTimer);
    window.__apaRefAuditTimer = setTimeout(renderReferenceFormattingAudit, 450);
  });
  setTimeout(renderReferenceFormattingAudit, 250);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeReferenceAudit);
else initializeReferenceAudit();
