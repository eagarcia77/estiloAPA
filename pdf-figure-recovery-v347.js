// APA7 Academic Formatter v3.4.7
// Reliable PDF figure recovery for the actual preview structure produced by app.js.
// app.js may represent one PDF page as a single <p> with <br> separators; this
// module can split that paragraph at the correct line before inserting a figure.
// Figures with integrated number/title/note are preserved without duplicate captions.

const PDF_FIGURE_RECOVERY_VERSION = "3.4.7";
const PFR_PDFJS_VERSION = "6.1.200";
const PFR_PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PFR_PDFJS_VERSION}/build/pdf.mjs`;
const PFR_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PFR_PDFJS_VERSION}/build/pdf.worker.mjs`;

let pfrPdfJsPromise;
let pfrRunPromise = null;

const pfrQ = (selector, root = document) => root.querySelector(selector);
const pfrQA = (selector, root = document) => [...root.querySelectorAll(selector)];
const pfrText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const pfrNorm = (value) => pfrText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function pfrInstitutional() {
  return pfrQ("#formatProfile")?.value === "modulo11c";
}

async function pfrPdfJs() {
  if (!pfrPdfJsPromise) {
    pfrPdfJsPromise = import(PFR_PDFJS_URL).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PFR_WORKER_URL;
      return pdfjs;
    });
  }
  return pfrPdfJsPromise;
}

function pfrFontSize(transform, fallback = 0) {
  if (!Array.isArray(transform) || transform.length < 4) return fallback || 0;
  return Math.max(Math.hypot(transform[0], transform[1]), Math.hypot(transform[2], transform[3]), fallback || 0);
}

function pfrGroupLines(items, pageHeight) {
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

async function pfrPageModel(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = [];
  for (const raw of content.items) {
    if (!("str" in raw) || !raw.str?.trim()) continue;
    const transform = raw.transform || [];
    items.push({
      text: raw.str.trim(),
      x: Number(transform[4] || 0),
      fontSize: pfrFontSize(transform, Number(raw.height || 0)),
      screenY: viewport.height - Number(transform[5] || 0),
    });
  }
  return { viewport, lines: pfrGroupLines(items, viewport.height) };
}

function pfrFigureNumber(text) {
  const matches = [...String(text || "").matchAll(/\b(?:figura|figure)\s+(\d{1,3})\b/gi)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function pfrCandidateGaps(lines, pageHeight, previousTail = "") {
  const gaps = [];
  const minimum = Math.max(68, pageHeight * 0.072);
  if (!lines.length) return gaps;

  const first = lines[0];
  if (first.top > minimum) {
    gaps.push({
      top: 4,
      bottom: first.top - 3,
      before: previousTail,
      after: first.text,
      leading: true,
      labelNumber: pfrFigureNumber(previousTail),
      standaloneLabel: false,
    });
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i];
    const next = lines[i + 1];
    const top = current.bottom + 3;
    const bottom = next.top - 3;
    if (bottom - top < minimum) continue;
    if (top < pageHeight * 0.015 || bottom > pageHeight * 0.99) continue;

    const beforeLines = lines.slice(Math.max(0, i - 7), i + 1);
    const before = beforeLines.map((line) => line.text).join(" ");
    const afterContext = lines.slice(i + 1, Math.min(lines.length, i + 4)).map((line) => line.text).join(" ");
    gaps.push({
      top,
      bottom,
      before,
      after: next.text,
      afterContext,
      leading: false,
      labelNumber: pfrFigureNumber(before),
      standaloneLabel: beforeLines.some((line) => /^\s*(?:figura|figure)\s+\d{1,3}[a-z]?\s*\.?\s*$/i.test(line.text)),
    });
  }
  return gaps;
}

function pfrPixelInk(data, index) {
  return data[index] < 246 || data[index + 1] < 246 || data[index + 2] < 246;
}

function pfrInkBox(imageData, width, height) {
  const data = imageData.data;
  const stepX = Math.max(1, Math.floor(width / 420));
  const stepY = Math.max(1, Math.floor(height / 420));
  let minX = width, minY = height, maxX = -1, maxY = -1, samples = 0;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      if (!pfrPixelInk(data, idx)) continue;
      samples += 1;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (samples < 55 || maxX < minX || maxY < minY) return null;
  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  if (boxWidth < width * 0.20 || boxHeight < height * 0.12) return null;
  const padX = Math.max(8, Math.round(width * 0.012));
  const padY = Math.max(8, Math.round(height * 0.018));
  const x1 = Math.max(0, minX - padX), y1 = Math.max(0, minY - padY);
  const x2 = Math.min(width - 1, maxX + padX), y2 = Math.min(height - 1, maxY + padY);
  return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

async function pfrRenderPage(page) {
  const scale = 1.7;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, ctx, scale };
}

function pfrCropGap(rendered, gap) {
  const { canvas, ctx, scale } = rendered;
  const sourceTop = Math.max(0, Math.floor(gap.top * scale));
  const sourceBottom = Math.min(canvas.height, Math.ceil(gap.bottom * scale));
  const sourceHeight = sourceBottom - sourceTop;
  if (sourceHeight < 60) return "";
  const region = ctx.getImageData(0, sourceTop, canvas.width, sourceHeight);
  const box = pfrInkBox(region, canvas.width, sourceHeight);
  if (!box) return "";

  const out = document.createElement("canvas");
  out.width = box.width;
  out.height = box.height;
  const outCtx = out.getContext("2d", { alpha: false });
  outCtx.drawImage(canvas, box.x, sourceTop + box.y, box.width, box.height, 0, 0, box.width, box.height);
  return out.toDataURL("image/jpeg", 0.94);
}

function pfrPlainTextFromHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return pfrNorm(temp.textContent);
}

function pfrSplitBrParagraph(node, targetText) {
  if (!node || !["P", "DIV"].includes(node.tagName) || !node.querySelector("br")) return null;
  const prefix = pfrNorm(targetText).slice(0, Math.min(54, pfrNorm(targetText).length));
  if (!prefix) return null;
  const parts = node.innerHTML.split(/<br\s*\/?>/i);
  const index = parts.findIndex((part) => pfrPlainTextFromHtml(part).startsWith(prefix));
  if (index < 0) return null;
  if (index === 0) return node;

  const before = node.cloneNode(false);
  const after = node.cloneNode(false);
  before.innerHTML = parts.slice(0, index).join("<br>");
  after.innerHTML = parts.slice(index).join("<br>");
  node.replaceWith(before, after);
  return after;
}

function pfrPreviewAnchor(section, text) {
  const target = pfrNorm(text);
  if (!target) return null;
  const prefix = target.slice(0, Math.min(54, target.length));
  const candidates = pfrQA("h1,h2,h3,h4,h5,h6,p,li,div", section);

  const direct = candidates.find((node) => pfrNorm(node.textContent).startsWith(prefix));
  if (direct) return direct;

  for (const node of candidates) {
    if (!pfrNorm(node.textContent).includes(prefix)) continue;
    const split = pfrSplitBrParagraph(node, text);
    if (split) return split;
    return node;
  }
  return null;
}

function pfrFindStandaloneLabel(section, number) {
  if (!number) return null;
  const regex = new RegExp(`^\\s*(?:Figura|Figure)\\s+${number}[A-Za-z]?\\s*\\.?\\s*$`, "i");
  return pfrQA("h1,h2,h3,h4,h5,h6,p,li", section).find((node) => regex.test(pfrText(node.textContent))) || null;
}

function pfrInsertion(section, gap, number) {
  const label = pfrFindStandaloneLabel(section, number);
  if (label) {
    let point = label;
    const next = label.nextElementSibling;
    const nextText = pfrText(next?.textContent);
    if (next && !["IMG", "TABLE", "OL", "UL"].includes(next.tagName) && nextText && nextText.length <= 240 && !/^Nota\./i.test(nextText)) point = next;
    return { mode: "after", node: point };
  }
  const anchor = pfrPreviewAnchor(section, gap.after);
  return anchor ? { mode: "before", node: anchor } : null;
}

function pfrLooksLikeStartBanner(pageNumber, gap) {
  return pageNumber === 1 && gap.leading && /^(introduccion|introduction)$/.test(pfrNorm(gap.after));
}

function pfrExisting(section, number, pageNumber, gapIndex) {
  if (number && section.querySelector(`img[data-apa-source-figure-number="${number}"]`)) return true;
  if (section.querySelector(`img[data-pdf-recovery-v347="${pageNumber}-${gapIndex}"]`)) return true;
  return false;
}

function pfrInsert(section, dataUrl, fileName, pageNumber, gap, gapIndex) {
  if (!dataUrl || pfrLooksLikeStartBanner(pageNumber, gap)) return null;
  const number = gap.labelNumber || pfrFigureNumber(`${gap.before} ${gap.afterContext || ""}`);
  if (pfrExisting(section, number, pageNumber, gapIndex)) return null;
  const insertion = pfrInsertion(section, gap, number);
  if (!insertion?.node) return null;

  const image = document.createElement("img");
  image.src = dataUrl;
  image.className = "apa-figure-image module-figure-image pdf-recovered-v347";
  image.dataset.pdfRecoveryV347 = `${pageNumber}-${gapIndex}`;
  image.dataset.pdfSourceFile = fileName;
  image.dataset.pdfSourcePage = String(pageNumber);
  image.dataset.apaLoadedDocumentImage = "true";

  if (number) {
    image.dataset.apaSourceFigureNumber = String(number);
    image.dataset.apaFigureNumber = String(number);
  }

  // If the PDF text layer does NOT contain a standalone Figura X label, the
  // source raster normally already contains Figura X + title + Nota. Preserve
  // that complete image and prevent the APA formatter from duplicating caption.
  if (number && !gap.standaloneLabel) {
    image.classList.add("apa-self-captioned-figure");
    image.dataset.apaSelfCaptioned = "true";
    image.dataset.figureIntegrated = "true";
    image.dataset.apaMediaRole = "self-captioned-figure";
    image.alt = `Figura ${number} del documento original con rótulo, título y nota integrados`;
  } else {
    image.dataset.apaMediaRole = "recovered-figure";
    image.alt = "Imagen del documento original";
  }

  if (insertion.mode === "after") insertion.node.after(image);
  else insertion.node.before(image);
  return image;
}

async function pfrRecoverFile(file, section) {
  const pdfjs = await pfrPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  let inserted = 0;
  let previousTail = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const { viewport, lines } = await pfrPageModel(page);
    const gaps = pfrCandidateGaps(lines, viewport.height, previousTail);
    if (gaps.length) {
      const rendered = await pfrRenderPage(page);
      for (let index = 0; index < gaps.length; index += 1) {
        const dataUrl = pfrCropGap(rendered, gaps[index]);
        if (pfrInsert(section, dataUrl, file.name, pageNumber, gaps[index], index)) inserted += 1;
      }
    }
    previousTail = lines.slice(-7).map((line) => line.text).join(" ");
  }
  return inserted;
}

function pfrAudit(inserted) {
  const preview = pfrQ("#preview");
  const list = pfrQ("#auditList");
  if (!preview || !list) return;
  list.querySelectorAll('[data-pdf-recovery-audit="v347"]').forEach((node) => node.remove());
  const figures = pfrQA("img.pdf-recovered-v347", preview).length;
  const selfCaptioned = pfrQA('img.pdf-recovered-v347[data-apa-self-captioned="true"]', preview).length;
  const li = document.createElement("li");
  li.dataset.pdfRecoveryAudit = "v347";
  li.className = figures ? "ok" : "warn";
  li.textContent = figures
    ? `Recuperación PDF v${PDF_FIGURE_RECOVERY_VERSION}: ${figures} figura(s) incorporada(s); ${selfCaptioned} conserva(n) rótulo/título/Nota integrados; banner inicial excluido.`
    : `Recuperación PDF v${PDF_FIGURE_RECOVERY_VERSION}: no se recuperaron figuras visuales; use + Insertar imagen solo como respaldo.`;
  list.append(li);
  if (inserted > 0) {
    preview.dispatchEvent(new Event("input", { bubbles: true }));
    const status = pfrQ("#status");
    if (status) {
      status.textContent = `PDF v${PDF_FIGURE_RECOVERY_VERSION}: ${inserted} figura(s) incorporada(s) desde el documento original.`;
      status.className = "status success";
    }
  }
}

async function pfrRun() {
  if (!pfrInstitutional()) return 0;
  const preview = pfrQ("#preview");
  const input = pfrQ("#files");
  if (!preview || !input || preview.querySelector(".placeholder")) return 0;
  const files = [...(input.files || [])].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!files.length) return 0;

  let inserted = 0;
  for (const file of files) {
    const section = pfrQA("section[data-source-file]", preview).find((node) => node.dataset.sourceFile === file.name);
    if (!section || section.dataset.pdfFigureRecoveryV347 === "true") continue;
    inserted += await pfrRecoverFile(file, section);
    section.dataset.pdfFigureRecoveryV347 = "true";
  }
  if (typeof window.applyApaFigureFormatting === "function") window.applyApaFigureFormatting(preview);
  if (typeof window.markModuleStartBanner === "function") window.markModuleStartBanner(preview);
  pfrAudit(inserted);
  return inserted;
}

function recoverPdfFiguresV347() {
  if (pfrRunPromise) return pfrRunPromise;
  pfrRunPromise = pfrRun().catch((error) => {
    console.error("PDF figure recovery v3.4.7", error);
    const status = pfrQ("#status");
    if (status) {
      status.textContent = `No se pudieron recuperar las figuras del PDF: ${error.message}`;
      status.className = "status error";
    }
    return 0;
  }).finally(() => { pfrRunPromise = null; });
  return pfrRunPromise;
}

let pfrTimer = null;
function pfrSchedule(delay = 1200) {
  clearTimeout(pfrTimer);
  pfrTimer = setTimeout(() => void recoverPdfFiguresV347(), delay);
}

function pfrInitialize() {
  const preview = pfrQ("#preview");
  pfrQ("#files")?.addEventListener("change", () => pfrSchedule(1200));
  pfrQ("#formatBtn")?.addEventListener("click", () => {
    pfrQA("section[data-source-file]", preview || document).forEach((section) => delete section.dataset.pdfFigureRecoveryV347);
    pfrSchedule(1400);
  });
  pfrQ("#reauditBtn")?.addEventListener("click", () => pfrSchedule(300));
}

window.recoverPdfFiguresV347 = recoverPdfFiguresV347;
window.PDF_FIGURE_RECOVERY_VERSION = PDF_FIGURE_RECOVERY_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pfrInitialize, { once: true });
else pfrInitialize();
