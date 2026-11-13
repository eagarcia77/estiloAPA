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
    ["H4", "level-4"], ["H5", "level-5"], ["H6", "level-5"],
  ]);
  for (const heading of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    heading.classList.add("apa-heading", headingMap.get(heading.tagName) || "level-2");
  }
}

function isApaReferenceEntry(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  // Exclude teaching notes and resource recommendations embedded in the
  // references section; require a recognizable APA author/date structure.
  if (/^(?:recursos? sugeridos?|lecturas? recomendadas?|nota(?:s)? sobre|recommended resources|additional reading)\s*:/i.test(value)) return false;
  return /^.{2,180}?\.\s*\((?:(?:19|20)\d{2}[a-z]?|s\.\s*f\.|n\.\s*d\.)\)\.\s+\S/i.test(value);
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
        if (isApaReferenceEntry(text)) {
          block.classList.add("apa-reference");
          referenceBlocks.push(block);
        } else {
          block.classList.remove("apa-reference");
          block.classList.add("apa-reference-review-note");
          // Teaching resource notes are not bibliography entries. Move them
          // before the references heading on initial import only; preserve
          // their text, inline formatting and subsequent user edits.
          if (/^(?:recursos? sugeridos?|lecturas? recomendadas?|recommended resources|additional reading)\s*:/i.test(text) && heading) {
            flush();
            heading.before(block);
          }
        }
      }
    }
    flush();
  }
}

// APA 7 reference typography is applied once during import/formatting,
// never during DOCX export. Preserve any existing manual inline emphasis.
function normalizeReferenceItalics(root) {
  // Format only recognisable book, institutional report and standalone web titles
  // during initial import. Never run during export or subsequent user edits.
  for (const ref of root.querySelectorAll(".apa-reference")) {
    if (ref.querySelector("em,i,[style*='italic']")) continue;
    const text = ref.textContent.replace(/\s+/g, " ").trim();
    const year = /\((?:(?:19|20)\d{2}[a-z]?|s\.\s*f\.|n\.\s*d\.)\)/i.exec(text);
    if (!year) continue;
    const rest = text.slice(year.index + year[0].length).replace(/^\s*\.\s*/, "").trim();
    if (!rest || /^https?:/i.test(rest)) continue;
    // Do not guess italics for journal articles, chapters in edited books,
    // or sources with a journal volume/issue pattern. They require different
    // APA 7 emphasis rules and should remain available for manual editing.
    if (/[,]\s*\d+\s*(?:\(\d+\))?\s*[,]\s*\d/.test(rest) ||
        /\b(?:In|En)\s+[^.]+\((?:Ed\.|Eds\.|ed\.|eds\.)\)/.test(rest) ||
        /\b\d+\s*\(\d+\)\s*[,，]\s*\d/.test(rest)) continue;
    let title = rest.split(/\s+https?:\/\//i)[0].trim();
    // Editions and report identifiers are metadata, not part of the italicized
    // book/report title. Preserve the original text and its punctuation.
    const edition = /\s+\((?:\d+(?:st|nd|rd|th)?\s+ed\.|\d+\.ª\s+ed\.|edici[oó]n[^)]*|NIST\s+(?:CSWP|SP|IR)\s+[\w.-]+|(?:Report|Informe)\s+(?:No\.|núm\.)\s*[\w.-]+)\)/i.exec(title);
    if (edition) title = title.slice(0, edition.index);
    const sentence = title.match(/^(.+?)(?:\.\s+(?=[A-ZÁÉÍÓÚÑ])|\.$)/);
    if (sentence) title = sentence[1];
    title = title.replace(/\.$/, "").trim();
    if (title.length < 5) continue;
    // Work with text nodes, never innerHTML: preserve existing links and runs.
    const walker = document.createTreeWalker(ref, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    // Word imports can split one title across several spans/text runs.
    // Map its character range onto the original text nodes instead of
    // requiring the entire title to occur inside one node.
    const full = nodes.map(node => node.nodeValue).join("");
    const start = full.indexOf(title);
    if (start < 0) continue;
    let cursor = 0, first = null, last = null;
    for (const node of nodes) {
      const next = cursor + node.nodeValue.length;
      if (!first && start >= cursor && start < next)
        first = { node, offset: start - cursor };
      if (first && start + title.length <= next) {
        last = { node, offset: start + title.length - cursor };
        break;
      }
      cursor = next;
    }
    if (!first || !last) continue;
    try {
      const range = document.createRange();
      range.setStart(first.node, first.offset);
      range.setEnd(last.node, last.offset);
      const em = document.createElement("em");
      em.append(range.extractContents());
      range.insertNode(em);
    } catch (error) {
      console.warn("APA reference title could not be italicized:", error);
    }
  }
}

function normalizeApaTableCaptions(root) {
  // Repair the specific duplicated caption pattern produced by Word import:
  // "Tabla 1. Title" followed by "Tabla 1" immediately before the table.
  for (const table of root.querySelectorAll("table")) {
    const label = table.previousElementSibling;
    const caption = label?.previousElementSibling;
    if (!label || !caption || !/^(P|DIV|H[1-6])$/.test(label.tagName) ||
        !/^(P|DIV|H[1-6])$/.test(caption.tagName)) continue;
    const number = label.textContent.trim().match(/^(Tabla|Table)\s+(\d+[a-z]?)\.?$/i);
    const combined = caption.textContent.trim().match(/^(Tabla|Table)\s+(\d+[a-z]?)\.\s+(.+)$/i);
    if (!number || !combined || number[2].toLowerCase() !== combined[2].toLowerCase()) continue;
    // A Word heading commonly contains a <strong> run, so rejecting all
    // inline children prevented normalization of the real exported fixture.
    // The exact duplicate-text match above protects unrelated captions.
    // Preserve manual edits elsewhere: only this recognized pair is changed.
    // Imported headings must become ordinary APA table captions, not Word headings.
    const captionNode = /^H[1-6]$/.test(caption.tagName) ? document.createElement("p") : caption;
    if (captionNode !== caption) caption.replaceWith(captionNode);
    captionNode.textContent = combined[1] + " " + combined[2];
    captionNode.className = "apa-table-label";
    captionNode.style.fontWeight = "bold";
    const titleNode = /^H[1-6]$/.test(label.tagName) ? document.createElement("p") : label;
    if (titleNode !== label) label.replaceWith(titleNode);
    titleNode.textContent = combined[3];
    titleNode.className = "apa-table-title no-indent";
    titleNode.style.fontStyle = "italic";
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

function normalizeApaTableNotes(root) {
  // Only annotate notes immediately following a table. Do not touch ordinary
  // paragraphs containing the word "Nota" or overwrite manually italicized runs.
  for (const table of root.querySelectorAll("table")) {
    const note = table.nextElementSibling;
    if (!note || !/^(P|DIV)$/.test(note.tagName)) continue;
    const match = /^(Nota|Note)\./i.exec(note.textContent.trim());
    if (!match) continue;
    note.classList.add("apa-note", "no-indent");
    const first = note.firstChild;
    if (first?.nodeType === Node.TEXT_NODE && /^\s*(Nota|Note)\./i.test(first.nodeValue)) {
      const prefix = first.nodeValue.match(/^(\s*(?:Nota|Note)\.)/i)[1];
      first.nodeValue = first.nodeValue.slice(prefix.length);
      const emphasis = document.createElement("em");
      emphasis.textContent = prefix;
      note.insertBefore(emphasis, first);
    } else if (!note.querySelector("em,i,[style*='italic']")) {
      const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
      const firstText = walker.nextNode();
      if (!firstText) continue;
      const prefix = firstText.nodeValue.match(/^(\s*(?:Nota|Note)\.)/i)?.[1];
      if (!prefix) continue;
      firstText.nodeValue = firstText.nodeValue.slice(prefix.length);
      const emphasis = document.createElement("em");
      emphasis.textContent = prefix;
      firstText.parentNode.insertBefore(emphasis, firstText);
    }
  }
}

function applyApaRules(root) {
  replaceDivsWithParagraphs(root);
  normalizeHeadingLevels(root);
  normalizeReferences(root);
  normalizeReferenceItalics(root);
  normalizeApaTableCaptions(root);
  normalizeApaTableNotes(root);
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
  return [...root.querySelectorAll(".apa-reference")].filter(element => isApaReferenceEntry(element.textContent)).map((element, index) => {
    const text = element.textContent.replace(/\s+/g, " ").trim();
    const yearMatch = text.match(new RegExp(`\\((${yearToken})[^)]*\\)`, "i"));
    const year = yearMatch ? yearMatch[1].toLowerCase().replace(/\s/g, "") : "";
    const beforeYear = yearMatch ? text.slice(0, yearMatch.index).trim() : text;
    // Personal authors use the first surname; institutional authors must
    // retain their complete name (e.g. International Telecommunication Union).
    const personalAuthor = /^([^,]{2,80}),\s*(?:[A-ZÁÉÍÓÚÑ]\.\s*){1,4}(?:,|&|y|$)/i.exec(beforeYear);
    let author = personalAuthor ? personalAuthor[1].trim() : beforeYear.replace(/[.\s]+$/, "").trim();
    if (author.length > 160) author = author.slice(0, 160);
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

function apaAuthorAliases(author) {
  const clean = String(author || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const tokens = clean.split(" ");
  const aliases = new Set([clean]);
  if (tokens.length === 1) aliases.add(tokens[0]);
  // An organizational acronym is derived only from its actual author name,
  // never from a guessed translation or an unrelated organization.
  if (tokens.length >= 2) {
    const stop = new Set(["de","del","la","las","los","el","of","the","and","for","y","en","on","a"]);
    const acronym = tokens.filter(t => !stop.has(t)).map(t => t[0]).join("");
    if (acronym.length >= 2) aliases.add(acronym);
  }
  return [...aliases];
}

function auditDocument(root) {
  const findings = [];
  let points = 35;
  const references = parseReferences(root);
  const citations = parseCitations(root);
  // Match full institutional names and their derived initials, while keeping
  // author-year suffixes (2025a vs 2025b) distinct.
  const authorYearMatch = (citation, ref) => citation.year === ref.year &&
    apaAuthorAliases(citation.author).some(alias => apaAuthorAliases(ref.author).includes(alias));
  const unmatchedCitations = citations.filter(citation =>
    !references.some(ref => authorYearMatch(citation, ref)));
  const uncitedReferences = references.filter(ref => ref.key &&
    !citations.some(citation => authorYearMatch(citation, ref)));

  findings.push({ level: "ok", text: "Márgenes de 1 pulgada e interlineado doble configurados para la exportación." });
  findings.push({ level: "ok", text: `Fuente APA compatible seleccionada: ${els.fontFamily.value}.` });
  if (els.pageNumbers.checked) findings.push({ level: "ok", text: "La exportación DOCX incluirá numeración de página en el encabezado." });

  const refsHeading = root.querySelector(".apa-references-heading");
  const resourceNotesInBibliography = [...root.querySelectorAll(".apa-reference-review-note")]
    .filter(el => /^(?:recursos? sugeridos?|lecturas? recomendadas?|recommended resources|additional reading)\s*:/i.test(el.textContent.trim()) &&
      !!el.previousElementSibling?.closest?.("section,div"));
  // Review notes are preserved rather than silently counted as sources.
  if (resourceNotesInBibliography.length) {
    findings.push({ level: "warn", text: `${resourceNotesInBibliography.length} nota(s) de recursos sugeridos no son referencias APA 7; ubíquelas fuera de la bibliografía.` });
  }
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

    // Highlight incomplete records for research instead of fabricating fields.
    const incomplete = references.filter(ref => !ref.hasYear ||
      !/\)\.\s+\S/.test(ref.text) ||
      /^\s*https?:\/\//i.test(ref.text) ||
      /\b(?:doi|editorial|publisher|autor|author|fecha|date)\s*:\s*(?:pendiente|desconocid[oa]|unknown|missing)\b/i.test(ref.text));
    if (incomplete.length) {
      const examples = incomplete.slice(0, 3).map(ref => `#${ref.index}: ${ref.text.slice(0, 90)}`).join(" | ");
      findings.push({ level: "warn", text: `${incomplete.length} referencia(s) posiblemente incompleta(s); verificar datos bibliográficos: ${examples}.` });
    }
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
      findings.push({ level: "ok", text: "Todas las citas reconocidas coinciden por autor y año; compruebe manualmente siglas y variantes de nombres." });
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

// Keep the APA report current without reformatting the user's edited text.
let apaAuditTimer = null;
els.preview?.addEventListener("input", () => {
  if (importingDocument) return;
  window.clearTimeout(apaAuditTimer);
  apaAuditTimer = window.setTimeout(() => {
    if (hasFormattedContent()) runAudit(false);
  }, 750);
});

// DOI metadata lookup uses Crossref's public API. No secret or paid key.
// Never replace a reference unless the user confirms the exact suggestion.
async function verifyReferenceDois() {
  const refs = parseReferences(els.preview);
  const candidates = refs.filter(ref => /(?:doi\.org\/|doi:\\s*)(10\.\d{4,9}\/[^\s<>]+)/i.test(ref.text));
  if (!candidates.length) {
    setStatus("No se encontraron DOI para verificar. Las referencias sin DOI requieren una búsqueda bibliográfica manual.", "warn");
    return;
  }
  let verified = 0, changed = 0;
  for (const ref of candidates.slice(0, 15)) {
    const doi = ref.text.match(/(?:doi\.org\/|doi:\\s*)(10\.\d{4,9}\/[^\s<>]+)/i)?.[1]?.replace(/[.,;]+$/, "");
    if (!doi) continue;
    try {
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const item = (await response.json())?.message;
      if (!item?.title?.[0] || !item?.DOI) continue;
      verified++;
      const authors = (item.author || []).map(a => a.family ? `${a.family}, ${(a.given || "").split(/\s+/).filter(Boolean).map(n => n[0] + ".").join(" ")}` : a.name).filter(Boolean);
      const year = item.published?.["date-parts"]?.[0]?.[0] || item.issued?.["date-parts"]?.[0]?.[0];
      const title = item.title[0].replace(/<[^>]+>/g, "");
      const journal = item["container-title"]?.[0] || "";
      const suggestion = `${authors.join(", ") || item.publisher || "Autor por verificar"}. (${year || "s. f."}). ${title}. ${journal ? journal + ". " : ""}https://doi.org/${item.DOI}`;
      if (window.confirm(`Metadatos encontrados en Crossref para DOI ${doi}:\n\n${suggestion}\n\n¿Reemplazar esta referencia? Revise después volumen, número, páginas y cursivas APA 7.`)) {
        ref.element.textContent = suggestion;
        ref.element.classList.add("apa-reference");
        changed++;
      }
    } catch (error) {
      console.warn("Crossref DOI lookup failed", doi, error);
    }
  }
  runAudit(false);
  setStatus(`Crossref: ${verified} DOI verificados; ${changed} referencias actualizadas con autorización. Revise datos y cursivas.`, "success");
}

// Search Crossref for references without DOI. Add only a verified DOI;
// do not rewrite the author's original APA typography or publication data.
async function discoverMissingReferenceDois() {
  const refs = parseReferences(els.preview).filter(ref => !ref.hasDoi && ref.hasYear);
  if (!refs.length) {
    setStatus("No hay referencias con año y sin DOI que puedan buscarse en Crossref.", "success");
    return;
  }
  let matches = 0, accepted = 0;
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const ref of refs.slice(0, 12)) {
    const afterYear = ref.text.replace(/^.*?\((?:19|20)\d{2}[a-z]?\)\.\s*/i, "");
    const title = afterYear.split(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/)[0].replace(/\s*\([^)]*ed\.\).*$/i, "").trim();
    if (title.length < 18) continue;
    try {
      const url = "https://api.crossref.org/works?rows=3&query.bibliographic=" +
        encodeURIComponent(ref.author + " " + title);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const items = (await response.json())?.message?.items || [];
      const candidate = items.find(item => {
        const candidateTitle = normalize(item.title?.[0]);
        const originalTitle = normalize(title);
        const publishedYear = item.published?.["date-parts"]?.[0]?.[0] || item.issued?.["date-parts"]?.[0]?.[0];
        const candidateAuthors = (item.author || []).map(a => normalize(a.family || a.name)).join(" ");
        const surname = normalize(ref.author.split(",")[0]);
        return item.DOI && originalTitle.length >= 18 &&
          (candidateTitle === originalTitle || (candidateTitle.includes(originalTitle) && originalTitle.length >= 35)) &&
          String(publishedYear) === ref.year.replace(/[a-z]$/, "") &&
          surname.length > 2 && candidateAuthors.includes(surname);
      });
      if (!candidate) continue;
      matches++;
      const doiUrl = "https://doi.org/" + candidate.DOI;
      if (window.confirm("Coincidencia bibliográfica encontrada en Crossref:\n\n" +
          (candidate.title?.[0] || "") + "\n" + doiUrl +
          "\n\n¿Añadir únicamente este DOI a la referencia original?")) {
        const suffix = /[.]\s*$/.test(ref.element.textContent) ? " " : ". ";
        ref.element.append(document.createTextNode(suffix + doiUrl));
        accepted++;
      }
    } catch (error) {
      console.warn("Crossref bibliographic lookup failed", error);
    }
  }
  runAudit(false);
  setStatus(`Búsqueda bibliográfica: ${matches} coincidencias estrictas; ${accepted} DOI añadidos con autorización.`, "success");
}

const discoverDoiButton = document.createElement("button");
discoverDoiButton.type = "button";
discoverDoiButton.textContent = "Buscar DOI faltantes en internet";
discoverDoiButton.title = "Busca por título, autor y año en Crossref; solo añade DOI tras su aprobación.";
discoverDoiButton.addEventListener("click", () => void discoverMissingReferenceDois());
els.auditList?.parentElement?.append(discoverDoiButton);

// Book lookup is advisory: APA 7 does not include ISBN in references.
// Open Library records may describe a different printing or edition.
async function verifyBooksInOpenLibrary() {
  const refs = parseReferences(els.preview).filter(ref => ref.hasYear && !ref.hasDoi);
  if (!refs.length) {
    setStatus("No se encontraron referencias candidatas para consultar en Open Library.", "warn");
    return;
  }
  const normalize = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let reviewed = 0, matches = 0;
  for (const ref of refs.slice(0, 12)) {
    const rest = ref.text.replace(/^.*?\((?:19|20)\d{2}[a-z]?\)\.\s*/i, "");
    const title = rest.split(/\s+\((?:\d+(?:st|nd|rd|th)\s+ed\.|\d+\.ª\s+ed\.)\)/i)[0]
      .split(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/)[0].trim();
    if (title.length < 12 || /^https?:/i.test(title)) continue;
    try {
      const response = await fetch("https://openlibrary.org/search.json?limit=5&fields=key,title,author_name,first_publish_year,edition_key,isbn,publisher,edition_count&title=" +
        encodeURIComponent(title));
      if (!response.ok) continue;
      reviewed++;
      const items = (await response.json())?.docs || [];
      const match = items.find(item => {
        const a = normalize(item.title), b = normalize(title);
        const authors = (item.author_name || []).map(normalize).join(" ");
        const surname = normalize(ref.author.split(",")[0]);
        // Year of first publication is NOT the year of the edition cited.
        return a === b && surname.length > 2 && authors.includes(surname);
      });
      if (!match) continue;
      matches++;
      const recordUrl = "https://openlibrary.org" + match.key;
      const message = "Posible registro de libro localizado (NO modifica su referencia):\n\n" +
        match.title + "\nAutores: " + (match.author_name || []).join("; ") +
        "\nPrimera publicación registrada: " + (match.first_publish_year || "sin dato") +
        "\nEdiciones catalogadas: " + (match.edition_count || "sin dato") +
        "\n\nEl año de primera publicación no confirma el año ni la edición citada. " +
        "El ISBN no se añade a referencias APA 7.\n\n¿Abrir el registro para verificar la edición?";
      if (window.confirm(message)) window.open(recordUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.warn("Open Library lookup failed", error);
    }
  }
  setStatus(`Open Library: ${reviewed} consultas; ${matches} posibles libros identificados. No se modificaron referencias.`, "success");
}

const openLibraryButton = document.createElement("button");
openLibraryButton.type = "button";
openLibraryButton.textContent = "Verificar libros en Open Library";
openLibraryButton.title = "Consulta catálogos de libros sin modificar las referencias; verifique edición y fecha.";
openLibraryButton.addEventListener("click", () => void verifyBooksInOpenLibrary());
els.auditList?.parentElement?.append(openLibraryButton);

const doiVerifyButton = document.createElement("button");
doiVerifyButton.type = "button";
doiVerifyButton.textContent = "Verificar DOI en Crossref";
doiVerifyButton.title = "Consulta metadatos bibliográficos; solicita aprobación antes de reemplazar una referencia.";
doiVerifyButton.addEventListener("click", () => void verifyReferenceDois());
els.auditList?.parentElement?.append(doiVerifyButton);

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
  // Capture the actual visible editor styles before detaching the export DOM.
  // getComputedStyle() on detached nodes cannot reliably resolve editor CSS.
  const live = els.preview;
  const clone = live.cloneNode(true);
  const liveNodes = [live, ...live.querySelectorAll("*")];
  const cloneNodes = [clone, ...clone.querySelectorAll("*")];
  for (let i = 0; i < cloneNodes.length; i++) {
    const source = liveNodes[i];
    const target = cloneNodes[i];
    if (!source || !target || source.nodeType !== Node.ELEMENT_NODE) continue;
    if (!/^(P|H[1-6]|LI|TD|TH|SPAN|B|STRONG|I|EM|U|A|DIV)$/.test(source.tagName)) continue;
    const computed = window.getComputedStyle(source);
    // Preserve user-visible formatting for Word, including class-based styles.
    for (const prop of ["text-align", "font-family", "font-size", "font-weight",
      "font-style", "text-decoration-line", "color"]) {
      if (!target.style.getPropertyValue(prop)) target.style.setProperty(prop, computed.getPropertyValue(prop));
    }
    if (/^(P|H[1-6]|LI|TD|TH)$/.test(source.tagName)) {
      for (const prop of ["text-indent", "line-height", "margin-left", "margin-top", "margin-bottom"]) {
        if (!target.style.getPropertyValue(prop)) target.style.setProperty(prop, computed.getPropertyValue(prop));
      }
    }
  }
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
  const isLevel3 = element.classList.contains("level-3") || element.tagName === "H3";
  const isLevel4 = element.classList.contains("level-4") || element.tagName === "H4";
  const isLevel5 = element.classList.contains("level-5") || ["H5", "H6"].includes(element.tagName);
  const isHeading = isLevel1 || isLevel2 || isLevel3 || isLevel4 || isLevel5;
  const isFigureLabel = element.classList.contains("apa-figure-label");
  const noIndent = isRef || isHeading || isFigureLabel || element.classList.contains("apa-note") || element.classList.contains("no-indent");
  // Apply APA heading emphasis as inherited styling, not a replacement run.
  // Manual font/color/size changes inside the heading must survive DOCX export.
  // Editor-first export: semantic heading classes do not override manual formatting.
  // The captured editor CSS supplies the actual character styling.
  const baseline = {};
  // Apply the paragraph's own formatting to its text runs; previously only
  // descendant spans were considered, dropping font, size, color and emphasis
  // applied directly to the editor paragraph.
  const paragraphStyle = window.EstiloAPAWordDocxStyles?.childStyle(element, baseline) || baseline;
  // Inline APA levels 4 and 5 must not be treated as centered block headings.
  // Their run emphasis is inherited from the editor, preserving manual changes.
  let runs = textRunsFromNode(element, api, font, size, paragraphStyle);
  if (!runs.length) runs = [new TextRun({ text, font, size, ...baseline })];
  const options = {
    children: runs,
    spacing: { line: 480, after: 0, before: 0 },
    alignment: (() => {
      const alignment = element.style.textAlign;
      if (alignment === "center") return AlignmentType.CENTER;
      if (alignment === "right" || alignment === "end") return AlignmentType.RIGHT;
      if (alignment === "justify") return AlignmentType.JUSTIFIED;
      return AlignmentType.LEFT;
    })(),
  };
  // Explicit editor paragraph spacing takes precedence over default APA spacing.
  // The detached export clone has a snapshot of the live editor's computed CSS.
  // Avoid resolving styles against the detached node, where rules may be missing.
  const computed = element.style;
  const ptToTwips = (cssValue) => {
    const pixels = Number.parseFloat(cssValue);
    return Number.isFinite(pixels) ? Math.max(0, Math.round(pixels * 15)) : 0;
  };
  if (element.style.marginTop) options.spacing.before = ptToTwips(computed.marginTop);
  if (element.style.marginBottom) options.spacing.after = ptToTwips(computed.marginBottom);
  // Preserve formatting explicitly chosen in the editor. These overrides
  // take precedence over automatic APA defaults during DOCX serialization.
  const cssFirstLine = element.style.textIndent;
  const cssLeft = element.style.marginLeft || element.style.paddingLeft;
  const cssLineHeight = element.style.lineHeight;
  const cssToTwips = (value) => {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return null;
    if (/in$/.test(value)) return Math.round(n * 1440);
    if (/pt$/.test(value)) return Math.round(n * 20);
    if (/px$/.test(value)) return Math.round(n * 15);
    return null;
  };
  const userIndent = element.dataset.apaEditorIndent;
  const rulerIndent = window.EstiloAPAWordRulerIndents?.toDocx(element);
  if (rulerIndent) options.indent = rulerIndent;
  else if (userIndent === "none") options.indent = { left: 0, firstLine: 0 };
  else if (userIndent === "first") options.indent = { left: 0, firstLine: 720 };
  else if (userIndent === "hanging") options.indent = { left: 720, hanging: 720 };
  else if (isRef && els.hangingReferences.checked && !cssFirstLine && !cssLeft) options.indent = { left: 720, hanging: 720 };
  else if (!noIndent && els.firstLineIndent.checked && shouldAutoIndentParagraph(element)) options.indent = { firstLine: 720 };
  if (cssFirstLine && cssToTwips(cssFirstLine) !== null) {
    const firstLine = cssToTwips(cssFirstLine);
    const indent = { ...(options.indent || {}) };
    if (firstLine < 0) {
      // docx expects a positive hanging indent, not a negative firstLine.
      delete indent.firstLine;
      indent.hanging = Math.abs(firstLine);
      indent.left = Math.max(indent.left || 0, indent.hanging);
    } else {
      delete indent.hanging;
      indent.firstLine = firstLine;
    }
    options.indent = indent;
  }
  if (cssLeft && cssToTwips(cssLeft) !== null) {
    options.indent = { ...(options.indent || {}), left: cssToTwips(cssLeft) };
  }
  if (cssLineHeight) {
    const explicitLine = cssToTwips(cssLineHeight);
    if (explicitLine !== null && explicitLine > 0) options.spacing.line = explicitLine;
    else if (/^[\d.]+$/.test(cssLineHeight)) options.spacing.line = Math.round(Number(cssLineHeight) * 240);
  }
  // Normalize negative ruler/CSS indentation values before docx validates them.
  // Negative first-line offsets in Word are represented as positive hanging values.
  if (options.indent) {
    const indent = { ...options.indent };
    if (Number.isFinite(indent.firstLine) && indent.firstLine < 0) {
      indent.hanging = Math.abs(indent.firstLine);
      delete indent.firstLine;
      indent.left = Math.max(0, indent.left || 0, indent.hanging);
    }
    if (Number.isFinite(indent.hanging) && indent.hanging < 0) {
      indent.firstLine = Math.abs(indent.hanging);
      delete indent.hanging;
    }
    options.indent = indent;
  }
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
  // Final serialization boundary: the docx library validates all indentation
  // dimensions as non-negative integers. A negative margin (often -720 twips)
  // must never abort the entire document export.
  if (options.indent) {
    const indent = { ...options.indent };
    for (const key of ["left", "right", "firstLine", "hanging"]) {
      if (indent[key] === undefined || indent[key] === null) continue;
      const value = Number(indent[key]);
      if (!Number.isFinite(value)) { delete indent[key]; continue; }
      if (key === "firstLine" && value < 0) {
        indent.hanging = Math.max(Number(indent.hanging) || 0, Math.abs(Math.round(value)));
        delete indent.firstLine;
      } else if (key === "hanging" && value < 0) {
        indent.firstLine = Math.abs(Math.round(value));
        delete indent.hanging;
      } else {
        indent[key] = Math.max(0, Math.round(value));
      }
    }
    if (indent.hanging !== undefined && indent.firstLine !== undefined) delete indent.firstLine;
    if (indent.hanging !== undefined) indent.left = Math.max(indent.left || 0, indent.hanging);
    options.indent = indent;
  }
  return new Paragraph(options);
}

function collectExportBlocks(clone) {
  const blocks = [];
  const visit = (parent) => {
    for (const element of [...parent.children]) {
      // Editor wrappers must not become a single flattened Word paragraph.
      // Descend only through structural containers; preserve real paragraphs,
      // figures, lists and tables as independent export blocks.
      const structural = ["DIV", "SECTION", "ARTICLE", "MAIN"].includes(element.tagName);
      const hasBlocks = [...element.children].some(child =>
        /^(P|H[1-6]|DIV|SECTION|ARTICLE|MAIN|TABLE|FIGURE|UL|OL|IMG)$/.test(child.tagName));
      if (structural && hasBlocks) visit(element);
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
    // Export the displayed size, not the source image's pixel dimensions.
    // The clone is detached, so read the corresponding live editor image by index.
    const sourceImages = [...document.querySelectorAll("#preview img")];
    const imageIndex = Number(img.dataset.exportImageIndex);
    const live = Number.isInteger(imageIndex) && imageIndex >= 0 ? sourceImages[imageIndex] : null;
    const bounds = live?.getBoundingClientRect();
    const visibleWidth = bounds?.width > 0 ? bounds.width : (Number.parseFloat(img.style.width) || naturalWidth);
    const visibleHeight = bounds?.height > 0 ? bounds.height : (Number.parseFloat(img.style.height) || visibleWidth * naturalHeight / naturalWidth);
    const scale = Math.min(1, 520 / visibleWidth, 690 / visibleHeight);
    return new api.ImageRun({
      data: bytes,
      transformation: {
        width: Math.max(1, Math.round(visibleWidth * scale)),
        height: Math.max(1, Math.round(visibleHeight * scale)),
      },
      altText: { title: img.getAttribute("alt") || "Imagen", description: img.getAttribute("alt") || "Imagen del documento" },
    });
  } catch (error) {
    console.warn("DOCX image export skipped:", error);
    return null;
  }
}

function normalizeExportTableCaptions(blocks) {
  // Export-only fallback: Word imports may wrap captions in separate containers,
  // so DOM sibling-based import normalization cannot always see both paragraphs.
  const result = [...blocks];
  for (let i = 2; i < result.length; i++) {
    if (result[i].tagName !== "TABLE") continue;
    const label = result[i - 1], combined = result[i - 2];
    if (!label || !combined || !/^(P|DIV|H[1-6])$/.test(label.tagName) ||
        !/^(P|DIV|H[1-6])$/.test(combined.tagName)) continue;
    const a = label.textContent.trim().match(/^(Tabla|Table)\s+(\d+[a-z]?)\.?$/i);
    const b = combined.textContent.trim().match(/^(Tabla|Table)\s+(\d+[a-z]?)\.\s+(.+)$/i);
    if (!a || !b || a[2].toLowerCase() !== b[2].toLowerCase()) continue;
    // Operate only on the detached export clone; never overwrite manual editor changes.
    const number = document.createElement("p");
    number.textContent = b[1] + " " + b[2];
    number.className = "apa-table-label no-indent";
    number.style.fontWeight = "bold";
    const title = document.createElement("p");
    title.textContent = b[3];
    title.className = "apa-table-title no-indent";
    title.style.fontStyle = "italic";
    result[i - 2] = number;
    result[i - 1] = title;
  }
  return result;
}

async function downloadDocx() {
  try {
    const api = await waitForGlobal("docx");
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, Header, PageNumber, AlignmentType } = api;
    const font = els.fontFamily.value;
    const size = fontSettings[font].halfPoints;
    const clone = cleanExportClone();
    [...clone.querySelectorAll("img")].forEach((img, index) => { img.dataset.exportImageIndex = String(index); });
    const children = [];
    const numberingConfigs = [];
    let orderedListIndex = 0;

    for (const element of normalizeExportTableCaptions(collectExportBlocks(clone))) {
      if (element.tagName === "HR") continue;
      if (["UL", "OL"].includes(element.tagName)) {
        const isOrdered = element.tagName === "OL";
        const listRef = isOrdered ? `apa-numbering-${++orderedListIndex}` : null;
        if (isOrdered) numberingConfigs.push({
          reference: listRef,
          levels: [{
            level: 0, format: "decimal", text: "%1.", alignment: "left",
            start: Math.max(1, Number(element.getAttribute("start")) || 1),
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        });
        for (const li of element.querySelectorAll(":scope > li")) {
          const text = li.textContent.replace(/\s+/g, " ").trim();
          if (!text) continue;
          children.push(new Paragraph({
            children: textRunsFromNode(li, api, font, size, window.EstiloAPAWordDocxStyles?.childStyle(li, {}) || {}),
            bullet: element.tagName === "UL" ? { level: 0 } : undefined,
            numbering: isOrdered ? { reference: listRef, level: 0 } : undefined,
            spacing: { line: 480, after: 0, before: 0 },
          }));
        }
        continue;
      }
      if (element.tagName === "TABLE") {
        const rows = [...element.querySelectorAll("tr")].map((row) => new TableRow({
          cantSplit: true,
          children: [...row.cells].map((cell) => {
            const cellParagraphs = [...cell.children].filter(node => /^(P|DIV|H[1-6])$/.test(node.tagName));
            const paragraphs = cellParagraphs.length ? cellParagraphs.map(node =>
              domBlockToDocxParagraph(node, api, font, size)
            ).filter(Boolean) : [new Paragraph({
              children: textRunsFromNode(cell, api, font, size,
                window.EstiloAPAWordDocxStyles?.childStyle(cell, {}) || {}),
              spacing: { line: 480, after: 0 },
              alignment: cell.style.textAlign === "center" ? AlignmentType.CENTER :
                cell.style.textAlign === "right" ? AlignmentType.RIGHT :
                cell.style.textAlign === "justify" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
            })];
            const isHeader = row === element.querySelector("tr");
            const isLast = row === [...element.querySelectorAll("tr")].at(-1);
            const borderLine = { style: api.BorderStyle?.SINGLE || "single", size: 8, color: "000000" };
            const noBorder = { style: api.BorderStyle?.NONE || "none", size: 0, color: "FFFFFF" };
            // Explicit cell borders override Word's default table-grid style.
            return new TableCell({
              borders: {
                top: isHeader ? borderLine : noBorder,
                bottom: (isHeader || isLast) ? borderLine : noBorder,
                left: noBorder, right: noBorder,
              },
              children: paragraphs.length ? paragraphs : [new Paragraph({ text: "" })],
              columnSpan: Math.max(1, Number(cell.colSpan) || 1),
              rowSpan: Math.max(1, Number(cell.rowSpan) || 1),
            });
          })
        }));
        if (rows.length) {
          const liveTables = [...els.preview.querySelectorAll("table")];
          const tableIndex = [...clone.querySelectorAll("table")].indexOf(element);
          const liveTable = liveTables[tableIndex];
          const liveWidths = liveTable ? [...liveTable.rows[0]?.cells || []].map(cell => cell.getBoundingClientRect().width) : [];
          const totalWidth = liveWidths.reduce((a,b)=>a+b,0);
          const widths = totalWidth > 0 && liveWidths.length === rows[0].cells.length
            ? liveWidths.map(w => Math.max(1, Math.round(w / totalWidth * 100)))
            : null;
          // APA 7 table rules: horizontal top, header separator and bottom.
          // No vertical lines or interior grid. Word units: 8 = 1 pt.
          const rule = { style: api.BorderStyle?.SINGLE || "single", size: 8, color: "000000" };
          const none = { style: api.BorderStyle?.NONE || "none", size: 0, color: "FFFFFF" };
          const borders = {
            top: rule, bottom: rule, insideHorizontal: none,
            left: none, right: none, insideVertical: none,
          };
          children.push(new Table({
            rows,
            borders,
            width: { size: 100, type: WidthType.PERCENTAGE },
            ...(widths ? { columnWidths: widths.map(w => Math.round(w / 100 * 9360)) } : {}),
            layout: api.TableLayoutType?.FIXED,
          }));
        }
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
      numbering: { config: numberingConfigs },
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
