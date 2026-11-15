// Gemini assistance for Academic Formatter. No API keys are stored in the browser.
const editor = document.getElementById("preview");
const section = document.getElementById("geminiAssistant");
if (editor && section) {
  const endpoint = section.querySelector("#geminiEndpoint");
  const task = section.querySelector("#geminiTask");
  const scope = section.querySelector("#geminiScope");
  const consent = section.querySelector("#geminiConsent");
  const run = section.querySelector("#geminiRun");
  const output = section.querySelector("#geminiOutput");
  const status = section.querySelector("#geminiStatus");
  const copy = section.querySelector("#geminiCopy");
  const MAX_CHARS = 24000;
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
    output.value = "";
    copy.disabled = true;
    if (!consent.checked) { status.textContent = "Confirme el envío de contenido antes de continuar."; return; }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.value, content }),
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store"
      });
      if (!response.ok) throw new Error("El servidor respondió con HTTP " + response.status + ".");
      const data = await response.json();
      if (typeof data.suggestion !== "string") throw new Error("El servidor no devolvió sugerencias válidas.");
      output.value = data.suggestion.slice(0, 30000);
      copy.disabled = !output.value;
      status.textContent = "Sugerencias recibidas. Revise antes de incorporar cualquier cambio.";
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "La solicitud excedió el tiempo de espera." : "No se pudo conectar: " + error.message;
    } finally { clearTimeout(timeout); run.disabled = false; }
  });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(output.value); status.textContent = "Sugerencias copiadas."; }
    catch { output.focus(); output.select(); status.textContent = "Seleccione y copie el texto manualmente."; }
  });
}
