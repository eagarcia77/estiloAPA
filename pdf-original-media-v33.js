const PDF_ORIGINAL_MEDIA_VERSION = "3.4";
const PDF_MEDIA_PDFJS_VERSION = "6.1.200";
const PDF_MEDIA_PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_MEDIA_PDFJS_VERSION}/build/pdf.mjs`;
const PDF_MEDIA_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_MEDIA_PDFJS_VERSION}/build/pdf.worker.mjs`;

let pdfMediaJsPromise;
let pdfMediaBusy = false;
let pdfMediaTimer = null;
let mediaRepairTimer = null;

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
  return Math.max(
    Math.hypot(transform[0], transform[1]),
    Math.hypot(transform[2], transform[3]),
    fallback || 0
  );
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

async function pageMediaModel(page) {
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

function figureReferenceNumber(text) {
  const matches = [...String(text || "").matchAll(/\b(?:figura|figure)\s+(\d{1,3})\b/gi)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function standaloneFigureLabel(text) {
  return /^\s*(?:figura|figure)\s+\d{1,3}[a-z]?\s*\.?\s*$/i.test(String(text || ""));
}

function candidateVisualGaps(lines, pageHeight, previousPageTail = "") {
  const gaps = [];
  const minimum = Math.max(88, pageHeight * 0.10);
  if (!lines.length) return gaps;

  const first = lines[0];
  if (first.top > minimum) {
    gaps.push({
      top: 5,
      bottom: first.top - 4,
      before: previousPageTail,
      after: first.text,
      leading: true,
    });
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i];
    const next = lines[i + 1];
    const top = current.bottom + 4;
    const bottom = next.top - 4;
    const height = bottom - top;
    if (height < minimum) continue;
    if (top < pageHeight * 0.02 || bottom > pageHeight * 0.985) continue;

    // Only suppress a gap when the PDF text layer contains a standalone APA
    // figure label. A narrative mention such as "Como se observa en la Figura 4"
    // must NOT suppress image recovery because the label/title may be inside
    // the raster image itself.
    const nearby = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3));
    if (nearby.some((line) => standaloneFigureLabel(line.text))) continue;

    gaps.push({
      top,
      bottom,
      before: lines.slice(Math.max(0, i - 4), i + 1).map((line) => line.text).join(" "),
      after: next.text,
      leading: false,
    });
  }
  return gaps;
}

function pixelHasInk(data, index) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return r < 244 || g < 244 || b < 244;
}

function inkBoundingBox(imageData, width, height) {
  const data = imageData.data;
  const stepX = Math.max(1, Math.floor(width / 350));
  const stepY = Math.max(1, Math.floor(height / 350));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let inkSamples = 0;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      if (!pixelHasInk(data, idx)) continue;
      inkSamples += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (inkSamples < 80 || maxX < minX || maxY < minY) return null;
  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  if (boxWidth < width * 0.28 || boxHeight < height * 0.20) return null;

  const padX = Math.max(6, Math.round(width * 0.012));
  const padY = Math.max(6, Math.round(height * 0.018));
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: Math.min(width, maxX + padX) - Math.max(0, minX - padX) + 1,
    height: Math.min(height, maxY + padY) - Math.max(0, minY - padY) + 1,
  };
}

async function renderGapImage(page, gap) {
  const scale = 1.45;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  await page.render({ canvasContext: context, viewport }).promise;

  const sourceTop = Math.max(0, Math.floor(gap.top * scale));
  const sourceBottom = Math.min(canvas.height, Math.ceil(gap.bottom * scale));
  const sourceHeight = sourceBottom - sourceTop;
  if (sourceHeight < 70) return "";

  const region = context.getImageData(0, sourceTop, canvas.width, sourceHeight);
  const box = inkBoundingBox(region, canvas.width, sourceHeight);
  if (!box) return "";

  const out = document.createElement("canvas");
  out.width = box.width;
  out.height = box.height;
  const outContext = out.getContext("2d", { alpha: false });
  outContext.drawImage(
    canvas,
    box.x,
    sourceTop + box.y,
    box.width,
    box.height,
    0,
    0,
    box.width,
    box.height
  );
  return out.toDataURL("image/jpeg", 0.93);
}

function previewAnchor(section, text) {
  const target = mediaNorm(text);
  if (!target) return null;
  const prefix = target.slice(0, Math.min(58, target.length));
  const candidates = [...section.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li")];
  return candidates.find((node) => mediaNorm(node.textContent).startsWith(prefix)) || null;
}

function isModuleBanner(pageNumber, gap) {
  if (pageNumber !== 1) return false;
  const after = mediaNorm(gap.after);
  if (!/^(introduccion|introduction)$/.test(after)) return false;
  return gap.top < gap.bottom;
}

function figureDescription(context, number) {
  const text = String(context || "").replace(/\s+/g, " ").trim();
  const marker = new RegExp(`\\b(?:Figura|Figure)\\s+${number}\\b[,.:;]?\\s*`, "i");
  const parts = text.split(marker);
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].trim();
    if (tail) return tail.slice(0, 220);
  }
  return `Figura ${number} del documento original`;
}

function nearbyElement(element, direction = "previous") {
  let node = direction === "previous" ? element?.previousElementSibling : element?.nextElementSibling;
  while (node && !mediaNorm(node.textContent) && node.tagName !== "IMG" && node.tagName !== "TABLE") {
    node = direction === "previous" ? node.previousElementSibling : node.nextElementSibling;
  }
  return node || null;
}

function removeAutoCaptionPair(image) {
  let previous = nearbyElement(image, "previous");
  if (previous?.classList.contains("apa-figure-title") || previous?.classList.contains("thesis-figure-title")) {
    const label = nearbyElement(previous, "previous");
    if (label?.classList.contains("apa-figure-label") || label?.classList.contains("thesis-figure-label")) {
      previous.remove();
      label.remove();
      return;
    }
  }
  if (previous?.classList.contains("apa-figure-label") || previous?.classList.contains("thesis-figure-label")) {
    previous.remove();
  }
}

function repairMediaRoles(root = document.querySelector("#preview")) {
  if (!root) return;

  const banners = [...root.querySelectorAll('img.apa-cover-image,img[data-apa-non-figure="true"],img[data-apa-nonfigure="true"]')];
  for (const image of banners) {
    removeAutoCaptionPair(image);
    image.classList.remove("apa-figure-image", "module-figure-image", "thesis-figure-image");
    image.classList.add("apa-cover-image", "pdf-original-image");
    image.dataset.apaNonFigure = "true";
    delete image.dataset.apaFigureNumber;
    delete image.dataset.apaAltGenerated;
  }

  const selfCaptioned = [...root.querySelectorAll('img[data-apa-self-captioned="true"],img.apa-self-captioned-figure')];
  for (const image of selfCaptioned) {
    removeAutoCaptionPair(image);
    image.classList.add("apa-figure-image", "pdf-original-image", "apa-self-captioned-figure");
    image.classList.remove("apa-cover-image");
    image.dataset.apaSelfCaptioned = "true";
    const sourceNumber = Number(image.dataset.apaSourceFigureNumber || image.dataset.apaFigureNumber || 0);
    if (sourceNumber > 0) image.dataset.apaFigureNumber = String(sourceNumber);
    delete image.dataset.apaAltGenerated;
  }

  // Number only true figures. Banners never consume a figure number.
  const figures = [...root.querySelectorAll("img.apa-figure-image")]
    .filter((image) => image.dataset.apaNonFigure !== "true" && !image.classList.contains("apa-cover-image"));
  let next = 1;
  for (const image of figures) {
    const source = Number(image.dataset.apaSourceFigureNumber || 0);
    if (source > 0) {
      image.dataset.apaFigureNumber = String(source);
      next = Math.max(next, source + 1);
    } else {
      image.dataset.apaFigureNumber = String(next);
      next += 1;
    }
  }
}

function existingMedia(section, pageNumber, role, figureNumber = null) {
  if (role === "banner") {
    return section.querySelector(`img.apa-cover-image[data-pdf-source-page="${pageNumber}"]`)
      || (pageNumber === 1 ? section.querySelector("img.apa-cover-image") : null);
  }
  if (figureNumber) {
    return section.querySelector(`img[data-apa-source-figure-number="${figureNumber}"]`);
  }
  return section.querySelector(`img[data-pdf-source-page="${pageNumber}"][data-apa-self-captioned="true"]`);
}

function insertRecoveredMedia(section, dataUrl, fileName, pageNumber, gap, mediaIndex, previousPageTail) {
  const anchor = previewAnchor(section, gap.after);
  if (!anchor) return null;

  const context = `${previousPageTail || ""} ${gap.before || ""}`.replace(/\s+/g, " ").trim();
  const figureNumber = figureReferenceNumber(context);
  const banner = isModuleBanner(pageNumber, gap);

  if (existingMedia(section, pageNumber, banner ? "banner" : "figure", figureNumber)) return null;

  const image = document.createElement("img");
  image.src = dataUrl;
  image.dataset.pdfOriginalMediaV34 = `${pageNumber}-${mediaIndex}`;
  image.dataset.pdfSourceFile = fileName;
  image.dataset.pdfSourcePage = String(pageNumber);
  image.style.display = "block";
  image.style.maxWidth = "100%";
  image.style.height = "auto";
  image.style.margin = ".4em auto 1em";

  if (banner) {
    image.className = "apa-cover-image pdf-original-image module-banner-image";
    image.alt = "Banner de identificación del módulo conservado del documento original";
    image.dataset.apaNonFigure = "true";
    image.dataset.apaMediaRole = "module-banner";
  } else if (figureNumber) {
    image.className = "apa-figure-image pdf-original-image apa-self-captioned-figure";
    image.alt = `Figura ${figureNumber}. ${figureDescription(context, figureNumber)}`;
    image.dataset.apaSelfCaptioned = "true";
    image.dataset.apaSourceFigureNumber = String(figureNumber);
    image.dataset.apaFigureNumber = String(figureNumber);
    image.dataset.apaMediaRole = "self-captioned-figure";
  } else {
    image.className = "apa-figure-image pdf-original-image";
    image.alt = "Imagen del cuerpo del documento original; requiere revisión de clasificación";
    image.dataset.apaNeedsFigureReview = "true";
    image.dataset.apaMediaRole = "unclassified";
  }

  anchor.before(image);
  return image;
}

async function preserveMediaForFile(file, section) {
  const pdfjs = await pdfMediaJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  let inserted = 0;
  let previousPageTail = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const { viewport, lines } = await pageMediaModel(page);
    const gaps = candidateVisualGaps(lines, viewport.height, previousPageTail);

    for (let index = 0; index < gaps.length; index += 1) {
      const gap = gaps[index];
      const dataUrl = await renderGapImage(page, gap);
      if (!dataUrl) continue;

      if (insertRecoveredMedia(section, dataUrl, file.name, pageNumber, gap, index, previousPageTail)) {
        inserted += 1;
      }
    }

    previousPageTail = lines.slice(-6).map((line) => line.text).join(" ");
  }
  return inserted;
}

function updateOriginalMediaAudit() {
  const root = document.querySelector("#preview");
  const list = document.querySelector("#auditList");
  if (!root || !list) return;

  repairMediaRoles(root);
  list.querySelectorAll('li[data-pdf-original-media-audit],li[data-apa-media-audit="figure"]').forEach((node) => node.remove());

  const banners = [...root.querySelectorAll("img.apa-cover-image")];
  const selfCaptioned = [...root.querySelectorAll('img[data-apa-self-captioned="true"]')];
  const otherFigures = [...root.querySelectorAll("img.apa-figure-image")]
    .filter((img) => img.dataset.apaSelfCaptioned !== "true" && img.dataset.apaNonFigure !== "true");
  const review = otherFigures.filter((img) => img.dataset.apaNeedsFigureReview === "true");

  if (!banners.length && !selfCaptioned.length && !otherFigures.length) return;

  const li = document.createElement("li");
  li.dataset.pdfOriginalMediaAudit = "true";
  li.className = review.length ? "warn" : "ok";
  const parts = [];
  if (banners.length) parts.push(`${banners.length} banner(es) de módulo conservado(s) sin numeración de figura`);
  if (selfCaptioned.length) parts.push(`${selfCaptioned.length} figura(s) original(es) con rótulo/título integrados preservada(s) sin duplicar el caption`);
  if (otherFigures.length) parts.push(`${otherFigures.length} imagen(es) adicional(es) del cuerpo`);
  if (review.length) parts.push(`${review.length} requiere(n) clasificación manual`);
  li.textContent = `Medios originales PDF v${PDF_ORIGINAL_MEDIA_VERSION}: ${parts.join("; ")}.`;
  list.append(li);
}

async function preserveOriginalPdfMedia() {
  if (pdfMediaBusy) return;
  const preview = document.querySelector("#preview");
  const input = document.querySelector("#files");
  if (!preview || !input || preview.querySelector(".placeholder")) return;

  const pdfFiles = [...(input.files || [])]
    .filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfFiles.length) return;

  pdfMediaBusy = true;
  try {
    let inserted = 0;
    for (const file of pdfFiles) {
      const section = [...preview.querySelectorAll("section[data-source-file]")]
        .find((node) => node.dataset.sourceFile === file.name);
      if (!section || section.dataset.pdfOriginalMediaV34Checked === "true") continue;
      inserted += await preserveMediaForFile(file, section);
      section.dataset.pdfOriginalMediaV34Checked = "true";
    }

    repairMediaRoles(preview);
    if (inserted) {
      preview.dispatchEvent(new Event("input", { bubbles: true }));
      const status = document.querySelector("#status");
      if (status) {
        status.textContent = `PDF v${PDF_ORIGINAL_MEDIA_VERSION}: ${inserted} imagen(es) original(es) preservada(s). El banner del módulo no se numera; las figuras auto-captionadas conservan su numeración sin duplicar título.`;
        status.className = "status success";
      }
    }
    setTimeout(updateOriginalMediaAudit, 180);
  } catch (error) {
    console.error("PDF original media v3.4", error);
  } finally {
    pdfMediaBusy = false;
  }
}

function scheduleOriginalPdfMedia() {
  clearTimeout(pdfMediaTimer);
  pdfMediaTimer = setTimeout(() => void preserveOriginalPdfMedia(), 420);
}

function scheduleMediaRepair() {
  clearTimeout(mediaRepairTimer);
  mediaRepairTimer = setTimeout(() => repairMediaRoles(), 70);
}

function addOriginalMediaStyles() {
  if (document.querySelector("#pdf-original-media-v34-style")) return;
  const style = document.createElement("style");
  style.id = "pdf-original-media-v34-style";
  style.textContent = `
    .apa-paper img.apa-cover-image,
    .apa-paper img.module-banner-image {
      display:block !important;
      max-width:100% !important;
      width:auto !important;
      height:auto !important;
      margin:.4em auto 1em !important;
    }
    .apa-paper img.apa-self-captioned-figure {
      display:block !important;
      max-width:100% !important;
      width:auto !important;
      height:auto !important;
      margin:.45em auto 1em !important;
    }
  `;
  document.head.append(style);
}

function updateVersionUi() {
  const badge = document.querySelector(".badge");
  if (badge) {
    badge.textContent = "v3.4";
    badge.setAttribute("aria-label", "Versión 3.4");
  }
  const footer = document.querySelector("footer p");
  if (footer) {
    footer.textContent = "APA7 Academic Formatter v3.4 · Banner de módulo sin numeración · Figuras originales preservadas · Tablas APA 7 · Listas numeradas · Auditoría de referencias.";
  }
}

function initializeOriginalPdfMedia() {
  addOriginalMediaStyles();
  updateVersionUi();

  const preview = document.querySelector("#preview");
  if (!preview) return;

  new MutationObserver(() => {
    scheduleOriginalPdfMedia();
    scheduleMediaRepair();
  }).observe(preview, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  document.querySelector("#formatBtn")?.addEventListener("click", () => {
    preview.querySelectorAll("section[data-source-file]").forEach((section) => {
      delete section.dataset.pdfOriginalMediaV34Checked;
    });
    setTimeout(scheduleOriginalPdfMedia, 850);
  });

  document.querySelector("#reauditBtn")?.addEventListener("click", () => {
    setTimeout(() => {
      repairMediaRoles(preview);
      updateOriginalMediaAudit();
    }, 220);
  });

  // Run after the generic table/figure normalizer but before DOCX/HTML exporters.
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#downloadDocxBtn,#downloadHtmlBtn")) return;
    repairMediaRoles(preview);

    // The existing DOCX exporter only emits images carrying apa-figure-image.
    // Give banners that class only for the synchronous export pass; they remain
    // explicitly marked as non-figures so they never consume a figure number.
    const banners = [...preview.querySelectorAll("img.apa-cover-image")];
    banners.forEach((image) => image.classList.add("apa-figure-image"));
    setTimeout(() => {
      banners.forEach((image) => image.classList.remove("apa-figure-image"));
      repairMediaRoles(preview);
    }, 0);
  }, true);

  setTimeout(() => {
    scheduleOriginalPdfMedia();
    repairMediaRoles(preview);
    updateOriginalMediaAudit();
  }, 520);
}

window.repairApaMediaRoles = repairMediaRoles;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeOriginalPdfMedia, { once: true });
} else {
  initializeOriginalPdfMedia();
}
