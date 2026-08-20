const APA_MEDIA_VERSION = "3.2";
let mediaNormalizing = false;
let mediaTimer = null;

function mediaRoot() {
  return document.querySelector("#preview");
}

function mediaText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripHeadingSemantics(element) {
  if (!element) return;
  const classes = [
    "apa-heading", "module-heading", "level-1", "level-2", "level-3", "level-4", "level-5",
    "apa-heading-level-1", "apa-heading-level-2", "apa-heading-level-3", "apa-heading-level-4", "apa-heading-level-5",
    "topic-heading", "module-subheading", "thesis-major-heading", "thesis-section-heading", "thesis-chapter-title"
  ];
  classes.forEach((name) => element.classList.remove(name));
  delete element.dataset.apaHeadingLevel;
  if (element.dataset.apaEditorStyle?.startsWith("h")) delete element.dataset.apaEditorStyle;
}

function isFigureLabelText(text) {
  return /^(Figura|Figure)\s+\d+[A-Za-z]?\s*\.?$/i.test(mediaText(text));
}

function isTableLabelText(text) {
  return /^(Tabla|Table)\s+\d+[A-Za-z]?\s*\.?$/i.test(mediaText(text));
}

function isGenericAlt(value) {
  const text = mediaText(value);
  if (!text) return true;
  return /^(image|imagen|picture|graphic|gr[aá]fico|figura|figure|drawing|photo|fotograf[ií]a)(\s*\d+)?$/i.test(text)
    || /^(figura|figure)\s+\d+\s+(del|of the)\s+(documento|document)/i.test(text)
    || /figura del m[oó]dulo acad[eé]mico/i.test(text);
}

function meaningfulPrevious(element) {
  let node = element?.previousElementSibling || null;
  while (node && !mediaText(node.textContent) && node.tagName !== "IMG" && node.tagName !== "TABLE") node = node.previousElementSibling;
  return node;
}

function meaningfulNext(element) {
  let node = element?.nextElementSibling || null;
  while (node && !mediaText(node.textContent) && node.tagName !== "IMG" && node.tagName !== "TABLE") node = node.nextElementSibling;
  return node;
}

function normalizeTableCaptions(root) {
  const tables = [...root.querySelectorAll("table")];
  tables.forEach((table, index) => {
    const number = index + 1;
    let previous = meaningfulPrevious(table);
    let title = null;
    let label = null;

    if (previous && (previous.classList.contains("apa-table-title") || previous.classList.contains("module-table-title") || previous.classList.contains("thesis-table-title"))) {
      title = previous;
      const maybeLabel = meaningfulPrevious(title);
      if (maybeLabel && isTableLabelText(maybeLabel.textContent)) label = maybeLabel;
    } else if (previous && isTableLabelText(previous.textContent)) {
      label = previous;
    } else if (previous && mediaText(previous.textContent).length <= 140) {
      const maybeLabel = meaningfulPrevious(previous);
      if (maybeLabel && isTableLabelText(maybeLabel.textContent)) {
        title = previous;
        label = maybeLabel;
      }
    }

    if (!label) {
      label = document.createElement("p");
      label.textContent = `Tabla ${number}`;
      table.before(label);
    }
    stripHeadingSemantics(label);
    label.classList.add("apa-table-label", "module-table-label", "thesis-table-label", "no-indent");
    label.style.textAlign = "left";
    label.style.fontWeight = "700";
    label.style.fontStyle = "normal";
    label.style.textIndent = "0";

    if (title) {
      stripHeadingSemantics(title);
      title.classList.add("apa-table-title", "module-table-title", "thesis-table-title", "no-indent");
      title.style.textAlign = "left";
      title.style.fontWeight = "400";
      title.style.fontStyle = "italic";
      title.style.textIndent = "0";
    }

    table.dataset.apaTableNumber = String(number);
  });
}

function hoistEmbeddedImages(root) {
  const images = [...root.querySelectorAll("img")];
  for (const image of images) {
    const parent = image.parentElement;
    if (!parent || parent === root || parent.matches("section[data-source-file]")) continue;

    if (parent.tagName === "P" && mediaText(parent.textContent) === "") {
      if (parent.querySelectorAll("img").length === 1) parent.replaceWith(image);
      else parent.before(image);
      continue;
    }

    const section = image.closest("section[data-source-file]") || root;
    let top = image;
    while (top.parentElement && top.parentElement !== section && top.parentElement !== root) top = top.parentElement;
    if (top !== image && !top.matches("p,h1,h2,h3,h4,h5,h6,li,table")) {
      top.after(image);
    }
  }
}

function normalizeFigures(root) {
  hoistEmbeddedImages(root);
  const images = [...root.querySelectorAll("img")];

  images.forEach((image, index) => {
    const number = index + 1;
    image.classList.add("apa-figure-image", "module-figure-image", "thesis-figure-image");
    image.dataset.apaFigureNumber = String(number);
    image.style.display = "block";
    image.style.maxWidth = "100%";
    image.style.height = "auto";
    image.style.margin = ".35em auto";

    let previous = meaningfulPrevious(image);
    let title = null;
    let label = null;

    if (previous && (previous.classList.contains("apa-figure-title") || previous.classList.contains("thesis-figure-title"))) {
      title = previous;
      const maybeLabel = meaningfulPrevious(title);
      if (maybeLabel && isFigureLabelText(maybeLabel.textContent)) label = maybeLabel;
    } else if (previous && isFigureLabelText(previous.textContent)) {
      label = previous;
    } else if (previous && mediaText(previous.textContent).length <= 160) {
      const maybeLabel = meaningfulPrevious(previous);
      if (maybeLabel && isFigureLabelText(maybeLabel.textContent)) {
        title = previous;
        label = maybeLabel;
      }
    }

    if (!label) {
      label = document.createElement("p");
      label.textContent = `Figura ${number}`;
      image.before(label);
    }
    stripHeadingSemantics(label);
    label.classList.add("apa-figure-label", "thesis-figure-label", "no-indent");
    label.style.textAlign = "left";
    label.style.fontWeight = "700";
    label.style.fontStyle = "normal";
    label.style.textIndent = "0";

    if (!title) {
      title = document.createElement("p");
      title.className = "apa-figure-title thesis-figure-title no-indent";
      if (!isGenericAlt(image.getAttribute("alt"))) {
        title.textContent = mediaText(image.getAttribute("alt"));
      } else {
        title.textContent = "Título de la figura [revisar]";
        title.dataset.apaTitlePlaceholder = "true";
      }
      label.after(title);
    }

    stripHeadingSemantics(title);
    title.classList.add("apa-figure-title", "thesis-figure-title", "no-indent");
    title.style.textAlign = "left";
    title.style.fontWeight = "400";
    title.style.fontStyle = "italic";
    title.style.textIndent = "0";

    if (!image.getAttribute("alt")?.trim()) {
      image.setAttribute("alt", `Figura ${number} del documento`);
      image.dataset.apaAltGenerated = "true";
    }

    const next = meaningfulNext(image);
    if (next && /^(Nota|Note)\.\s*/i.test(mediaText(next.textContent))) {
      stripHeadingSemantics(next);
      next.classList.add("apa-note", "thesis-note", "no-indent");
      next.style.textAlign = "left";
      next.style.textIndent = "0";
    }
  });
}

function mediaAudit() {
  const root = mediaRoot();
  const list = document.querySelector("#auditList");
  if (!root || !list || root.querySelector(".placeholder")) return;
  list.querySelectorAll("li[data-apa-media-audit]").forEach((node) => node.remove());

  normalizeMedia(root);
  const tables = [...root.querySelectorAll("table")];
  const figures = [...root.querySelectorAll("img.apa-figure-image")];
  const badTableTitles = tables.filter((table) => {
    const title = meaningfulPrevious(table);
    return !title || !title.classList.contains("apa-table-title") || getComputedStyle(title).textAlign !== "left" || getComputedStyle(title).fontStyle !== "italic" || Number.parseInt(getComputedStyle(title).fontWeight, 10) >= 600;
  });
  const placeholderTitles = figures.filter((image) => meaningfulPrevious(image)?.dataset.apaTitlePlaceholder === "true");
  const generatedAlt = figures.filter((image) => image.dataset.apaAltGenerated === "true");

  const tableItem = document.createElement("li");
  tableItem.dataset.apaMediaAudit = "table";
  tableItem.className = badTableTitles.length ? "warn" : "ok";
  tableItem.textContent = badTableTitles.length
    ? `Tablas APA 7 v${APA_MEDIA_VERSION}: ${badTableTitles.length} título(s) requieren revisión; deben ir a la izquierda, en cursiva y sin negrita.`
    : `Tablas APA 7 v${APA_MEDIA_VERSION}: títulos de tabla alineados a la izquierda, en cursiva y sin negrita.`;
  list.append(tableItem);

  if (figures.length) {
    const figureItem = document.createElement("li");
    figureItem.dataset.apaMediaAudit = "figure";
    figureItem.className = placeholderTitles.length || generatedAlt.length ? "warn" : "ok";
    figureItem.textContent = placeholderTitles.length || generatedAlt.length
      ? `Figuras APA 7 v${APA_MEDIA_VERSION}: ${figures.length} imagen(es) conservada(s); ${placeholderTitles.length} título(s) y ${generatedAlt.length} texto(s) alternativo(s) requieren revisión.`
      : `Figuras APA 7 v${APA_MEDIA_VERSION}: ${figures.length} imagen(es) conservada(s) con número, título y texto alternativo; las notas existentes se preservan.`;
    list.append(figureItem);
  }
}

function normalizeMedia(root = mediaRoot()) {
  if (!root || root.querySelector(".placeholder") || mediaNormalizing) return;
  mediaNormalizing = true;
  try {
    normalizeTableCaptions(root);
    normalizeFigures(root);
  } finally {
    mediaNormalizing = false;
  }
}

window.normalizeApaMedia = normalizeMedia;

function scheduleMediaNormalization() {
  clearTimeout(mediaTimer);
  mediaTimer = setTimeout(() => normalizeMedia(), 100);
}

function addMediaStyles() {
  if (document.querySelector("#apa-media-v32-styles")) return;
  const style = document.createElement("style");
  style.id = "apa-media-v32-styles";
  style.textContent = `
    .apa-paper .apa-table-title,
    .apa-paper .module-table-title,
    .apa-paper .thesis-table-title {
      text-align:left !important;
      font-weight:400 !important;
      font-style:italic !important;
      text-indent:0 !important;
    }
    .apa-paper .apa-table-label,
    .apa-paper .module-table-label,
    .apa-paper .thesis-table-label,
    .apa-paper .apa-figure-label,
    .apa-paper .thesis-figure-label {
      text-align:left !important;
      font-weight:700 !important;
      font-style:normal !important;
      text-indent:0 !important;
    }
    .apa-paper .apa-figure-title,
    .apa-paper .thesis-figure-title {
      text-align:left !important;
      font-weight:400 !important;
      font-style:italic !important;
      text-indent:0 !important;
    }
    .apa-paper img.apa-figure-image {
      display:block !important;
      max-width:100% !important;
      height:auto !important;
      margin:.35em auto !important;
    }
    .apa-paper [data-apa-title-placeholder="true"] {
      text-decoration: underline dotted;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
  `;
  document.head.append(style);
}

function initializeMediaNormalizer() {
  addMediaStyles();
  const root = mediaRoot();
  if (!root) return;
  new MutationObserver(scheduleMediaNormalization).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  root.addEventListener("input", scheduleMediaNormalization);
  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(mediaAudit, 120));
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#downloadDocxBtn,#downloadHtmlBtn")) normalizeMedia();
  }, true);
  setTimeout(() => { normalizeMedia(); mediaAudit(); }, 300);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeMediaNormalizer);
else initializeMediaNormalizer();