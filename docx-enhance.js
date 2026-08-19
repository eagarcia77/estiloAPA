const DOCX_ENHANCE_VERSION = "2.4";

async function waitDocx(timeoutMs = 12000) {
  const started = Date.now();
  while (!window.docx) {
    if (Date.now() - started > timeoutMs) throw new Error("No se pudo cargar la biblioteca DOCX.");
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return window.docx;
}

function dataUrlToBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl).split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dataUrlMime(dataUrl) {
  return /^data:image\/png/i.test(dataUrl) ? "png" : "jpg";
}

async function imageDimensions(src, maxWidth = 580, maxHeight = 650) {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      resolve({ width: Math.max(1, Math.round(image.naturalWidth * ratio)), height: Math.max(1, Math.round(image.naturalHeight * ratio)) });
    };
    image.onerror = () => reject(new Error("No se pudo leer una figura extraída del PDF."));
    image.src = src;
  });
}

function institutionalProfileEnabled() {
  return document.querySelector("#formatProfile")?.value === "modulo11c";
}

function inlineRuns(node, api, font, size, inherited = {}) {
  const { TextRun, ExternalHyperlink } = api;
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.nodeValue) return [];
    return [new TextRun({ text: node.nodeValue, font, size, bold: inherited.bold, italics: inherited.italics, underline: inherited.underline ? {} : undefined })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName;
  const style = { bold: inherited.bold || ["B", "STRONG"].includes(tag), italics: inherited.italics || ["I", "EM"].includes(tag), underline: inherited.underline || tag === "U" };
  if (tag === "BR") return [new TextRun({ break: 1, font, size })];
  if (tag === "A" && node.getAttribute("href") && ExternalHyperlink) {
    const text = node.textContent || node.getAttribute("href");
    return [new ExternalHyperlink({ link: node.getAttribute("href"), children: [new TextRun({ text, font, size, color: "0563C1", underline: {}, bold: style.bold, italics: style.italics })] })];
  }
  return [...node.childNodes].flatMap((child) => inlineRuns(child, api, font, size, style));
}

function paragraphFromElement(element, api, font, size, firstLineIndent, hangingReferences, institutional) {
  const { Paragraph, AlignmentType, TextRun } = api;
  const text = element.textContent.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const isRef = element.classList.contains("apa-reference");
  const isReferencesHeading = element.classList.contains("apa-references-heading") || element.classList.contains("references-heading");
  const isModuleHeading = institutional && element.classList.contains("module-heading") && !isReferencesHeading;
  const isModuleSubheading = institutional && element.classList.contains("module-subheading");
  const isModuleKeywords = institutional && element.classList.contains("module-keywords");
  const isTableLabel = institutional && element.classList.contains("module-table-label");
  const isTableTitle = institutional && element.classList.contains("module-table-title");
  const isLevel1 = !institutional && (element.classList.contains("level-1") || element.tagName === "H1");
  const isLevel2 = !institutional && (element.classList.contains("level-2") || element.tagName === "H2");
  const isLevel3 = !institutional && (element.classList.contains("level-3") || ["H3", "H4", "H5", "H6"].includes(element.tagName));
  const isFigureLabel = element.classList.contains("apa-figure-label");
  const isFigureTitle = element.classList.contains("apa-figure-title");
  const isNote = element.classList.contains("apa-note");
  const isHeading = isReferencesHeading || isModuleHeading || isLevel1 || isLevel2 || isLevel3;
  const runSize = isModuleHeading ? 28 : size;
  let runs = inlineRuns(element, api, font, runSize, { bold: isModuleKeywords });
  if (!runs.length) runs = [new TextRun({ text, font, size: runSize })];
  if (isModuleHeading) runs = [new TextRun({ text, font, size: 28, bold: true })];
  else if (isReferencesHeading) runs = [new TextRun({ text, font, size, bold: true })];
  else if (isLevel1 || isLevel2 || isLevel3) runs = [new TextRun({ text, font, size, bold: true, italics: isLevel3 })];
  else if (isModuleSubheading || isTableLabel) runs = [new TextRun({ text, font, size, bold: true })];
  else if (isFigureLabel) runs = [new TextRun({ text, font, size, bold: true })];
  else if (isFigureTitle || isTableTitle) runs = [new TextRun({ text, font, size, italics: true })];
  let alignment = AlignmentType.LEFT;
  if (isReferencesHeading || (!institutional && isLevel1)) alignment = AlignmentType.CENTER;
  const options = { children: runs, spacing: { line: 480, after: 0, before: isModuleHeading ? 120 : 0 }, alignment };
  if (isRef && hangingReferences) options.indent = { left: 720, hanging: 720 };
  else {
    const noIndent = isHeading || isModuleSubheading || isFigureLabel || isFigureTitle || isTableLabel || isTableTitle || isNote || element.classList.contains("no-indent");
    if (!noIndent && firstLineIndent) options.indent = { firstLine: 720 };
  }
  return new Paragraph(options);
}

function topLevelBlocks(preview) {
  const clone = preview.cloneNode(true);
  clone.removeAttribute("contenteditable");
  clone.querySelectorAll("hr.document-separator").forEach((node) => node.remove());
  const blocks = [];
  const visit = (parent) => {
    for (const child of [...parent.children]) {
      if (child.matches("section[data-source-file]")) visit(child);
      else blocks.push(child);
    }
  };
  visit(clone);
  return blocks;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function apaTableFromElement(element, api, font, size, institutional) {
  const { Table, TableRow, TableCell, Paragraph, WidthType, BorderStyle } = api;
  const none = { style: BorderStyle?.NONE || "none", size: 0, color: "FFFFFF" };
  const single = { style: BorderStyle?.SINGLE || "single", size: 8, color: "000000" };
  const domRows = [...element.querySelectorAll("tr")];
  const rows = domRows.map((row, rowIndex) => {
    const isFirst = rowIndex === 0;
    const isLast = rowIndex === domRows.length - 1;
    return new TableRow({ cantSplit: true, children: [...row.cells].map((cell) => new TableCell({ borders: institutional ? { top: isFirst ? single : none, bottom: (isFirst || isLast) ? single : none, left: none, right: none } : undefined, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: inlineRuns(cell, api, font, size, { bold: isFirst }), spacing: { line: 360, after: 0, before: 0 } })] })) });
  });
  return rows.length ? new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }) : null;
}

async function enhancedDocxExport() {
  const preview = document.querySelector("#preview");
  if (!preview) return false;
  const institutional = institutionalProfileEnabled();
  const hasFigures = Boolean(preview.querySelector("img.apa-figure-image"));
  if (!institutional && !hasFigures) return false;
  const api = await waitDocx();
  const { Document, Packer, Paragraph, TextRun, Header, PageNumber, AlignmentType, ImageRun } = api;
  const selectedFont = document.querySelector("#fontFamily")?.value || "Times New Roman";
  const font = institutional ? "Arial" : selectedFont;
  const sizes = { "Times New Roman": 24, Arial: 22, Calibri: 22, Georgia: 22 };
  const size = institutional ? 24 : (sizes[font] || 24);
  const firstLineIndent = document.querySelector("#firstLineIndent")?.checked !== false;
  const hangingReferences = document.querySelector("#hangingReferences")?.checked !== false;
  const addPageNumbers = document.querySelector("#pageNumbers")?.checked !== false;
  const children = [];
  for (const element of topLevelBlocks(preview)) {
    if (element.tagName === "IMG" && element.classList.contains("apa-figure-image")) {
      const src = element.getAttribute("src") || "";
      if (!src.startsWith("data:image/")) continue;
      const dimensions = await imageDimensions(src);
      const alt = element.getAttribute("alt") || "Figura extraída del PDF";
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: dataUrlToBytes(src), type: dataUrlMime(src), transformation: dimensions, altText: { title: alt, description: alt, name: alt } })], spacing: { line: 480, after: 0, before: 0 } }));
      continue;
    }
    if (["UL", "OL"].includes(element.tagName)) {
      for (const li of element.querySelectorAll(":scope > li")) {
        const text = li.textContent.replace(/\s+/g, " ").trim();
        if (!text) continue;
        children.push(new Paragraph({ children: inlineRuns(li, api, font, size), bullet: element.tagName === "UL" ? { level: 0 } : undefined, numbering: element.tagName === "OL" ? { reference: "apa-numbering-v24", level: 0 } : undefined, spacing: { line: 480, after: 0, before: 0 } }));
      }
      continue;
    }
    if (element.tagName === "TABLE") {
      const table = apaTableFromElement(element, api, font, size, institutional);
      if (table) children.push(table);
      continue;
    }
    const paragraph = paragraphFromElement(element, api, font, size, firstLineIndent, hangingReferences, institutional);
    if (paragraph) children.push(paragraph);
  }
  const headers = addPageNumbers ? { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font, size })] })] }) } : undefined;
  const doc = new Document({ numbering: { config: [{ reference: "apa-numbering-v24", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }] }] }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers, children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, institutional ? "modulo-institucional-APA7.docx" : "modulo-APA7-PDF-Smart.docx");
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = institutional ? `DOCX generado con perfil institucional Modulo11c v${DOCX_ENHANCE_VERSION}.` : `DOCX generado con PDF Smart v${DOCX_ENHANCE_VERSION}, incluyendo figuras y tablas detectadas.`;
    status.className = "status success";
  }
  return true;
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadDocxBtn");
  if (!button) return;
  const preview = document.querySelector("#preview");
  if (!preview) return;
  const shouldEnhance = institutionalProfileEnabled() || Boolean(preview.querySelector("img.apa-figure-image"));
  if (!shouldEnhance) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void enhancedDocxExport().catch((error) => {
    console.error("DOCX formatter", error);
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = `No se pudo generar el DOCX mejorado: ${error?.message || error}`;
      status.className = "status error";
    }
  });
}, true);
