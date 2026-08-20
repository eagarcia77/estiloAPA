// APA7 Academic Formatter v3.4.2
// Excludes the module-start banner from the formatted result while preserving all academic figures.

const BANNER_EXCLUDE_VERSION = "3.4.2";
let bannerExcludeTimer = null;

const bxQ = (selector, root = document) => root.querySelector(selector);
const bxQA = (selector, root = document) => [...root.querySelectorAll(selector)];

function bxInstitutional() {
  return bxQ("#formatProfile")?.value === "modulo11c";
}

function bxIsBanner(img) {
  if (!img) return false;
  if (typeof window.isApaBannerImage === "function" && window.isApaBannerImage(img)) return true;
  return img.dataset.banner === "true" ||
    img.dataset.apaNonFigure === "true" ||
    img.dataset.apaNonfigure === "true" ||
    img.classList.contains("apa-cover-image") ||
    img.classList.contains("module-banner-image") ||
    img.classList.contains("module-banner");
}

function bxRemoveAdjacentGeneratedCaption(img) {
  const previous = img?.previousElementSibling;
  if (previous?.dataset?.apaGeneratedFigureCaption === "true") {
    const before = previous.previousElementSibling;
    previous.remove();
    if (before?.dataset?.apaGeneratedFigureCaption === "true") before.remove();
  }
  const next = img?.nextElementSibling;
  if (next?.dataset?.apaGeneratedFigureCaption === "true") next.remove();
}

function excludeModuleStartBanner(root = bxQ("#preview")) {
  if (!root || root.querySelector(".placeholder") || !bxInstitutional()) return 0;
  let removed = 0;
  for (const img of bxQA("img", root)) {
    if (!bxIsBanner(img)) continue;
    bxRemoveAdjacentGeneratedCaption(img);
    img.remove();
    removed += 1;
  }
  if (removed) root.dataset.apaExcludedStartBanners = String(removed);
  return removed;
}

function scheduleBannerExclusion(delay = 120) {
  clearTimeout(bannerExcludeTimer);
  bannerExcludeTimer = setTimeout(() => excludeModuleStartBanner(), delay);
}

function updateBannerExcludeUi() {
  const badge = bxQ(".badge");
  if (badge) {
    badge.textContent = `v${BANNER_EXCLUDE_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${BANNER_EXCLUDE_VERSION}`);
  }
  const help = bxQ("#previewHelp");
  if (help) help.innerHTML = "Seleccione texto o coloque el cursor en un párrafo y use la barra APA 7 para editar. <strong>Imágenes:</strong> las figuras académicas se conservan con formato APA 7; el banner inicial del módulo se excluye completamente de la vista formateada y de las exportaciones.";
}

const bxNativeAnchorClick = HTMLAnchorElement.prototype.click;
if (!HTMLAnchorElement.prototype.__apaV342DownloadName) {
  HTMLAnchorElement.prototype.click = function (...args) {
    if (/modulo-institucional-APA7-v3\.4\.1\.docx$/i.test(this.download || "")) {
      this.download = `modulo-institucional-APA7-v${BANNER_EXCLUDE_VERSION}.docx`;
    }
    return bxNativeAnchorClick.apply(this, args);
  };
  Object.defineProperty(HTMLAnchorElement.prototype, "__apaV342DownloadName", { value: true });
}

function initializeBannerExclusion() {
  updateBannerExcludeUi();
  const preview = bxQ("#preview");
  if (preview) {
    const observer = new MutationObserver(() => scheduleBannerExclusion(160));
    observer.observe(preview, { childList: true, subtree: true });
  }
  bxQ("#formatBtn")?.addEventListener("click", () => scheduleBannerExclusion(1050));
  bxQ("#reauditBtn")?.addEventListener("click", () => scheduleBannerExclusion(220));
  bxQ("#files")?.addEventListener("change", () => scheduleBannerExclusion(1050));
  scheduleBannerExclusion(850);
}

window.excludeModuleStartBanner = excludeModuleStartBanner;
window.BANNER_EXCLUDE_VERSION = BANNER_EXCLUDE_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeBannerExclusion, { once: true });
else initializeBannerExclusion();
