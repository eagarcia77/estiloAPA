import "./docx-images-v346.js";
import "./source-images-v345.js";
import "./pdf-figure-recovery-v347.js";
import "./figure-apa.js";
import "./exclude-banner-v343.js";
import "./image-editor-v344.js";
import "./reference-format-v345.js";
import "./docx-banner-safe-v343.js";

const HTML_ENHANCE_VERSION = "3.4.7";

function institutionalHtmlProfileEnabled() {
  return document.querySelector("#formatProfile")?.value === "modulo11c";
}

function updateV347Ui() {
  const badge = document.querySelector(".badge");
  if (badge) {
    badge.textContent = `v${HTML_ENHANCE_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${HTML_ENHANCE_VERSION}`);
  }
  const footer = document.querySelector("footer p");
  if (footer) footer.textContent = `APA7 Academic Formatter v${HTML_ENHANCE_VERSION} · Imágenes DOCX/PDF incorporadas · Banner inicial excluido · Figuras APA 7 · Referencias APA 7.`;
  const help = document.querySelector("#previewHelp");
  if (help) help.innerHTML = "El documento permanece editable. <strong>v3.4.7:</strong> incorpora imágenes de DOCX y recupera figuras del PDF incluso cuando cada página llega como un solo párrafo con saltos de línea. Las figuras que ya contienen Figura X, título y Nota dentro de la imagen se conservan sin duplicar caption. El banner inicial se excluye.";
}

async function downloadInstitutionalHtml() {
  const preview = document.querySelector("#preview");
  if (!preview) return;

  if (typeof window.recoverPdfFiguresV347 === "function") await window.recoverPdfFiguresV347();
  if (typeof window.classifyEmbeddedImages === "function") window.classifyEmbeddedImages(preview);
  if (typeof window.applyApaFigureFormatting === "function") window.applyApaFigureFormatting(preview);
  if (typeof window.formatReferencesApa7 === "function") window.formatReferencesApa7(preview);
  if (typeof window.markModuleStartBanner === "function") window.markModuleStartBanner(preview);

  const clone = preview.cloneNode(true);
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("id");
  clone.querySelectorAll("hr.document-separator").forEach((node) => node.remove());
  clone.querySelectorAll("[data-missing-alt]").forEach((node) => node.removeAttribute("data-missing-alt"));
  clone.querySelectorAll('img[data-apa-media-role="module-banner"],img[data-apa-exclude-export="true"].apa-start-banner-excluded').forEach((node) => node.remove());
  clone.querySelectorAll(".apa-image-selected").forEach((node) => node.classList.remove("apa-image-selected"));

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Módulo institucional APA 7</title><style>
@page { size: letter; margin: 1in; } * { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 2; color: #000; background: #fff; }
section[data-source-file] { display: contents; } p { margin: 0; text-indent: .5in; }
.module-heading { text-align: left; font-size: 12pt; font-weight: 700; line-height: 2; margin: 1em 0 0; text-indent: 0; }
.references-heading,.apa-references-heading { text-align:center; font-size:12pt; font-weight:700; font-style:normal; line-height:2; text-indent:0; margin:1em 0 0; }
.module-subheading,.module-keywords,.module-lead,.no-indent { text-indent: 0; } .module-subheading,.module-keywords { font-weight: 700; }
ul,ol { margin: 0 0 .6em .45in; padding-left: .25in; } li { margin: 0; padding: 0; }
.apa-figure-label,.module-table-label { font-weight: 700; text-indent: 0; text-align:left; margin: .85em 0 0; }
.apa-figure-title,.module-table-title { font-style: italic; font-weight:400; text-indent: 0; text-align:left; margin: 0 0 .35em; }
img.apa-figure-image,.module-figure-image,img.apa-loaded-document-image,img.pdf-recovered-v347 { display:block; max-width:100%; width:auto; height:auto; margin:.35em auto; break-inside:avoid; page-break-inside:avoid; }
.apa-note,.apa-figure-note { text-indent:0; text-align:left; margin:.15em 0 .7em; }
table { width:100%; border-collapse:collapse; border-top:1px solid #000; border-bottom:1px solid #000; margin:.35em 0 .55em; break-inside:avoid; }
th,td { border:0; padding:.18em; vertical-align:top; line-height:1.55; } tr:first-child { border-bottom:1px solid #000; } th { font-weight:700; }
.apa-reference { font-family:Arial,Helvetica,sans-serif; font-size:12pt; line-height:2; text-align:left; padding-left:.5in; text-indent:-.5in; margin:0; }
.apa-reference a { color:#0563c1; text-decoration:underline; }
</style></head><body>${clone.innerHTML}</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "modulo-institucional-APA7-v3.4.7.html";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const status = document.querySelector("#status");
  if (status) {
    const figures = [...preview.querySelectorAll("img.apa-figure-image,img.module-figure-image")].filter((img) => img.dataset.apaMediaRole !== "module-banner").length;
    const recovered = [...preview.querySelectorAll("img.pdf-recovered-v347")].length;
    const selfCaptioned = [...preview.querySelectorAll('img.pdf-recovered-v347[data-apa-self-captioned="true"]')].length;
    const manual = [...preview.querySelectorAll('img[data-apa-manual-image="true"]')].length;
    const refs = [...preview.querySelectorAll(".apa-reference")].length;
    status.textContent = `HTML v${HTML_ENHANCE_VERSION}: ${figures} figura(s), ${recovered} recuperada(s) del PDF (${selfCaptioned} con caption integrado), ${manual} manuales; banner excluido; ${refs} referencia(s) APA 7.`;
    status.className = "status success";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadHtmlBtn");
  if (!button || !institutionalHtmlProfileEnabled()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.disabled = true;
  void downloadInstitutionalHtml()
    .catch((error) => {
      console.error("HTML v3.4.7", error);
      const status = document.querySelector("#status");
      if (status) {
        status.textContent = `No se pudo generar el HTML: ${error.message}`;
        status.className = "status error";
      }
    })
    .finally(() => { button.disabled = false; });
}, true);

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateV347Ui, { once: true });
else updateV347Ui();
