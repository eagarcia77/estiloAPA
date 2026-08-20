const APA_TABLE_VERSION = "2.9";

function tableText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function thesisOrModuleProfile() {
  return document.querySelector("#formatProfile")?.value || "";
}

function createCell(tag, text) {
  const cell = document.createElement(tag);
  cell.textContent = text;
  return cell;
}

function reconstructConceptApplicationTable(preview) {
  const paragraphs = [...preview.querySelectorAll("p")];
  for (const paragraph of paragraphs) {
    if (paragraph.dataset.apaTableRecovered === "true") continue;
    const text = tableText(paragraph.textContent);
    if (!/^Concepto\s+Aplicaci[oó]n\s+gerencial\b/i.test(text) || text.length < 80) continue;

    const remainder = text.replace(/^Concepto\s+Aplicaci[oó]n\s+gerencial\s*/i, "");
    const keyRegex = /\b(B2C|B2B|C2C|B2G|G2C|EDI|Extranet|Marketplace|Comercio\s+m[oó]vil|Social\s+commerce|Inteligencia\s+comercial|IA|Omnicanalidad)\b/gi;
    const matches = [...remainder.matchAll(keyRegex)];
    if (matches.length < 4) continue;

    const rows = [];
    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i];
      const next = matches[i + 1];
      const key = tableText(current[0]);
      const start = (current.index || 0) + current[0].length;
      const end = next ? (next.index || remainder.length) : remainder.length;
      const value = tableText(remainder.slice(start, end));
      if (key && value) rows.push([key, value]);
    }
    if (rows.length < 4) continue;

    const table = document.createElement("table");
    table.className = "apa-table apa-table-recovered";
    table.dataset.apaRecovered = "concept-application";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.append(createCell("th", "Concepto"), createCell("th", "Aplicación gerencial"));
    thead.append(headerRow);
    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.append(createCell("td", row[0]), createCell("td", row[1]));
      tbody.append(tr);
    }
    table.append(thead, tbody);
    paragraph.dataset.apaTableRecovered = "true";
    paragraph.replaceWith(table);
  }
}

function candidateTableTitle(table) {
  let previous = table.previousElementSibling;
  if (!previous) return null;
  const text = tableText(previous.textContent);
  if (!text || text.length > 120) return null;
  if (/^Tabla\s+\d+/i.test(text)) return null;
  if (/[.!?]$/.test(text) && text.length > 70) return null;
  if (["P", "H1", "H2", "H3", "H4", "H5", "H6"].includes(previous.tagName)) return previous;
  return null;
}

function styleApaTable(table) {
  table.classList.add("apa7-table-strict");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.border = "0";
  table.style.margin = "0 0 .5em 0";
  table.style.textAlign = "left";

  const rows = [...table.rows];
  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const isLast = rowIndex === rows.length - 1;
    [...row.cells].forEach((cell, cellIndex) => {
      cell.style.border = "0";
      cell.style.borderLeft = "0";
      cell.style.borderRight = "0";
      cell.style.borderTop = isHeader ? "1px solid #000" : "0";
      cell.style.borderBottom = (isHeader || isLast) ? "1px solid #000" : "0";
      cell.style.padding = ".2em .3em";
      cell.style.verticalAlign = "top";
      cell.style.lineHeight = "1.15";
      cell.style.textAlign = isHeader && cellIndex > 0 ? "center" : "left";
      if (isHeader) {
        cell.style.fontWeight = "bold";
        if (cell.tagName !== "TH") cell.setAttribute("role", "columnheader");
      }
    });
  });
}

function ensureApaTableCaption(table, tableNumber) {
  let label = table.previousElementSibling;
  let title = null;

  if (label && /^Tabla\s+\d+/i.test(tableText(label.textContent))) {
    label.classList.add("apa-table-label", "thesis-table-label", "no-indent");
    label.style.fontWeight = "bold";
    label.style.textAlign = "left";
    title = label.nextElementSibling;
    if (title === table) title = null;
  } else {
    const candidate = candidateTableTitle(table);
    const titleText = candidate ? tableText(candidate.textContent) : "";
    if (candidate) candidate.remove();

    label = document.createElement("p");
    label.className = "apa-table-label thesis-table-label no-indent";
    label.innerHTML = `<strong>Tabla ${tableNumber}</strong>`;
    label.style.textAlign = "left";
    table.before(label);

    if (titleText) {
      title = document.createElement("p");
      title.className = "apa-table-title thesis-table-title no-indent";
      const em = document.createElement("em");
      em.textContent = titleText;
      title.append(em);
      title.style.textAlign = "left";
      label.after(title);
    }
  }

  if (title && title !== table) {
    title.classList.add("apa-table-title", "thesis-table-title", "no-indent");
    title.style.fontStyle = "italic";
    title.style.textAlign = "left";
  }

  table.dataset.apaTableNumber = String(tableNumber);
}

function normalizeApaTables(preview) {
  if (!preview || preview.querySelector(".placeholder")) return;
  reconstructConceptApplicationTable(preview);
  const tables = [...preview.querySelectorAll("table")];
  tables.forEach((table, index) => {
    ensureApaTableCaption(table, index + 1);
    styleApaTable(table);
    table.classList.add("thesis-apa-table", "apa7-strict-table");
  });
}

function appendTableAudit() {
  const preview = document.querySelector("#preview");
  const list = document.querySelector("#auditList");
  if (!preview || !list || preview.querySelector(".placeholder")) return;
  list.querySelectorAll("li[data-apa-table-audit]").forEach((node) => node.remove());
  const tables = [...preview.querySelectorAll("table")];
  if (!tables.length) return;

  let missingTitle = 0;
  for (const table of tables) {
    const label = table.previousElementSibling?.classList.contains("apa-table-title")
      ? table.previousElementSibling.previousElementSibling
      : table.previousElementSibling;
    const title = table.previousElementSibling?.classList.contains("apa-table-title") ? table.previousElementSibling : null;
    if (!label || !/^Tabla\s+\d+/i.test(tableText(label.textContent)) || !title || !tableText(title.textContent)) missingTitle += 1;
  }

  const li = document.createElement("li");
  li.dataset.apaTableAudit = "true";
  li.className = missingTitle ? "warn" : "ok";
  li.textContent = missingTitle
    ? `Tablas APA 7 v${APA_TABLE_VERSION}: ${tables.length} tabla(s) detectada(s); ${missingTitle} requiere(n) revisar o completar el título.`
    : `Tablas APA 7 v${APA_TABLE_VERSION}: ${tables.length} tabla(s) con número, título y reglas sin líneas verticales.`;
  list.append(li);
}

function runApaTableNormalization() {
  const preview = document.querySelector("#preview");
  if (!preview) return;
  normalizeApaTables(preview);
  setTimeout(appendTableAudit, 80);
}

function initApaTables() {
  const preview = document.querySelector("#preview");
  if (!preview) return;
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(runApaTableNormalization, 80);
  }).observe(preview, { childList: true, subtree: true });
  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(appendTableAudit, 120));
  document.querySelector("#formatProfile")?.addEventListener("change", () => setTimeout(runApaTableNormalization, 120));
  runApaTableNormalization();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initApaTables);
else initApaTables();
