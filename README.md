# APA7 Academic Formatter v3.4.8

Aplicación web para importar, revisar, editar y exportar documentos académicos con formato **APA 7**, con énfasis en módulos institucionales, tesis y disertaciones. El proyecto se ejecuta principalmente en el navegador y está diseñado para conservar la estructura del documento original mientras permite realizar correcciones antes de exportar el resultado.

**Aplicación:** https://eagarcia77.github.io/estiloAPA/

**Repositorio:** https://github.com/eagarcia77/estiloAPA

---

## Autor y desarrollador

**Dr. Eduardo Augusto García Rodríguez, Ed.D.**  
Desarrollador Curricular / Curriculum Developer  
Universidad Interamericana de Puerto Rico — Recinto de San Germán

Áreas de trabajo e interés profesional:

- desarrollo curricular y diseño instruccional;
- educación en línea y educación a distancia;
- administración y uso académico de LMS;
- Blackboard Ultra, Canvas y Moodle;
- desarrollo y evaluación de cursos en línea;
- accesibilidad educativa y diseño universal para el aprendizaje (DUA);
- inteligencia artificial aplicada a la educación superior;
- tecnología educativa, análisis de datos y transformación digital;
- apoyo y desarrollo profesional de la facultad.

**LinkedIn:** https://www.linkedin.com/in/eduardoagarcia2814

**GitHub:** https://github.com/eagarcia77

---

## Propósito del proyecto

APA7 Academic Formatter busca facilitar la preparación y revisión de documentos académicos mediante un flujo de trabajo visual y editable. La aplicación no pretende sustituir la revisión académica humana ni la consulta del *Publication Manual of the American Psychological Association*, sino servir como herramienta de apoyo para:

1. importar documentos;
2. reconstruir su estructura;
3. aplicar reglas visibles de APA 7;
4. auditar elementos académicos;
5. editar el resultado directamente en la vista previa;
6. conservar tablas, figuras e imágenes cuando sea posible;
7. exportar una copia limpia en DOCX o HTML.

---

## Versión actual: v3.4.8 — Edición protegida

La versión **3.4.8** incorpora un sistema de protección para la sección **3. Vista previa y exportación**.

Mientras el usuario está escribiendo, borrando, cortando, pegando o reemplazando texto, los normalizadores automáticos de estructura quedan temporalmente aplazados. Esto evita que un `MutationObserver` u otro proceso de formato vuelva a reconstruir nodos del documento mientras el cursor está activo.

La edición protegida cubre, entre otros, los procesos relacionados con:

- perfil institucional del módulo;
- listas numeradas;
- tablas APA 7;
- figuras e imágenes;
- recuperación de figuras PDF;
- clasificación de imágenes DOCX;
- referencias APA 7;
- semántica y estructura del documento.

Las reglas pendientes pueden volver a ejecutarse al salir del área editable, volver a auditar o exportar el documento.

---

## Funciones principales

### Importación de documentos

Formatos admitidos actualmente:

- DOCX
- PDF
- TXT
- MD
- HTML / HTM

Los documentos se procesan localmente en el navegador siempre que las bibliotecas utilizadas lo permitan.

### Perfiles de formato

La interfaz incluye perfiles para:

- **Módulo institucional — APA 7 estricto**
- **Disertación doctoral — plantilla institucional**
- **Tesis de maestría — formato institucional**
- **APA 7 estándar**

El perfil institucional de módulo utiliza Arial de 12 pt y aplica reglas específicas de estructura, encabezados, tablas, figuras y referencias.

### Vista previa editable

La sección **3. Vista previa y exportación** utiliza un documento `contenteditable` que permite:

- escribir texto nuevo;
- modificar palabras y párrafos;
- borrar con Backspace o Delete;
- copiar, cortar y pegar;
- seleccionar y reemplazar contenido;
- aplicar estilos APA desde la barra de herramientas;
- insertar tablas;
- insertar rótulos de figuras;
- insertar imágenes manualmente;
- editar o eliminar imágenes insertadas;
- añadir enlaces;
- insertar saltos de página;
- aplicar formato de párrafo y referencias.

### Imágenes DOCX

Las imágenes incrustadas en archivos DOCX se convierten mediante Mammoth a datos de imagen (`data:image/...`) durante el proceso de importación. Esto permite que las imágenes formen parte del documento editable desde la conversión inicial.

### Recuperación de figuras PDF

La recuperación PDF actual corresponde a **v3.4.7** y fue diseñada para trabajar con la estructura que produce el importador principal.

El sistema puede recuperar figuras cuando una página PDF llega a la vista previa como un solo párrafo con múltiples saltos `<br>`. El recuperador puede dividir ese bloque en el punto donde corresponde insertar la figura.

También contempla figuras ubicadas después de la última línea de una página.

Cuando una figura ya contiene dentro de la propia imagen:

- `Figura X`;
- título;
- Nota;

se conserva como figura auto-rotulada y se evita crear un caption duplicado.

### Banner inicial

El banner inicial de identificación del módulo se reconoce como un elemento diferente de una figura académica.

- No consume numeración de figura.
- No recibe `Figura X`.
- Se mantiene internamente cuando es necesario para preservar el proceso de extracción.
- Se excluye del resultado final del módulo cuando corresponde.

### Inserción manual de imágenes

Si una imagen no puede recuperarse automáticamente, la barra de edición permite utilizar **+ Insertar imagen** para colocarla manualmente en la posición seleccionada.

Las imágenes manuales pueden incluir:

- número de figura;
- título;
- imagen;
- Nota, cuando corresponda.

También pueden editarse o eliminarse desde la misma vista previa.

---

## Figuras en APA 7

Para figuras que requieren caption externo, la aplicación utiliza la estructura:

```text
Figura X
Título de la figura
[imagen]
Nota. Texto de la nota, cuando corresponda.
```

Reglas visuales principales:

- `Figura X` en negrita;
- título en cursiva;
- alineación a la izquierda;
- imagen debajo del título;
- Nota debajo de la imagen;
- sin duplicar captions que ya formen parte de la imagen original.

---

## Tablas en APA 7

El proyecto aplica una presentación académica sin líneas verticales y conserva únicamente las reglas horizontales esenciales.

La estructura utilizada es:

```text
Tabla X
Título de la tabla
[tabla]
Nota. Cuando corresponda.
```

Características:

- número de tabla en negrita;
- título en cursiva;
- encabezados identificados semánticamente;
- ausencia de bordes verticales;
- líneas horizontales esenciales;
- alineación diferenciada para contenido textual y numérico.

---

## Referencias APA 7

El motor actual de referencias aplica correcciones conservadoras. No inventa información bibliográfica que no se encuentre en la fuente.

Entre las reglas aplicadas se incluyen:

- encabezado **Referencias** centrado y en negrita;
- doble espacio;
- alineación a la izquierda;
- sangría francesa de 0.5 pulgadas;
- ausencia de espacio adicional entre referencias;
- orden alfabético cuando la opción está activada;
- normalización de DOI existentes al formato `https://doi.org/...`;
- preservación y creación de enlaces para DOI y URL;
- conservación de cursivas existentes;
- aplicación conservadora de cursivas cuando el patrón bibliográfico puede identificarse con suficiente seguridad.

La herramienta **no debe inventar** autores, fechas, títulos, volúmenes, páginas, editoriales, DOI o URL ausentes.

---

## Auditoría APA 7

La aplicación genera una auditoría heurística del documento y puede revisar elementos como:

- sección de Referencias;
- citas autor-año;
- referencias detectadas;
- citas sin referencia coincidente;
- referencias sin cita detectada;
- DOI y URL;
- imágenes sin texto alternativo;
- listas numeradas;
- tablas;
- figuras;
- medios recuperados del documento original.

La puntuación producida por la aplicación es una ayuda diagnóstica y **requiere revisión académica humana**.

---

## Exportación

La aplicación permite descargar:

### DOCX

El exportador intenta conservar:

- orden actual de la vista previa;
- contenido editado por el usuario;
- encabezados;
- párrafos;
- listas;
- tablas;
- figuras;
- imágenes cargadas o recuperadas;
- imágenes insertadas manualmente;
- referencias con formato APA 7;
- numeración de páginas cuando está activada.

En el perfil institucional, el banner inicial se excluye de la exportación del módulo.

### HTML

La exportación HTML genera una versión independiente del documento con estilos académicos incorporados y sin los controles internos del editor.

---

## Historial reciente

### v3.4.8

- protección de edición en **Vista previa y exportación**;
- aplazamiento de normalizadores mientras el usuario escribe o borra;
- reducción de pérdidas de texto provocadas por reconstrucciones automáticas del DOM;
- normalización diferida antes de auditoría o exportación.

### v3.4.7

- recuperación PDF compatible con páginas representadas como un solo párrafo con `<br>`;
- división del párrafo en la posición de la figura;
- recuperación de figuras al final de página;
- preservación de figuras con caption integrado;
- exclusión del banner inicial.

### v3.4.6

- importación determinística de imágenes DOCX mediante Mammoth `convertImage`;
- recuperación PDF reforzada;
- espera de recuperación de figuras antes de determinadas exportaciones.

### v3.4.5

- incorporación de imágenes cargadas desde documentos;
- normalización de bloques de imagen;
- mejoras al formato APA 7 de Referencias;
- normalización conservadora de DOI y URL.

### v3.4.4

- botón **+ Insertar imagen** en la barra de edición;
- edición y eliminación manual de imágenes;
- inserción de figuras en la posición seleccionada.

### v3.4

- base estable utilizada para el desarrollo actual;
- preservación de medios originales de PDF;
- diferenciación entre banner y figuras;
- preservación de figuras auto-rotuladas sin duplicar caption.

---

## Arquitectura funcional

El proyecto utiliza JavaScript en el navegador y módulos especializados para tareas concretas. Entre los componentes activos se encuentran motores para:

- importación principal;
- reconstrucción de PDF;
- recuperación de medios PDF;
- importación de imágenes DOCX;
- formato del perfil institucional;
- edición APA;
- protección de edición;
- listas numeradas;
- tablas y figuras;
- referencias;
- auditoría;
- exportación DOCX;
- exportación HTML.

La estrategia actual busca mantener los motores especializados separados para reducir cambios innecesarios en el contenido original.

---

## Validación y publicación

El repositorio utiliza **GitHub Actions** para validar la sintaxis JavaScript y verificar componentes críticos antes de publicar.

El flujo general es:

1. realizar cambios en `main`;
2. ejecutar validaciones automáticas con `node --check` y verificaciones específicas;
3. si la validación es satisfactoria, sincronizar `gh-pages` con el commit validado;
4. publicar la aplicación mediante GitHub Pages.

Configuración recomendada en GitHub:

**Settings → Pages → Deploy from a branch → gh-pages → / (root)**

---

## Limitaciones conocidas

PDF es un formato de presentación final y no siempre conserva información semántica suficiente para reconstruir perfectamente un documento editable.

Pueden requerir revisión manual:

- figuras complejas;
- imágenes vectoriales;
- cuadros de texto;
- columnas múltiples;
- tablas complejas;
- documentos escaneados;
- PDFs sin capa de texto;
- captions incorporados como parte de una imagen;
- orden visual ambiguo.

Cuando esté disponible, un **DOCX original** suele ser una fuente más confiable para reconstruir texto, estructura e imágenes.

---

## Accesibilidad

El proyecto procura mantener prácticas de accesibilidad web, incluyendo:

- estructura semántica;
- navegación por teclado;
- texto alternativo para imágenes cuando está disponible;
- controles identificables;
- contraste legible;
- edición y exportación sin depender exclusivamente de elementos visuales.

Las imágenes que no contienen una descripción adecuada deben revisarse manualmente para asegurar un texto alternativo significativo.

---

## Uso académico responsable

Los resultados del formateador deben revisarse antes de utilizarse como versión final de un documento académico. APA 7 contiene reglas que dependen del tipo exacto de fuente, contexto académico y estructura del documento.

El proyecto debe utilizarse como **herramienta de apoyo para edición, revisión y control de calidad**, no como sustituto de la evaluación académica profesional.

---

## Desarrollado por

**Dr. Eduardo Augusto García Rodríguez, Ed.D.**  
Desarrollador Curricular — Universidad Interamericana de Puerto Rico, Recinto de San Germán  
GitHub: https://github.com/eagarcia77  
LinkedIn: https://www.linkedin.com/in/eduardoagarcia2814
