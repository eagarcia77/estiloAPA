// APA7 Academic Formatter v3.4.5
// Preserves images embedded in loaded DOCX/HTML content without changing source order.
// PDF images continue to be handled by the stable v3.4 PDF media engine.

const SOURCE_IMAGES_VERSION = "3.4.5";
let sourceImageTimer = null;
let mammothImagePatchInstalled = false;

const siQ = (selector, root = document) => root.querySelector(selector);
const siQA = (selector, root = document) => [...root.querySelectorAll(selector)];
const siText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function siInstitutional() {
  return siQ("#formatProfile")?.value === "modulo11c";
}

function installMammothImagePreservation() {
  if (mammothImagePatchInstalled) return true;
  const mammoth = window.mammoth;
  if (!mammoth?.convertToHtml || !mammoth?.images?.imgElement) return false;

  const originalConvertToHtml = mammoth.convertToHtml.bind(mammoth);
  mammoth.convertToHtml = function(input, options = {}) {
    const nextOptions = { ...options };
    if (!nextOptions.convertImage) {
      nextOptions.convertImage = mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        const contentType = image.contentType || "image/png";
        return {
          src: `data:${contentType};base64,${base64}`,
          alt: "Imagen incorporada desde el documento original"
        };
      });
    }
    return originalConvertToHtml(input, nextOptions);
  };

  mammothImagePatchInstalled = true;
  window.MAMMOTH_APA_IMAGE_PATCH = SOURCE_IMAGES_VERSION;
  return true;
}

function nodeComesBefore(a, b) {
  if (!a || !b || a === b) return false;
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function removeGeneratedCaptionAround(image) {
  let previous = image?.previousElementSibling;
  if (previous?.dataset?.apaGeneratedFigureCaption === "true") {
    const before = previous.previousElementSibling;
    previous.remove();
    if (before?.dataset?.apaGeneratedFigureCaption === "true") before.remove();
  }
  const next = image?.nextElementSibling;
  if (next?.dataset?.apaGeneratedFigureCaption === "true") next.remove();
}

function sectionIntroHeading(section) {
  return siQA("h1,h2,h3,h4,h5,h6,p", section).find((node) => /^Introducci[oó]n$/i.test(siText(node.textContent))) || null;
}

function classifyEmbeddedImages(root = siQ("#preview")) {
  if (!root || root.querySelector(".placeholder") || !siInstitutional()) return { embedded: 0, figures: 0, banners: 0 };

  let embedded = 0;
  let figures = 0;
  let banners = 0;
  const sections = siQA("section[data-source-file]", root);
  const containers = sections.length ? sections : [root];

  for (const section of containers) {
    const images = siQA("img", section);
    if (!images.length) continue;
    const intro = sectionIntroHeading(section);

    images.forEach((image, index) => {
      // Leave the stable PDF v3.4 media engine in full control of PDF-recovered media.
      if (image.dataset.pdfOriginalMediaV34 || image.dataset.pdfSourcePage) return;

      embedded += 1;
      image.dataset.apaLoadedDocumentImage = "true";

      // Only the first source image before Introducción can be the module-start banner.
      const startBanner = index === 0 && intro && nodeComesBefore(image, intro);
      if (startBanner) {
        removeGeneratedCaptionAround(image);
        image.dataset.apaMediaRole = "module-banner";
        image.dataset.apaExcludeExport = "true";
        image.dataset.apaNonFigure = "true";
        image.classList.add("apa-cover-image", "module-banner-image", "apa-start-banner-excluded");
        image.classList.remove("apa-figure-image", "module-figure-image");
        image.alt = image.alt?.trim() || "Banner inicial del módulo — excluido de la exportación";
        banners += 1;
        return;
      }

      delete image.dataset.apaNonFigure;
      delete image.dataset.apaExcludeExport;
      image.classList.remove("apa-cover-image", "module-banner-image", "apa-start-banner-excluded");
      image.classList.add("apa-figure-image", "module-figure-image", "apa-loaded-document-image");
      image.dataset.apaMediaRole = image.dataset.apaMediaRole === "module-banner" ? "source-document-image" : (image.dataset.apaMediaRole || "source-document-image");
      image.alt = image.alt?.trim() || "Figura incorporada desde el documento original";
      figures += 1;
    });
  }

  root.dataset.apaLoadedDocumentImages = String(embedded);
  root.dataset.apaLoadedAcademicImages = String(figures);
  return { embedded, figures, banners };
}

function installSourceImageStyles() {
  if (siQ("#source-images-v345-style")) return;
  const style = document.createElement("style");
  style.id = "source-images-v345-style";
  style.textContent = `
    .apa-paper img.apa-loaded-document-image {
      display:block !important;
      max-width:100% !important;
      width:auto !important;
      height:auto !important;
      margin:.35em auto .5em !important;
      break-inside:avoid !important;
      page-break-inside:avoid !important;
    }
  `;
  document.head.append(style);
}

function scheduleSourceImages(delay = 140) {
  clearTimeout(sourceImageTimer);
  sourceImageTimer = setTimeout(() => {
    const summary = classifyEmbeddedImages();
    if (summary.figures && typeof window.applyApaFigureFormatting === "function") {
      window.applyApaFigureFormatting(siQ("#preview"));
    }
  }, delay);
}

function updateSourceImageUi() {
  const badge = siQ(".badge");
  if (badge) {
    badge.textContent = `v${SOURCE_IMAGES_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${SOURCE_IMAGES_VERSION}`);
  }
  const help = siQ("#previewHelp");
  if (help) {
    help.innerHTML = "El documento permanece editable. <strong>Imágenes:</strong> se incorporan las imágenes incrustadas del documento cargado y las figuras recuperadas del PDF; solo el banner inicial se excluye. También puede usar <strong>+ Insertar imagen</strong> para añadir o reemplazar una figura manualmente.";
  }
}

function initializeSourceImages() {
  installSourceImageStyles();
  updateSourceImageUi();

  if (!installMammothImagePreservation()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installMammothImagePreservation() || attempts >= 80) clearInterval(timer);
    }, 100);
  }

  const preview = siQ("#preview");
  if (preview) {
    new MutationObserver(() => scheduleSourceImages(160)).observe(preview, { childList: true, subtree: true });
  }

  siQ("#formatBtn")?.addEventListener("click", () => scheduleSourceImages(1050));
  siQ("#files")?.addEventListener("change", () => scheduleSourceImages(1100));
  siQ("#reauditBtn")?.addEventListener("click", () => scheduleSourceImages(180));
  scheduleSourceImages(800);
}

window.classifyEmbeddedImages = classifyEmbeddedImages;
window.installMammothImagePreservation = installMammothImagePreservation;
window.SOURCE_IMAGES_VERSION = SOURCE_IMAGES_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeSourceImages, { once: true });
else initializeSourceImages();
