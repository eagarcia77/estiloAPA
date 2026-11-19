// Gemini assistance for Academic Formatter. No API keys are stored in the browser.
const editor = document.getElementById("preview");
const section = document.getElementById("geminiAssistant");
if (editor && section) {
  // Keep Gemini visible beside the editor rather than below a long document.
  const editorPanel = editor.closest(".preview-panel");
  const toolbar = editorPanel?.querySelector(".preview-toolbar");
  if (toolbar) {
    toolbar.after(section);
    section.classList.remove("simple-secondary");
    section.style.cssText = "margin: 12px 0; padding: 12px 16px; border: 1px solid #cbd5df; border-radius: 10px; background: #f7fafc;";
    section.querySelector("summary").style.cssText = "cursor: pointer; font-weight: 700; color: #175e50;";
  }
  const endpoint = section.querySelector("#geminiEndpoint");
  const task = section.querySelector("#geminiTask");
  const accessToken = section.querySelector("#geminiAccessToken");
  const scope = section.querySelector("#geminiScope");
  const consent = section.querySelector("#geminiConsent");
  const run = section.querySelector("#geminiRun");
  const output = section.querySelector("#geminiOutput");
  const status = section.querySelector("#geminiStatus");
  const copy = section.querySelector("#geminiCopy");
  const MAX_CHARS = 24000;
  const counter = section.querySelector("#geminiContentCount");
  const refreshCount = () => {
    const content = scope.value === "selection" ? selectedText() : editor.innerText.trim();
    counter.textContent = scope.value === "selection"
      ? (content ? "Selección: " + content.length + " caracteres." : "Seleccione texto dentro del documento.")
      : "Documento: " + content.length + " de " + MAX_CHARS + " caracteres permitidos.";
  };
  scope.addEventListener("change", refreshCount);
  editor.addEventListener("input", refreshCount);
  document.addEventListener("selectionchange", refreshCount);
  refreshCount();
  const safeEndpoint = value => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Utilice una dirección HTTPS válida del servidor Gemini.");
    return url;
  };
  const selectedText = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return "";
    return selection.toString().trim();
  };
  run.addEventListener("click", async () => {
    if (!consent.checked) { status.textContent = "Confirme el envío de contenido antes de continuar."; return; }
    if (!accessToken.value.trim()) { section.querySelector("#geminiConnectionSettings").open = true; status.textContent = "La conexión todavía requiere activar el acceso seguro por usuario. Para la prueba actual, introduzca la clave temporal en Configuración de conexión."; return; }
    let url;
    try { url = safeEndpoint(endpoint.value.trim()); }
    catch (error) { status.textContent = error.message; return; }
    const content = scope.value === "selection" ? selectedText() : editor.innerText.trim();
    if (!content) { status.textContent = "Seleccione texto dentro del editor o utilice el documento completo."; return; }
    if (content.length > MAX_CHARS) { status.textContent = "El contenido excede 24,000 caracteres. Seleccione un fragmento más corto."; return; }
    run.disabled = true;
    status.textContent = "Solicitando sugerencias a Gemini…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken.value.trim() },
        body: JSON.stringify({ task: task.value, content }),
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store"
      });
      if (!response.ok) {
        let serverMessage = "";
        try {
          const detail = await response.json();
          if (typeof detail.error === "string") serverMessage = detail.error.slice(0, 240);
        } catch { /* Older Worker deployments may return a generic error. */ }
        throw new Error(serverMessage || ("El servidor respondió con HTTP " + response.status + "."));
      }
      const data = await response.json();
      if (typeof data.suggestion !== "string") throw new Error("El servidor no devolvió sugerencias válidas.");
      output.value = data.suggestion.slice(0, 30000);
      copy.disabled = !output.value;
      status.textContent = "Sugerencias recibidas. Revise antes de incorporar cualquier cambio.";
    } catch (error) {
      const msg = error.name === "AbortError" ? "La solicitud excedió el tiempo de espera." : error.message;
      status.textContent = "No se pudo completar la revisión: " + msg + (/HTTP 502/.test(msg) ? " Revise si el Worker de Cloudflare tiene publicado el código más reciente." : "");
    } finally { clearTimeout(timeout); run.disabled = false; copy.disabled = !output.value; }
  });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(output.value); status.textContent = "Sugerencias copiadas."; }
    catch { output.focus(); output.select(); status.textContent = "Seleccione y copie el texto manualmente."; }
  });
}
