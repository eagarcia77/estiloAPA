// English UI terminology. Never translate the editable document or uploaded filenames.
// Technical identifiers, document content, APA citations and source data remain unchanged.
const UI_ENGLISH_REPLACEMENTS = [
  ["Versión ", "Version "],
  ["Vista previa y exportación", "Document Editor and Export"],
  ["Vista previa y exportación de documentos", "Document Editor and Export"],
  ["Tipo de documento", "Document Type"],
  ["Configuración de formato", "Formatting Settings"],
  ["Aplicar formato", "Apply Formatting"],
  ["Probar ejemplo", "Try Sample"],
  ["Volver a auditar", "Run Review Again"],
  ["Descargar DOCX", "Download DOCX"],
  ["Descargar HTML", "Download HTML"],
  ["Descargar auditoría", "Download Review Report"],
  ["Error al procesar los documentos", "Error processing documents"],
  ["Ocurrió un error al procesar los documentos.", "An error occurred while processing the documents."],
  ["Revise la auditoría y edite la vista previa si es necesario.", "Review the findings and edit the document if needed."],
  ["o use “Try Sample”.", "or use “Try Sample”."],
  ["o use “Probar ejemplo”.", "or use “Try Sample”."],
  ["Edición protegida v3.4.8:", "Protected Editing v3.4.8:"],
  ["Cambios de texto conservados. La vista previa salió del modo de edición protegida.", "Text changes saved. Protected editing mode ended."],
  ["Protección Backspace:", "Backspace Protection:"],
  ["Incorporar imagen", "Insert Picture"],
  ["Insertar imagen", "Insert Picture"],
  ["Eliminar imagen", "Remove Picture"],
  ["Editar imagen", "Edit Picture"],
  ["Imagen seleccionada", "Selected Picture"],
  ["Sangría francesa", "Hanging Indent"],
  ["Sangría inicial", "First-Line Indent"],
  ["Alineación izquierda", "Left Alignment"],
  ["Justificado", "Justified"],
  ["Guardar", "Save"],
  ["Buscar y reemplazar", "Find and Replace"],
  ["Reemplazar", "Replace"],
  ["Buscar", "Find"],
  ["Insertar", "Insert"],
  ["Revisar", "Review"],
  ["Inicio", "Home"],
  ["Archivo", "File"],
  ["Diseño", "Layout"],
  ["Vista", "View"],
  ["Formato aplicado correctamente", "Formatting applied successfully"],
  ["Tamaño de fuente", "Font Size"],
  ["Tipo de letra", "Font Family"],
  ["Negritas", "Bold"],
  ["Imágenes", "Pictures"],
  ["Imagen", "Picture"],
  ["Figuras APA 7", "APA 7 Figures"],
  ["Tablas APA 7", "APA 7 Tables"],
  ["Citas y referencias", "Citations and References"],
  ["Citas", "Citations"],
  ["Auditoría", "Review"],
  ["Alternativo", "Alternative"],
  ["Texto alternativo", "Alt Text"],
  ["Faltan citas", "Missing Citations"],
  ["Sin referencia", "Unmatched Reference"],
  ["Borrado masivo", "Mass Deletion"],
  ["Procesando documentos", "Processing Documents"],
  ["Páginas", "Pages"],
  ["Página", "Page"],
  ["Palabras", "Words"],
  ["Caracteres", "Characters"],
  ["Tabla", "Table"],
  ["Figura", "Figure"],
  ["Nota.", "Note."],
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
  ["Izquierda, doble espacio y sangría de primera línea de 0.5 pulg. Evite justificar el margen derecho.", "Left-aligned, double-spaced, with a 0.5 in first-line indent. Do not justify the right margin."],
  ["Nivel 1 centrado/negrita; nivel 2 izquierda/negrita; nivel 3 izquierda/negrita/cursiva; niveles 4–5 con sangría y texto en la misma línea.", "Level 1 centered/bold; level 2 left/bold; level 3 left/bold/italic; levels 4–5 indented with run-in text."],
  ["Encabezado centrado y en negrita, doble espacio, orden alfabético, sin viñetas y sangría francesa de 0.5 pulg.", "Centered bold heading, double spacing, alphabetical order, no bullets, and a 0.5 in hanging indent."],
  ["DOI como https://doi.org/...; no añada punto final después de DOI o URL.", "Use DOI links in https://doi.org/... format; do not add a final period after a DOI or URL."],
  ["Número en negrita, título en cursiva, sin líneas verticales y solo reglas horizontales necesarias.", "Bold table number, italic title, no vertical borders, and only necessary horizontal rules."],
  ["Número en negrita, título en cursiva y nota debajo cuando sea necesaria para fuente o aclaración.", "Bold figure number, italic title, and a note below when a source or clarification is needed."],
  ["La Vista previa es", "The document preview is"],
  ["editable", "editable"],
  ["Coloque el cursor donde desea trabajar.", "Place the cursor where you want to edit."],
  ["para añadir una figura PNG/JPG manualmente; luego puede seleccionarla, editar su título/Nota o eliminarla.", "to add a PNG/JPG figure; then select it to edit its title/note or remove it."],
  ["El banner inicial permanece excluido de las exportaciones.", "The initial banner remains excluded from exports."],
  ["incorpora imágenes de DOCX y recupera figuras del PDF incluso cuando cada página llega como un solo párrafo con saltos de línea.", "includes DOCX images and recovers PDF figures even when a page is imported as a single paragraph with line breaks."],
  ["Las figuras que ya contienen Figura X, título y Nota dentro de la imagen se conservan sin duplicar caption.", "Figures already labeled within the image are retained without duplicate captions."],
  ["El banner inicial se excluye.", "The initial banner is excluded."],
  ["proteger la edición del texto e incorpora", "protect text editing and include"],
  ["protege la edición del texto e incorpora", "protects text editing and includes"],
  ["puede escribir, borrar, cortar y pegar directamente en esta vista previa sin que los normalizadores reconstruyan el texto mientras el cursor está activo. Las reglas APA 7 se reanudan al salir del editor, volver a auditar o exportar.", "type, delete, cut, and paste in the editor. APA 7 formatting resumes after editing or when you review or export."],
  ["Los cambios de texto se conservaron.", "Text changes were preserved."],
  ["Puede escribir, borrar, cortar y pegar", "You can type, delete, cut, and paste"],
  ["Se detectó", "Detected"],
  ["La puntuación es heurística", "The score is heuristic"],
  ["requiere revisión académica humana", "requires human academic review"],
  ["Se conservan", "Preserved"],
  ["No se pudo", "Could not"],
  ["Seleccione", "Select"],
  ["módulo", "module"],
  ["figura(s)", "figure(s)"],
  ["referencia(s)", "reference(s)"],
  ["lista(s)", "list(s)"],
];

// Match longer expressions first so short terms never interrupt a complete sentence.
const UI_ENGLISH_SORTED = [...UI_ENGLISH_REPLACEMENTS]
  .sort((a, b) => b[0].length - a[0].length);

function uiEnglishText(source) {
  let translated = source;
  for (const [spanish, english] of UI_ENGLISH_SORTED) {
    if (translated.includes(spanish)) translated = translated.split(spanish).join(english);
  }
  return translated;
}

function uiEnglishExcluded(element) {
  return Boolean(element?.closest?.("#preview, #fileList, script, style, [data-no-ui-translate]"));
}

function uiEnglishTranslate(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE || uiEnglishExcluded(root)) return;
  for (const element of [root, ...root.querySelectorAll("*")]) {
    if (uiEnglishExcluded(element)) continue;
    for (const attribute of ["title", "aria-label", "placeholder"]) {
      const before = element.getAttribute(attribute);
      if (before) {
        const after = uiEnglishText(before);
        if (after !== before) element.setAttribute(attribute, after);
      }
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
