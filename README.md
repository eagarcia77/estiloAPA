# APA7 Module Formatter v2.1

Aplicación web para importar módulos académicos, aplicar formato APA 7, auditar citas/referencias y exportar una copia limpia. La aplicación funciona en el navegador y no requiere una API de inteligencia artificial.

## Novedades de la versión 2.1

- Revisión avanzada individual de cada referencia detectada.
- Matriz de correspondencia entre citas y referencias por primer autor y año.
- Identificación de citas sin referencia y referencias sin cita detectada.
- Detección de referencias potencialmente duplicadas por autor y año.
- Alertas para DOI en formato `doi:` o `dx.doi.org` y URLs con puntuación final.
- Botón **Aplicar correcciones seguras** para cambios conservadores de presentación.
- Protección del contenido enriquecido: las correcciones automáticas no reemplazan referencias con cursivas, enlaces u otro marcado interno.
- Descarga de la matriz de auditoría en CSV.
- Panel avanzado que se actualiza al editar el documento.
- GitHub Actions valida `app.js` y `enhancements.js` antes del despliegue.

## Funciones principales

- Carga múltiple de DOCX, PDF, TXT, MD, HTML y HTM.
- Procesamiento local en el navegador.
- Botón **Probar ejemplo** para comprobar la aplicación sin subir archivos.
- Márgenes de 1 pulgada y doble espacio.
- Fuentes compatibles configurables: Times New Roman 12, Arial 11, Calibri 11 y Georgia 11.
- Sangría de primera línea de 0.5 pulg. en párrafos regulares.
- Sangría francesa de 0.5 pulg. en referencias.
- Ordenamiento alfabético opcional de referencias.
- Auditoría de citas y referencias.
- Vista previa editable.
- Exportación a DOCX y HTML.
- Reporte de auditoría en TXT y matriz avanzada en CSV.
- Número de página opcional en DOCX.

## Ejecutar desde GitHub Pages

El repositorio incluye `.github/workflows/pages.yml`.

1. Entre a **Settings → Pages**.
2. Seleccione **Source: GitHub Actions**.
3. GitHub ejecutará el workflow cuando haya cambios en `main`.
4. El workflow valida la sintaxis JavaScript antes de publicar.

> Si el repositorio privado no permite GitHub Pages bajo su plan o configuración actual, utilice la ejecución local descrita abajo.

## Ejecutar localmente en Windows

### Opción rápida

1. Clone o descargue el repositorio como ZIP.
2. Extraiga los archivos.
3. Ejecute `run-local.bat`.
4. Se abrirá `http://localhost:8000` en el navegador.
5. Para cerrar el servidor, cierre la ventana de comandos o presione `Ctrl+C`.

### PowerShell

Desde la carpeta del proyecto:

```powershell
.\run-local.ps1
```

También puede ejecutar:

```powershell
python -m http.server 8000
```

Luego abra `http://localhost:8000`.

## Cómo probar la aplicación

1. Abra la aplicación.
2. Presione **Probar ejemplo**.
3. Revise la auditoría general y la sección **Revisión avanzada de citas y referencias**.
4. Pruebe **Aplicar correcciones seguras**.
5. Descargue DOCX, HTML, auditoría TXT o matriz CSV.

## Privacidad

Los archivos se procesan en el navegador. Esta versión no incluye base de datos, almacenamiento automático de documentos ni una API de IA del proyecto. Las bibliotecas externas se cargan desde CDN, por lo que se requiere conexión a Internet al iniciar la aplicación.

## Bibliotecas

- Mammoth.js 1.12.0: conversión de DOCX a HTML.
- PDF.js / pdfjs-dist 6.1.200: lectura de PDF.
- docx 9.7.1: generación de archivos Word en el navegador.

## Limitaciones

La auditoría es heurística y no sustituye una revisión académica completa. La correspondencia de citas utiliza principalmente primer autor y año, por lo que autores corporativos, referencias legales, autores con apellidos complejos y otros casos especiales pueden requerir revisión manual. Deben verificarse con la fuente original los autores, fecha, título, publicación, volumen, número, páginas, DOI/URL, cursivas y capitalización. La extracción desde PDF puede perder estructura porque el PDF representa una página final y no necesariamente la semántica original del documento.

## Estructura

```text
estiloAPA/
├── .github/workflows/pages.yml
├── app.js
├── enhancements.js
├── index.html
├── styles.css
├── run-local.bat
├── run-local.ps1
└── README.md
```
