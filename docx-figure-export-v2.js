// APA7 Academic Formatter v3.4.1
// Stable DOCX export for the institutional module profile.
// Uses the CURRENT preview order; it never reorders figures, tables, lists or sections.

const DOCX_FIGURE_EXPORT_VERSION = "3.4.1";
const dxQ = (selector, root = document) => root.querySelector(selector);
const dxQA = (selector, root = document) => [...root.querySelectorAll(selector)];
const dxText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function dxInstitutional() {
  return dxQ("#formatProfile")?.value === "modulo11c";
}

async function dxWaitDocx() {
  for (let i = 0; i < 200 && !window.docx; i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  if (!window.docx) throw new Error("No se pudo cargar la biblioteca DOCX.");
  return window.docx;
}

function dxDataUrlBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl || "").split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dxDataUrlType(dataUrl) {
  return /^data:image\/png/i.test(dataUrl) ? "png" : "jpg";
}

async function dxImageDimensions(src, banner = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = banner ? 610 : 560;
      const maxHeight = banner ? 300 : 620;
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      resolve({ width: Math.max(1, Math.round(image.naturalWidth * scale)), height: Math.max(1, Math.round(image.naturalHeight * scale)) });
    };
    image.onerror = () => reject(new Error("No se pudo leer una imagen del documento."));
    image.src = src;
  });
}

function dxTopLevelBlocks(preview) {
  const clone = preview.cloneNode(true);
  clone.removeAttribute("contenteditable");
  clone.querySelectorAll("hr.document-separator").forEach((node) => node.remove());
  const blocks = [];
  const walk = (parent) => {
    for (const child of [...parent.children]) {
      if (child.matches("section[data-source-file]")) walk(child);
      else blocks.push(child);
    }
  };
  walk(clone);
  return blocks;
}

function dxInlineRuns(node, api, font, size, inherited = {}) {
  const { TextRun, ExternalHyperlink } = api;
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.nodeValue) return [];
    return [new TextRun({ text: node.nodeValue, font, size, bold: !!inherited.bold, italics: !!inherited.italics, underline: inherited.underline ? {} : undefined, color: "000000" })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName;
  const style = {
    bold: inherited.bold || tag === "B" || tag === "STRONG",
    italics: inherited.italics || tag === "I" || tag === "EM",
    underline: inherited.underline || tag === "U"
  };
  if (tag === "BR") return [new TextRun({ break: 1, font, size, color: "000000" })];
  if (tag === "A" && node.getAttribute("href") && ExternalHyperlink) {
    const href = node.getAttribute("href");
    return [new ExternalHyperlink({
      link: href,
      children: [new TextRun({ text: dxText(node.textContent) || href, font, size, color: "0563C1", underline: {}, bold: style.bold, italics: style.italics })]
    })];
  }
  return [...node.childNodes].flatMap((child) => dxInlineRuns(child, api, font, size, style));
}

function dxHeadingLevel(element) {
  const dataLevel = Number(element.dataset?.apaHeadingLevel || 0);
  if ([1, 2, 3, 4, 5].includes(dataLevel)) return dataLevel;
  if (element.classList.contains("apa-heading-level-1") || element.classList.contains("references-heading")) return 1;
  if (element.classList.contains("apa-heading-level-2") || element.classList.contains("topic-heading")) return 2;
  if (element.classList.contains("apa-heading-level-3") || element.classList.contains("module-subheading")) return 3;
  if (element.tagName === "H1") return 1;
  if (element.tagName === "H2") return 2;
  if (element.tagName === "H3") return 3;
  return 0;
}

function dxParagraph(element, api, font, size, firstLineIndent, hangingReferences) {
  const { Paragraph, AlignmentType, TextRun } = api;
  const text = dxText(element.textContent);
  if (!text) return null;

  const headingLevel = dxHeadingLevel(element);
  const isHeading = headingLevel > 0;
  const isReferencesHeading = /^Referencias$/i.test(text) || element.classList.contains("apa-references-heading") || element.classList.contains("references-heading");
  const isReference = element.classList.contains("apa-reference") || element.dataset.apaReference === "true";
  const isTableLabel = element.classList.contains("module-table-label") || element.classList.contains("apa-table-label");
  const isTableTitle = element.classList.contains("module-table-title") || element.classList.contains("apa-table-title");
  const isFigureLabel = element.classList.contains("apa-figure-label");
  const isFigureTitle = element.classList.contains("apa-figure-title");
  const isNote = element.classList.contains("apa-note") || element.classList.contains("apa-figure-note");

  let runs = dxInlineRuns(element, api, font, size);
  if (!runs.length) runs = [new TextRun({ text, font, size, color: "000000" })];
  if (isHeading) runs = [new TextRun({ text, font, size, bold: true, italics: [3, 5].includes(headingLevel), color: "000000" })];
  if (isTableLabel || isFigureLabel) runs = [new TextRun({ text, font, size, bold: true, color: "000000" })];
  if (isTableTitle || isFigureTitle) runs = [new TextRun({ text, font, size, italics: true, bold: false, color: "000000" })];

  let alignment = AlignmentType.LEFT;
  if (headingLevel === 1 || isReferencesHeading) alignment = AlignmentType.CENTER;

  const options = {
    children: runs,
    alignment,
    spacing: { line: 480, before: isHeading ? 120 : 0, after: 0 },
    keepNext: isHeading || isTableLabel || isTableTitle || isFigureLabel || isFigureTitle,
  };

  if (isReference && hangingReferences) options.indent = { left: 720, hanging: 720 };
  else {
    const noIndent = isHeading || isReferencesHeading || isTableLabel || isTableTitle || isFigureLabel || isFigureTitle || isNote || element.classList.contains("no-indent");
    if (!noIndent && firstLineIndent) options.indent = { firstLine: 720 };
  }
  return new Paragraph(options);
}

function dxLooksNumeric(value) {
  return /^[-+]?[$€£]?\s*\d[\d,.]*(?:\s*%|\s*[A-Za-z]{0,3})?$/.test(dxText(value));
}

function dxTable(element, api, font, size) {
  const { Table, TableRow, TableCell, Paragraph, WidthType, BorderStyle, AlignmentType } = api;
  const none = { style: BorderStyle?.NONE || "none", size: 0, color: "FFFFFF" };
  const rule = { style: BorderStyle?.SINGLE || "single", size: 8, color: "000000" };
  const domRows = dxQA("tr", element);
  if (!domRows.length) return null;

  const rows = domRows.map((row, rowIndex) => {
    const header = rowIndex === 0;
    const last = rowIndex === domRows.length - 1;
    return new TableRow({
      cantSplit: true,
      tableHeader: header,
      children: [...row.cells].map((cell, cellIndex) => {
        const value = dxText(cell.textContent);
        let alignment = AlignmentType.LEFT;
        if (header && cellIndex > 0) alignment = AlignmentType.CENTER;
        else if (!header && dxLooksNumeric(value)) alignment = AlignmentType.RIGHT;
        return new TableCell({
          borders: { top: header ? rule : none, bottom: (header || last) ? rule : none, left: none, right: none },
          margins: { top: 70, bottom: 70, left: 80, right: 80 },
          children: [new Paragraph({
            alignment,
            spacing: { line: 240, before: 0, after: 0 },
            children: dxInlineRuns(cell, api, font, 22, { bold: header })
          })]
        });
      })
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }
  });
}

function dxOrderedListConfig(reference, start = 1) {
  return {
    reference,
    levels: [{
      level: 0,
      format: "decimal",
      text: "%1.",
      alignment: "left",
      start: Number.isFinite(start) && start > 0 ? start : 1,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } }
    }]
  };
}

async function dxImageParagraph(element, api, font, size) {
  const { Paragraph, AlignmentType, ImageRun } = api;
  const src = element.getAttribute("src") || "";
  if (!src.startsWith("data:image/")) return null;
  const banner = typeof window.isApaBannerImage === "function"
    ? window.isApaBannerImage(element)
    : element.classList.contains("apa-cover-image") || element.classList.contains("module-banner-image");
  const dimensions = await dxImageDimensions(src, banner);
  const alt = dxText(element.getAttribute("alt")) || (banner ? "Banner del módulo" : "Figura académica");
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 480, before: 0, after: banner ? 120 : 0 },
    children: [new ImageRun({
      data: dxDataUrlBytes(src),
      type: dxDataUrlType(src),
      transformation: dimensions,
      altText: { title: alt, description: alt, name: alt }
    })]
  });
}

function dxDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function buildApaDocxFigureV2() {
  const preview = dxQ("#preview");
  if (!preview || !dxInstitutional()) return false;

  if (typeof window.applyApaFigureFormatting === "function") window.applyApaFigureFormatting(preview);
  if (typeof window.normalizeNumberedLists === "function") window.normalizeNumberedLists(preview);

  const api = await dxWaitDocx();
  const { Document, Packer, Paragraph, Header, PageNumber, TextRun, AlignmentType } = api;
  const font = "Arial";
  const size = 24;
  const firstLineIndent = dxQ("#firstLineIndent")?.checked !== false;
  const hangingReferences = dxQ("#hangingReferences")?.checked !== false;
  const addPageNumbers = dxQ("#pageNumbers")?.checked !== false;
  const children = [];
  const numberingConfigs = [];
  let listCounter = 0;

  for (const element of dxTopLevelBlocks(preview)) {
    if (element.tagName === "IMG") {
      const imageParagraph = await dxImageParagraph(element, api, font, size);
      if (imageParagraph) children.push(imageParagraph);
      continue;
    }

    if (element.tagName === "TABLE") {
      const table = dxTable(element, api, font, size);
      if (table) children.push(table);
      continue;
    }

    if (element.tagName === "OL" || element.tagName === "UL") {
      let numberingReference = null;
      if (element.tagName === "OL") {
        listCounter += 1;
        numberingReference = `apa-numbering-v341-${listCounter}`;
        const start = Number.parseInt(element.getAttribute("start") || "1", 10) || 1;
        numberingConfigs.push(dxOrderedListConfig(numberingReference, start));
      }
      for (const li of dxQA(":scope > li", element)) {
        const value = dxText(li.textContent);
        if (!value) continue;
        children.push(new Paragraph({
          children: dxInlineRuns(li, api, font, size),
          bullet: element.tagName === "UL" ? { level: 0 } : undefined,
          numbering: element.tagName === "OL" ? { reference: numberingReference, level: 0 } : undefined,
          spacing: { line: 480, before: 0, after: 0 }
        }));
      }
      continue;
    }

    const paragraph = dxParagraph(element, api, font, size, firstLineIndent, hangingReferences);
    if (paragraph) children.push(paragraph);
  }

  const headers = addPageNumbers ? {
    default: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT], font, size, color: "000000" })]
      })]
    })
  } : undefined;

  const doc = new Document({
    numbering: { config: numberingConfigs },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers,
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  dxDownload(blob, `modulo-institucional-APA7-v${DOCX_FIGURE_EXPORT_VERSION}.docx`);

  const status = dxQ("#status");
  if (status) {
    const banners = dxQA("img.apa-cover-image,img.module-banner-image", preview).length;
    const figures = dxQA("img.apa-figure-image,img.module-figure-image", preview).filter((img) => !(typeof window.isApaBannerImage === "function" && window.isApaBannerImage(img))).length;
    status.textContent = `DOCX v${DOCX_FIGURE_EXPORT_VERSION} generado sin reorganizar el módulo: ${banners} banner(s) y ${figures} figura(s) preservados con tratamiento APA 7.`;
    status.className = "status success";
  }
  return true;
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadDocxBtn");
  if (!button || !dxInstitutional()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  button.disabled = true;
  void buildApaDocxFigureV2()
    .catch((error) => {
      console.error("DOCX figure export v3.4.1", error);
      const status = dxQ("#status");
      if (status) {
        status.textContent = `No se pudo generar el DOCX: ${error.message}`;
        status.className = "status error";
      }
    })
    .finally(() => { button.disabled = false; });
}, true);

window.buildApaDocxFigureV2 = buildApaDocxFigureV2;
window.DOCX_FIGURE_EXPORT_VERSION = DOCX_FIGURE_EXPORT_VERSION;
