// APA7 Academic Formatter v3.4.6
// Deterministic DOCX image import. Installs Mammoth convertImage before the
// main app handles the Format click, so embedded Word images are present in
// the HTML from the first conversion pass.

const DOCX_IMAGES_VERSION = "3.4.6";
let docxImageAttempts = 0;

function installDocxImageImportV346() {
  const mammoth = window.mammoth;
  if (!mammoth?.convertToHtml || !mammoth?.images?.imgElement) return false;
  if (window.MAMMOTH_DOCX_IMAGES_V346 === true) return true;

  const originalConvertToHtml = mammoth.convertToHtml.bind(mammoth);
  mammoth.convertToHtml = function(input, options = {}) {
    const convertImage = mammoth.images.imgElement(async (image) => {
      const base64 = await image.read("base64");
      const contentType = image.contentType || "image/png";
      return {
        src: `data:${contentType};base64,${base64}`,
        alt: "Imagen del documento original"
      };
    });
    return originalConvertToHtml(input, { ...options, convertImage });
  };

  window.MAMMOTH_DOCX_IMAGES_V346 = true;
  return true;
}

function retryDocxImageInstall() {
  if (installDocxImageImportV346()) return;
  docxImageAttempts += 1;
  if (docxImageAttempts < 100) setTimeout(retryDocxImageInstall, 100);
}

// Capture phase guarantees this runs before app.js's normal click handler.
document.addEventListener("click", (event) => {
  if (!event.target?.closest?.("#formatBtn")) return;
  installDocxImageImportV346();
}, true);

document.addEventListener("change", (event) => {
  if (event.target?.id !== "files") return;
  installDocxImageImportV346();
}, true);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", retryDocxImageInstall, { once: true });
} else {
  retryDocxImageInstall();
}

window.installDocxImageImportV346 = installDocxImageImportV346;
window.DOCX_IMAGES_VERSION = DOCX_IMAGES_VERSION;
