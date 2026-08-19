# APA7 Module Formatter

Aplicación web para importar módulos académicos y generar una copia normalizada con reglas de formato APA 7.

## Funciones incluidas

- Carga múltiple de archivos `.docx`, `.pdf`, `.txt`, `.md`, `.html` y `.htm`.
- Procesamiento local en el navegador; los documentos no se envían a una API del proyecto.
- Conversión de DOCX a HTML mediante Mammoth.js.
- Extracción de texto de PDF mediante PDF.js.
- Márgenes de 1 pulgada y doble espacio.
- Fuentes compatibles configurables: Times New Roman 12, Arial 11, Calibri 11 y Georgia 11.
- Sangría de primera línea de 0.5 pulg. en párrafos regulares.
- Identificación de la sección `Referencias` / `References`.
- Sangría francesa de 0.5 pulg. para referencias.
- Identificación básica de encabezados, figuras, notas, URLs y citas parentéticas autor-año.
- Auditoría rápida de posibles problemas que requieren revisión humana.
- Vista previa editable antes de exportar.
- Exportación a `.docx` y `.html`.
- Diseño responsivo y controles accesibles para teclado.

## Uso

1. Abra la aplicación.
2. Seleccione o arrastre uno o varios archivos.
3. Seleccione la fuente APA deseada.
4. Presione **Formatear en APA 7**.
5. Revise la sección **Auditoría rápida**.
6. Corrija cualquier detalle directamente en la vista previa.
7. Descargue el resultado en DOCX o HTML.

## Privacidad

Esta versión procesa los archivos dentro del navegador. El repositorio no incluye base de datos, almacenamiento de documentos ni una API de inteligencia artificial.

## Limitaciones de la versión 1.0

- Un PDF contiene principalmente una representación final de la página; al extraer texto puede perder estructura, tablas, columnas, imágenes y estilos originales.
- La exportación DOCX reconstruye el documento con formato limpio; no pretende reproducir pixel por pixel el archivo original.
- La auditoría APA es heurística. Deben revisarse manualmente autoría, títulos, DOI/URL, cursivas, datos bibliográficos, correspondencia entre citas y referencias, tablas, figuras y casos especiales de APA 7.
- Las imágenes importadas desde DOCX pueden requerir revisión de texto alternativo y posición.

## Bibliotecas del navegador

- Mammoth.js 1.12.0 para lectura de DOCX.
- PDF.js 6.1.200 para extracción de texto de PDF.
- docx 9.7.1 para generación de archivos Word.

## GitHub Pages

El repositorio incluye un workflow en `.github/workflows/pages.yml`. Para publicar la aplicación, habilite **Settings → Pages → Source: GitHub Actions** en el repositorio. Después, cada actualización a `main` ejecutará el despliegue.

## Estructura

```text
estiloAPA/
├── .github/
│   └── workflows/
│       └── pages.yml
├── app.js
├── index.html
├── styles.css
└── README.md
```

## Próximas mejoras sugeridas

- Comparación automática entre citas en el texto y lista de referencias.
- Detección más avanzada de DOI, URL, autores y títulos.
- Conservación de imágenes y tablas al exportar DOCX.
- Reporte detallado descargable de cumplimiento APA 7.
- Plantillas específicas para módulos de Blackboard Ultra.
- Validaciones de accesibilidad WCAG/WAVE más profundas.
