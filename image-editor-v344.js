// APA7 Academic Formatter v3.4.4
// Manual image insertion/editing for the editable preview.
// Images are inserted at the user's current document position and exported by
// the existing DOCX/HTML pipeline. This module never reorders document blocks.

const IMAGE_EDITOR_VERSION = "3.4.4";
let imageEditorSavedRange = null;
let selectedManualImage = null;

const ieQ = (selector, root = document) => root.querySelector(selector);
const ieQA = (selector, root = document) => [...root.querySelectorAll(selector)];
const ieText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function iePreview() {
  return ieQ("#preview");
}

function ieSelectionInsidePreview() {
  const root = iePreview();
  const selection = window.getSelection();
  if (!root || !selection || !selection.rangeCount) return false;
  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return Boolean(element && root.contains(element));
}

function ieSaveSelection() {
  if (!ieSelectionInsidePreview()) return;
  const selection = window.getSelection();
  imageEditorSavedRange = selection.getRangeAt(0).cloneRange();
}

function ieInsertionAnchor() {
  const root = iePreview();
  if (!root) return null;

  if (imageEditorSavedRange && root.contains(imageEditorSavedRange.commonAncestorContainer)) {
    let node = imageEditorSavedRange.startContainer;
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    let block = node?.closest?.("p,h1,h2,h3,h4,h5,h6,li,table,ol,ul,img");
    if (block && root.contains(block)) {
      const section = block.closest("section[data-source-file]");
      if (section) {
        while (block.parentElement && block.parentElement !== section) block = block.parentElement;
      } else {
        while (block.parentElement && block.parentElement !== root) block = block.parentElement;
      }
      return block;
    }
  }

  const sections = ieQA("section[data-source-file]", root);
  const lastSection = sections[sections.length - 1];
  return lastSection?.lastElementChild || root.lastElementChild || null;
}

function ieContainerForAnchor(anchor) {
  const root = iePreview();
  if (!root) return null;
  const section = anchor?.closest?.("section[data-source-file]");
  return section || root;
}

function ieInsertAfter(anchor, nodes) {
  const root = iePreview();
  if (!root) return;
  const container = ieContainerForAnchor(anchor);
  let point = anchor;
  for (const node of nodes) {
    if (point?.parentNode) point.after(node);
    else container.append(node);
    point = node;
  }
}

function ieNextFigureNumber() {
  const root = iePreview();
  if (!root) return 1;
  const values = [];
  for (const label of ieQA(".apa-figure-label,.thesis-figure-label", root)) {
    const match = ieText(label.textContent).match(/\b(\d{1,3})\b/);
    if (match) values.push(Number(match[1]));
  }
  for (const img of ieQA("img[data-apa-figure-number],img[data-apa-source-figure-number]", root)) {
    const value = Number(img.dataset.apaFigureNumber || img.dataset.apaSourceFigureNumber || 0);
    if (value > 0) values.push(value);
  }
  return values.length ? Math.max(...values.filter(Number.isFinite)) + 1 : 1;
}

function ieEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ieReadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
}

function ieDispatchChange(message) {
  const root = iePreview();
  root?.dispatchEvent(new Event("input", { bubbles: true }));
  const status = ieQ("#status");
  if (status && message) {
    status.textContent = message;
    status.className = "status success";
  }
}

function ieCreateCaption(number, title, note) {
  const label = document.createElement("p");
  label.className = "apa-figure-label no-indent";
  label.dataset.apaManualCaption = "true";
  label.innerHTML = `<strong>Figura ${number}</strong>`;

  const titleP = document.createElement("p");
  titleP.className = "apa-figure-title no-indent";
  titleP.dataset.apaManualCaption = "true";
  titleP.innerHTML = `<em>${ieEscape(title)}</em>`;

  const noteP = document.createElement("p");
  noteP.className = "apa-note apa-figure-note no-indent";
  noteP.dataset.apaManualCaption = "true";
  noteP.innerHTML = `<em>Nota.</em> ${ieEscape(note)}`;

  return { label, titleP, noteP };
}

async function ieInsertImageFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g)$/i.test(file.type || "")) {
    window.alert("Para garantizar compatibilidad con Word, seleccione una imagen PNG o JPG/JPEG.");
    return;
  }

  const dataUrl = await ieReadFile(file);
  const number = ieNextFigureNumber();
  const title = window.prompt("Título de la figura (APA 7):", `Título descriptivo de la figura ${number}`);
  if (title === null) return;
  const note = window.prompt("Nota de la figura (opcional):", "");
  if (note === null) return;

  const { label, titleP, noteP } = ieCreateCaption(number, ieText(title) || `Figura ${number}`, ieText(note));
  const img = document.createElement("img");
  img.src = dataUrl;
  img.className = "apa-figure-image module-figure-image apa-manual-image";
  img.dataset.apaManualImage = "true";
  img.dataset.apaMediaRole = "manual-figure";
  img.dataset.apaFigureNumber = String(number);
  img.dataset.figureTitle = ieText(title) || `Figura ${number}`;
  if (ieText(note)) img.dataset.figureNote = ieText(note);
  img.alt = `Figura ${number}. ${ieText(title) || `Figura ${number}`}`;
  img.style.display = "block";
  img.style.maxWidth = "100%";
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.margin = ".35em auto";
  img.setAttribute("tabindex", "0");

  const nodes = [label, titleP, img];
  if (ieText(note)) nodes.push(noteP);
  ieInsertAfter(ieInsertionAnchor(), nodes);
  ieSelectImage(img);
  ieDispatchChange(`Figura ${number} insertada manualmente en la posición seleccionada.`);
}

function ieCaptionNodes(img) {
  if (!img) return { label: null, title: null, note: null };
  let title = img.previousElementSibling;
  let label = null;
  if (title?.classList.contains("apa-figure-title")) label = title.previousElementSibling;
  else title = null;
  if (!label?.classList.contains("apa-figure-label")) label = null;
  const next = img.nextElementSibling;
  const note = next?.classList.contains("apa-figure-note") || next?.classList.contains("apa-note") ? next : null;
  return { label, title, note };
}

function ieSelectImage(img) {
  if (selectedManualImage) selectedManualImage.classList.remove("apa-image-selected");
  selectedManualImage = img && iePreview()?.contains(img) ? img : null;
  if (selectedManualImage) selectedManualImage.classList.add("apa-image-selected");
  const edit = ieQ("#editApaImage");
  const remove = ieQ("#removeApaImage");
  if (edit) edit.disabled = !selectedManualImage;
  if (remove) remove.disabled = !selectedManualImage;
}

function ieEditSelectedImage() {
  const img = selectedManualImage;
  if (!img || !iePreview()?.contains(img)) return;
  const number = Number(img.dataset.apaFigureNumber || img.dataset.apaSourceFigureNumber || 0) || ieNextFigureNumber();
  const captions = ieCaptionNodes(img);
  const currentTitle = ieText(captions.title?.textContent || img.dataset.figureTitle || img.alt.replace(/^Figura\s+\d+\.\s*/i, ""));
  const currentNote = ieText(captions.note?.textContent || img.dataset.figureNote || "").replace(/^Nota\.\s*/i, "");
  const title = window.prompt("Título de la figura:", currentTitle || `Título descriptivo de la figura ${number}`);
  if (title === null) return;
  const note = window.prompt("Nota de la figura (opcional):", currentNote);
  if (note === null) return;

  if (captions.label) captions.label.innerHTML = `<strong>Figura ${number}</strong>`;
  if (captions.title) captions.title.innerHTML = `<em>${ieEscape(ieText(title) || `Figura ${number}`)}</em>`;
  if (!captions.label || !captions.title) {
    const created = ieCreateCaption(number, ieText(title) || `Figura ${number}`, ieText(note));
    img.before(created.label, created.titleP);
  }

  const refreshed = ieCaptionNodes(img);
  if (ieText(note)) {
    if (refreshed.note) refreshed.note.innerHTML = `<em>Nota.</em> ${ieEscape(ieText(note))}`;
    else {
      const noteP = document.createElement("p");
      noteP.className = "apa-note apa-figure-note no-indent";
      noteP.dataset.apaManualCaption = "true";
      noteP.innerHTML = `<em>Nota.</em> ${ieEscape(ieText(note))}`;
      img.after(noteP);
    }
  } else if (refreshed.note?.dataset.apaManualCaption === "true") {
    refreshed.note.remove();
  }

  img.dataset.apaFigureNumber = String(number);
  img.dataset.figureTitle = ieText(title) || `Figura ${number}`;
  if (ieText(note)) img.dataset.figureNote = ieText(note);
  else delete img.dataset.figureNote;
  img.alt = `Figura ${number}. ${ieText(title) || `Figura ${number}`}`;
  ieDispatchChange(`Figura ${number} actualizada.`);
}

function ieRemoveSelectedImage() {
  const img = selectedManualImage;
  if (!img || !iePreview()?.contains(img)) return;
  if (!window.confirm("¿Desea eliminar esta imagen del documento?")) return;
  const captions = ieCaptionNodes(img);
  const number = img.dataset.apaFigureNumber || "";
  captions.label?.remove();
  captions.title?.remove();
  captions.note?.remove();
  img.remove();
  ieSelectImage(null);
  ieDispatchChange(`Figura ${number || "seleccionada"} eliminada del documento.`);
}

function ieInstallStyles() {
  if (ieQ("#apa-image-editor-v344-style")) return;
  const style = document.createElement("style");
  style.id = "apa-image-editor-v344-style";
  style.textContent = `
    .apa-paper img.apa-manual-image{cursor:pointer;max-width:100%;height:auto;}
    .apa-paper img.apa-image-selected{outline:3px solid #0b6cff!important;outline-offset:4px;}
    #apaImagePicker{display:none!important;}
    .apa-editor-toolbar button.image-action{white-space:nowrap;}
  `;
  document.head.append(style);
}

function ieInstallToolbarControls() {
  const toolbar = ieQ("#apaEditorToolbar");
  if (!toolbar || ieQ("#insertApaImage")) return false;
  const insertGroup = ieQA(".tool-group", toolbar).find((group) => group.getAttribute("aria-label") === "Insertar") || toolbar.lastElementChild;
  if (!insertGroup) return false;

  const insert = document.createElement("button");
  insert.type = "button";
  insert.id = "insertApaImage";
  insert.className = "image-action";
  insert.textContent = "+ Insertar imagen";
  insert.title = "Insertar una imagen PNG/JPG en la posición actual del documento";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.id = "editApaImage";
  edit.className = "image-action";
  edit.textContent = "Editar imagen";
  edit.disabled = true;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.id = "removeApaImage";
  remove.className = "image-action";
  remove.textContent = "Eliminar imagen";
  remove.disabled = true;

  const picker = document.createElement("input");
  picker.type = "file";
  picker.id = "apaImagePicker";
  picker.accept = "image/png,image/jpeg";
  picker.setAttribute("aria-label", "Seleccionar imagen para insertar");

  insertGroup.append(insert, edit, remove, picker);

  [insert, edit, remove].forEach((button) => button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    ieSaveSelection();
  }));

  insert.addEventListener("click", () => {
    ieSaveSelection();
    picker.value = "";
    picker.click();
  });
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (file) void ieInsertImageFile(file).catch((error) => {
      console.error("Manual image insertion", error);
      const status = ieQ("#status");
      if (status) {
        status.textContent = `No se pudo insertar la imagen: ${error.message}`;
        status.className = "status error";
      }
    });
  });
  edit.addEventListener("click", ieEditSelectedImage);
  remove.addEventListener("click", ieRemoveSelectedImage);
  return true;
}

function ieUpdateUi() {
  const badge = ieQ(".badge");
  if (badge) {
    badge.textContent = `v${IMAGE_EDITOR_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${IMAGE_EDITOR_VERSION}`);
  }
  const help = ieQ("#previewHelp");
  if (help) help.innerHTML = "La Vista previa es <strong>editable</strong>. Coloque el cursor donde desea trabajar. Use <strong>+ Insertar imagen</strong> para añadir una figura PNG/JPG manualmente; luego puede seleccionarla, editar su título/Nota o eliminarla. El banner inicial permanece excluido de las exportaciones.";
}

function ieInitialize() {
  ieInstallStyles();
  ieUpdateUi();
  const install = () => {
    if (!ieInstallToolbarControls()) setTimeout(install, 150);
  };
  install();

  document.addEventListener("selectionchange", ieSaveSelection);
  const root = iePreview();
  root?.addEventListener("keyup", ieSaveSelection);
  root?.addEventListener("mouseup", ieSaveSelection);
  root?.addEventListener("click", (event) => {
    const img = event.target?.closest?.("img");
    if (img && root.contains(img) && img.dataset.apaMediaRole !== "module-banner") ieSelectImage(img);
    else if (!event.target?.closest?.("#apaEditorToolbar")) ieSelectImage(null);
  });
}

window.insertApaImageFile = ieInsertImageFile;
window.IMAGE_EDITOR_VERSION = IMAGE_EDITOR_VERSION;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ieInitialize, { once: true });
else ieInitialize();
