const PDF_ORIGINAL_MEDIA_VERSION = "3.3";
const PDF_MEDIA_PDFJS_VERSION = "6.1.200";
const PDF_MEDIA_PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_MEDIA_PDFJS_VERSION}/build/pdf.mjs`;
const PDF_MEDIA_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_MEDIA_PDFJS_VERSION}/build/pdf.worker.mjs`;

let pdfMediaJsPromise;
let pdfMediaBusy = false;
let pdfMediaTimer = null;

function mediaNorm(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function pdfMediaJs() {
  if (!pdfMediaJsPromise) {
    pdfMediaJsPromise = import(PDF_MEDIA_PDFJS_URL).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_MEDIA_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfMediaJsPromise;
}

function mediaFontSize(transform, fallback = 0) {
  if (!Array.isArray(transform) || transform.length < 4) return fallback || 0;
  return Math.max(Math.hypot(transform[0], transform[1]), Math.hypot(transform[2], transform[3]), fallback || 0);
}

function groupMediaLines(items, pageHeight) {
  const lines = [];
  for (const item of items.sort((a, b) => (a.screenY - b.screenY) || (a.x - b.x))) {
    const tolerance = Math.max(2.5, item.fontSize * 0.28);
    let line = lines.find((candidate) => Math.abs(candidate.screenY - item.screenY) <= tolerance);
    if (!line) {
      line = { screenY: item.screenY, items: [] };
      lines.push(line);
    }
    line.items.push(item);
    line.screenY = line.items.reduce((sum, current) => sum + current.screenY, 0) / line.items.length;
  }

  return lines.map((line) => {
    const sorted = line.items.sort((a, b) => a.x - b.x);
    const text = sorted.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
    const fontSize = Math.max(...sorted.map((item) => item.fontSize || 0), 10);
    return {
      text,
      top: Math.max(0, line.screenY - fontSize * 1.05),
      bottom: Math.min(pageHeight, line.screenY + fontSize * 0.55),
      fontSize,
    };
  }).filter((line) => line.text).sort((a, b) => a.top - b.top);
}

async function pageMediaLines(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = [];
  for (const raw of content.items) {
    if (!("str" in raw) || !raw.str?.trim()) continue;
    const transform = raw.transform || [];
    const fontSize = mediaFontSize(transform, Number(raw.height || 0));
    const y = Number(transform[5] || 0);
    items.push({
      text: raw.str.trim(),
      x: Number(transform[4] || 0),
      fontSize,
      screenY: viewport.height - y,
    });
  }
  return { viewport, lines: groupMediaLines(items, viewport.height) };
}

function explicitFigureAround(lines, beforeIndex, afterIndex) {
  const nearbyBefore = lines.slice(Math.max(0, beforeIndex - 3), beforeIndex + 1).map((line) => line.text).join(" ");
  const nearbyAfter = lines.slice(afterIndex, Math.min(lines.length, afterIndex + 2)).map((line) => line.text).join(" ");
  return /\b(figura|figure)\s+\d+/i.test(nearbyBefore) || /^\s*(nota|note)\./i.test(nearbyAfter);
}

function candidateVisualGaps(lines, pageHeight) {
  const gaps = [];
  if (lines.length < 2) return gaps;
  const minimum = Math.max(95, pageHeight * 0.105);

  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i];
    const next = lines[i + 1];
    const top = current.bottom + 4;
    const bottom = next.top - 4;
    const height = bottom - top;
    if (height < minimum) continue;
    if (top < pageHeight * 0.03 || bottom > pageHeight * 0.97) continue;
    if (explicitFigureAround(lines, i, i + 1)) continue; // PDF Smart ya maneja figuras etiquetadas.
    gaps.push({ top, bottom, before: current.text, after: next.text, index: i });
  }
  return gaps;
}

function pixelIsInk(data, index) {
  return data[index] < 240 || data[index + 1] < 240 || data[index + 2] < 240;
}

function meaningfulInkRun(imageData, width, height) {
  const data = imageData.data;
  const stepX = Math.max(2, Math.floor(width / 220));
  const rowHasInk = new Array(height).fill(false);
  const rowCoverage = new Array(height).fill(0);
  for (let y = 0; y < height; y += 2) {
    let ink = 0;
    let samples = 0;
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      samples += 1;
      if (pixelIsInk(data, idx)) ink += 1;
    }
    const coverage = samples ? ink / samples : 0;
    rowCoverage[y] = coverage;
    rowCoverage[Math.min(height - 1, y + 1)] = coverage;
    const active = coverage >= 0.075;
    rowHasInk[y] = active;
    if (y + 1 < height) rowHasInk[y + 1] = active;
  }

  let best = null;
  let start = null;
  for (let y = 0; y <= height; y += 1) {
    const active = y < height ? rowHasInk[y] : false;
    if (active && start === null) start = y;
    if (!active && start !== null) {
      const end = y - 1;
      if (!best || end - start > best.end - best.start) best = { start, end };
      start = null;
    }
  }
  if (!best || best.end - best.start < Math.max(45, height * 0.18)) return null;

  let sum = 0;
  let count = 0;
  for (let y = best.start; y <= best.end; y += 1) {
    sum += rowCoverage[y] || 0;
    count += 1;
  }
  if (!count || sum / count < 0.10) return null;
  return { start: Math.max(0, best.start - 5), end: Math.min(height - 1, best.end + 5) };
}

async function renderGapImage(page, viewport, gap) {
  const scale = 1.45;
  const renderViewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  await page.render({ canvasContext: context, viewport: renderViewport }).promise;

  const sourceTop = Math.max(0, Math.floor(gap.top * scale));
  const sourceBottom = Math.min(canvas.height, Math.ceil(gap.bottom * scale));
  const sourceHeight = sourceBottom - sourceTop;
  if (sourceHeight < 70) return "";

  const gapData = context.getImageData(0, sourceTop, canvas.width, sourceHeight);
  const run = meaningfulInkRun(gapData, canvas.width, sourceHeight);
  if (!run) return "";

  const trimTop = sourceTop + run.start;
  const trimHeight = run.end - run.start + 1;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = trimHeight;
  const outContext = out.getContext("2d", { alpha: false });
  outContext.drawImage(canvas, 0, trimTop, canvas.width, trimHeight, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.92);
}

function previewAnchor(section, text) {
  const target = mediaNorm(text);
  if (!target) return null;
  const prefix = target.slice(0, Math.min(55, target.length));
  const candidates = [...section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li")];
  return candidates.find((node) => mediaNorm(node.textContent).startsWith(prefix)) || null;
}

function isCoverGap(pageNumber, gap) {
  return pageNumber === 1 && /^introduccion$/i.test(mediaNorm(gap.after)) && gap.top < gap.bottom;
}

function insertOriginalMedia(section, dataUrl, fileName, pageNumber, gap, mediaIndex) {
  const anchor = previewAnchor(section, gap.after);
  if (!anchor) return null;
  const key = `${pageNumber}-${mediaIndex}`;
  if (section.querySelector(`img[data-pdf-original-media="${key}"]`)) return null;

  const image = document.createElement("img");
  image.src = dataUrl;
  image.dataset.pdfOriginalMedia = key;
  image.dataset.pdfSourceFile = fileName;
  image.dataset.pdfSourcePage = String(pageNumber);
  image.style.display = "block";
  image.style.maxWidth = "100%";
  image.style.height = "auto";
  image.style.margin = ".4em auto 1em";

  if (isCoverGap(pageNumber, gap)) {
    image.className = "apa-cover-image pdf-original-image";
    image.alt = "Imagen de portada conservada del documento original";
    image.dataset.apaNonFigure = "true";
  } else {
    image.className = "apa-figure-image pdf-original-image";
    image.alt = "";
    image.dataset.apaNeedsFigureReview = "true";
  }
  anchor.before(image);
  return image;
}

async function preserveMediaForFile(file, section) {
  const pdfjs = await pdfMediaJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  let inserted = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const { viewport, lines } = await pageMediaLines(page);
    const gaps = candidateVisualGaps(lines, viewport.height);
    for (let index = 0; index < gaps.length; index += 1) {
      const gap = gaps[index];
      const dataUrl = await renderGapImage(page, viewport, gap);
      if (!dataUrl) continue;
      if (insertOriginalMedia(section, dataUrl, file.name, pageNumber, gap, index)) inserted += 1;
    }
  }
  return inserted;
}

function updateOriginalMediaAudit() {
  const root = document.querySelector("#preview");
  const list = document.querySelector("#auditList");
  if (!root || !list) return;
  list.querySelectorAll("li[data-pdf-original-media-audit]").forEach((node) => node.remove());
  const coverImages = [...root.querySelectorAll("img.apa-cover-image")];
  const recoveredBody = [...root.querySelectorAll("img.pdf-original-image.apa-figure-image")];
  if (!coverImages.length && !recoveredBody.length) return;

  const li = document.createElement("li");
  li.dataset.pdfOriginalMediaAudit = "true";
  li.className = recoveredBody.some((img) => img.dataset.apaNeedsFigureReview === "true") ? "warn" : "ok";
  const parts = [];
  if (coverImages.length) parts.push(`${coverImages.length} imagen(es) de portada/original(es) conservada(s) sin numerarlas como figuras`);
  if (recoveredBody.length) parts.push(`${recoveredBody.length} imagen(es) del cuerpo recuperada(s) para revisión y formato de figura APA 7`);
  li.textContent = `Medios originales PDF v${PDF_ORIGINAL_MEDIA_VERSION}: ${parts.join("; ")}.`;
  list.append(li);
}

async function preserveOriginalPdfMedia() {
  if (pdfMediaBusy) return;
  const preview = document.querySelector("#preview");
  const input = document.querySelector("#files");
  if (!preview || !input || preview.querySelector(".placeholder")) return;
  const pdfFiles = [...(input.files || [])].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfFiles.length) return;

  pdfMediaBusy = true;
  try {
    let inserted = 0;
    for (const file of pdfFiles) {
      const section = [...preview.querySelectorAll("section[data-source-file]")].find((node) => node.dataset.sourceFile === file.name);
      if (!section || section.dataset.pdfOriginalMediaChecked === "true") continue;
      inserted += await preserveMediaForFile(file, section);
      section.dataset.pdfOriginalMediaChecked = "true";
    }
    if (inserted) {
      preview.dispatchEvent(new Event("input", { bubbles: true }));
      const status = document.querySelector("#status");
      if (status) {
        status.textContent = `PDF v${PDF_ORIGINAL_MEDIA_VERSION}: ${inserted} imagen(es) original(es) preservada(s). Las imágenes de portada se mantienen sin numeración; las figuras del cuerpo se normalizan según APA 7.`;
        status.className = "status success";
      }
    }
    setTimeout(updateOriginalMediaAudit, 160);
  } catch (error) {
    console.error("PDF original media", error);
  } finally {
    pdfMediaBusy = false;
  }
}

function scheduleOriginalPdfMedia() {
  clearTimeout(pdfMediaTimer);
  pdfMediaTimer = setTimeout(() => void preserveOriginalPdfMedia(), 450);
}

function addOriginalMediaStyles() {
  if (document.querySelector("#pdf-original-media-v33-style")) return;
  const style = document.createElement("style");
  style.id = "pdf-original-media-v33-style";
  style.textContent = `
    .apa-paper img.apa-cover-image {
      display:block !important;
      max-width:100% !important;
      width:auto !important;
      height:auto !important;
      margin:.4em auto 1em !important;
    }
  `;
  document.head.append(style);
}

function initializeOriginalPdfMedia() {
  addOriginalMediaStyles();
  const preview = document.querySelector("#preview");
  if (!preview) return;
  new MutationObserver(scheduleOriginalPdfMedia).observe(preview, { childList: true, subtree: true });
  document.querySelector("#formatBtn")?.addEventListener("click", () => {
    preview.querySelectorAll("section[data-source-file]").forEach((section) => delete section.dataset.pdfOriginalMediaChecked);
    setTimeout(scheduleOriginalPdfMedia, 900);
  });
  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(updateOriginalMediaAudit, 180));

  // El exportador existente inserta imágenes con la clase apa-figure-image. Se añade
  // temporalmente a las imágenes de portada solo durante la exportación DOCX.
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#downloadDocxBtn")) return;
    const covers = [...preview.querySelectorAll("img.apa-cover-image")];
    covers.forEach((image) => image.classList.add("apa-figure-image", "thesis-figure-image"));
    setTimeout(() => covers.forEach((image) => image.classList.remove("apa-figure-image", "thesis-figure-image")), 0);
  }, true);

  setTimeout(scheduleOriginalPdfMedia, 500);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeOriginalPdfMedia, { once: true });
else initializeOriginalPdfMedia();