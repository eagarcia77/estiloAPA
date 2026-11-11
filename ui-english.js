// English UI terminology. Never translate the editable document or uploaded filenames.
// Technical identifiers, document content, APA citations and source data remain unchanged.
const UI_ENGLISH_REPLACEMENTS = [
  ["Estilo APA 7…", "APA 7 Style…"],
  ["Párrafo normal", "Normal Paragraph"],
  ["Título del trabajo", "Document Title"],
  ["Encabezado nivel", "Heading Level"],
  ["Referencia APA", "APA Reference"],
  ["Nota de tabla/figura", "Table/Figure Note"],
  ["Rótulo de tabla", "Table Label"],
  ["Título de tabla", "Table Title"],
  ["Rótulo de figura", "Figure Label"],
  ["Título de figura", "Figure Title"],
  ["Alineación", "Alignment"],
  ["Historial", "History"],
  ["Formato de texto", "Text Formatting"],
  ["Sangría e interlineado", "Indentation and Line Spacing"],
  ["Negrita", "Bold"],
  ["Cursiva", "Italic"],
  ["Subrayado", "Underline"],
  ["Deshacer", "Undo"],
  ["Rehacer", "Redo"],
  ["Quitar formato de caracteres", "Clear Character Formatting"],
  ["Quitar sangría", "Remove Indent"],
  ["Estilo APA 7 del bloque", "APA 7 Paragraph Style"],
  ["Limpiar", "Clear"],
  ["Izq.", "Left"],
  ["Centro", "Center"],
  ["Der.", "Right"],
  ["Alinear a la izquierda", "Align Left"],
  ["Alinear a la derecha", "Align Right"],
  ["Centrar", "Center Align"],
  ["1ª línea .5″", "First Line 0.5 in"],
  ["Francesa .5″", "Hanging 0.5 in"],
  ["Sin sangría", "No Indent"],
  ["Sangría de primera línea 0.5 pulgadas", "First Line Indent 0.5 in"],
  ["Sangría francesa 0.5 pulgadas", "Hanging Indent 0.5 in"],
  ["Interlineado…", "Line Spacing…"],
  ["Interlineado", "Line Spacing"],
  ["Sencillo", "Single"],
  ["Doble", "Double"],
  ["Párrafo APA", "APA Paragraph"],
  ["Referencias", "References"],
  ["+ Tabla APA", "+ APA Table"],
  ["+ Figura", "+ Figure"],
  ["+ Insertar imagen", "+ Insert Picture"],
  ["Editar imagen", "Edit Picture"],
  ["Eliminar imagen", "Remove Picture"],
  ["Enlace", "Link"],
  ["Salto pág.", "Page Break"],
  ["Reglas APA 7", "APA 7 Rules"],
  ["Reglas APA", "APA Rules"],
  ["Insertar una imagen PNG/JPG en la posición actual del documento", "Insert a PNG/JPG picture at the current cursor position"],
  ["Seleccionar imagen para insertar", "Choose a picture to insert"],
  ["Título", "Title"],
  ["Autor", "Author"],
  ["Palabras clave", "Keywords"],
  ["Texto del cuerpo", "Body Text"],
  ["Encabezados", "Headings"],
  ["DOI y URL", "DOI and URL"],
  ["Tablas", "Tables"],
  ["Figuras", "Figures"],
  ["Vista previa", "Preview"],
  ["Descargar auditoría", "Download Review Report"],
  ["Auditoría APA 7", "APA 7 Review"],
  ["Edición protegida", "Protected Editing"],
  ["Documento editable", "Editable Document"],
  ["El contenido formateado aparecerá aquí.", "Formatted content will appear here."],
  ["Cargue uno o más archivos o presione “Try Sample”.", "Upload one or more files or select “Try Sample”."],
  ["Cargue uno o más archivos o presione “Probar ejemplo”.", "Upload one or more files or select “Try Sample”."],
  ["Todavía no hay citas o referencias detectadas para revisar.", "No citations or references were detected for review."],
  ["No se detectaron entradas marcadas como referencias.", "No entries marked as references were detected."],
  ["Use el estilo", "Use the style"],
  ["Formatee el documento primero", "Format the document first"],
  ["No se pudo generar el DOCX", "Could not generate the DOCX"],
  ["No se pudo generar el HTML", "Could not generate the HTML"],
  ["Documento DOCX generado correctamente.", "DOCX generated successfully."],
  ["Formato aplicado.", "Formatting applied."],
  ["Auditoría actualizada.", "Review updated."],
  ["Seleccione por lo menos un archivo", "Select at least one file"],
  ["Seleccione uno o varios documentos", "Select one or more documents"],
  ["Procesando documentos…", "Processing documents…"],
  ["Procesando", "Processing"],
  ["archivo(s) listo(s) para procesar.", "file(s) ready to process."],
  ["No se pudo cargar la biblioteca", "Could not load the library"],
  ["Verifique su conexión a Internet.", "Check your internet connection."],
  ["Error de ejecución:", "Runtime error:"],
  ["No se pudo leer una imagen del documento.", "Could not read an image from the document."],
  ["No se pudo insertar la imagen:", "Could not insert picture:"],
  ["Cambios de texto conservados.", "Text changes preserved."],
  ["Se bloqueó el borrado de casi todo el documento.", "Deletion of nearly the entire document was blocked."],
  ["Seleccione y elimine fragmentos más pequeños o utilice Limpiar.", "Select and delete smaller sections or use Clear."],
  ["Protección Backspace: se restauró el documento tras detectar un borrado masivo.", "Backspace protection: the document was restored after an unexpected large deletion."],
  ["puntuación heurística", "heuristic score"],
  ["Puntuación heurística", "Heuristic score"],
  ["Observaciones", "Findings"],
  ["Citas detectadas", "Citations detected"],
  ["Referencias detectadas", "References detected"],
  ["Citas sin referencia", "Citations without a matching reference"],
  ["Referencias sin cita", "References without a matching citation"],
  ["módulo", "module"],
  ["figura(s)", "figure(s)"],
  ["referencia(s)", "reference(s)"],
  ["lista(s)", "list(s)"],
];

function uiEnglishText(source) {
  let translated = source;
  for (const [spanish, english] of UI_ENGLISH_REPLACEMENTS) {
    if (translated.includes(spanish)) translated = translated.split(spanish).join(english);
  }
  return translated;
}

function uiEnglishExcluded(element) {
  return Boolean(element?.closest?.("#preview, #fileList, script, style, [data-no-ui-translate]"));
}

function uiEnglishTranslate(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE || uiEnglishExcluded(root)) return;
  for (const attribute of ["title", "aria-label", "placeholder"]) {
    const before = root.getAttribute(attribute);
    if (before) {
      const after = uiEnglishText(before);
      if (after !== before) root.setAttribute(attribute, after);
    }
  }
  // Work with text nodes only; do not replace buttons or rebind event listeners.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (uiEnglishExcluded(node.parentElement)) continue;
    const before = node.nodeValue;
    const after = uiEnglishText(before);
    if (after !== before) node.nodeValue = after;
  }
  // Text-node walking skips root-level option content only when root is a text node.
}

function initEnglishInterface() {
  document.documentElement.lang = "en";
  uiEnglishTranslate(document.body);
  let busy = false;
  const observer = new MutationObserver(changes => {
    if (busy) return;
    busy = true;
    try {
      for (const change of changes) {
        const element = change.target.nodeType === Node.ELEMENT_NODE ?
          change.target : change.target.parentElement;
        if (element && !uiEnglishExcluded(element)) uiEnglishTranslate(element);
      }
    } finally { busy = false; }
  });
  observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initEnglishInterface, { once: true });
else initEnglishInterface();
