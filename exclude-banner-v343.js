// APA7 Academic Formatter v3.4.3
// Keeps the start banner in the DOM for the v3.4 PDF media engine, but hides it
// from the formatted preview and marks it for exclusion from exports.

const BANNER_EXCLUDE_VERSION = "3.4.3";
let bannerExcludeTimer = null;

const bxQ = (selector, root = document) => root.querySelector(selector);
const bxQA = (selector, root = document) => [...root.querySelectorAll(selector)];

function bxInstitutional() {
  return bxQ("#formatProfile")?.value === "modulo11c";
}

// IMPORTANT: This is deliberately stricter than the generic figure/banner
// classifier. Only the actual module-start banner recovered by the v3.4 media
// engine is excluded. Academic figures must never be filtered here.
function bxIsTrueStartBanner(img) {
  if (!img) return false;
  if (img.dataset.apaMediaRole === "module-banner") return true;
  const page = Number(img.dataset.pdfSourcePage || 0);
  const original = Boolean(img.dataset.pdfOriginalMediaV34);
  const bannerClass = img.classList.contains("module-banner-image") || img.classList.contains("apa-cover-image");
  return page === 1 && original && bannerClass;
}

function markModuleStartBanner(root = bxQ("#preview")) {
  if (!root || root.querySelector(".placeholder") || !bxInstitutional()) return 0;
  let marked = 0;

  for (const img of bxQA("img", root)) {
    if (!bxIsTrueStartBanner(img)) {
      // Never leave the export-exclusion marker on an academic figure.
      if (img.dataset.apaMediaRole !== "module-banner") {
        delete img.dataset.apaExcludeExport;
        img.classList.remove("apa-start-banner-excluded");
      }
      continue;
    }
    img.dataset.apaExcludeExport = "true";
    img.classList.add("apa-start-banner-excluded");
    marked += 1;
  }

  root.dataset.apaExcludedStartBanners = String(marked);
  return marked;
}

function installBannerExcludeStyle() {
  if (bxQ("#apa-banner-exclude-v343-style")) return;
  const style = document.createElement("style");
  style.id = "apa-banner-exclude-v343-style";
  style.textContent = `
    .apa-paper img.apa-start-banner-excluded,
    .apa-paper img[data-apa-media-role="module-banner"][data-apa-exclude-export="true"] {
      display:none !important;
    }
  `;
  document.head.append(style);
}

function scheduleBannerMark(delay = 120) {
  clearTimeout(bannerExcludeTimer);
  bannerExcludeTimer = setTimeout(() => markModuleStartBanner(), delay);
}

function updateBannerExcludeUi() {
  const badge = bxQ(".badge");
  if (badge) {
    badge.textContent = `v${BANNER_EXCLUDE_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${BANNER_EXCLUDE_VERSION}`);
  }
  const help = bxQ("#previewHelp");
  if (help) help.innerHTML = "Seleccione texto o coloque el cursor en un párrafo y use la barra APA 7 para editar. <strong>Imágenes:</strong> se conservan las figuras académicas del PDF con tratamiento APA 7. Solo el banner inicial real de la página 1 se oculta y se excluye de las exportaciones.";
}

function initializeBannerExclusion() {
  installBannerExcludeStyle();
  updateBannerExcludeUi();
  const preview = bxQ("#preview");
  if (preview) {
    const observer = new MutationObserver(() => scheduleBannerMark(180));
    observer.observe(preview, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-apa-media-role"] });
  }
  bxQ("#formatBtn")?.addEventListener("click", () => scheduleBannerMark(1150));
  bxQ("#reauditBtn")?.addEventListener("click", () => scheduleBannerMark(240));
  bxQ("#files")?.addEventListener("change", () => scheduleBannerMark(1150));
  scheduleBannerMark(900);
}

window.markModuleStartBanner = markModuleStartBanner;
window.isTrueModuleStartBanner = bxIsTrueStartBanner;
window.BANNER_EXCLUDE_VERSION = BANNER_EXCLUDE_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeBannerExclusion, { once: true });
else initializeBannerExclusion();
