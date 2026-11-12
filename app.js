const APP_VERSION = "3.4.8";
// PDF.js 6 uses Map.getOrInsertComputed, unavailable in Safari 18 on iPadOS.
// Keep the core and worker pinned to the same Safari-compatible release.
const PDFJS_VERSION = "4.10.38";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

const els = {
  files: document.querySelector("#files"),
  dropZone: document.querySelector("#dropZone"),
  fileList: document.querySelector("#fileList"),
  fontFamily: document.querySelector("#fontFamily"),
  firstLineIndent: document.querySelector("#firstLineIndent"),
  hangingReferences: document.querySelector("#hangingReferences"),
  sortReferences: document.querySelector("#sortReferences"),
  pageNumbers: document.querySelector("#pageNumbers"),
  formatBtn: document.querySelector("#formatBtn"),
  demoBtn: document.querySelector("#demoBtn"),
  reauditBtn: document.querySelector("#reauditBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  status: document.querySelector("#status"),
  auditList: document.querySelector("#auditList"),
  score: document.querySelector("#score"),
  metrics: document.querySelector("#metrics"),
  preview: document.querySelector("#preview"),
  downloadDocxBtn: document.querySelector("#downloadDocxBtn"),
  downloadHtmlBtn: document.querySelector("#downloadHtmlBtn"),
  downloadAuditBtn: document.querySelector("#downloadAuditBtn"),
};

let selectedFiles = [];
let importRequestId = 0;
let importingDocument = false;
let pdfjsPromise;
let lastAudit = null;

const fontSettings = {
  "Times New Roman": { cssSize: "12pt", halfPoints: 24 },
  Arial: { cssSize: "11pt", halfPoints: 22 },
  Calibri: { cssSize: "11pt", halfPoints: 22 },
  Georgia: { cssSize: "11pt", halfPoints: 22 },
};

const referenceHeadingRegex = /^(referencias(?: bibliogr[aá]ficas)?|references|lista de referencias)$/i;
const yearToken = "(?:19|20)\\d{2}[a-z]?|n\\.d\\.|s\\.f\\.";

function setStatus(message = "", type = "") {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function updateFileList() {
  els.fileList.replaceChildren();
  if (!selectedFiles.length) return;
  for (const file of selectedFiles) {
    const row = document.createElement("div");
    row.className = "file-item";
    const name = document.createElement("span");
    name.textContent = file.name;
    const size = document.createElement("span");
    size.className = "file-size";
    size.textContent = formatBytes(file.size);
    row.append(name, size);
    els.fileList.append(row);
  }
}

function setFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  if (hasFormattedContent() &&
      !window.confirm("Opening a new file will replace the current document. Export your edits before continuing. Open the new file?")) return;
  // A new selection triggers the entire APA 7 import automatically.
  // Preserve the native File input while Safari finishes reading the selected file.
  selectedFiles = files;
  importRequestId += 1;
  updateFileList();
  setStatus("Opening and formatting document in APA 7…");
  void formatSelectedFiles(importRequestId);
}

els.files.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  // Keep the native input intact while Safari reads the selected file.
  // This supports both DOCX and PDF file-provider uploads.
  setFiles(files);
});
for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  });
}
els.dropZone.addEventListener("drop", (event) => setFiles(event.dataTransfer.files));

// Opening a document should not require finding the hidden settings panel.
// Users can drop a file anywhere on the visible document workspace.
const editorDropArea = document.querySelector(".paper-wrap");
editorDropArea?.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
});
editorDropArea?.addEventListener("drop", (event) => {
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  event.stopPropagation();
  setFiles(event.dataTransfer.files);
});

for (const control of [els.fontFamily, els.firstLineIndent, els.hangingReferences]) {
  control.addEventListener("change", applyPreviewStyles);
}
els.sortReferences.addEventListener("change", () => {
  // Sorting is an explicit user request, never triggered during typing.
  if (hasFormattedContent()) {
    normalizeReferences(els.preview);
    runAudit();
  }
});

els.formatBtn.addEventListener("click", () => {
  if (importingDocument || !selectedFiles.length) return;
  if (hasFormattedContent() &&
      !window.confirm("Reapply APA 7 from the original uploaded file? This replaces your edits in the editor.")) return;
  importRequestId += 1;
  void formatSelectedFiles(importRequestId);
});
els.demoBtn.addEventListener("click", loadDemo);
els.reauditBtn.addEventListener("click", runAudit);
els.clearBtn.addEventListener("click", event => {
  // Protect user edits from accidental Clear, including locally saved drafts.
  const existing = els.preview &&
    !els.preview.querySelector(".placeholder") &&
    (els.preview.textContent || "").trim().length > 0;
  if (existing && !window.confirm("Clear the current document and its local draft? Export your changes first if needed.")) {
    event.stopImmediatePropagation();
    return;
  }
  clearAll();
});
els.downloadHtmlBtn.addEventListener("click", downloadHtml);
els.downloadDocxBtn.addEventListener("click", downloadDocx);
els.downloadAuditBtn.addEventListener("click", downloadAudit);
// The editor stays responsive: auditing is on demand, not on every keystroke.
// Opening Review computes a fresh report from the CURRENT edited document.
const reviewDetails = document.querySelector("#simpleReviewDetails");
reviewDetails?.addEventListener("toggle", () => {
  if (reviewDetails.open && hasFormattedContent()) runAudit(false);
});

async function waitForGlobal(name, timeoutMs = 12000) {
  const started = Date.now();
  while (!window[name]) {
    if (Date.now() - started > timeoutMs) throw new Error(`Could not load the ${name} library. Check your internet connection.`);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return window[name];
}

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(text) {
  const blocks = String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`).join("\n");
}

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const root = doc.querySelector("main");
  const allowed = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE",
    "STRONG", "B", "EM", "I", "U", "SUP", "SUB", "A", "IMG", "BR", "TABLE", "THEAD",
    "TBODY", "TR", "TH", "TD", "CAPTION", "FIGURE", "FIGCAPTION", "SPAN", "DIV"
  ]);

  for (const element of [...root.querySelectorAll("*")]) {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attr of [...element.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      const keep = ["href", "src", "alt", "title"].includes(name);
      if (!keep || name.startsWith("on")) element.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) element.removeAttribute(attr.name);
    }
    if (element.tagName === "A") element.setAttribute("rel", "noopener noreferrer");
  }
  return root.innerHTML;
}

async function readDocx(file) {
  // iPadOS file providers can return a zero-size placeholder for cloud files.
  // Try reading the actual bytes before trusting File.size metadata.
  if (!file) throw new Error("No se recibió un archivo Word.");
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch (error) {
    console.error("DOCX file provider read failed:", error);
    throw new Error("Safari no pudo leer el documento. Descárguelo primero en Archivos > En mi iPad y vuelva a seleccionarlo.");
  }
  if (bytes.byteLength === 0) {
    throw new Error("Safari recibió 0 bytes del archivo seleccionado. En Archivos, descargue el documento de iCloud/OneDrive y guarde una copia en En mi iPad; luego selecciónela nuevamente.");
  }
  const header = new Uint8Array(bytes.slice(0, 4));
  const isZip = header.length === 4 && header[0] === 0x50 && header[1] === 0x4b &&
    header[2] === 0x03 && header[3] === 0x04;
  if (!isZip) {
    throw new Error("Este archivo no parece ser un DOCX válido. En Word, guárdelo como Documento de Word (.docx), no como .doc ni PDF.");
  }
  try {
    return await convertDocx(bytes);
  } catch (error) {
    console.error("DOCX import failed:", error);
    throw new Error("No se pudo leer el archivo DOCX. Puede estar incompleto o dañado. Ábralo en Word, guarde una copia nueva como .docx y vuelva a subirla.");
  }
}

async function convertDocx(arrayBuffer) {
  const mammoth = await waitForGlobal("mammoth");
  if (arrayBuffer.byteLength < 4) throw new Error("El proveedor de archivos devolvió un documento vacío. Guarde una copia local en Archivos y vuelva a intentar.");
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh"
      ],
      includeDefaultStyleMap: true,
    }
  );
  return sanitizeHtml(result.value);
}

async function readPdf(file) {
  if (!file) throw new Error("No se recibió un archivo PDF.");
  // As with DOCX, trust bytes read from iPadOS file providers, not File.size.
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    console.error("PDF file provider read failed:", error);
    throw new Error("Safari no pudo leer el PDF. Descárguelo en Archivos > En mi iPad y vuelva a seleccionarlo.");
  }
  if (buffer.byteLength === 0) {
    throw new Error("Safari recibió 0 bytes del PDF. Descargue una copia local completa e inténtelo nuevamente.");
  }
  const data = new Uint8Array(buffer);
  const isPdf = data.length >= 5 && data[0] === 0x25 && data[1] === 0x50 &&
    data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d;
  if (!isPdf) {
    throw new Error("El archivo seleccionado no contiene un PDF válido. Verifique que se haya descargado completamente.");
  }
  // Prefer the structured converter: it reconstructs detectable tables and figures.
  // Unlike the separate manual PDF tool, this returns HTML to the normal import flow.
  if (typeof window !== "undefined" && typeof window.EstiloAPASmartPdfToHtml === "function") {
    const structuredHtml = await window.EstiloAPASmartPdfToHtml(file);
    if (structuredHtml && structuredHtml.trim()) return sanitizeHtml(structuredHtml);
    throw new Error("No se pudo reconstruir contenido editable del PDF. Se conservó el documento anterior.");
  }
  const pdfjs = await getPdfJs();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data }).promise;
  } catch (error) {
    console.error("PDF import failed:", error);
    throw new Error("No se pudo abrir el PDF. Puede estar incompleto, dañado o protegido. Guarde una copia sin protección y vuelva a intentar.");
  }
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let current = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      current += `${item.str}${item.hasEOL ? "\n" : " "}`;
      if (item.hasEOL) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
    }
    if (current.trim()) lines.push(current.trim());
    pages.push(lines.join("\n"));
  }
  const extractedText = pages.join("\n\n").trim();
  if (!extractedText) {
    throw new Error("Este PDF no contiene texto seleccionable. Puede ser un documento escaneado: necesita OCR antes de convertirlo en texto editable. No se reemplazó el documento actual.");
  }
  return textToHtml(extractedText);
}

async function readFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "docx") return readDocx(file);
  if (extension === "pdf") return readPdf(file);
  if (["html", "htm"].includes(extension)) return sanitizeHtml(await file.text());
  if (["txt", "md"].includes(extension)) return textToHtml(await file.text());
  throw new Error(`Unsupported file format: ${file.name}`);
}

function replaceDivsWithParagraphs(root) {
  for (const div of [...root.querySelectorAll("div")]) {
    if (div.querySelector("p,h1,h2,h3,h4,h5,h6,ul,ol,table,figure")) continue;
    const p = document.createElement("p");
    p.innerHTML = div.innerHTML;
    div.replaceWith(p);
  }
}

function normalizeHeadingLevels(root) {
  const headingMap = new Map([
    ["H1", "level-1"], ["H2", "level-2"], ["H3", "level-3"],
    ["H4", "level-3"], ["H5", "level-3"], ["H6", "level-3"],
  ]);
  for (const heading of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    heading.classList.add("apa-heading", headingMap.get(heading.tagName) || "level-2");
  }
}

function normalizeReferences(root) {
  const containers = root.matches?.("section") ? [root] : [...root.querySelectorAll("section[data-source-file]")];
  if (!containers.length) containers.push(root);

  for (const container of containers) {
    const blocks = [...container.children];
    let inReferences = false;
    let referenceBlocks = [];
    let heading = null;

    const flush = () => {
      if (els.sortReferences.checked && heading && referenceBlocks.length > 1) {
        referenceBlocks.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim(), "es", { sensitivity: "base" }));
        let anchor = heading;
        for (const block of referenceBlocks) {
          anchor.after(block);
          anchor = block;
        }
      }
      referenceBlocks = [];
    };

    for (const block of blocks) {
      const text = block.textContent.trim();
      if (!text) continue;
      if (referenceHeadingRegex.test(text)) {
        flush();
        block.classList.add("apa-heading", "level-1", "apa-references-heading");
        block.classList.remove("apa-reference");
        inReferences = true;
        heading = block;
        continue;
      }
      if (inReferences && /^H[1-6]$/.test(block.tagName)) {
        flush();
        inReferences = false;
        heading = null;
      }
      if (inReferences && ["P", "LI", "DIV"].includes(block.tagName)) {
        block.classList.add("apa-reference");
        referenceBlocks.push(block);
      }
    }
    flush();
  }
}

function normalizeFigures(root) {
  for (const p of root.querySelectorAll("p")) {
    const text = p.textContent.trim();
    if (/^(figura|figure)\s+\d+[a-z]?\.?$/i.test(text)) p.classList.add("apa-figure-label");
    if (/^(nota|note)\.?\s/i.test(text)) p.classList.add("apa-note");
  }
  for (const img of root.querySelectorAll("img")) {
    if (!img.alt?.trim()) img.dataset.missingAlt = "true";
  }
}

function autoLinkUrls(root) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    if (node.parentElement?.closest("a")) continue;
    const text = node.nodeValue;
    if (!urlRegex.test(text)) continue;
    urlRegex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    for (const match of text.matchAll(urlRegex)) {
      const index = match.index;
      fragment.append(document.createTextNode(text.slice(lastIndex, index)));
      const anchor = document.createElement("a");
      const cleanUrl = match[0].replace(/[.,;)]+$/, "");
      anchor.href = cleanUrl;
      anchor.textContent = cleanUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      fragment.append(anchor);
      lastIndex = index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(fragment);
  }
}

function applyApaRules(root) {
  replaceDivsWithParagraphs(root);
  normalizeHeadingLevels(root);
  normalizeReferences(root);
  normalizeFigures(root);
  autoLinkUrls(root);
}

// EstiloAPA import policy: indent only substantive paragraphs (3+ sentences).
// Keep manually applied Ribbon/ruler indentation and APA reference hanging indents.
function hasThreeSentences(element) {
  const text = (element.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const normalized = text
    .replace(/\b(?:Dr|Dra|Sr|Sra|Prof|etc|p\.\s*ej|e\.\s*g|i\.\s*e)\./gi, match => match.replace(/\./g, ""))
    .replace(/\b(?:[A-ZÁÉÍÓÚÑ]\.){2,}/g, match => match.replace(/\./g, ""))
    .replace(/\b\d+\.\d+\b/g, match => match.replace(".", ""));
  const endings = normalized.match(/[.!?]+(?=\s|$|["”’»)\]]|\n)/g) || [];
  return endings.length >= 3;
}

function shouldAutoIndentParagraph(element) {
  if (!element || element.tagName !== "P") return false;
  if (element.closest("table,thead,tbody,tfoot,th,td,figure,figcaption")) return false;
  if (element.matches(".apa-reference,.apa-title,.apa-heading,.apa-figure-label,.apa-figure-title,.apa-note,.apa-table-label,.no-indent,[role=heading]")) return false;
  if (element.querySelector("img,svg,table")) return false;
  return hasThreeSentences(element);
}

function applyPreviewStyles() {
  const font = els.fontFamily.value;
  els.preview.style.fontFamily = `"${font}", serif`;
  els.preview.style.fontSize = fontSettings[font].cssSize;
  for (const p of els.preview.querySelectorAll("p")) {
    // Do not undo direct Ribbon commands during font/format updates.
    if (["none", "first", "hanging"].includes(p.dataset.apaEditorIndent)) continue;
    const exempt = p.matches(".apa-reference,.apa-title,.apa-heading,.apa-figure-label,.apa-figure-title,.apa-note,.no-indent");
    p.style.textIndent = !exempt && els.firstLineIndent.checked && shouldAutoIndentParagraph(p) ? ".5in" : "0";
  }
  for (const ref of els.preview.querySelectorAll(".apa-reference")) {
    if (["none", "first", "hanging"].includes(ref.dataset.apaEditorIndent)) continue;
    if (els.hangingReferences.checked) {
      ref.style.paddingLeft = ".5in";
      ref.style.textIndent = "-.5in";
    } else {
      ref.style.paddingLeft = "0";
      ref.style.textIndent = "0";
    }
  }
}

function normalizeKeyPart(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bet\s+al\.?\b/gi, "")
    .replace(/[^a-z0-9ñ]+/gi, " ")
    .trim()
    .split(/\s+/)[0] || "";
}

function parseReferences(root) {
  return [...root.querySelectorAll(".apa-reference")].map((element, index) => {
    const text = element.textContent.replace(/\s+/g, " ").trim();
    const yearMatch = text.match(new RegExp(`\\((${yearToken})[^)]*\\)`, "i"));
    const year = yearMatch ? yearMatch[1].toLowerCase().replace(/\s/g, "") : "";
    const beforeYear = yearMatch ? text.slice(0, yearMatch.index).trim() : text;
    let author = beforeYear.split(",")[0].trim();
    if (!author.includes(",") && /\.$/.test(author)) author = author.replace(/\.$/, "");
    if (author.length > 80) author = author.split(".")[0];
    const authorKey = normalizeKeyPart(author);
    return {
      index: index + 1,
      element,
      text,
      author,
      authorKey,
      year,
      key: authorKey && year ? `${authorKey}|${year}` : "",
      hasUrl: /https?:\/\//i.test(text),
      hasDoi: /(?:https?:\/\/doi\.org\/|doi:\s*)10\.\d{4,9}\//i.test(text),
      hasYear: Boolean(year),
    };
  });
}

function parseCitations(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll(".apa-reference,.apa-references-heading").forEach((el) => el.remove());
  const text = clone.innerText.replace(/\s+/g, " ");
  const citations = [];
  const seen = new Set();

  const add = (author, year, raw, type) => {
    const authorKey = normalizeKeyPart(author);
    const cleanYear = String(year).toLowerCase().replace(/\s/g, "");
    if (!authorKey || !cleanYear) return;
    const id = `${authorKey}|${cleanYear}|${raw}`;
    if (seen.has(id)) return;
    seen.add(id);
    citations.push({ author: author.trim(), authorKey, year: cleanYear, key: `${authorKey}|${cleanYear}`, raw: raw.trim(), type });
  };

  const parenRegex = /\(([^()]{1,220})\)/g;
  for (const match of text.matchAll(parenRegex)) {
    const inside = match[1];
    if (!new RegExp(yearToken, "i").test(inside)) continue;
    for (const part of inside.split(";")) {
      const yearMatch = part.match(new RegExp(`(${yearToken})`, "i"));
      if (!yearMatch) continue;
      let author = part.slice(0, yearMatch.index).replace(/[,\s]+$/, "").trim();
      author = author.replace(/^see\s+|^véase\s+/i, "");
      if (author) add(author, yearMatch[1], part, "parentética");
    }
  }

  const narrativeRegex = new RegExp(`\\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]+(?:\\s+(?:et\\s+al\\.|&|y)\\s+[A-ZÁÉÍÓÚÑ]?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]*)?)\\s*\\((${yearToken})\\)`, "g");
  for (const match of text.matchAll(narrativeRegex)) add(match[1], match[2], match[0], "narrativa");
  return citations;
}

function auditDocument(root) {
  const findings = [];
  let points = 35;
  const references = parseReferences(root);
  const citations = parseCitations(root);
  const referenceKeys = new Set(references.map((ref) => ref.key).filter(Boolean));
  const citationKeys = new Set(citations.map((citation) => citation.key));
  const unmatchedCitations = citations.filter((citation) => !referenceKeys.has(citation.key));
  const uncitedReferences = references.filter((ref) => ref.key && !citationKeys.has(ref.key));

  findings.push({ level: "ok", text: "Márgenes de 1 pulgada e interlineado doble configurados para la exportación." });
  findings.push({ level: "ok", text: `Fuente APA compatible seleccionada: ${els.fontFamily.value}.` });
  if (els.pageNumbers.checked) findings.push({ level: "ok", text: "La exportación DOCX incluirá numeración de página en el encabezado." });

  const refsHeading = root.querySelector(".apa-references-heading");
  if (refsHeading) {
    points += 10;
    findings.push({ level: "ok", text: "Se identificó una sección de Referencias." });
  } else {
    findings.push({ level: "warn", text: "No se identificó una sección titulada Referencias/References." });
  }

  if (references.length) {
    points += 10;
    findings.push({ level: "ok", text: `${references.length} referencia(s) detectada(s) con sangría francesa.` });
    const missingYear = references.filter((ref) => !ref.hasYear);
    if (missingYear.length) findings.push({ level: "warn", text: `${missingYear.length} referencia(s) no muestran año, “n.d.” o “s.f.” fácilmente detectable.` });
    else points += 5;

    const malformedDoi = references.filter((ref) => /\bdoi:\s*10\./i.test(ref.text) && !/https?:\/\/doi\.org\//i.test(ref.text));
    if (malformedDoi.length) findings.push({ level: "warn", text: `${malformedDoi.length} referencia(s) usan “doi:” en lugar del formato URL https://doi.org/... recomendado en APA 7.` });
  } else if (refsHeading) {
    findings.push({ level: "error", text: "La sección de Referencias está vacía o no pudo interpretarse." });
  }

  if (citations.length) {
    points += 10;
    findings.push({ level: "ok", text: `${citations.length} cita(s) autor-año detectada(s) en el contenido.` });
  } else {
    findings.push({ level: "warn", text: "No se detectaron citas autor-año. Revise si el contenido requiere fuentes académicas." });
  }

  if (citations.length && references.length) {
    if (!unmatchedCitations.length) {
      points += 15;
      findings.push({ level: "ok", text: "Todas las citas detectadas tienen una referencia coincidente por autor principal y año." });
    } else {
      const examples = unmatchedCitations.slice(0, 4).map((c) => `“${c.raw}”`).join(", ");
      findings.push({ level: "error", text: `${unmatchedCitations.length} cita(s) no tienen una referencia coincidente. Ejemplos: ${examples}.` });
    }
    if (uncitedReferences.length) {
      const examples = uncitedReferences.slice(0, 3).map((r) => `“${r.author || r.text.slice(0, 40)} (${r.year || "sin año"})”`).join(", ");
      findings.push({ level: "warn", text: `${uncitedReferences.length} referencia(s) no tienen una cita coincidente detectada. Ejemplos: ${examples}.` });
    } else {
      points += 5;
    }
  }

  const missingAlt = root.querySelectorAll("img[data-missing-alt='true']").length;
  if (missingAlt) findings.push({ level: "error", text: `${missingAlt} imagen(es) no tienen texto alternativo detectable.` });
  else if (root.querySelector("img")) {
    points += 5;
    findings.push({ level: "ok", text: "Las imágenes importadas conservan texto alternativo detectable." });
  } else {
    points += 5;
  }

  const longUrls = references.filter((ref) => ref.hasUrl).length;
  if (longUrls) findings.push({ level: "ok", text: `${longUrls} referencia(s) contienen URL o DOI enlazable.` });

  const score = Math.max(0, Math.min(100, points));
  return {
    score,
    findings,
    metrics: {
      citations: citations.length,
      references: references.length,
      unmatchedCitations: unmatchedCitations.length,
      uncitedReferences: uncitedReferences.length,
      imagesMissingAlt: missingAlt,
    },
  };
}

function renderAudit(result) {
  lastAudit = result;
  els.score.textContent = `${result.score}%`;
  els.auditList.replaceChildren();
  for (const item of result.findings) {
    const li = document.createElement("li");
    li.className = item.level;
    li.textContent = item.text;
    els.auditList.append(li);
  }
  els.metrics.innerHTML = `
    <span><strong>${result.metrics.citations}</strong> citas</span>
    <span><strong>${result.metrics.references}</strong> referencias</span>
    <span><strong>${result.metrics.unmatchedCitations}</strong> sin referencia</span>
    <span><strong>${result.metrics.uncitedReferences}</strong> sin cita</span>`;
  els.downloadAuditBtn.disabled = false;
}

function runAudit(announce = true) {
  if (!hasFormattedContent()) return;
  // An academic review must not silently restyle edited paragraphs.
  renderAudit(auditDocument(els.preview));
  if (announce) setStatus("APA 7 review complete. Your edits were not changed.", "success");
}

async function formatSelectedFiles(requestId = importRequestId) {
  if (!selectedFiles.length) return;
  // Snapshot input files so a later selection cannot alter this import.
  const files = [...selectedFiles];
  importingDocument = true;
  els.formatBtn.disabled = true;
  setStatus("Applying APA 7 formatting…");
  try {
    const wrapper = document.createElement("div");
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const html = await readFile(file);
      // Reject stale imports before touching the currently edited document.
      if (requestId !== importRequestId) return;
      setStatus(`Formatting ${i + 1} of ${files.length}: ${file.name}`);
      const section = document.createElement("section");
      section.dataset.sourceFile = file.name;
      section.innerHTML = html;
      // Never replace an existing document with an empty conversion result.
      // Images/tables without text are legitimate content and must be retained.
      const hasImportedContent = Boolean(section.textContent.trim() ||
        section.querySelector("img,svg,table,canvas,video,math"));
      if (!hasImportedContent) {
        throw new Error("El archivo se pudo abrir, pero no se extrajo contenido editable. No se reemplazó el documento anterior. Si es un PDF escaneado, necesita reconocimiento de texto (OCR).");
      }
      applyApaRules(section);
      wrapper.append(section);
      if (i < files.length - 1) {
        const separator = document.createElement("hr");
        separator.className = "document-separator";
        separator.setAttribute("aria-hidden", "true");
        wrapper.append(separator);
      }
    }
    if (requestId !== importRequestId) return;
    // Preserve the previous editor until the new document has survived every
    // import hook. An empty post-import editor must never be marked successful.
    const previousHtml = els.preview.innerHTML;
    const previousReady = els.preview.dataset.apaReadyForEditing;
    const hasContent = (node) => Boolean((node.textContent || "").trim() ||
      node.querySelector("img,svg,table,canvas,video,math"));
    if (!hasContent(wrapper)) throw new Error("El conversor no produjo contenido. Se conservó el documento anterior.");
    try {
      window.apaResetProtectedDocument?.();
      els.preview.replaceChildren(...wrapper.childNodes);
      if (!hasContent(els.preview)) throw new Error("El contenido no llegó al editor.");
      applyPreviewStyles();
      if (!hasContent(els.preview)) throw new Error("El contenido desapareció al aplicar el diseño del editor.");
      // The document-loaded event may trigger external editor modules.
      els.preview.dispatchEvent(new Event("apa-document-loaded"));
      if (!hasContent(els.preview)) throw new Error("Un módulo del editor eliminó el contenido durante la importación.");
      renderAudit(auditDocument(els.preview));
      if (!hasContent(els.preview)) throw new Error("El contenido desapareció durante la auditoría.");
      enableDownloads();
      els.preview.dataset.apaReadyForEditing = "true";
      setStatus("APA 7 applied. Your document is ready to edit.", "success");
      els.preview.focus();
    } catch (importError) {
      els.preview.innerHTML = previousHtml;
      if (previousReady === undefined) delete els.preview.dataset.apaReadyForEditing;
      else els.preview.dataset.apaReadyForEditing = previousReady;
      if (!hasContent(els.preview)) {
        els.downloadDocxBtn.disabled = true;
        els.downloadHtmlBtn.disabled = true;
        els.downloadAuditBtn.disabled = true;
      }
      throw importError;
    }
  } catch (error) {
    console.error(error);
    if (requestId === importRequestId) setStatus(error?.message || "Could not open the document.", "error");
  } finally {
    if (requestId === importRequestId) {
      importingDocument = false;
      els.formatBtn.disabled = false;
    }
  }
}

function loadDemo() {
  const demo = document.createElement("section");
  demo.dataset.sourceFile = "ejemplo-APA7";
  demo.innerHTML = `
    <h1>Inteligencia artificial y aprendizaje</h1>
    <p>La inteligencia artificial puede apoyar la retroalimentación formativa cuando existe una intención pedagógica clara. Según García (2026), el uso responsable requiere transparencia y revisión humana. Otros estudios también destacan la importancia de integrar accesibilidad y diseño universal (López & Rivera, 2025).</p>
    <h2>Aplicación educativa</h2>
    <p>El docente debe evaluar la calidad de las respuestas generadas y mantener criterios académicos definidos (García, 2026).</p>
    <h1>Referencias</h1>
    <p>García, E. A. (2026). Innovación educativa y uso responsable de inteligencia artificial. Editorial Académica.</p>
    <p>López, M., & Rivera, J. (2025). Diseño universal y tecnología educativa. Revista de Innovación Educativa, 12(2), 20–35. https://doi.org/10.1000/ejemplo</p>`;
  applyApaRules(demo);
  importRequestId += 1;
  importingDocument = false;
  window.apaResetProtectedDocument?.();
  els.preview.replaceChildren(demo);
  applyPreviewStyles();
  els.preview.dispatchEvent(new Event("apa-document-loaded"));
  renderAudit(auditDocument(els.preview));
  enableDownloads();
  els.preview.dataset.apaReadyForEditing = "true";
  setStatus("APA 7 sample loaded. You can now edit the document.", "success");
}

function hasFormattedContent() {
  return Boolean(els.preview.querySelector("section[data-source-file], .apa-reference, h1, h2, h3")) && !els.preview.querySelector(".placeholder");
}

function enableDownloads() {
  els.downloadDocxBtn.disabled = false;
  els.downloadHtmlBtn.disabled = false;
  els.downloadAuditBtn.disabled = false;
  els.reauditBtn.disabled = false;
}

function clearAll() {
  importRequestId += 1;
  importingDocument = false;
  els.formatBtn.disabled = false;
  window.apaResetProtectedDocument?.();
  selectedFiles = [];
  lastAudit = null;
  els.files.value = "";
  updateFileList();
  els.preview.innerHTML = '<p class="placeholder">El contenido formateado aparecerá aquí.</p>';
  els.auditList.innerHTML = "<li>Cargue uno o más archivos o presione “Probar ejemplo”.</li>";
  els.metrics.innerHTML = "";
  els.score.textContent = "—";
  els.downloadDocxBtn.disabled = true;
  els.downloadHtmlBtn.disabled = true;
  els.downloadAuditBtn.disabled = true;
  els.reauditBtn.disabled = true;
  setStatus("");
}

function cleanExportClone() {
  const clone = els.preview.cloneNode(true);
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("id");
  clone.querySelectorAll("[data-missing-alt]").forEach((el) => el.removeAttribute("data-missing-alt"));
  clone.querySelectorAll("hr.document-separator").forEach((el) => el.remove());
  return clone;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAudit() {
  // Regenerate the report at download time so edits are reflected accurately.
  runAudit(false);
  if (!lastAudit) return;
  const lines = [
    `APA7 Module Formatter v${APP_VERSION}`,
    `Puntuación heurística: ${lastAudit.score}%`,
    "",
    `Citas detectadas: ${lastAudit.metrics.citations}`,
    `Referencias detectadas: ${lastAudit.metrics.references}`,
    `Citas sin referencia: ${lastAudit.metrics.unmatchedCitations}`,
    `Referencias sin cita: ${lastAudit.metrics.uncitedReferences}`,
    "",
    "Observaciones:",
    ...lastAudit.findings.map((item) => `- [${item.level.toUpperCase()}] ${item.text}`),
    "",
    "Nota: esta auditoría es heurística y requiere revisión académica humana."
  ];
  downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), "auditoria-APA7.txt");
}

function downloadHtml() {
  const clone = cleanExportClone();
  const font = els.fontFamily.value;
  const fontSize = fontSettings[font].cssSize;
  const layoutModel = window.EstiloAPAWordPageLayout;
  const layoutState = layoutModel?.read(document.querySelector("#preview"));
  const paper = layoutState && layoutModel.pageDimensions(layoutState);
  const margin = layoutState?.margins;
  const pageCss = paper ?
    `@page { size: ${paper.width}in ${paper.height}in; margin: ${margin.top}in ${margin.right}in ${margin.bottom}in ${margin.left}in; }` :
    "${pageCss}";
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Documento formateado APA 7</title><style>
@page { size: letter; margin: 1in; }
body { margin: 0; font-family: "${font}", serif; font-size: ${fontSize}; line-height: 2; color: #000; }
section[data-source-file] { display: contents; }
p { margin: 0; text-indent: 0; }
h1,h2,h3,h4,h5,h6 { font: inherit; margin: 1em 0 0; }
.level-1 { text-align: center; font-weight: 700; }.level-2 { text-align: left; font-weight: 700; }.level-3 { text-align: left; font-weight: 700; font-style: italic; }
.apa-reference { ${els.hangingReferences.checked ? "padding-left: .5in; text-indent: -.5in;" : "padding-left: 0; text-indent: 0;"} }
.apa-heading,.apa-figure-label,.apa-note { text-indent: 0; }.apa-figure-label { font-weight: 700; }a { color: inherit; }
</style></head><body>${clone.innerHTML}</body></html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), "modulo-APA7.html");
}

function textRunsFromNode(node, api, font, size, inherited = {}) {
  const { TextRun } = api;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    if (!text) return [];
    const word = window.EstiloAPAWordDocxStyles;
    const options = word?.runOptions(inherited, font, size) ||
      { font, size, bold: inherited.bold, italics: inherited.italics, underline: inherited.underline ? {} : undefined };
    return [new TextRun({ text, ...options })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName;
  const style = window.EstiloAPAWordDocxStyles?.childStyle(node, inherited) || {
    bold: inherited.bold || ["B", "STRONG"].includes(tag),
    italics: inherited.italics || ["I", "EM"].includes(tag),
    underline: inherited.underline || tag === "U",
  };
  if (tag === "BR") return [new TextRun({ break: 1, font, size })];
  return [...node.childNodes].flatMap((child) => textRunsFromNode(child, api, font, size, style));
}

function domBlockToDocxParagraph(element, api, font, size) {
  const { Paragraph, AlignmentType, TextRun } = api;
  const text = element.textContent.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const isRef = element.classList.contains("apa-reference");
  const isLevel1 = element.classList.contains("level-1") || element.tagName === "H1";
  const isLevel2 = element.classList.contains("level-2") || element.tagName === "H2";
  const isLevel3 = element.classList.contains("level-3") || ["H3", "H4", "H5", "H6"].includes(element.tagName);
  const isHeading = isLevel1 || isLevel2 || isLevel3;
  const isFigureLabel = element.classList.contains("apa-figure-label");
  const noIndent = isRef || isHeading || isFigureLabel || element.classList.contains("apa-note") || element.classList.contains("no-indent");
  // Apply APA heading emphasis as inherited styling, not a replacement run.
  // Manual font/color/size changes inside the heading must survive DOCX export.
  const baseline = { bold: isHeading || isFigureLabel, italics: isLevel3 };
  let runs = textRunsFromNode(element, api, font, size, baseline);
  if (!runs.length) runs = [new TextRun({ text, font, size, ...baseline })];
  const options = {
    children: runs,
    spacing: { line: 480, after: 0, before: 0 },
    alignment: isLevel1 ? AlignmentType.CENTER : AlignmentType.LEFT,
  };
  const userIndent = element.dataset.apaEditorIndent;
  const rulerIndent = window.EstiloAPAWordRulerIndents?.toDocx(element);
  if (rulerIndent) options.indent = rulerIndent;
  else if (userIndent === "none") options.indent = { left: 0, firstLine: 0 };
  else if (userIndent === "first") options.indent = { left: 0, firstLine: 720 };
  else if (userIndent === "hanging") options.indent = { left: 720, hanging: 720 };
  else if (isRef && els.hangingReferences.checked) options.indent = { left: 720, hanging: 720 };
  else if (!noIndent && els.firstLineIndent.checked && shouldAutoIndentParagraph(element)) options.indent = { firstLine: 720 };
  // Preserve Word heading semantics and prevent headings from becoming orphans.
  if (isHeading) {
    const heading = api.HeadingLevel;
    options.heading = isLevel1 ? heading?.HEADING_1 : isLevel2 ? heading?.HEADING_2 : heading?.HEADING_3;
    options.keepNext = true;
    options.keepLines = true;
  }
  // Keep figure captions with their neighboring content when pagination allows.
  if (isFigureLabel) options.keepNext = true;
  // Respect explicit line breaks in imported headings and administrative metadata.
  // textRunsFromNode already converts <br> nodes into Word line breaks.
  window.EstiloAPAWordPageLayout?.decorateParagraph(element, options);
  return new Paragraph(options);
}

function collectExportBlocks(clone) {
  const blocks = [];
  const visit = (parent) => {
    for (const element of [...parent.children]) {
      if (element.matches("section[data-source-file]")) visit(element);
      else blocks.push(element);
    }
  };
  visit(clone);
  return blocks;
}

async function imageToDocxRun(img, api) {
  const source = img.getAttribute("src") || "";
  if (!source) return null;
  let bytes;
  try {
    if (source.startsWith("data:image/")) {
      const response = await fetch(source);
      bytes = new Uint8Array(await response.arrayBuffer());
    } else if (source.startsWith("blob:") || source.startsWith("https:") || source.startsWith("http:")) {
      const response = await fetch(source);
      if (!response.ok) return null;
      bytes = new Uint8Array(await response.arrayBuffer());
    } else return null;
    if (!bytes.length) return null;
    const naturalWidth = img.naturalWidth || Number(img.getAttribute("width")) || 600;
    const naturalHeight = img.naturalHeight || Number(img.getAttribute("height")) || 400;
    const scale = Math.min(1, 520 / naturalWidth, 690 / naturalHeight);
    return new api.ImageRun({
      data: bytes,
      transformation: {
        width: Math.max(1, Math.round(naturalWidth * scale)),
        height: Math.max(1, Math.round(naturalHeight * scale)),
      },
    });
  } catch (error) {
    console.warn("DOCX image export skipped:", error);
    return null;
  }
}

async function downloadDocx() {
  try {
    const api = await waitForGlobal("docx");
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, Header, PageNumber, AlignmentType } = api;
    const font = els.fontFamily.value;
    const size = fontSettings[font].halfPoints;
    const clone = cleanExportClone();
    const children = [];

    for (const element of collectExportBlocks(clone)) {
      if (element.tagName === "HR") continue;
      if (["UL", "OL"].includes(element.tagName)) {
        for (const li of element.querySelectorAll(":scope > li")) {
          const text = li.textContent.replace(/\s+/g, " ").trim();
          if (!text) continue;
          children.push(new Paragraph({
            children: [new TextRun({ text, font, size })],
            bullet: element.tagName === "UL" ? { level: 0 } : undefined,
            numbering: element.tagName === "OL" ? { reference: "apa-numbering", level: 0 } : undefined,
            spacing: { line: 480, after: 0, before: 0 },
          }));
        }
        continue;
      }
      if (element.tagName === "TABLE") {
        const rows = [...element.querySelectorAll("tr")].map((row) => new TableRow({
          cantSplit: true,
          children: [...row.cells].map((cell) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell.textContent.trim(), font, size })], spacing: { line: 480, after: 0 } })]
          }))
        }));
        if (rows.length) children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        continue;
      }
      if (element.tagName === "FIGURE" || element.tagName === "IMG") {
        const images = element.tagName === "IMG" ? [element] : [...element.querySelectorAll("img")];
        for (const img of images) {
          const imageRun = await imageToDocxRun(img, api);
          if (imageRun) {
            children.push(new Paragraph({ children: [imageRun], spacing: { line: 480 } }));
          } else {
            children.push(new Paragraph({ children: [new TextRun({ text: `[Figura no incrustada: ${img.getAttribute("alt") || "revise el original"}]`, font, size, italics: true })] }));
          }
        }
        if (element.tagName === "FIGURE") {
          for (const caption of element.querySelectorAll("figcaption")) {
            children.push(new Paragraph({ children: [new TextRun({ text: caption.textContent.trim(), font, size })], spacing: { line: 480 } }));
          }
        }
        continue;
      }
      const paragraph = domBlockToDocxParagraph(element, api, font, size);
      if (paragraph) children.push(paragraph);
    }

    const headers = els.pageNumbers.checked ? {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ children: [PageNumber.CURRENT], font, size })],
        })]
      })
    } : undefined;

    const doc = new Document({
      numbering: { config: [{ reference: "apa-numbering", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }] }] },
      sections: [{
        properties: { page: window.EstiloAPAWordPageLayout?.getDocxPage() || { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers,
        children,
      }],
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, "modulo-APA7.docx");
    setStatus("DOCX document exported successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatus(`Could not export DOCX: ${error?.message || error}`, "error");
  }
}

window.addEventListener("error", (event) => {
  if (event?.message) setStatus(`Application error: ${event.message}`, "error");
});

setStatus("");
