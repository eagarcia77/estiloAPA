# Instalación local — APA7 Academic Formatter v3.4.8

Esta guía explica cómo instalar y ejecutar **APA7 Academic Formatter v3.4.8** en un servidor web local o dentro de una red institucional.

## 1. Tipo de aplicación

APA7 Academic Formatter es una aplicación web estática basada principalmente en HTML, CSS y JavaScript. No requiere PHP, base de datos ni un servidor de aplicaciones para sus funciones principales.

La aplicación **no debe abrirse haciendo doble clic sobre `index.html`**. Debe servirse mediante HTTP/HTTPS porque utiliza módulos JavaScript (`type="module"`) y bibliotecas cargadas dinámicamente.

## 2. Requisitos

### Requisitos mínimos

- Windows 10/11, macOS o Linux.
- Navegador moderno: Microsoft Edge, Google Chrome o Firefox actualizado.
- Un servidor web local, por ejemplo:
  - Python 3 `http.server`;
  - Apache/XAMPP;
  - Microsoft IIS;
  - Nginx;
  - cualquier servidor estático que sirva `.html`, `.css` y `.js` correctamente.

### Conexión a Internet

La versión v3.4.8 utiliza bibliotecas externas desde `cdn.jsdelivr.net`:

- Mammoth `1.12.0` para importación DOCX;
- docx `9.7.1` para generación de archivos Word;
- pdfjs-dist `6.1.200` para lectura y reconstrucción de PDF.

Por esta razón, **el servidor local necesita acceso a Internet** para cargar esas dependencias en la versión actual. Los documentos seleccionados se procesan principalmente en el navegador; no se requiere una API key para utilizar la aplicación.

Si se necesita una instalación totalmente aislada de Internet, las bibliotecas anteriores deben descargarse y alojarse localmente, y deben modificarse las rutas CDN en `index.html`, `pdf-smart.js`, `pdf-original-media-v33.js`, `pdf-figure-recovery-v346.js` y `pdf-figure-recovery-v347.js`.

## 3. Archivos principales

El paquete incluye todos los archivos versionados del repositorio. Entre los más importantes se encuentran:

- `index.html` — interfaz principal.
- `styles.css` — estilos generales.
- `app.js` — importación, formato y lógica principal.
- `edit-stability-v348.js` — protección de edición de la vista previa.
- `pdf-smart.js` — reconstrucción de PDF.
- `pdf-original-media-v33.js` — preservación de medios PDF.
- `pdf-figure-recovery-v347.js` — recuperación actual de figuras PDF.
- `docx-images-v346.js` — importación de imágenes DOCX.
- `image-editor-v344.js` — inserción y edición manual de imágenes.
- `reference-format-v345.js` — formato APA 7 de referencias.
- `docx-banner-safe-v343.js` — exportación DOCX excluyendo el banner inicial.
- `html-enhance.js` — exportación HTML institucional.
- `run-local.bat` — inicio rápido en Windows con Python.
- `run-local.ps1` — inicio rápido desde PowerShell.

No elimine archivos JavaScript del paquete aunque algunos indiquen una versión anterior en el nombre. La versión 3.4.8 está compuesta por varios motores especializados con numeración independiente.

## 4. Opción recomendada para pruebas: Python 3

### Windows — usando `run-local.bat`

1. Descomprima el ZIP, por ejemplo en:

   `C:\APA7-Academic-Formatter`

2. Verifique que Python 3 esté instalado:

   `py --version`

   o:

   `python --version`

3. Haga doble clic en `run-local.bat`.

4. El navegador debe abrir:

   `http://localhost:8000/`

5. Mantenga abierta la ventana del servidor mientras utiliza la aplicación.

6. Para detener el servidor, cierre la ventana o presione `Ctrl + C`.

### Windows — manualmente

Abra PowerShell o Command Prompt dentro de la carpeta del proyecto y ejecute:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Luego abra:

`http://127.0.0.1:8000/`

### macOS / Linux

Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Luego abra:

`http://127.0.0.1:8000/`

> `python -m http.server` es adecuado para pruebas locales. No se recomienda como servidor público de producción.

## 5. Instalación con XAMPP / Apache en Windows

1. Instale XAMPP si no está instalado.
2. Descomprima el contenido del proyecto dentro de:

   `C:\xampp\htdocs\apa7formatter\`

3. La estructura debe quedar similar a:

```text
C:\xampp\htdocs\apa7formatter\
  index.html
  app.js
  styles.css
  edit-stability-v348.js
  ...
```

4. Abra **XAMPP Control Panel**.
5. Inicie **Apache**.
6. Abra en el navegador:

   `http://localhost/apa7formatter/`

No se requiere iniciar MySQL.

### Si Apache utiliza otro puerto

Si Apache está configurado, por ejemplo, en el puerto 8080:

`http://localhost:8080/apa7formatter/`

## 6. Instalación con Microsoft IIS

### Activar IIS

En Windows:

1. Abra **Turn Windows features on or off / Activar o desactivar las características de Windows**.
2. Active **Internet Information Services**.
3. Dentro de **World Wide Web Services → Common HTTP Features**, active al menos:
   - Default Document;
   - Static Content;
   - HTTP Errors.
4. Aplique los cambios.

### Copiar la aplicación

1. Cree:

   `C:\inetpub\wwwroot\apa7formatter\`

2. Copie **todos** los archivos del ZIP dentro de esa carpeta.

3. Abra:

   `http://localhost/apa7formatter/`

### Configuración recomendada de IIS

- `index.html` debe estar configurado como documento predeterminado.
- `.js` debe servirse como JavaScript.
- `.css` debe servirse como CSS.
- No se requiere ASP.NET, PHP ni una base de datos.

Si una política institucional bloquea `cdn.jsdelivr.net`, las funciones DOCX/PDF pueden fallar hasta que el dominio sea permitido o se instalen las bibliotecas de forma local.

## 7. Instalación con Apache en Linux

Ejemplo para Ubuntu/Debian:

```bash
sudo apt update
sudo apt install apache2
sudo mkdir -p /var/www/html/apa7formatter
sudo cp -R ./* /var/www/html/apa7formatter/
sudo systemctl restart apache2
```

Abra:

`http://localhost/apa7formatter/`

Desde otro equipo de la misma red puede utilizar la dirección IP del servidor, por ejemplo:

`http://192.168.1.50/apa7formatter/`

## 8. Instalación con Nginx

Copie la carpeta a una ubicación servida por Nginx, por ejemplo:

`/var/www/apa7formatter`

Configuración básica de ejemplo:

```nginx
server {
    listen 80;
    server_name localhost;
    root /var/www/apa7formatter;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Reinicie Nginx y acceda mediante el host configurado.

## 9. Uso dentro de una red local

Para pruebas con Python accesibles desde otros equipos de la red:

```powershell
py -m http.server 8000 --bind 0.0.0.0
```

Luego obtenga la IPv4 del equipo servidor con:

```powershell
ipconfig
```

Si la dirección es, por ejemplo, `192.168.1.50`, otros equipos pueden abrir:

`http://192.168.1.50:8000/`

### Precauciones

- Permita el puerto en Windows Firewall solo para la red privada/institucional necesaria.
- No exponga `python -m http.server` directamente a Internet.
- Para uso institucional permanente, utilice IIS, Apache o Nginx y considere HTTPS.

## 10. Prueba después de instalar

Realice esta validación:

1. Abra la aplicación y confirme que muestra **v3.4.8**.
2. Presione **Probar ejemplo**.
3. Confirme que aparece contenido en **3. Vista previa y exportación**.
4. Edite una oración, borre texto y pegue contenido para comprobar la edición protegida.
5. Cargue un DOCX con una imagen y confirme que la imagen se incorpora.
6. Cargue un PDF con figuras y espere a que termine la recuperación de imágenes.
7. Verifique que el banner inicial del módulo no se exporte como figura.
8. Revise la sección Referencias: doble espacio, sangría francesa y DOI/URL cuando estén presentes.
9. Descargue un DOCX.
10. Descargue un HTML.

## 11. Problemas comunes

### La página abre, pero algunos botones no funcionan

Compruebe la consola del navegador (`F12 → Console`). Si aparecen errores relacionados con módulos o CORS, confirme que la aplicación se abrió mediante `http://localhost...` y no con `file:///...`.

### DOCX no carga o no genera Word

Verifique que el navegador pueda acceder a:

- `cdn.jsdelivr.net/npm/mammoth@1.12.0/`
- `cdn.jsdelivr.net/npm/docx@9.7.1/`

### PDF no procesa figuras

Verifique acceso a:

- `cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/`

También tenga presente que PDF es un formato de presentación final y algunas imágenes o estructuras pueden requerir inserción manual.

### PowerShell bloquea el script

Puede ejecutar temporalmente:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-local.ps1
```

Este cambio aplica únicamente a la sesión actual de PowerShell.

### El puerto 8000 está ocupado

Utilice otro, por ejemplo:

```powershell
py -m http.server 8080 --bind 127.0.0.1
```

Y abra:

`http://127.0.0.1:8080/`

## 12. Seguridad y privacidad

La aplicación procesa los archivos seleccionados principalmente dentro del navegador. No obstante:

- las bibliotecas JavaScript externas se descargan desde CDN en la versión actual;
- no debe afirmarse cumplimiento FERPA, HIPAA u otro marco regulatorio sin una evaluación formal;
- para documentos institucionales sensibles, evalúe una instalación aislada con dependencias locales y políticas institucionales de seguridad;
- utilice HTTPS si la aplicación se ofrece de forma permanente a través de una red institucional o Internet.

## 13. Actualización del servidor

Para actualizar una instalación existente:

1. haga copia de seguridad de la carpeta actual;
2. descargue el ZIP de la nueva versión;
3. detenga el servidor si es necesario;
4. sustituya todos los archivos del proyecto;
5. reinicie el servidor;
6. borre la caché del navegador o utilice `Ctrl + F5`;
7. confirme la versión visible en la interfaz;
8. repita la lista de pruebas del apartado 10.

No se recomienda mezclar archivos de versiones diferentes.

## 14. Archivos de inicio rápido incluidos

### `run-local.bat`

Para Windows con Python instalado. Inicia un servidor en el puerto 8000 y abre el navegador.

### `run-local.ps1`

Alternativa para PowerShell. Detecta `py`, `python` o `python3` y levanta el servidor en el puerto 8000.

## 15. Soporte del proyecto

**Desarrollador:** Dr. Eduardo Augusto García Rodríguez, Ed.D.  
**Repositorio:** https://github.com/eagarcia77/estiloAPA  
**Aplicación pública:** https://eagarcia77.github.io/estiloAPA/  
**Versión de esta guía:** 3.4.8
