# APA7 Module Formatter v2.0

Aplicación web para importar módulos académicos, aplicar formato APA 7, auditar citas/referencias y exportar una copia limpia. La aplicación funciona en el navegador y no requiere una API de inteligencia artificial.

## Novedades de la versión 2.0

- Botón **Probar ejemplo** para confirmar inmediatamente que la aplicación está ejecutándose.
- Comparación heurística entre citas autor-año y la lista de referencias.
- Identificación de citas sin referencia y referencias sin cita detectada.
- Métricas de citas, referencias y correspondencia.
- Ordenamiento alfabético opcional de referencias.
- Detección básica de DOI escritos como `doi:` para recomendar el formato URL de APA 7.
- Reauditoría automática después de editar la vista previa.
- Descarga de un reporte de auditoría en TXT.
- Exportación DOCX mejorada con tablas, formato básico en negrita/cursiva y número de página opcional.
- Validación de sintaxis JavaScript dentro de GitHub Actions antes del despliegue.
- Lanzadores `run-local.bat` y `run-local.ps1` para Windows.

## Formatos aceptados

- DOCX
- PDF
- TXT
- MD
- HTML / HTM

## Formato aplicado

- Página tamaño carta.
- Márgenes de 1 pulgada.
- Interlineado doble.
- Times New Roman 12 pt, Arial 11 pt, Calibri 11 pt o Georgia 11 pt.
- Sangría de primera línea de 0.5 pulg. en párrafos regulares.
- Sangría francesa de 0.5 pulg. en referencias.
- Encabezados básicos APA.
- Número de página opcional en la exportación DOCX.

## Ejecutar desde GitHub Pages

El repositorio incluye `.github/workflows/pages.yml`.

1. Entre a **Settings → Pages**.
2. Seleccione **Source: GitHub Actions**.
3. GitHub ejecutará el workflow cuando haya cambios en `main`.
4. El workflow valida `app.js` con `node --check` antes de publicar.

> Si el repositorio privado no permite GitHub Pages bajo su plan actual, puede mantenerlo privado y utilizar la ejecución local descrita abajo, o cambiar la visibilidad según su política institucional.

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

Si la política de PowerShell bloquea scripts, puede ejecutar directamente:

```powershell
python -m http.server 8000
```

Luego abra `http://localhost:8000`.

## Cómo probar la aplicación

1. Abra la aplicación.
2. Presione **Probar ejemplo**.
3. Debe aparecer un documento de muestra en la vista previa.
4. La auditoría debe mostrar citas, referencias y correspondencia.
5. Pruebe **Descargar DOCX**, **Descargar HTML** y **Descargar auditoría**.

## Privacidad

Los archivos se procesan en el navegador. Esta versión no incluye base de datos, almacenamiento automático de documentos ni una API de IA del proyecto. Las bibliotecas externas del navegador se cargan desde CDN, por lo que se requiere conexión a Internet al iniciar la aplicación.

## Bibliotecas

- Mammoth.js 1.12.0: conversión de DOCX a HTML.
- PDF.js / pdfjs-dist 6.1.200: lectura de PDF.
- docx 9.7.1: generación de archivos Word en el navegador.

## Limitaciones

La auditoría es heurística y no sustituye una revisión académica completa. Deben revisarse manualmente autoría, títulos, cursivas, capitalización, DOI/URL, casos de autores corporativos, referencias legales, tablas, figuras y otros casos especiales de APA 7. La extracción desde PDF puede perder estructura porque el PDF representa una página final y no necesariamente la semántica original del documento.

## Estructura

```text
estiloAPA/
├── .github/workflows/pages.yml
├── app.js
├── index.html
├── styles.css
├── run-local.bat
├── run-local.ps1
└── README.md
```
