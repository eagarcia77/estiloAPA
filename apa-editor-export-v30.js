const APA_EDITOR_EXPORT_VERSION = "3.0";

function exportProfile() {
  return document.querySelector("#formatProfile")?.value || "";
}

function wrapWholeBlock(block, { bold = false, italic = false } = {}) {
  if (!block || block.querySelector("strong,b,em,i,a")) return;
  let html = block.innerHTML;
  if (italic) html = `<em>${html}</em>`;
  if (bold) html = `<strong>${html}</strong>`;
  block.innerHTML = html;
}

function synchronizeApaEditorForExport() {
  const root = document.querySelector("#preview");
  if (!root) return;
  const thesis = ["thesis-doctoral", "thesis-masters"].includes(exportProfile());

  root.querySelectorAll("[data-apa-editor-style]").forEach((block) => {
    const style = block.dataset.apaEditorStyle;
    const align = block.dataset.apaEditorAlign;
    const indent = block.dataset.apaEditorIndent;
    const line = block.dataset.apaEditorLine;

    if (align) block.style.textAlign = align;
    if (line) block.style.lineHeight = line;
    if (indent === "first") {
      block.style.paddingLeft = "";
      block.style.textIndent = ".5in";
    } else if (indent === "hanging") {
      block.style.paddingLeft = ".5in";
      block.style.textIndent = "-.5in";
    } else if (indent === "none") {
      block.style.paddingLeft = "";
      block.style.textIndent = "0";
    }

    if (style === "h1") {
      block.classList.add("apa-heading-level-1", "level-1", "no-indent");
      block.dataset.apaHeadingLevel = "1";
      if (thesis) block.classList.add("thesis-major-heading");
    } else if (style === "h2") {
      block.classList.add("apa-heading-level-2", "level-2", "no-indent");
      block.dataset.apaHeadingLevel = "2";
      if (thesis) {
        block.classList.remove("thesis-section-heading");
        wrapWholeBlock(block, { bold: true });
      }
    } else if (style === "h3") {
      block.classList.add("apa-heading-level-3", "level-3", "no-indent");
      block.dataset.apaHeadingLevel = "3";
      if (thesis) {
        block.classList.remove("thesis-section-heading");
        wrapWholeBlock(block, { bold: true, italic: true });
      }
    } else if (style === "h4") {
      block.classList.add("apa-heading-level-4");
      block.dataset.apaHeadingLevel = "4";
      block.classList.remove("no-indent");
      if (thesis) wrapWholeBlock(block, { bold: true });
    } else if (style === "h5") {
      block.classList.add("apa-heading-level-5");
      block.dataset.apaHeadingLevel = "5";
      block.classList.remove("no-indent");
      if (thesis) wrapWholeBlock(block, { bold: true, italic: true });
    } else if (style === "reference") {
      block.classList.add("apa-reference", "thesis-reference", "no-indent");
    } else if (style === "table-label") {
      block.classList.add("apa-table-label", "module-table-label", "thesis-table-label", "no-indent");
    } else if (style === "table-title") {
      block.classList.add("apa-table-title", "module-table-title", "thesis-table-title", "no-indent");
    } else if (style === "figure-label") {
      block.classList.add("apa-figure-label", "thesis-figure-label", "no-indent");
    } else if (style === "figure-title") {
      block.classList.add("apa-figure-title", "thesis-figure-title", "no-indent");
    } else if (style === "note") {
      block.classList.add("apa-note", "thesis-note", "no-indent");
    }
  });
}

document.addEventListener("click", (event) => {
  if (event.target?.closest?.("#downloadDocxBtn,#downloadHtmlBtn")) synchronizeApaEditorForExport();
}, true);
