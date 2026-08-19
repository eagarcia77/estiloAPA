const DOCX_ENHANCE_VERSION = "2.3";

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

function inlineRuns(node, api, font, size, inherited = {}) {
  const { TextRun } = api;
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.nodeValue) return [];
    return [new TextRun({ text: node.nodeValue, font, size, bold: inherited.bold, italics: inherited.italics, underline: inherited.underline ? {} : undefined })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName;
  const style = { bold: inherited.bold || ["B", "STRONG"].includes(tag), italics: inherited.italics || ["I", "EM"].includes(tag), underline: inherited.underline || tag === "U" };
  if (tag === "BR") return [new TextRun({ break: 1, font, size })];
  return [...node.childNodes].flatMap((child) => inlineRuns(child, api, font, size, style));
}

function paragraphFromElement(element, api, font, size, firstLineIndent, hangingReferences) {
  const { Paragraph, AlignmentType, TextRun } = api;
  const text = element.textContent.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const isRef = element.classList.contains("apa-reference");
  const isLevel1 = element.classList.contains("level-1") || element.tagName === "H1";
  const isLevel2 = element.classList.contains("level-2") || element.tagName === "H2";
  const isLevel3 = element.classList.contains("level-3") || ["H3", "H4", "H5", "H6"].includes(element.tagName);
  const isFigureLabel = element.classList.contains("apa-figure-label");
  const isFigureTitle = element.classList.contains("apa-figure-title");
  const isNote = element.classList.contains("apa-note");
  const isHeading = isLevel1 || isLevel2 || isLevel3;
  let runs = inlineRuns(element, api, font, size);
  if (!runs.length) runs = [new TextRun({ text, font, size })];
  if (isHeading) runs = [new TextRun({ text, font, size, bold: true, italics: isLevel3 })];
  else if (isFigureLabel) runs = [new TextRun({ text, font, size, bold: true })];
  else if (isFigureTitle) runs = [new TextRun({ text, font, size, italics: true })];
  const options = { children: runs, spacing: { line: 480, after: 0, before: 0 }, alignment: isLevel1 ? AlignmentType.CENTER : AlignmentType.LEFT };
  if (isRef && hangingReferences) options.indent = { left: 720, hanging: 720 };
  else if (!isRef && !isHeading && !isFigureLabel && !isFigureTitle && !isNote && firstLineIndent) options.indent = { firstLine: 720 };
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

async function enhancedPdfDocxExport() {
  const preview = document.querySelector("#preview");
  if (!preview?.querySelector("img.apa-figure-image")) return false;
  const api = await waitDocx();
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, Header, PageNumber, AlignmentType, ImageRun } = api;
  const font = document.querySelector("#fontFamily")?.value || "Times New Roman";
  const sizes = { "Times New Roman": 24, Arial: 22, Calibri: 22, Georgia: 22 };
  const size = sizes[font] || 24;
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
        children.push(new Paragraph({ children: [new TextRun({ text, font, size })], bullet: element.tagName === "UL" ? { level: 0 } : undefined, numbering: element.tagName === "OL" ? { reference: "apa-numbering-v23", level: 0 } : undefined, spacing: { line: 480, after: 0, before: 0 } }));
      }
      continue;
    }
    if (element.tagName === "TABLE") {
      const rows = [...element.querySelectorAll("tr")].map((row, rowIndex) => new TableRow({ children: [...row.cells].map((cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell.textContent.trim(), font, size, bold: rowIndex === 0 })], spacing: { line: 360, after: 0, before: 0 } })] })) }));
      if (rows.length) children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      continue;
    }
    const paragraph = paragraphFromElement(element, api, font, size, firstLineIndent, hangingReferences);
    if (paragraph) children.push(paragraph);
  }

  const headers = addPageNumbers ? { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font, size })] })] }) } : undefined;
  const doc = new Document({ numbering: { config: [{ reference: "apa-numbering-v23", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }] }] }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers, children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, "modulo-APA7-PDF-Smart.docx");
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = `DOCX generado con PDF Smart v${DOCX_ENHANCE_VERSION}, incluyendo figuras y tablas detectadas.`;
    status.className = "status success";
  }
  return true;
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadDocxBtn");
  if (!button) return;
  const preview = document.querySelector("#preview");
  if (!preview?.querySelector("img.apa-figure-image")) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void enhancedPdfDocxExport().catch((error) => {
    console.error("DOCX PDF Smart", error);
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = `No se pudo generar el DOCX mejorado: ${error?.message || error}`;
      status.className = "status error";
    }
  });
}, true);