const THESIS_HTML_VERSION = "2.7";

function thesisHtmlEnabled() {
  return ["thesis-doctoral", "thesis-masters"].includes(document.querySelector("#formatProfile")?.value || "");
}

function thesisHtmlClone() {
  const preview = document.querySelector("#preview");
  const clone = preview.cloneNode(true);
  clone.removeAttribute("id");
  clone.removeAttribute("contenteditable");
  clone.querySelectorAll("hr.document-separator").forEach((node) => node.remove());
  return clone;
}

function thesisHtmlDownload() {
  const clone = thesisHtmlClone();
  const degree = document.querySelector("#formatProfile")?.value === "thesis-doctoral" ? "Disertación doctoral" : "Tesis de maestría";
  const mode = document.querySelector("#preview")?.dataset?.thesisStructureMode || "";
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${degree} — formato institucional</title>
<style>
@page { size: letter; margin: 1in 1in 1in 1.5in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 2; color: #000; }
section[data-source-file] { display: contents; }
p { margin: 0; text-indent: .5in; }
.no-indent,.thesis-cover-block,.thesis-major-heading,.thesis-section-heading,.thesis-chapter-title,.apa-reference,.thesis-reference,.thesis-note,.apa-note,.thesis-table-label,.thesis-table-title,.thesis-figure-label,.thesis-figure-title { text-indent: 0 !important; }
.thesis-cover-block { text-align: center; }
.thesis-major-heading,.thesis-chapter-title,.thesis-references-heading { text-align: center; font-weight: 700; }
.thesis-section-heading { text-align: left; font-weight: 700; }
.thesis-page-start { break-before: page; page-break-before: always; }
.apa-reference,.thesis-reference { padding-left: .5in; text-indent: -.5in !important; }
.thesis-table-label,.thesis-figure-label { font-weight: 700; }
.thesis-table-title,.thesis-figure-title { font-style: italic; }
img { display: block; max-width: 100%; height: auto; margin: .25em auto; }
table { width: 100%; border-collapse: collapse; margin: .25em 0; line-height: 1.2; }
th,td { border: 0; padding: .2em .3em; vertical-align: top; }
tr:first-child th,tr:first-child td { border-top: 1.25px solid #000; border-bottom: 1px solid #000; font-weight: 700; }
tr:last-child th,tr:last-child td { border-bottom: 1.25px solid #000; }
a { color: inherit; text-decoration: underline; }
</style></head><body>${clone.innerHTML}</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = document.querySelector("#formatProfile")?.value === "thesis-doctoral" ? "disertacion-doctoral-formateada.html" : "tesis-maestria-formateada.html";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const status = document.querySelector("#status");
  if (status) {
    const extra = mode === "module-like" ? " Se detectó contenido de módulo; no se interpretó como preliminares de tesis." : "";
    status.textContent = `${degree} exportada en HTML con perfil institucional v${THESIS_HTML_VERSION}.${extra}`;
    status.className = mode === "module-like" ? "status error" : "status success";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadHtmlBtn");
  if (!button || !thesisHtmlEnabled()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  thesisHtmlDownload();
}, true);