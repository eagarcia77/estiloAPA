// APA7 Academic Formatter v3.4.3
// Wraps the stable v3.4.1 DOCX exporter. The true module-start banner is
// removed only during export and restored immediately afterwards.

const DOCX_BANNER_SAFE_VERSION = "3.4.3";

const originalDocumentAddEventListener343 = document.addEventListener.bind(document);
document.addEventListener = function(type, listener, options) {
  const capture = options === true || (options && typeof options === "object" && options.capture === true);
  // Suppress only the capture-phase DOCX click handler registered by v3.4.1.
  if (type === "click" && capture) return;
  return originalDocumentAddEventListener343(type, listener, options);
};
try {
  await import("./docx-figure-export-v2.js");
} finally {
  document.addEventListener = originalDocumentAddEventListener343;
}

function dbQ(selector, root = document) { return root.querySelector(selector); }
function dbQA(selector, root = document) { return [...root.querySelectorAll(selector)]; }
function dbInstitutional() { return dbQ("#formatProfile")?.value === "modulo11c"; }

function dbTrueBanner(img) {
  if (typeof window.isTrueModuleStartBanner === "function") return window.isTrueModuleStartBanner(img);
  return img?.dataset?.apaMediaRole === "module-banner";
}

function detachTrueBanners(preview) {
  const records = [];
  for (const img of dbQA("img", preview)) {
    if (!dbTrueBanner(img)) continue;
    records.push({ img, parent: img.parentNode, next: img.nextSibling });
    img.remove();
  }
  return records;
}

function restoreTrueBanners(records) {
  for (const { img, parent, next } of records) {
    if (!parent) continue;
    if (next && next.parentNode === parent) parent.insertBefore(img, next);
    else parent.appendChild(img);
  }
  if (typeof window.markModuleStartBanner === "function") window.markModuleStartBanner();
}

async function exportDocxWithoutStartBanner343() {
  const preview = dbQ("#preview");
  if (!preview || !dbInstitutional()) return false;

  if (typeof window.applyApaFigureFormatting === "function") window.applyApaFigureFormatting(preview);
  if (typeof window.markModuleStartBanner === "function") window.markModuleStartBanner(preview);

  const banners = detachTrueBanners(preview);
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(...args) {
    if (/modulo-institucional-APA7-v3\.4\.1\.docx$/i.test(this.download || "")) {
      this.download = `modulo-institucional-APA7-v${DOCX_BANNER_SAFE_VERSION}.docx`;
    }
    return originalClick.apply(this, args);
  };

  try {
    const result = await window.buildApaDocxFigureV2();
    const status = dbQ("#status");
    if (status) {
      const figures = dbQA("img.apa-figure-image,img.module-figure-image", preview)
        .filter((img) => !dbTrueBanner(img)).length;
      status.textContent = `DOCX v${DOCX_BANNER_SAFE_VERSION} generado: banner inicial excluido y ${figures} figura(s) académica(s) conservada(s).`;
      status.className = "status success";
    }
    return result;
  } finally {
    HTMLAnchorElement.prototype.click = originalClick;
    restoreTrueBanners(banners);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadDocxBtn");
  if (!button || !dbInstitutional()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.disabled = true;
  void exportDocxWithoutStartBanner343()
    .catch((error) => {
      console.error("DOCX banner-safe v3.4.3", error);
      const status = dbQ("#status");
      if (status) {
        status.textContent = `No se pudo generar el DOCX: ${error.message}`;
        status.className = "status error";
      }
    })
    .finally(() => { button.disabled = false; });
}, true);

window.exportDocxWithoutStartBanner343 = exportDocxWithoutStartBanner343;
window.DOCX_BANNER_SAFE_VERSION = DOCX_BANNER_SAFE_VERSION;
