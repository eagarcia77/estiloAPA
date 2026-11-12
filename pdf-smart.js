const PDF_SMART_VERSION = "2.3";
// PDF.js 6 uses Map.getOrInsertComputed, unavailable in Safari 18 on iPadOS.
// Keep the core and worker pinned to the same Safari-compatible release.
const PDFJS_VERSION = "4.10.38";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

let pdfJsPromise;
let processingPdf = false;

const referenceHeadingRegex = /^(referencias(?: bibliogr[aá]ficas)?|references|lista de referencias)$/i;
const figureLabelRegex = /^(figura|figure)\s+\d+[a-z]?\.?$/i;
const noteRegex = /^(nota|note)\.\s*/i;
const topicHeadingRegex = /^tema\s+\d+\.\s*/i;
const level1HeadingRegex = /^(introducci[oó]n|objetivos?\s+del\s+m[oó]dulo|palabras\s+claves?|lecturas?\s+y\s+recursos?\s+requeridos|contenido\s+del\s+m[oó]dulo|integraci[oó]n\s+de\s+conceptos|conclusi[oó]n|referencias(?:\s+bibliogr[aá]ficas)?|references)$/i;
const referenceStartRegex = /^[A-ZÁÉÍÓÚÑÜ][^()]{0,150}\(((?:19|20)\d{2}[a-z]?|n\.d\.|s\.f\.)\)/i;
const bulletMarkerRegex = /^\s*(?:[•▪◦‣·]|[-–—])\s*/;
const orderedMarkerRegex = /^\s*\d{1,2}[.)]\s*/;

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
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
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

function itemRight(item) {
  return item.x + Math.max(item.width || 0, String(item.text || "").length * item.fontSize * 0.32);
}

function needsSpaceBetween(previous, current, currentText) {
  if (!previous) return false;
  if (/^\d{1,2}[.)]$/.test(String(previous.text).trim())) return true;
  const gap = current.x - itemRight(previous);
  return gap > Math.max(1.25, Math.min(previous.fontSize, current.fontSize) * 0.12)
    && !/[-/([{]$/.test(String(previous.text).trim())
    && !/^[,.;:!?%)\]}]/.test(currentText);
}

function styleItemHtml(item, text) {
  let html = escapeHtml(text);
  if (item.italic) html = `<em>${html}</em>`;
  if (item.bold) html = `<strong>${html}</strong>`;
  return html;
}

function joinLineItems(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = "";
  let html = "";
  let previous = null;

  for (const item of sorted) {
    const part = String(item.text || "").replace(/\s+/g, " ").trim();
    if (!part) continue;
    const addSpace = previous ? needsSpaceBetween(previous, item, part) : false;
    text += `${addSpace ? " " : ""}${part}`;
    html += `${addSpace ? " " : ""}${styleItemHtml(item, part)}`;
    previous = item;
  }

  text = text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return { text, html: html.trim() };
}

function groupItemsIntoLines(items) {
  const usable = items
    .filter((item) => String(item.text || "").trim())
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

  return lines.map((line) => {
    const sorted = line.items.sort((a, b) => a.x - b.x);
    const joined = joinLineItems(sorted);
    const weightedSizes = [];
    for (const item of sorted) {
      const weight = Math.max(1, Math.min(20, String(item.text || "").trim().length));
      for (let i = 0; i < weight; i += 1) weightedSizes.push(item.fontSize);
    }
    return {
      text: joined.text,
      html: joined.html,
      y: line.y,
      x: sorted[0]?.x ?? 0,
      right: Math.max(...sorted.map(itemRight)),
      fontSize: median(weightedSizes) || sorted[0]?.fontSize || 0,
      bold: sorted.some((item) => item.bold),
      italic: sorted.some((item) => item.italic),
      items: sorted,
    };
  }).filter((line) => line.text).sort((a, b) => b.y - a.y);
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
      const style = content.styles?.[raw.fontName] || {};
      const styleName = `${raw.fontName || ""} ${style.fontFamily || ""}`;
      items.push({
        text: raw.str,
        x: Number(transform[4] || 0),
        y: Number(transform[5] || 0),
        width: Number(raw.width || 0),
        height: Number(raw.height || 0),
        fontSize: fontSizeFromTransform(transform, Number(raw.height || 0)),
        fontName: styleName,
        bold: /bold|black|heavy|semibold|demi/i.test(styleName),
        italic: /italic|oblique/i.test(styleName),
      });
    }

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      lines: groupItemsIntoLines(items),
      proxy: page,
      figureImages: new Map(),
    });
  }
  return pages;
}

function removeRepeatedHeadersAndFooters(pages) {
  const occurrences = new Map();
  for (const page of pages) {
    for (const line of page.lines) {
      const nearTop = line.y >= page.height * 0.90;
      const nearBottom = line.y <= page.height * 0.08;
      if (!nearTop && !nearBottom) continue;
      const key = normalizeLineKey(line.text);
      if (!key || key.length > 140) continue;
      if (!occurrences.has(key)) occurrences.set(key, new Set());
      occurrences.get(key).add(page.pageNumber);
    }
  }

  const repeated = new Set(
    [...occurrences.entries()]
      .filter(([, pageNumbers]) => pageNumbers.size >= Math.max(2, Math.ceil(pages.length * 0.35)))
      .map(([key]) => key)
  );

  for (const page of pages) {
    page.lines = page.lines.filter((line) => {
      const key = normalizeLineKey(line.text);
      const nearTop = line.y >= page.height * 0.90;
      const nearBottom = line.y <= page.height * 0.08;
      const pageNumberOnly = nearBottom && /^\s*(?:p[aá]g(?:ina)?\.?\s*)?\d+\s*$/i.test(line.text);
      return !pageNumberOnly && !(repeated.has(key) && (nearTop || nearBottom));
    });
  }
}

function detectBodyFontSize(pages) {
  const samples = [];
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.text.length < 24) continue;
      if (figureLabelRegex.test(line.text) || noteRegex.test(line.text) || referenceHeadingRegex.test(line.text)) continue;
      const weight = Math.max(1, Math.min(12, Math.round(line.text.length / 25)));
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
  if (!text || text.length > 190) return 0;
  if (figureLabelRegex.test(text) || noteRegex.test(text)) return 0;
  if (referenceHeadingRegex.test(text) || level1HeadingRegex.test(text)) return 1;
  if (topicHeadingRegex.test(text)) return 2;
  if (line.fontSize >= bodyFontSize * 1.75) return 1;
  if (line.fontSize >= bodyFontSize * 1.35) return 2;
  if (line.bold && line.fontSize >= bodyFontSize * 0.98 && text.length <= 115 && !/[.!?]$/.test(text)) return 3;
  return 0;
}

function isListLine(line, baseLeft) {
  const text = line.text.trim();
  if (bulletMarkerRegex.test(text)) return "ul-item";
  if (orderedMarkerRegex.test(text) && line.x >= baseLeft + 8) return "ol-item";
  return "";
}

function stripListMarker(text) {
  return String(text).replace(bulletMarkerRegex, "").replace(orderedMarkerRegex, "").trim();
}

function shouldJoinLines(previous, next, context) {
  if (!previous || !next) return false;
  if (classifyHeading(next, context.bodyFontSize)) return false;
  if (figureLabelRegex.test(next.text) || noteRegex.test(next.text)) return false;
  if (isListLine(next, context.baseLeft)) return false;
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

function joinWrappedHtml(leftHtml, rightHtml) {
  return `${String(leftHtml || "").trim()} ${String(rightHtml || "").trim()}`.replace(/\s+/g, " ").trim();
}

function screenTopForLine(page, line) {
  return Math.max(0, page.height - line.y - line.fontSize * 1.05);
}

function screenBottomForLine(page, line) {
  return Math.min(page.height, page.height - line.y + line.fontSize * 0.45);
}

async function renderCrop(pageData, top, bottom) {
  const safeTop = Math.max(0, Math.min(pageData.height, top));
  const safeBottom = Math.max(safeTop + 1, Math.min(pageData.height, bottom));
  if (safeBottom - safeTop < 80) return "";

  const scale = 1.35;
  const viewport = pageData.proxy.getViewport({ scale });
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = Math.ceil(viewport.width);
  fullCanvas.height = Math.ceil(viewport.height);
  const context = fullCanvas.getContext("2d", { alpha: false });
  await pageData.proxy.render({ canvasContext: context, viewport }).promise;

  const cropCanvas = document.createElement("canvas");
  const sourceY = Math.floor(safeTop * scale);
  const sourceHeight = Math.floor((safeBottom - safeTop) * scale);
  cropCanvas.width = fullCanvas.width;
  cropCanvas.height = sourceHeight;
  const cropContext = cropCanvas.getContext("2d", { alpha: false });
  cropContext.drawImage(fullCanvas, 0, sourceY, fullCanvas.width, sourceHeight, 0, 0, cropCanvas.width, cropCanvas.height);
  return cropCanvas.toDataURL("image/jpeg", 0.90);
}

async function prepareFigureImages(pages, bodyFontSize) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    for (let index = 0; index < page.lines.length; index += 1) {
      const label = page.lines[index];
      if (!figureLabelRegex.test(label.text.trim())) continue;
      const title = page.lines[index + 1];
      if (!title || title.text.length > 180) continue;

      const start = screenBottomForLine(page, title) + 6;
      let noteIndex = -1;
      for (let cursor = index + 2; cursor < page.lines.length; cursor += 1) {
        if (noteRegex.test(page.lines[cursor].text.trim())) {
          noteIndex = cursor;
          break;
        }
        if (classifyHeading(page.lines[cursor], bodyFontSize) && cursor > index + 2) break;
      }

      let dataUrl = "";
      if (noteIndex >= 0) {
        const end = screenTopForLine(page, page.lines[noteIndex]) - 8;
        if (end - start >= 100) dataUrl = await renderCrop(page, start, end);
      }

      if (!dataUrl) {
        const remaining = page.height - start - 8;
        if (remaining >= 170) {
          dataUrl = await renderCrop(page, start, page.height - 8);
        } else {
          const nextPage = pages[pageIndex + 1];
          if (nextPage) {
            const nextNote = nextPage.lines.findIndex((line) => noteRegex.test(line.text.trim()));
            const end = nextNote >= 0 ? screenTopForLine(nextPage, nextPage.lines[nextNote]) - 8 : nextPage.height * 0.60;
            if (end >= 120) dataUrl = await renderCrop(nextPage, 8, end);
          }
        }
      }
      if (dataUrl) page.figureImages.set(index, dataUrl);
    }
  }
}

function splitLineIntoCells(line, threshold = 28) {
  const items = [...line.items].sort((a, b) => a.x - b.x);
  const cells = [];
  let current = [];
  let previous = null;
  const flush = () => {
    if (!current.length) return;
    const joined = joinLineItems(current);
    cells.push({ x: current[0].x, text: joined.text, items: current });
    current = [];
  };
  for (const item of items) {
    if (previous && item.x - itemRight(previous) > threshold) flush();
    current.push(item);
    previous = item;
  }
  flush();
  return cells;
}

function uniqueAnchors(values, tolerance = 5) {
  const result = [];
  for (const value of [...values].sort((a, b) => b - a)) {
    if (!result.some((existing) => Math.abs(existing - value) <= tolerance)) result.push(value);
  }
  return result;
}

function nearestIndex(value, anchors) {
  let best = 0;
  let distance = Infinity;
  for (let i = 0; i < anchors.length; i += 1) {
    const d = Math.abs(value - anchors[i]);
    if (d < distance) {
      best = i;
      distance = d;
    }
  }
  return best;
}

function detectTable(lines, startIndex, bodyFontSize) {
  const headerLine = lines[startIndex];
  const headerCells = splitLineIntoCells(headerLine, Math.max(16, bodyFontSize * 1.65));
  if (headerCells.length < 2 || headerCells.length > 8 || headerLine.text.length > 200) return null;
  const starts = headerCells.map(cell => cell.x);
  if (starts.some((x, i) => i && x - starts[i - 1] < Math.max(30, bodyFontSize * 3))) return null;
  const region = [headerLine];
  const rowGap = Math.max(20, bodyFontSize * 2.5);
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (figureLabelRegex.test(line.text) || referenceHeadingRegex.test(line.text)) break;
    if (classifyHeading(line, bodyFontSize)) break;
    if (region[region.length - 1].y - line.y > rowGap * 1.7) break;
    const cells = splitLineIntoCells(line, Math.max(16, bodyFontSize * 1.65));
    const aligned = cells.filter(cell => starts.some(x => Math.abs(cell.x - x) < Math.max(22, bodyFontSize * 2.5)));
    // Stop at ordinary prose rather than swallowing subsequent paragraphs.
    if (cells.length === 1 && aligned.length === 0) break;
    if (cells.length > starts.length + 2) break;
    region.push(line);
    if (region.length >= 80) break;
  }
  if (region.length < 2) return null;
  const rows = region.map(line => {
    const cells = Array.from({ length: starts.length }, () => []);
    for (const cell of splitLineIntoCells(line, Math.max(16, bodyFontSize * 1.65))) {
      cells[nearestIndex(cell.x, starts)].push(cell.text);
    }
    return cells.map(parts => parts.join(" ").trim());
  });
  const populated = rows.filter(row => row.filter(Boolean).length >= 2);
  // Two aligned rows are enough for a small table; avoid false positives.
  if (populated.length < 2 || populated.length / rows.length < 0.6) return null;
  return { block: { type: "table", rows }, nextIndex: startIndex + region.length };
}

// PDF tables frequently have wrapped cells: infer rows from the first column,
// and attach intervening text to the nearest column of the current row.
function detectLabeledTable(lines, labelIndex, bodyFontSize) {
  const label = lines[labelIndex];
  if (!/\bTabla\s+\d+\b/i.test(label.text)) return null;
  const stop = /^(?:Nota\.|Tabla\s+\d+\b|Figura\s+\d+\b|Estudio de caso)/i;
  let end = labelIndex + 1;
  while (end < lines.length && !stop.test(lines[end].text.trim()) &&
         lines[end].y < label.y && label.y - lines[end].y < 530) end += 1;
  const region = lines.slice(labelIndex + 1, end);
  if (region.length < 2) return null;
  const threshold = Math.max(15, bodyFontSize * 1.35);
  // Stable left edges recur on multiple rows; isolated fragments within a
  // wrapped header (e.g. "TCP/IP del texto (5 capas)") must not become columns.
  const starts = region.flatMap(line => line.items.map(item => item.x));
  const clusters = [];
  for (const x of starts.sort((a, b) => a - b)) {
    const cluster = clusters.find(group => Math.abs(group.x - x) <= 7);
    if (cluster) { cluster.count += 1; cluster.x = (cluster.x * (cluster.count - 1) + x) / cluster.count; }
    else clusters.push({x, count: 1});
  }
  const anchors = clusters.filter(group => group.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3).sort((a, b) => a.x - b.x).map(group => group.x);
  if (anchors.length < 2 || anchors.length > 8) return null;
  const tolerance = Math.max(14, bodyFontSize * 1.5);
  const firstX = anchors[0];
  const rows = [];
  for (const line of region) {
    const cells = splitLineIntoCells(line, threshold);
    const firstColumnStarts = cells.some(cell => Math.abs(cell.x - firstX) <= tolerance);
    if (firstColumnStarts || !rows.length) rows.push(Array.from({length: anchors.length}, () => ""));
    const row = rows[rows.length - 1];
    for (const cell of cells) {
      const col = nearestIndex(cell.x, anchors);
      row[col] += (row[col] ? " " : "") + cell.text;
    }
  }
  if (rows.length < 2 || rows.filter(row => row.filter(Boolean).length >= 2).length < 2) return null;
  return {block: {type: "table", rows, pageNumber: label.pageNumber}, nextIndex: end};
}

function pageToBlocks(page, bodyFontSize, inReferencesAtStart = false) {
  const lines = page.lines;
  if (!lines.length) return { blocks: [], inReferences: inReferencesAtStart };
  const gap = typicalLineGap(lines);
  const leftCandidates = lines.filter((line) => classifyHeading(line, bodyFontSize) === 0).map((line) => line.x);
  const baseLeft = median(leftCandidates) || Math.min(...lines.map((line) => line.x));
  const context = { bodyFontSize, typicalGap: gap, baseLeft };
  const blocks = [];
  let inReferences = inReferencesAtStart;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const text = line.text.trim();

    if (/\bTabla\s+\d+\b/i.test(text)) {
      const labeled = detectLabeledTable(lines, index, bodyFontSize);
      if (labeled) {
        blocks.push({type: "table-label", text, pageNumber: page.pageNumber});
        labeled.block.pageNumber = page.pageNumber;
        blocks.push(labeled.block);
        index = labeled.nextIndex;
        continue;
      }
    }

    if (figureLabelRegex.test(text)) {
      const originalIndex = index;
      blocks.push({ type: "figure-label", text, pageNumber: page.pageNumber });
      const title = lines[index + 1];
      if (title && !classifyHeading(title, bodyFontSize) && !noteRegex.test(title.text)) {
        blocks.push({ type: "figure-title", text: title.text.trim(), html: title.html, pageNumber: page.pageNumber });
        index += 1;
      }
      const image = page.figureImages.get(originalIndex);
      if (image) blocks.push({ type: "image", src: image, alt: `${text}: ${title?.text?.trim() || "figura del documento"}`, pageNumber: page.pageNumber });
      index += 1;
      continue;
    }

    if (noteRegex.test(text)) {
      let noteText = text;
      let cursor = index + 1;
      while (cursor < lines.length && shouldJoinLines(lines[cursor - 1], lines[cursor], context)) {
        noteText = joinWrappedText(noteText, lines[cursor].text);
        cursor += 1;
      }
      blocks.push({ type: "figure-note", text: noteText, pageNumber: page.pageNumber });
      index = cursor;
      continue;
    }

    if (!inReferences) {
      const table = detectTable(lines, index, bodyFontSize);
      if (table) {
        table.block.pageNumber = page.pageNumber;
        blocks.push(table.block);
        index = table.nextIndex;
        continue;
      }
    }

    const headingLevel = classifyHeading(line, bodyFontSize);
    if (headingLevel) {
      let headingText = text;
      let headingHtml = line.html;
      let cursor = index + 1;
      if (topicHeadingRegex.test(text) && cursor < lines.length) {
        const next = lines[cursor];
        const nextGap = line.y - next.y;
        const similarFont = Math.abs(next.fontSize - line.fontSize) <= Math.max(1.2, bodyFontSize * 0.15);
        if (similarFont && nextGap <= gap * 2.2 && !/[.!?]$/.test(next.text) && next.text.length <= 100) {
          headingText = joinWrappedText(headingText, next.text);
          headingHtml = joinWrappedHtml(headingHtml, next.html);
          cursor += 1;
        }
      }
      blocks.push({ type: `h${headingLevel}`, text: headingText, html: headingHtml, pageNumber: page.pageNumber });
      inReferences = referenceHeadingRegex.test(headingText);
      index = cursor;
      continue;
    }

    if (inReferences) {
      let refText = text;
      let refHtml = line.html;
      let cursor = index + 1;
      while (cursor < lines.length) {
        const candidate = lines[cursor];
        if (referenceHeadingRegex.test(candidate.text)) break;
        // A new reference starts at a hanging-indent first line, even when the
        // previous entry wrapped onto multiple physical PDF lines.
        const candidateStartsReference = referenceStartRegex.test(candidate.text.trim());
        const likelyNewEntry = candidateStartsReference &&
          (candidate.x <= line.x + Math.max(12, bodyFontSize * 1.5) ||
           /(?:https?:\/\/\S+|doi\.org\/\S+|\.)\s*$/.test(refText));
        if (likelyNewEntry) break;
        const candidateGap = lines[cursor - 1].y - candidate.y;
        if (candidateGap > gap * 1.9) break;
        refText = joinWrappedText(refText, candidate.text);
        refHtml = joinWrappedHtml(refHtml, candidate.html);
        cursor += 1;
      }
      // PDF extraction can concatenate separate bibliography entries onto
      // one physical line. Split only at a credible author + year boundary.
      const embeddedEntry = /\s+(?=[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü'-]+,\s+[A-Z](?:\.|[a-z]+)[^()]{0,90}\((?:19|20)\d{2}[a-z]?\)\.)/g;
      const parts = refText.split(embeddedEntry).map(part => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        for (const part of parts) blocks.push({type:"reference",text:part,html:escapeHtml(part),pageNumber:page.pageNumber});
      } else {
        blocks.push({ type: "reference", text: refText, html: refHtml, pageNumber: page.pageNumber });
      }
      index = cursor;
      continue;
    }

    const listType = isListLine(line, baseLeft);
    if (listType) {
      let itemText = stripListMarker(text);
      let cursor = index + 1;
      while (cursor < lines.length) {
        const candidate = lines[cursor];
        if (isListLine(candidate, baseLeft) || classifyHeading(candidate, bodyFontSize) || figureLabelRegex.test(candidate.text) || noteRegex.test(candidate.text)) break;
        const candidateGap = lines[cursor - 1].y - candidate.y;
        const continuationIndent = candidate.x >= line.x + 4 || candidate.x >= baseLeft + 20;
        if (candidateGap > gap * 1.5 || !continuationIndent) break;
        itemText = joinWrappedText(itemText, candidate.text);
        cursor += 1;
      }
      blocks.push({ type: listType, text: itemText, pageNumber: page.pageNumber });
      index = cursor;
      continue;
    }

    let paragraphText = text;
    let paragraphHtml = line.html;
    let cursor = index + 1;
    while (cursor < lines.length && shouldJoinLines(lines[cursor - 1], lines[cursor], context)) {
      // A table heading is a structural boundary, never a continuation of prose.
      // Previously the paragraph merger consumed "Tabla 1" before the table
      // detector could inspect it, flattening entire tables into plain text.
      if (/\bTabla\s+\d+\b/i.test(lines[cursor].text)) break;
      paragraphText = joinWrappedText(paragraphText, lines[cursor].text);
      paragraphHtml = joinWrappedHtml(paragraphHtml, lines[cursor].html);
      cursor += 1;
    }
    blocks.push({ type: "p", text: paragraphText, html: paragraphHtml, pageNumber: page.pageNumber });
    index = cursor;
  }
  return { blocks, inReferences };
}

function mergeCrossPageBlocks(blocks) {
  const merged = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    const crossPage = previous && previous.pageNumber !== block.pageNumber;
    if (previous?.type === "p" && block.type === "p" && crossPage) {
      const prevText = previous.text.trim();
      const nextText = block.text.trim();
      const incomplete = !/[.!?]["')\]]?$/.test(prevText) || /[,;:]$/.test(prevText);
      const continuation = /^[a-záéíóúñü]/.test(nextText) || /^(?:19|20)\d{2}[).,]/.test(nextText);
      if (incomplete || continuation) {
        previous.text = joinWrappedText(previous.text, block.text);
        previous.html = joinWrappedHtml(previous.html, block.html);
        continue;
      }
    }
    merged.push(block);
  }
  return merged;
}

function blocksToHtml(blocks, sortReferences) {
  const output = [];
  let referenceBuffer = [];
  let listType = null;
  let listItems = [];

  const flushReferences = () => {
    if (!referenceBuffer.length) return;
    if (sortReferences) referenceBuffer.sort((a, b) => a.text.localeCompare(b.text, "es", { sensitivity: "base" }));
    for (const block of referenceBuffer) output.push(`<p class="apa-reference">${block.html || escapeHtml(block.text)}</p>`);
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
      const classes = ["apa-heading", `level-${level}`];
      if (referenceHeadingRegex.test(block.text)) classes.push("apa-references-heading");
      output.push(`<h${level} class="${classes.join(" ")}">${block.html || escapeHtml(block.text)}</h${level}>`);
    } else if (block.type === "table-label") {
      output.push(`<p class="apa-table-label"><strong>${escapeHtml(block.text)}</strong></p>`);
    } else if (block.type === "figure-label") {
      output.push(`<p class="apa-figure-label">${escapeHtml(block.text)}</p>`);
    } else if (block.type === "figure-title") {
      output.push(`<p class="apa-figure-title"><em>${block.html || escapeHtml(block.text)}</em></p>`);
    } else if (block.type === "figure-note") {
      const noteText = block.text.replace(noteRegex, "").trim();
      output.push(`<p class="apa-note"><strong>Nota.</strong> ${escapeHtml(noteText)}</p>`);
    } else if (block.type === "image") {
      output.push(`<img class="apa-figure-image" style="display:block;max-width:100%;height:auto;margin:.5em auto 1em;" src="${block.src}" alt="${escapeHtml(block.alt)}">`);
    } else if (block.type === "table") {
      const [head, ...body] = block.rows;
      output.push(`<table class="apa-table" style="width:100%;border-collapse:collapse;margin:1em 0;"><thead><tr>${head.map((cell) => `<th scope="col" style="border:1px solid #777;padding:.3em;text-align:left;vertical-align:top;">${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #777;padding:.3em;text-align:left;vertical-align:top;">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    } else {
      output.push(`<p>${block.html || escapeHtml(block.text)}</p>`);
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
    // Match the editor's custom rule: only substantive paragraphs (3+ sentences).
    // Do not indent contact details, headings, or isolated PDF text lines.
    const text = (paragraph.textContent || "").trim();
    const contact = /@|https?:\/\/|www\.|\b(?:linkedin|tel(?:éfono)?|phone|email)\b/i.test(text);
    const upperHeading = text.length < 120 && /[A-ZÁÉÍÓÚÑ]/.test(text) &&
      text === text.toLocaleUpperCase() && !/[.!?]$/.test(text);
    const normalized = text
      .replace(/\b(?:Dr|Dra|Sr|Sra|Prof|etc)\./gi, "")
      .replace(/\b(?:[A-ZÁÉÍÓÚÑ]\.){2,}/g, "")
      .replace(/\b\d+\.\d+\b/g, "");
    const sentences = (normalized.match(/[.!?]+(?=\s|$|["”’»)\]])/g) || []).length;
    paragraph.style.textIndent = !exempt && !contact && !upperHeading &&
      firstLineIndent && sentences >= 3 ? ".5in" : "0";
  });
  preview.querySelectorAll(".apa-reference").forEach((reference) => {
    reference.style.paddingLeft = hangingReferences ? ".5in" : "0";
    reference.style.textIndent = hangingReferences ? "-.5in" : "0";
  });
}

// Shared structured PDF converter used by the automatic Open File workflow.
// Keep document insertion and APA formatting under app.js control.
window.EstiloAPASmartPdfToHtml = async function (file) {
  const pages = await extractPdfPages(file);
  removeRepeatedHeadersAndFooters(pages);
  const characters = pages.reduce((sum, page) => sum + page.lines.reduce((n, line) => n + line.text.length, 0), 0);
  if (!characters) throw new Error("El PDF no contiene texto seleccionable. Para documentos escaneados se requiere OCR.");
  const bodyFontSize = detectBodyFontSize(pages);
  await prepareFigureImages(pages, bodyFontSize);
  let blocks = [];
  let inReferences = false;
  for (const page of pages) {
    const parsed = pageToBlocks(page, bodyFontSize, inReferences);
    blocks.push(...parsed.blocks);
    inReferences = parsed.inReferences;
  }
  const labeledTables = pages.reduce((count, page) =>
    count + page.lines.filter(line => /\bTabla\s+\d+\b/i.test(line.text)).length, 0);
  const reconstructedTables = blocks.filter(block => block.type === "table").length;
  if (labeledTables > reconstructedTables) {
    console.warn("PDF table reconstruction incomplete", { labeledTables, reconstructedTables });
    // Do not claim the table conversion is complete when some labels became prose.
    window.dispatchEvent(new CustomEvent("apa-pdf-table-warning", {
      detail: { labeledTables, reconstructedTables }
    }));
  }
  return blocksToHtml(mergeCrossPageBlocks(blocks), false);
};

async function smartFormatPdfFiles(files) {
  const preview = document.querySelector("#preview");
  const formatBtn = document.querySelector("#formatBtn");
  if (!preview || processingPdf) return;
  processingPdf = true;
  if (formatBtn) formatBtn.disabled = true;
  setPdfStatus(`APA7 PDF Smart v${PDF_SMART_VERSION}: analizando estructura, figuras y tablas…`);

  try {
    const allHtml = [];
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const pages = await extractPdfPages(file);
      removeRepeatedHeadersAndFooters(pages);
      const totalCharacters = pages.reduce((sum, page) => sum + page.lines.reduce((inner, line) => inner + line.text.length, 0), 0);
      if (totalCharacters < 80) throw new Error(`${file.name} parece ser un PDF escaneado o sin una capa de texto suficiente. Use el DOCX original o aplique OCR antes de subirlo.`);

      const bodyFontSize = detectBodyFontSize(pages);
      setPdfStatus(`PDF ${fileIndex + 1}: preservando figuras y estructura visual…`);
      await prepareFigureImages(pages, bodyFontSize);

      let blocks = [];
      let inReferences = false;
      for (const page of pages) {
        const parsed = pageToBlocks(page, bodyFontSize, inReferences);
        blocks.push(...parsed.blocks);
        inReferences = parsed.inReferences;
      }
      blocks = mergeCrossPageBlocks(blocks);

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
    setTimeout(() => document.querySelector("#reauditBtn")?.click(), 80);
    setPdfStatus(`PDF reconstruido con modo inteligente v${PDF_SMART_VERSION}. Se conservaron figuras, tablas detectadas, párrafos entre páginas y formato interno de referencias cuando fue posible.`, "success");
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