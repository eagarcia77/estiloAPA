const PDFJS_VERSION = "6.1.200";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

const els = {
  files: document.querySelector("#files"),
  dropZone: document.querySelector("#dropZone"),
  fileList: document.querySelector("#fileList"),
  fontFamily: document.querySelector("#fontFamily"),
  firstLineIndent: document.querySelector("#firstLineIndent"),
  hangingReferences: document.querySelector("#hangingReferences"),
  formatBtn: document.querySelector("#formatBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  status: document.querySelector("#status"),
  auditList: document.querySelector("#auditList"),
  score: document.querySelector("#score"),
  preview: document.querySelector("#preview"),
  downloadDocxBtn: document.querySelector("#downloadDocxBtn"),
  downloadHtmlBtn: document.querySelector("#downloadHtmlBtn"),
};

let selectedFiles = [];
let pdfjsPromise;

const fontSettings = {
  "Times New Roman": { cssSize: "12pt", halfPoints: 24 },
  Arial: { cssSize: "11pt", halfPoints: 22 },
  Calibri: { cssSize: "11pt", halfPoints: 22 },
  Georgia: { cssSize: "11pt", halfPoints: 22 },
};

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
  selectedFiles = Array.from(fileList || []);
  updateFileList();
  setStatus(selectedFiles.length ? `${selectedFiles.length} archivo(s) listo(s) para procesar.` : "");
}

els.files.addEventListener("change", (event) => setFiles(event.target.files));

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

els.fontFamily.addEventListener("change", applyPreviewStyles);
els.firstLineIndent.addEventListener("change", applyPreviewStyles);
els.hangingReferences.addEventListener("change", applyPreviewStyles);

els.formatBtn.addEventListener("click", formatSelectedFiles);
els.clearBtn.addEventListener("click", clearAll);
els.downloadHtmlBtn.addEventListener("click", downloadHtml);
els.downloadDocxBtn.addEventListener("click", downloadDocx);

async function waitForGlobal(name, timeoutMs = 10000) {
  const started = Date.now();
  while (!window[name]) {
    if (Date.now() - started > timeoutMs) throw new Error(`No se pudo cargar la biblioteca ${name}.`);
    await new Promise((resolve) => setTimeout(resolve, 50));
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
      const keep = name === "href" || name === "src" || name === "alt" || name === "title";
      if (!keep || name.startsWith("on")) element.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) element.removeAttribute(attr.name);
    }

    if (element.tagName === "A") {
      element.setAttribute("rel", "noopener noreferrer");
    }
  }
  return root.innerHTML;
}

async function readDocx(file) {
  const mammoth = await waitForGlobal("mammoth");
  const arrayBuffer = await file.arrayBuffer();
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
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
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

  return textToHtml(pages.join("\n\n"));
}

async function readFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "docx") return readDocx(file);
  if (extension === "pdf") return readPdf(file);
  if (["html", "htm"].includes(extension)) return sanitizeHtml(await file.text());
  if (["txt", "md"].includes(extension)) return textToHtml(await file.text());
  throw new Error(`Formato no compatible: ${file.name}`);
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
    ["H1", "level-1"],
    ["H2", "level-2"],
    ["H3", "level-3"],
    ["H4", "level-3"],
    ["H5", "level-3"],
    ["H6", "level-3"],
  ]);

  for (const heading of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    heading.classList.add("apa-heading", headingMap.get(heading.tagName) || "level-2");
  }
}

function normalizeReferences(root) {
  const blocks = [...root.children];
  const referenceHeadingRegex = /^(referencias(?: bibliogr[aá]ficas)?|references|lista de referencias)$/i;
  let inReferences = false;

  for (const block of blocks) {
    const text = block.textContent.trim();
    if (!text) continue;

    if (referenceHeadingRegex.test(text)) {
      block.classList.add("apa-heading", "level-1", "apa-references-heading");
      block.classList.remove("apa-reference");
      inReferences = true;
      continue;
    }

    if (inReferences && /^H[1-6]$/.test(block.tagName)) {
      inReferences = false;
    }

    if (inReferences && ["P", "LI", "DIV"].includes(block.tagName)) {
      block.classList.add("apa-reference");
    }
  }
}

function normalizeFigures(root) {
  for (const p of root.querySelectorAll("p")) {
    const text = p.textContent.trim();
    if (/^figura\s+\d+[a-z]?\.?$/i.test(text) || /^figure\s+\d+[a-z]?\.?$/i.test(text)) {
      p.classList.add("apa-figure-label");
    }
    if (/^nota\.?\s/i.test(text) || /^note\.?\s/i.test(text)) {
      p.classList.add("apa-note");
    }
  }

  for (const img of root.querySelectorAll("img")) {
    if (!img.alt) img.dataset.missingAlt = "true";
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
      anchor.href = match[0].replace(/[.,;)]+$/, "");
      anchor.textContent = match[0];
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      fragment.append(anchor);
      lastIndex = index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(fragment);
  }
}

function applyPreviewStyles() {
  const font = els.fontFamily.value;
  els.preview.style.fontFamily = `"${font}", serif`;
  els.preview.style.fontSize = fontSettings[font].cssSize;

  for (const p of els.preview.querySelectorAll("p")) {
    const exempt = p.matches(".apa-reference,.apa-title,.apa-heading,.apa-figure-label,.apa-figure-title,.apa-note,.no-indent");
    p.style.textIndent = !exempt && els.firstLineIndent.checked ? ".5in" : "0";
  }
  for (const ref of els.preview.querySelectorAll(".apa-reference")) {
    if (els.hangingReferences.checked) {
      ref.style.paddingLeft = ".5in";
      ref.style.textIndent = "-.5in";
    } else {
      ref.style.paddingLeft = "0";
      ref.style.textIndent = "0";
    }
  }
}

function applyApaRules(root) {
  replaceDivsWithParagraphs(root);
  normalizeHeadingLevels(root);
  normalizeReferences(root);
  normalizeFigures(root);
  autoLinkUrls(root);
}

function auditDocument(root) {
  const findings = [];
  let points = 45;

  findings.push({ level: "ok", text: "Márgenes de 1 pulgada configurados para la exportación." });
  findings.push({ level: "ok", text: "Interlineado doble configurado para el documento." });
  findings.push({ level: "ok", text: `Fuente APA compatible seleccionada: ${els.fontFamily.value}.` });

  const refs = [...root.querySelectorAll(".apa-reference")];
  const refsHeading = root.querySelector(".apa-references-heading");
  if (refsHeading) {
    points += 10;
    findings.push({ level: "ok", text: "Se identificó una sección de Referencias." });
  } else {
    findings.push({ level: "warn", text: "No se identificó una sección titulada Referencias/References. Verifique si el módulo la requiere." });
  }

  if (refs.length) {
    points += 15;
    findings.push({ level: "ok", text: `${refs.length} entrada(s) de referencia detectada(s) con formato de sangría francesa.` });

    const missingYear = refs.filter((ref) => !/\((?:19|20)\d{2}[a-z]?\)|\bn\.d\.\b|\bs\.f\.\b/i.test(ref.textContent));
    if (missingYear.length) {
      findings.push({ level: "warn", text: `${missingYear.length} referencia(s) no muestran un año, “n.d.” o “s.f.” fácilmente detectable.` });
    } else {
      points += 10;
      findings.push({ level: "ok", text: "Las referencias detectadas muestran año o indicador de fecha no disponible." });
    }
  }

  const missingAlt = root.querySelectorAll("img[data-missing-alt='true']").length;
  if (missingAlt) {
    findings.push({ level: "error", text: `${missingAlt} imagen(es) no tienen texto alternativo detectable. Deben revisarse por accesibilidad.` });
  } else if (root.querySelector("img")) {
    points += 10;
    findings.push({ level: "ok", text: "Las imágenes importadas conservan texto alternativo detectable." });
  } else {
    points += 5;
    findings.push({ level: "ok", text: "No se detectaron imágenes que requieran revisión de texto alternativo." });
  }

  const citationPattern = /\([A-ZÁÉÍÓÚÑ][^()]{0,70},\s*(?:19|20)\d{2}[a-z]?\)/g;
  const citationCount = (root.innerText.match(citationPattern) || []).length;
  if (citationCount) {
    points += 5;
    findings.push({ level: "ok", text: `${citationCount} cita(s) parentética(s) con patrón autor-año detectada(s).` });
  } else {
    findings.push({ level: "warn", text: "No se detectaron citas parentéticas autor-año. Revise manualmente las citas narrativas y las fuentes del contenido." });
  }

  const score = Math.max(0, Math.min(100, points));
  return { score, findings };
}

function renderAudit(result) {
  els.score.textContent = `${result.score}%`;
  els.auditList.replaceChildren();
  for (const item of result.findings) {
    const li = document.createElement("li");
    li.className = item.level;
    li.textContent = item.text;
    els.auditList.append(li);
  }
}

async function formatSelectedFiles() {
  if (!selectedFiles.length) {
    setStatus("Seleccione por lo menos un archivo.", "error");
    els.files.focus();
    return;
  }

  els.formatBtn.disabled = true;
  setStatus("Procesando documentos…");

  try {
    const wrapper = document.createElement("div");

    for (let i = 0; i < selectedFiles.length; i += 1) {
      const file = selectedFiles[i];
      setStatus(`Procesando ${i + 1} de ${selectedFiles.length}: ${file.name}`);
      const html = await readFile(file);
      const section = document.createElement("section");
      section.dataset.sourceFile = file.name;
      section.innerHTML = html;
      applyApaRules(section);
      wrapper.append(...section.childNodes);

      if (i < selectedFiles.length - 1) {
        const separator = document.createElement("hr");
        separator.className = "document-separator";
        separator.setAttribute("aria-hidden", "true");
        wrapper.append(separator);
      }
    }

    els.preview.replaceChildren(...wrapper.childNodes);
    applyPreviewStyles();
    renderAudit(auditDocument(els.preview));
    els.downloadDocxBtn.disabled = false;
    els.downloadHtmlBtn.disabled = false;
    setStatus("Formato aplicado. Revise la vista previa y las observaciones antes de descargar.", "success");
    els.preview.focus();
  } catch (error) {
    console.error(error);
    setStatus(error?.message || "Ocurrió un error al procesar los documentos.", "error");
  } finally {
    els.formatBtn.disabled = false;
  }
}

function clearAll() {
  selectedFiles = [];
  els.files.value = "";
  updateFileList();
  els.preview.innerHTML = '<p class="placeholder">El contenido formateado aparecerá aquí.</p>';
  els.auditList.innerHTML = "<li>Cargue uno o más archivos para comenzar.</li>";
  els.score.textContent = "—";
  els.downloadDocxBtn.disabled = true;
  els.downloadHtmlBtn.disabled = true;
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

function downloadHtml() {
  const clone = cleanExportClone();
  const font = els.fontFamily.value;
  const fontSize = fontSettings[font].cssSize;
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Documento formateado APA 7</title>
<style>
@page { size: letter; margin: 1in; }
body { margin: 0; font-family: "${font}", serif; font-size: ${fontSize}; line-height: 2; color: #000; }
p { margin: 0; ${els.firstLineIndent.checked ? "text-indent: .5in;" : "text-indent: 0;"} }
h1,h2,h3,h4,h5,h6 { font: inherit; margin: 1em 0 0; }
.level-1 { text-align: center; font-weight: 700; }
.level-2 { text-align: left; font-weight: 700; }
.level-3 { text-align: left; font-weight: 700; font-style: italic; }
.apa-reference { ${els.hangingReferences.checked ? "padding-left: .5in; text-indent: -.5in;" : "padding-left: 0; text-indent: 0;"} }
.apa-heading,.apa-figure-label,.apa-note { text-indent: 0; }
.apa-figure-label { font-weight: 700; }
a { color: inherit; }
</style>
</head>
<body>${clone.innerHTML}</body>
</html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), "modulo-APA7.html");
}

function domBlockToDocxParagraph(element, api, font, size) {
  const { Paragraph, TextRun, AlignmentType } = api;
  const text = element.textContent.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const isRef = element.classList.contains("apa-reference");
  const isLevel1 = element.classList.contains("level-1") || element.tagName === "H1";
  const isLevel2 = element.classList.contains("level-2") || element.tagName === "H2";
  const isLevel3 = element.classList.contains("level-3") || ["H3", "H4", "H5", "H6"].includes(element.tagName);
  const isHeading = isLevel1 || isLevel2 || isLevel3;
  const isFigureLabel = element.classList.contains("apa-figure-label");
  const noIndent = isRef || isHeading || isFigureLabel || element.classList.contains("apa-note") || element.classList.contains("no-indent");

  const run = new TextRun({
    text,
    font,
    size,
    bold: isHeading || isFigureLabel || element.querySelector("strong,b") !== null,
    italics: isLevel3 || element.classList.contains("apa-figure-title") || element.querySelector("em,i") !== null,
  });

  const options = {
    children: [run],
    spacing: { line: 480, after: 0, before: 0 },
    alignment: isLevel1 ? AlignmentType.CENTER : AlignmentType.LEFT,
  };

  if (isRef && els.hangingReferences.checked) options.indent = { left: 720, hanging: 720 };
  else if (!noIndent && els.firstLineIndent.checked) options.indent = { firstLine: 720 };

  return new Paragraph(options);
}

async function downloadDocx() {
  try {
    const api = await waitForGlobal("docx");
    const { Document, Packer, Paragraph, TextRun } = api;
    const font = els.fontFamily.value;
    const size = fontSettings[font].halfPoints;
    const clone = cleanExportClone();
    const children = [];

    for (const element of [...clone.children]) {
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
        const rows = [...element.querySelectorAll("tr")].map((row) => [...row.cells].map((cell) => cell.textContent.trim()).join(" | "));
        for (const row of rows) {
          children.push(new Paragraph({ children: [new TextRun({ text: row, font, size })], spacing: { line: 480, after: 0 } }));
        }
        continue;
      }

      const paragraph = domBlockToDocxParagraph(element, api, font, size);
      if (paragraph) children.push(paragraph);
    }

    const doc = new Document({
      numbering: {
        config: [{
          reference: "apa-numbering",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }],
        }],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, "modulo-APA7.docx");
    setStatus("Documento DOCX generado correctamente.", "success");
  } catch (error) {
    console.error(error);
    setStatus(`No se pudo generar el DOCX: ${error?.message || error}`, "error");
  }
}
