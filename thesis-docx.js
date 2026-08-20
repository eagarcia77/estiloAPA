const THESIS_DOCX_VERSION = "3.1";

function thesisExportProfile() {
  return document.querySelector("#formatProfile")?.value || "";
}

function thesisExportEnabled() {
  return ["thesis-doctoral", "thesis-masters"].includes(thesisExportProfile());
}

async function thesisWaitDocx(timeoutMs = 12000) {
  const started = Date.now();
  while (!window.docx) {
    if (Date.now() - started > timeoutMs) throw new Error("No se pudo cargar la biblioteca DOCX.");
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return window.docx;
}

function thesisBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl).split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function thesisImageDimensions(src, maxWidth = 540, maxHeight = 620) {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      resolve({
        width: Math.max(1, Math.round(image.naturalWidth * ratio)),
        height: Math.max(1, Math.round(image.naturalHeight * ratio)),
      });
    };
    image.onerror = reject;
    image.src = src;
  });
}

function thesisInlineRuns(node, api, inherited = {}) {
  const { TextRun, ExternalHyperlink } = api;
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.nodeValue) return [];
    return [new TextRun({
      text: node.nodeValue,
      font: "Times New Roman",
      size: 24,
      bold: inherited.bold,
      italics: inherited.italics,
      underline: inherited.underline ? {} : undefined,
    })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName;
  const style = {
    bold: inherited.bold || ["B", "STRONG"].includes(tag),
    italics: inherited.italics || ["I", "EM"].includes(tag),
    underline: inherited.underline || tag === "U",
  };
  if (tag === "BR") return [new TextRun({ break: 1, font: "Times New Roman", size: 24 })];
  if (tag === "A" && node.getAttribute("href") && ExternalHyperlink) {
    const text = node.textContent || node.getAttribute("href");
    return [new ExternalHyperlink({
      link: node.getAttribute("href"),
      children: [new TextRun({ text, font: "Times New Roman", size: 24, underline: {}, bold: style.bold, italics: style.italics })],
    })];
  }
  return [...node.childNodes].flatMap((child) => thesisInlineRuns(child, api, style));
}

function thesisParagraph(element, api, { allowPageBreak = true, sectionRole = "body" } = {}) {
  const { Paragraph, TextRun, AlignmentType } = api;
  const text = String(element.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const isCover = sectionRole === "cover" && element.classList.contains("thesis-cover-block");
  const isMajor = element.classList.contains("thesis-major-heading") || element.classList.contains("thesis-chapter-title");
  const isSection = element.classList.contains("thesis-section-heading");
  const isRef = element.classList.contains("thesis-reference") || element.classList.contains("apa-reference");
  const isFigureLabel = element.classList.contains("thesis-figure-label") || element.classList.contains("apa-figure-label");
  const isFigureTitle = element.classList.contains("thesis-figure-title") || element.classList.contains("apa-figure-title");
  const isTableLabel = element.classList.contains("thesis-table-label") || element.classList.contains("apa-table-label");
  const isTableTitle = element.classList.contains("thesis-table-title") || element.classList.contains("apa-table-title");
  const isNote = element.classList.contains("thesis-note") || element.classList.contains("apa-note");

  let runs = thesisInlineRuns(element, api);
  if (!runs.length) runs = [new TextRun({ text, font: "Times New Roman", size: 24 })];
  if (isMajor || isSection || isFigureLabel || isTableLabel) {
    runs = [new TextRun({ text, font: "Times New Roman", size: 24, bold: true })];
  } else if (isFigureTitle || isTableTitle) {
    runs = [new TextRun({ text, font: "Times New Roman", size: 24, italics: true })];
  }

  let alignment = AlignmentType.LEFT;
  if (isCover || isMajor) alignment = AlignmentType.CENTER;

  const noIndent = isCover || isMajor || isSection || isRef || isFigureLabel || isFigureTitle || isTableLabel || isTableTitle || isNote || element.classList.contains("no-indent");
  const options = {
    children: runs,
    spacing: { line: 480, after: 0, before: 0 },
    alignment,
    keepNext: isMajor || isSection || isFigureLabel || isFigureTitle || isTableLabel || isTableTitle,
  };

  if (isRef) options.indent = { left: 720, hanging: 720 };
  else if (!noIndent) options.indent = { firstLine: 720 };

  if (allowPageBreak && element.classList.contains("thesis-page-start")) options.pageBreakBefore = true;
  return new Paragraph(options);
}

function thesisPreviewBlocks() {
  const preview = document.querySelector("#preview");
  if (typeof window.normalizeNumberedLists === "function") window.normalizeNumberedLists(preview);
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

function thesisBlockText(el) {
  return String(el?.textContent || "").replace(/\s+/g, " ").trim();
}

function thesisIsPrelim(text) {
  return /^(Página de aprobación|Certificación de autoría|Dedicatoria|Agradecimientos?|Resumen|Abstract|Tabla de contenido|Índice de figuras|Índice de tablas)$/i.test(text);
}

function thesisLooksLikeModule(blocks) {
  const text = blocks.map(thesisBlockText).join("\n");
  const signals = [
    /Objetivos del módulo/i,
    /Palabras clave/i,
    /Lecturas y recursos requeridos/i,
    /^Tema\s+1\./im,
    /Contenido del módulo/i,
  ].filter((pattern) => pattern.test(text)).length;
  return signals >= 2;
}

function thesisSplitBlocks(blocks) {
  const texts = blocks.map(thesisBlockText);
  const approvalIndex = texts.findIndex((text) => /^Página de aprobación$/i.test(text));
  const firstPrelimIndex = texts.findIndex((text) => thesisIsPrelim(text));
  const chapterIndex = texts.findIndex((text) => /^Capítulo\s+I\b/i.test(text));
  const moduleLike = thesisLooksLikeModule(blocks);

  if (chapterIndex >= 0) {
    const coverEnd = approvalIndex > 0 ? approvalIndex : (firstPrelimIndex > 0 ? firstPrelimIndex : chapterIndex);
    return {
      cover: coverEnd > 0 ? blocks.slice(0, coverEnd) : [],
      prelim: blocks.slice(coverEnd, chapterIndex),
      body: blocks.slice(chapterIndex),
      mode: firstPrelimIndex >= 0 ? "full-thesis" : "body-with-chapter",
      moduleLike,
    };
  }

  if (firstPrelimIndex >= 0) {
    const coverEnd = approvalIndex > 0 ? approvalIndex : (firstPrelimIndex > 0 ? firstPrelimIndex : 0);
    return {
      cover: coverEnd > 0 ? blocks.slice(0, coverEnd) : [],
      prelim: blocks.slice(coverEnd),
      body: [],
      mode: "prelim-only",
      moduleLike,
    };
  }

  return {
    cover: [],
    prelim: [],
    body: blocks,
    mode: moduleLike ? "module-like" : "body-only",
    moduleLike,
  };
}

function thesisNumericCell(text) {
  return /^[-+]?[$€£]?\s*\d[\d,.]*(?:\s*%|\s*[A-Za-z]{0,3})?$/.test(String(text || "").trim());
}

function thesisApaTable(element, api) {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, BorderStyle } = api;
  const domRows = [...element.querySelectorAll("tr")];
  if (!domRows.length) return null;

  const none = { style: BorderStyle?.NONE || "none", size: 0, color: "FFFFFF" };
  const rule = { style: BorderStyle?.SINGLE || "single", size: 8, color: "000000" };

  const rows = domRows.map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const isLast = rowIndex === domRows.length - 1;
    const cells = [...row.cells].map((cell, cellIndex) => {
      const text = cell.textContent.replace(/\s+/g, " ").trim();
      let alignment = AlignmentType.LEFT;
      if (isHeader && cellIndex > 0) alignment = AlignmentType.CENTER;
      else if (!isHeader && thesisNumericCell(text)) alignment = AlignmentType.CENTER;

      const borders = {
        top: isHeader ? rule : none,
        bottom: (isHeader || isLast) ? rule : none,
        left: none,
        right: none,
      };

      return new TableCell({
        borders,
        margins: { top: 70, bottom: 70, left: 80, right: 80 },
        children: [new Paragraph({
          alignment,
          children: [new TextRun({ text, font: "Times New Roman", size: 24, bold: isHeader })],
          spacing: { line: 240, after: 0, before: 0 },
        })],
      });
    });
    return new TableRow({ cantSplit: true, tableHeader: isHeader, children: cells });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideHorizontal: none,
      insideVertical: none,
    },
  });
}

function thesisListConfig(reference, start = 1) {
  return {
    reference,
    levels: [{
      level: 0,
      format: "decimal",
      text: "%1.",
      alignment: "left",
      start: Number.isFinite(start) && start > 0 ? start : 1,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } },
    }],
  };
}

async function thesisConvertBlocks(blocks, api, numberingState, { firstBlockNoBreak = false, sectionRole = "body" } = {}) {
  const { Paragraph, TextRun, ImageRun, AlignmentType } = api;
  const children = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const element = blocks[index];

    if (element.tagName === "IMG" && (element.classList.contains("apa-figure-image") || element.classList.contains("thesis-figure-image"))) {
      const src = element.getAttribute("src") || "";
      if (src.startsWith("data:image/")) {
        const dimensions = await thesisImageDimensions(src);
        const alt = element.getAttribute("alt") || "Figura de la tesis";
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 480, after: 0, before: 0 },
          children: [new ImageRun({ data: thesisBytes(src), transformation: dimensions, altText: { title: alt, description: alt, name: alt } })],
        }));
      }
      continue;
    }

    if (["UL", "OL"].includes(element.tagName)) {
      let reference = null;
      if (element.tagName === "OL") {
        numberingState.counter += 1;
        reference = `thesis-numbering-v31-${numberingState.counter}`;
        const start = Number.parseInt(element.getAttribute("start") || "1", 10) || 1;
        numberingState.configs.push(thesisListConfig(reference, start));
      }
      for (const li of element.querySelectorAll(":scope > li")) {
        const text = thesisBlockText(li);
        if (!text) continue;
        const runs = thesisInlineRuns(li, api);
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          children: runs.length ? runs : [new TextRun({ text, font: "Times New Roman", size: 24 })],
          bullet: element.tagName === "UL" ? { level: 0 } : undefined,
          numbering: element.tagName === "OL" ? { reference, level: 0 } : undefined,
          spacing: { line: 480, after: 0, before: 0 },
        }));
      }
      continue;
    }

    if (element.tagName === "TABLE") {
      const table = thesisApaTable(element, api);
      if (table) children.push(table);
      continue;
    }

    const paragraph = thesisParagraph(element, api, {
      allowPageBreak: !(firstBlockNoBreak && index === 0),
      sectionRole,
    });
    if (paragraph) children.push(paragraph);
  }

  return children;
}

function thesisFooter(api) {
  const { Footer, Paragraph, TextRun, PageNumber, AlignmentType } = api;
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 24 })],
    })],
  });
}

async function exportThesisDocx() {
  const api = await thesisWaitDocx();
  const { Document, Packer, NumberFormat } = api;
  const blocks = thesisPreviewBlocks();
  const split = thesisSplitBlocks(blocks);
  const sections = [];
  const numberingState = { counter: 0, configs: [] };
  const pageBase = {
    size: { width: 12240, height: 15840 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 2160 },
  };

  if (split.cover.length) {
    sections.push({
      properties: { page: pageBase },
      children: await thesisConvertBlocks(split.cover, api, numberingState, { firstBlockNoBreak: true, sectionRole: "cover" }),
    });
  }

  if (split.prelim.length) {
    sections.push({
      properties: { page: { ...pageBase, pageNumbers: { start: split.cover.length ? 2 : 1, formatType: NumberFormat?.LOWER_ROMAN || "lowerRoman" } } },
      footers: { default: thesisFooter(api) },
      children: await thesisConvertBlocks(split.prelim, api, numberingState, { firstBlockNoBreak: true, sectionRole: "prelim" }),
    });
  }

  if (split.body.length) {
    sections.push({
      properties: { page: { ...pageBase, pageNumbers: { start: 1, formatType: NumberFormat?.DECIMAL || "decimal" } } },
      footers: { default: thesisFooter(api) },
      children: await thesisConvertBlocks(split.body, api, numberingState, { firstBlockNoBreak: true, sectionRole: "body" }),
    });
  }

  if (!sections.length) {
    sections.push({
      properties: { page: { ...pageBase, pageNumbers: { start: 1, formatType: NumberFormat?.DECIMAL || "decimal" } } },
      footers: { default: thesisFooter(api) },
      children: await thesisConvertBlocks(blocks, api, numberingState, { firstBlockNoBreak: true, sectionRole: "body" }),
    });
  }

  const doc = new Document({
    numbering: { config: numberingState.configs },
    sections,
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = thesisExportProfile() === "thesis-doctoral" ? "disertacion-doctoral-formateada-v3.1.docx" : "tesis-maestria-formateada-v3.1.docx";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const status = document.querySelector("#status");
  if (status) {
    let detail = `preliminares/cuerpo conservados; ${numberingState.counter} lista(s) numerada(s) con secuencias independientes`;
    if (split.mode === "module-like") detail = `módulo detectado: cuerpo académico desde página 1; ${numberingState.counter} lista(s) reiniciada(s) correctamente`;
    else if (split.mode === "body-only") detail = `cuerpo académico desde página 1; ${numberingState.counter} lista(s) reiniciada(s) correctamente`;
    else if (split.mode === "body-with-chapter") detail = `Capítulo I desde página 1; ${numberingState.counter} lista(s) reiniciada(s) correctamente`;
    else if (split.mode === "prelim-only") detail = `solo preliminares detectados; ${numberingState.counter} lista(s) reiniciada(s) correctamente`;
    status.textContent = `DOCX generado con perfil institucional v${THESIS_DOCX_VERSION}; ${detail}.`;
    status.className = split.moduleLike ? "status error" : "status success";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("#downloadDocxBtn");
  if (!button || !thesisExportEnabled()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void exportThesisDocx().catch((error) => {
    console.error("Thesis DOCX export", error);
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = `No se pudo generar la tesis en DOCX: ${error?.message || error}`;
      status.className = "status error";
    }
  });
}, true);
