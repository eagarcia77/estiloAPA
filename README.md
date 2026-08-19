# APA7 Module Formatter v2.2

Aplicación web para importar módulos académicos, aplicar formato APA 7, auditar citas/referencias y exportar una copia limpia.

## PDF Smart v2.2

La lectura de PDF ahora reconstruye la estructura utilizando coordenadas, tamaño de fuente, espaciado y orden visual antes de aplicar APA 7. Esto mejora párrafos, encabezados, listas y referencias frente a la extracción de texto plano.

También elimina encabezados y pies repetidos y detecta PDFs escaneados o sin capa de texto suficiente. En esos casos se recomienda utilizar el DOCX original o un PDF con OCR.

## Limitaciones

PDF es un formato de presentación final. Tablas, figuras, columnas múltiples, cuadros de texto y documentos escaneados pueden requerir revisión manual. Cuando esté disponible, DOCX seguirá siendo la mejor fuente para reconstruir el formato con precisión.

## Publicación

GitHub Actions valida `app.js`, `enhancements.js` y `pdf-smart.js` y sincroniza la rama `gh-pages` con la versión validada de `main`.

En **Settings → Pages**, seleccione **Deploy from a branch → gh-pages → / (root)**.
