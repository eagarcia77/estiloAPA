# Gemini en Academic Formatter — configuración del servidor

La interfaz de GitHub Pages no llama directamente a Google Gemini. El archivo `cloudflare/gemini-worker.js` contiene un intermediario para Cloudflare Workers que conserva la clave de Google como secreto. **El servidor aún requiere despliegue y configuración.**

## Preparación

1. Cree una clave de Gemini API en Google AI Studio y configure límites de consumo y facturación según su cuenta. No publique la clave ni la escriba en el editor web.
2. Cree una cuenta Cloudflare y utilice Wrangler desde su computadora (Node.js instalado):
   ```sh
   npx wrangler login
   npx wrangler deploy cloudflare/gemini-worker.js --name academic-formatter-gemini
   npx wrangler secret put GEMINI_API_KEY --name academic-formatter-gemini
   npx wrangler secret put APP_ACCESS_TOKEN --name academic-formatter-gemini
   ```
3. Para `APP_ACCESS_TOKEN`, utilice un secreto aleatorio de **al menos 24 caracteres** diferente de la clave API de Google. No lo añada a GitHub ni a un archivo de configuración público.
4. Abra Academic Formatter, despliegue «Asistente IA · Gemini», escriba la URL HTTPS del Worker (por ejemplo, la URL que Wrangler muestra después del despliegue) y la clave de acceso del servidor.
5. Seleccione un fragmento, marque el consentimiento y solicite una revisión. Compruebe que el resultado aparece en el cuadro de sugerencias y que el documento original no se modifica.

## Seguridad y limitaciones

- La aplicación no guarda la clave de acceso en almacenamiento persistente. El Worker exige un token secreto y restringe CORS al origen `https://eagarcia77.github.io`.
- CORS no es autenticación: el token es imprescindible. Este esquema de token compartido es apropiado para una prueba privada, **no para un servicio público multiusuario**.
- Antes de abrir el servicio a otros usuarios, implemente identidad por usuario (p. ej. Cloudflare Access), cuotas y limitación de solicitudes por identidad, registro de consumo sin contenidos y protección contra abuso. Restrinja permisos y cuotas de la API de Google.
- Los documentos enviados a Gemini salen del navegador y se procesan por el Worker y Google. No envíe datos confidenciales sin autorización institucional y revisión de los términos de privacidad.
- El modelo predeterminado es `gemini-2.5-flash`. Si no está disponible para su proyecto, configure la variable `GEMINI_MODEL` con un modelo compatible.
- Las respuestas de IA son sugerencias, no validaciones definitivas de APA 7 ni verificaciones externas de referencias. Revise todo antes de copiar al documento.
- El Worker solo acepta hasta 24,000 caracteres por solicitud; el frontend espera hasta 45 segundos.
