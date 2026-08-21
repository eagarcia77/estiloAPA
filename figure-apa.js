// APA7 Academic Formatter v3.4.5
// Formats figures without changing document order. Embedded DOCX images are
// normalized into top-level image blocks before captions are applied.

const FIGURE_APA_VERSION = "3.4.5";
let figureApaTimer = null;

const figureQ = (selector, root = document) => root.querySelector(selector);
const figureQA = (selector, root = document) => [...root.querySelectorAll(selector)];
const figureText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function figureModuleProfileEnabled() {
  return figureQ("#formatProfile")?.value === "modulo11c";
}

function isApaBannerImage(img) {
  if (!img) return false;
  if (img.dataset.apaMediaRole === "module-banner") return true;
  if (img.dataset.banner === "true") return true;
  if (img.dataset.apaNonFigure === "true" || img.dataset.apaNonfigure === "true") return true;
  if (img.classList.contains("apa-cover-image") || img.classList.contains("module-banner-image") || img.classList.contains("module-banner")) return true;

  const alt = figureText(img.getAttribute("alt")).toLowerCase();
  const title = figureText(img.getAttribute("title")).toLowerCase();
  const src = String(img.getAttribute("src") || "").toLowerCase();
  return alt.includes("banner") || title.includes("banner") || src.includes("banner");
}

function isIntegratedApaFigure(img) {
  if (!img) return false;
  if (img.dataset.apaSelfCaptioned === "true" || img.dataset.apaSelfcaptioned === "true") return true;
  if (img.dataset.figureIntegrated === "true" || img.dataset.integratedCaption === "true") return true;
  if (img.classList.contains("figure-integrated-caption")) return true;
  const alt = figureText(img.getAttribute("alt"));
  return /\b(?:figura|figure)\s+\d{1,3}\b/i.test(alt) && /(?:título|titulo|documento original|ecosistema|modelo|beneficio|producto|inteligencia|confianza|canal|sistema)/i.test(alt);
}

function wrapperOnlyContainsImage(wrapper, image) {
  if (!wrapper || !image) return false;
  for (const node of wrapper.childNodes) {
    if (node === image) continue;
    if (node.nodeType === Node.TEXT_NODE && !figureText(node.nodeValue)) continue;
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") continue;
    return false;
  }
  return true;
}

function normalizeFigureImageBlock(img) {
  const parent = img?.parentElement;
  if (!parent || !["P", "DIV", "FIGURE"].includes(parent.tagName)) return img;
  if (!wrapperOnlyContainsImage(parent, img)) return img;
  parent.replaceWith(img);
  return img;
}

function figureNumberFromImage(img) {
  const values = [
    img?.dataset?.apaSourceFigureNumber,
    img?.dataset?.apaFigureNumber,
    img?.dataset?.figureNumber,
    figureText(img?.getAttribute?.("alt")),
  ];
  for (const value of values) {
    const match = String(value || "").match(/(?:^|\b(?:figura|figure)?\s*)(\d{1,3})(?:\b|$)/i);
    const number = match ? Number(match[1]) : Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function nearbyMeaningful(node, direction = "previous") {
  let current = direction === "previous" ? node?.previousElementSibling : node?.nextElementSibling;
  while (current && !figureText(current.textContent) && current.tagName !== "IMG" && current.tagName !== "TABLE") {
    current = direction === "previous" ? current.previousElementSibling : current.nextElementSibling;
  }
  return current || null;
}

function existingCaptionForImage(img) {
  const previous = nearbyMeaningful(img, "previous");
  if (previous?.classList?.contains("apa-figure-title")) {
    const label = nearbyMeaningful(previous, "previous");
    if (label?.classList?.contains("apa-figure-label")) return { label, title: previous };
  }
  if (previous?.classList?.contains("apa-figure-label")) return { label: previous, title: null };
  return null;
}

function nextAvailableFigureNumber(root) {
  let max = 0;
  for (const label of figureQA(".apa-figure-label", root)) {
    const match = figureText(label.textContent).match(/\b(\d{1,3})\b/);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  for (const img of figureQA("img", root)) {
    if (isApaBannerImage(img)) continue;
    const number = figureNumberFromImage(img);
    if (number) max = Math.max(max, number);
  }
  return max + 1;
}

function descriptiveFigureTitle(img, number) {
  const explicit = figureText(img.dataset.figureTitle || img.getAttribute("data-title") || img.getAttribute("title"));
  if (explicit) return explicit.replace(/^Figura\s+\d+[:.\s-]*/i, "");

  const alt = figureText(img.getAttribute("alt"));
  if (alt && !/^Figura\s+\d+(?:\s+del documento original)?$/i.test(alt) && !/^Imagen(?:\s+del documento original)?$/i.test(alt) && !/^Imagen incorporada desde el documento original$/i.test(alt)) {
    return alt.replace(/^Figura\s+\d+[:.\s-]*/i, "");
  }
  return `Título de la figura ${number} [revisar]`;
}

function createFigureCaption(img, root) {
  if (existingCaptionForImage(img)) return;
  const number = figureNumberFromImage(img) || nextAvailableFigureNumber(root);
  img.dataset.apaFigureNumber = String(number);

  const label = document.createElement("p");
  label.className = "apa-figure-label no-indent";
  label.dataset.apaGeneratedFigureCaption = "true";
  label.textContent = `Figura ${number}`;

  const title = document.createElement("p");
  title.className = "apa-figure-title no-indent";
  title.dataset.apaGeneratedFigureCaption = "true";
  title.textContent = descriptiveFigureTitle(img, number);

  img.before(label, title);

  const noteValue = figureText(img.dataset.figureNote || img.getAttribute("data-note"));
  if (noteValue) {
    const note = document.createElement("p");
    note.className = "apa-note apa-figure-note no-indent";
    note.dataset.apaGeneratedFigureCaption = "true";
    note.innerHTML = `<em>Nota.</em> ${noteValue.replace(/^Nota\.\s*/i, "")}`;
    img.after(note);
  }
}

function applyApaFigureFormatting(root = figureQ("#preview")) {
  if (!root || root.querySelector(".placeholder") || !figureModuleProfileEnabled()) return;

  for (const originalImage of figureQA("img", root)) {
    const img = normalizeFigureImageBlock(originalImage);

    if (isApaBannerImage(img)) {
      img.classList.add("apa-cover-image", "module-banner-image");
      img.classList.remove("apa-figure-image", "module-figure-image");
      img.dataset.apaNonFigure = "true";
      continue;
    }

    img.classList.add("apa-figure-image", "module-figure-image");

    if (isIntegratedApaFigure(img)) {
      img.dataset.figureIntegrated = "true";
      img.dataset.apaSelfCaptioned = "true";
      continue;
    }

    createFigureCaption(img, root);
  }
}

function installFigureApaStyles() {
  if (figureQ("#figure-apa-v345-styles")) return;
  const style = document.createElement("style");
  style.id = "figure-apa-v345-styles";
  style.textContent = `
    .apa-paper .apa-figure-label{margin:.75em 0 0!important;text-indent:0!important;text-align:left!important;font-weight:700!important;font-style:normal!important;}
    .apa-paper .apa-figure-title{margin:0 0 .3em!important;text-indent:0!important;text-align:left!important;font-weight:400!important;font-style:italic!important;}
    .apa-paper img.apa-figure-image,.apa-paper img.module-figure-image{display:block!important;max-width:100%!important;width:auto!important;height:auto!important;margin:.3em auto .35em!important;break-inside:avoid!important;page-break-inside:avoid!important;}
    .apa-paper img.apa-cover-image,.apa-paper img.module-banner-image{display:block!important;max-width:100%!important;width:auto!important;height:auto!important;margin:.25em auto .65em!important;break-inside:avoid!important;page-break-inside:avoid!important;}
    .apa-paper .apa-figure-note{margin:.15em 0 .65em!important;text-indent:0!important;text-align:left!important;}
  `;
  document.head.append(style);
}

function scheduleApaFigureFormatting(delay = 120) {
  clearTimeout(figureApaTimer);
  figureApaTimer = setTimeout(() => applyApaFigureFormatting(), delay);
}

function updateFigurePatchUi() {
  const badge = figureQ(".badge");
  if (badge) {
    badge.textContent = `v${FIGURE_APA_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${FIGURE_APA_VERSION}`);
  }
}

function initializeFigureApa() {
  installFigureApaStyles();
  updateFigurePatchUi();
  const preview = figureQ("#preview");
  if (preview) {
    const observer = new MutationObserver(() => scheduleApaFigureFormatting(140));
    observer.observe(preview, { childList: true, subtree: true });
  }
  figureQ("#formatBtn")?.addEventListener("click", () => scheduleApaFigureFormatting(900));
  figureQ("#reauditBtn")?.addEventListener("click", () => scheduleApaFigureFormatting(180));
  figureQ("#files")?.addEventListener("change", () => scheduleApaFigureFormatting(900));
  scheduleApaFigureFormatting(700);
}

window.applyApaFigureFormatting = applyApaFigureFormatting;
window.isApaBannerImage = isApaBannerImage;
window.isIntegratedApaFigure = isIntegratedApaFigure;
window.FIGURE_APA_VERSION = FIGURE_APA_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeFigureApa, { once: true });
else initializeFigureApa();
