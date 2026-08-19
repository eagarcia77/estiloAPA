const PDF_SMART_VERSION = "2.2";
const PDFJS_VERSION = "6.1.200";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

let pdfJsPromise;
let processingPdf = false;

const referenceHeadingRegex = /^(referencias(?: bibliogr[aá]ficas)?|references|lista de referencias)$/i;
const sectionHeadingRegex = /^(introducci[oó]n|objetivos?|palabras\s+claves?|contenido|conclusi[oó]n|resumen|abstract|discusi[oó]n|resultados?|metodolog[ií]a|actividades?|asignaciones?|foros?|evaluaci[oó]n|m[oó]dulo\s+\d+.*)$/i;
const referenceStartRegex = /^[A-ZÁÉÍÓÚÑÜ][^()]{0,110}\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)/i;
const listRegex = /^\s*(?:[•▪◦‣·]|[-–—]|\d+[.)]|[A-Za-z][.)])\s+/;

function setPdfStatus(message, type = "") {
  const status = document.querySelector("#status");
  if (!status) return;
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const middle = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[middle] : (nums[middle - 1] + nums[middle]) / 2;
}

function normalizeLineKey(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(PDFJS_URL).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

function fontSizeFromTransform(transform, fallback = 0) {
  if (!Array.isArray(transform) || transform.length < 4) return fallback || 0;
  const sx = Math.hypot(transform[0], transform[1]);
  const sy = Math.hypot(transform[2], transform[3]);
  return Math.max(sx, sy, fallback || 0);
}

function joinLineItems(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = "";
  let previous = null;
  for (const item of sorted) {
    const part = String(item.text || "").replace(/\s+/g, " ").trim();
    if (!part) continue;
    if (!previous) {
      text = part;
      previous = item;
      continue;
    }
    const previousRight = previous.x + Math.max(previous.width || 0, previous.text.length * previous.fontSize * 0.35);
    const gap = item.x - previousRight;
    const needsSpace = gap > Math.max(1.25, Math.min(previous.fontSize, item.fontSize) * 0.12)
      && !/[-/([{]$/.test(text)
      && !/^[,.;:!?%)\]}]/.test(part);
    text += `${needsSpace ? " " : ""}${part}`;
    previous = item;
  }
  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function groupItemsIntoLines(items) {
  const usable = items
    .filter((item) => item.text.trim())
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  for (const item of usable) {
    const tolerance = Math.max(2.2, item.fontSize * 0.24);
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
    line.y = line.items.reduce((sum, current) => sum + current.y, 0) / line.items.length;
  }
  return lines
    .map((line) => {
      const sorted = line.items.sort((a, b) => a.x - b.x);
      const weightedSizes = [];
      for (const item of sorted) {
        const weight = Math.max(1, Math.min(20, item.text.trim().length));
        for (let i = 0; i < weight; i += 1) weightedSizes.push(item.fontSize);
      }
      return {
        text: joinLineItems(sorted),
        y: line.y,
        x: sorted[0]?.x ?? 0,
        right: Math.max(...sorted.map((item) => item.x + (item.width || 0))),
        fontSize: median(weightedSizes) || sorted[0]?.fontSize || 0,
        bold: sorted.some((item) => /bold|black|heavy|semibold/i.test(item.fontName)),
        italic: sorted.some((item) => /italic|oblique/i.test(item.fontName)),
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => b.y - a.y);
}

async function extractPdfPages(file) {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setPdfStatus(`Reconstruyendo PDF: página ${pageNumber} de ${pdf.numPages}…`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = [];
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str?.trim()) continue;
      const transform = raw.transform || [];
      items.push({
        text: raw.str,
        x: Number(transform[4] || 0),
        y: Number(transform[5] || 0),
        width: Number(raw.width || 0),
        height: Number(raw.height || 0),
        fontSize: fontSizeFromTransform(transform, Number(raw.height || 0)),
        fontName: raw.fontName || "",
      });
    }
    pages.push({ pageNumber, width: viewport.width, height: viewport.height, lines: groupItemsIntoLines(items) });
  }
  return pages;
}

function removeRepeatedHeadersAndFooters(pages) {
  const occurrences = new Map();
  for (const page of pages) {
    for (const line of page.lines) {
      const nearTop = line.y >= page.height * 0.88;
      const nearBottom = line.y <= page.height * 0.11;
      if (!nearTop && !nearBottom) continue;
      const key = normalizeLineKey(line.text);
      if (!key || key.length > 140) continue;
      if (!occurrences.has(key)) occurrences.set(key, new Set());
      occurrences.get(key).add(page.pageNumber);
    }
  }
  const repeated = new Set(
    [...occurrences.entries()]
      .filter(([, pageNumbers]) => pageNumbers.size >= Math.min(2, pages.length))
      .map(([key]) => key)
  );
  for (const page of pages) {
    page.lines = page.lines.filter((line) => {
      const key = normalizeLineKey(line.text);
      const nearTop = line.y >= page.height * 0.88;
      const nearBottom = line.y <= page.height * 0.11;
      const pageNumberOnly = nearBottom && /^\s*(?:p[aá]g(?:ina)?\.?\s*)?\d+\s*$/i.test(line.text);
      return !pageNumberOnly && !(repeated.has(key) && (nearTop || nearBottom));
    });
  }
}

function detectBodyFontSize(pages) {
  const samples = [];
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.text.length < 18) continue;
      if (referenceHeadingRegex.test(line.text) || sectionHeadingRegex.test(line.text)) continue;
      const weight = Math.max(1, Math.min(10, Math.round(line.text.length / 20)));
      for (let i = 0; i < weight; i += 1) samples.push(line.fontSize);
    }
  }
  return median(samples) || 12;
}

function typicalLineGap(lines) {
  const gaps = [];
  for (let index = 1; index < lines.length; index += 1) {
    const gap = lines[index - 1].y - lines[index].y;
    if (gap > 0 && gap < 60) gaps.push(gap);
  }
  return median(gaps) || 14;
}

function classifyHeading(line, bodyFontSize) {
  const text = line.text.trim();
  if (!text || text.length > 170) return 0;
  if (referenceHeadingRegex.test(text)) return 1;
  if (sectionHeadingRegex.test(text)) return 2;
  if (line.fontSize >= bodyFontSize * 1.35) return 1;
  if (line.fontSize >= bodyFontSize * 1.16) return 2;
  if (line.bold && line.fontSize >= bodyFontSize * 0.98 && text.length <= 110 && !/[.!?]$/.test(text)) return 2;
  if ((line.bold || line.italic) && text.length <= 90 && !/[.!?]$/.test(text)) return 3;
  return 0;
}

function shouldJoinLines(previous, next, context) {
  if (!previous || !next) return false;
  if (classifyHeading(next, context.bodyFontSize)) return false;
  if (listRegex.test(next.text)) return false;
  const gap = previous.y - next.y;
  if (gap <= 0 || gap > context.typicalGap * 1.55) return false;
  const indentation = next.x - context.baseLeft;
  if (indentation > Math.max(12, context.bodyFontSize * 1.1)) return false;
  if (/[.!?][”"')\]]?$/.test(previous.text) && gap > context.typicalGap * 1.15) return false;
  if (Math.abs(next.fontSize - previous.fontSize) > Math.max(1.4, context.bodyFontSize * 0.12)) return false;
  return true;
}

function joinWrappedText(left, right) {
  const first = String(left || "").trimEnd();
  const second = String(right || "").trimStart();
  if (/\p{L}-$/u.test(first) && /^\p{Ll}/u.test(second)) return `${first.slice(0, -1)}${second}`;
  return `${first} ${second}`.replace(/\s+/g, " ").trim();
}

function pageToBlocks(page, bodyFontSize, inReferencesAtStart = false) {
  const lines = page.lines;
  if (!lines.length) return { blocks: [], inReferences: inReferencesAtStart };
  const gap = typicalLineGap(lines);
  const leftCandidates = lines
    .filter((line) => classifyHeading(line, bodyFontSize) === 0 && !listRegex.test(line.text))
    .map((line) => line.x);
  const baseLeft = median(leftCandidates) || Math.min(...lines.map((line) => line.x));
  const context = { bodyFontSize, typicalGap: gap, baseLeft };
  const blocks = [];
  let inReferences = inReferencesAtStart;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const headingLevel = classifyHeading(line, bodyFontSize);
    if (headingLevel) {
      blocks.push({ type: `h${headingLevel}`, text: line.text.trim() });
      inReferences = referenceHeadingRegex.test(line.text.trim());
      index += 1;
      continue;
    }
    if (inReferences) {
      let text = line.text.trim();
      let cursor = index + 1;
      while (cursor < lines.length) {
        const candidate = lines[cursor];
        if (classifyHeading(candidate, bodyFontSize)) break;
        if (referenceStartRegex.test(candidate.text) && referenceStartRegex.test(text)) break;
        const candidateGap = lines[cursor - 1].y - candidate.y;
        if (candidateGap > gap * 1.8) break;
        text = joinWrappedText(text, candidate.text);
        cursor += 1;
      }
      blocks.push({ type: "reference", text });
      index = cursor;
      continue;
    }
    if (listRegex.test(line.text)) {
      const ordered = /^\s*(?:\d+[.)]|[A-Za-z][.)])\s+/.test(line.text);
      blocks.push({ type: ordered ? "ol-item" : "ul-item", text: line.text.replace(listRegex, "").trim() });
      index += 1;
      continue;
    }
    let text = line.text.trim();
    let cursor = index + 1;
    while (cursor < lines.length && shouldJoinLines(lines[cursor - 1], lines[cursor], context)) {
      text = joinWrappedText(text, lines[cursor].text);
      cursor += 1;
    }
    blocks.push({ type: "p", text });
    index = cursor;
  }
  return { blocks, inReferences };
}

function blocksToHtml(blocks, sortReferences) {
  const output = [];
  let referenceBuffer = [];
  let listType = null;
  let listItems = [];
  const flushReferences = () => {
    if (!referenceBuffer.length) return;
    if (sortReferences) referenceBuffer.sort((a, b) => a.text.localeCompare(b.text, "es", { sensitivity: "base" }));
    for (const block of referenceBuffer) output.push(`<p class="apa-reference">${escapeHtml(block.text)}</p>`);
    referenceBuffer = [];
  };
  const flushList = () => {
    if (!listItems.length || !listType) return;
    output.push(`<${listType}>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${listType}>`);
    listItems = [];
    listType = null;
  };
  for (const block of blocks) {
    if (block.type === "reference") {
      flushList();
      referenceBuffer.push(block);
      continue;
    }
    flushReferences();
    if (block.type === "ul-item" || block.type === "ol-item") {
      const desired = block.type === "ol-item" ? "ol" : "ul";
      if (listType && listType !== desired) flushList();
      listType = desired;
      listItems.push(block.text);
      continue;
    }
    flushList();
    if (/^h[123]$/.test(block.type)) {
      const level = block.type.slice(1);
      const extra = referenceHeadingRegex.test(block.text) ? ' class="apa-references-heading apa-heading level-1"' : "";
      output.push(`<h${level}${extra}>${escapeHtml(block.text)}</h${level}>`);
    } else {
      output.push(`<p>${escapeHtml(block.text)}</p>`);
    }
  }
  flushReferences();
  flushList();
  return output.join("\n");
}

function applyPreviewPresentation(preview) {
  const fontSelect = document.querySelector("#fontFamily");
  const firstLineIndent = document.querySelector("#firstLineIndent")?.checked !== false;
  const hangingReferences = document.querySelector("#hangingReferences")?.checked !== false;
  const font = fontSelect?.value || "Times New Roman";
  const sizes = { "Times New Roman": "12pt", Arial: "11pt", Calibri: "11pt", Georgia: "11pt" };
  preview.style.fontFamily = `"${font}", serif`;
  preview.style.fontSize = sizes[font] || "12pt";
  preview.querySelectorAll("p").forEach((paragraph) => {
    const exempt = paragraph.matches(".apa-reference,.apa-title,.apa-heading,.apa-figure-label,.apa-figure-title,.apa-note,.no-indent");
    paragraph.style.textIndent = !exempt && firstLineIndent ? ".5in" : "0";
  });
  preview.querySelectorAll(".apa-reference").forEach((reference) => {
    reference.style.paddingLeft = hangingReferences ? ".5in" : "0";
    reference.style.textIndent = hangingReferences ? "-.5in" : "0";
  });
}

async function smartFormatPdfFiles(files) {
  const preview = document.querySelector("#preview");
  const formatBtn = document.querySelector("#formatBtn");
  if (!preview || processingPdf) return;
  processingPdf = true;
  if (formatBtn) formatBtn.disabled = true;
  setPdfStatus(`APA7 PDF Smart v${PDF_SMART_VERSION}: analizando estructura del PDF…`);
  try {
    const allHtml = [];
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      setPdfStatus(`PDF ${fileIndex + 1} de ${files.length}: extrayendo texto y estructura…`);
      const pages = await extractPdfPages(file);
      removeRepeatedHeadersAndFooters(pages);
      const totalCharacters = pages.reduce((sum, page) => sum + page.lines.reduce((inner, line) => inner + line.text.length, 0), 0);
      if (totalCharacters < 80) {
        throw new Error(`${file.name} parece ser un PDF escaneado o sin una capa de texto suficiente. Para este archivo use el DOCX original o aplique OCR antes de subirlo.`);
      }
      const bodyFontSize = detectBodyFontSize(pages);
      const blocks = [];
      let inReferences = false;
      for (const page of pages) {
        const parsed = pageToBlocks(page, bodyFontSize, inReferences);
        blocks.push(...parsed.blocks);
        inReferences = parsed.inReferences;
      }
      if (fileIndex > 0) allHtml.push('<hr class="document-separator" aria-hidden="true">');
      allHtml.push(`<section data-source-file="${escapeHtml(file.name)}">${blocksToHtml(blocks, document.querySelector("#sortReferences")?.checked !== false)}</section>`);
    }
    preview.innerHTML = allHtml.join("\n");
    applyPreviewPresentation(preview);
    for (const id of ["downloadDocxBtn", "downloadHtmlBtn", "downloadAuditBtn", "reauditBtn"]) {
      const button = document.querySelector(`#${id}`);
      if (button) button.disabled = false;
    }
    preview.dispatchEvent(new Event("input", { bubbles: true }));
    const reaudit = document.querySelector("#reauditBtn");
    setTimeout(() => reaudit?.click(), 50);
    setPdfStatus(`PDF reconstruido con modo inteligente v${PDF_SMART_VERSION}. Revise especialmente tablas, figuras y PDFs con diseños complejos.`, "success");
    preview.focus();
  } catch (error) {
    console.error("APA7 PDF Smart", error);
    setPdfStatus(error?.message || "No se pudo reconstruir el PDF.", "error");
  } finally {
    processingPdf = false;
    if (formatBtn) formatBtn.disabled = false;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#formatBtn");
  if (!button) return;
  const input = document.querySelector("#files");
  const files = [...(input?.files || [])];
  if (!files.length) return;
  const allPdf = files.every((file) => file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf");
  if (!allPdf) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void smartFormatPdfFiles(files);
}, true);
