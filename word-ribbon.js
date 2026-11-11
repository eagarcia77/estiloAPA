// EstiloAPA - Word-style ribbon that reuses the existing, tested editor commands.
// All legacy controls are moved, never cloned, so their event handlers survive.
const RIBBON_TABS = [
  ["archivo", "Archivo"],
  ["inicio", "Inicio"],
  ["insertar", "Insertar"],
  ["diseno", "Diseño APA"],
  ["revisar", "Revisar"],
  ["vista", "Vista"],
];

function ribbonButton(label, action, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word-ribbon-action";
  button.textContent = label;
  if (options.title) button.title = options.title;
  button.addEventListener("click", action);
  return button;
}

function ribbonGroup(label) {
  const group = document.createElement("div");
  group.className = "word-ribbon-group";
  const caption = document.createElement("span");
  caption.className = "word-ribbon-group-label";
  caption.textContent = label;
  group.append(caption);
  return group;
}

function ribbonProxy(label, targetId, options = {}) {
  const proxy = ribbonButton(label, () => {
    const target = document.getElementById(targetId);
    if (target && !target.disabled) target.click();
  }, options);
  const target = document.getElementById(targetId);
  if (target) {
    proxy.disabled = target.disabled;
    const observer = new MutationObserver(() => { proxy.disabled = target.disabled; });
    observer.observe(target, { attributes: true, attributeFilter: ["disabled"] });
  } else {
    proxy.disabled = true;
  }
  return proxy;
}

function initWordRibbon() {
  const shell = document.getElementById("apaEditorShell");
  const toolbar = document.getElementById("apaEditorToolbar");
  const preview = document.getElementById("preview");
  if (!shell || !toolbar || !preview || document.getElementById("wordRibbonTabs")) return;

  const tabs = document.createElement("div");
  tabs.id = "wordRibbonTabs";
  tabs.className = "word-ribbon-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Cinta de opciones de EstiloAPA");

  const panels = document.createElement("div");
  panels.id = "wordRibbonPanels";
  panels.className = "word-ribbon-panels";
  const panelMap = new Map();
  const tabMap = new Map();

  for (const [id, name] of RIBBON_TABS) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = "word-ribbon-tab-" + id;
    tab.textContent = name;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "word-ribbon-panel-" + id);
    tab.setAttribute("aria-selected", "false");
    tab.tabIndex = -1;

    const panel = document.createElement("div");
    panel.id = "word-ribbon-panel-" + id;
    panel.className = "word-ribbon-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.hidden = true;
    tabs.append(tab);
    panels.append(panel);
    tabMap.set(id, tab);
    panelMap.set(id, panel);
    tab.addEventListener("click", () => activate(id));
    tab.addEventListener("keydown", event => {
      const index = RIBBON_TABS.findIndex(([key]) => key === id);
      const movement = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!movement) return;
      event.preventDefault();
      const next = RIBBON_TABS[(index + movement + RIBBON_TABS.length) % RIBBON_TABS.length][0];
      activate(next);
      tabMap.get(next).focus();
    });
  }

  function activate(id) {
    for (const [key, tab] of tabMap) {
      const active = key === id;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panelMap.get(key).hidden = !active;
    }
  }

  // Existing toolbar contains precisely eight functional groups.
  const groups = [...toolbar.children].filter(el => el.classList.contains("tool-group"));
  function moveGroup(index, target) {
    const group = groups[index];
    if (group) {
      group.classList.add("word-ribbon-legacy-group");
      target.append(group);
    }
  }

  // Group 0 history, 1 font, 2 styles, 3 alignment, 4 paragraph, 5 APA presets,
  // 6 insert, 7 APA rules. Moving live nodes preserves existing listeners.
  moveGroup(0, panelMap.get("inicio"));
  moveGroup(1, panelMap.get("inicio"));
  moveGroup(2, panelMap.get("inicio"));
  moveGroup(3, panelMap.get("inicio"));
  moveGroup(4, panelMap.get("inicio"));

  const insertPanel = panelMap.get("insertar");
  moveGroup(6, insertPanel);
  const insertImage = document.getElementById("insertManualImage") ||
    document.querySelector("#apaEditorShell button[title*='imagen'],#apaEditorShell button[title*='Imagen']");
  if (insertImage) {
    const group = ribbonGroup("Imágenes");
    group.append(ribbonButton("Insertar imagen", () => insertImage.click()));
    insertPanel.append(group);
  }

  const designPanel = panelMap.get("diseno");
  moveGroup(5, designPanel);
  moveGroup(7, designPanel);
  const profileGroup = ribbonGroup("Perfil académico");
  profileGroup.append(ribbonButton("Seleccionar perfil", () => document.getElementById("formatProfile")?.focus()));
  profileGroup.append(ribbonButton("Fuente del documento", () => document.getElementById("fontFamily")?.focus()));
  designPanel.append(profileGroup);

  const filePanel = panelMap.get("archivo");
  const fileGroup = ribbonGroup("Documentos");
  fileGroup.append(ribbonProxy("Aplicar formato", "formatBtn"));
  fileGroup.append(ribbonProxy("Probar ejemplo", "demoBtn"));
  fileGroup.append(ribbonProxy("Descargar Word", "downloadDocxBtn"));
  fileGroup.append(ribbonProxy("Exportar HTML", "downloadHtmlBtn"));
  fileGroup.append(ribbonProxy("Limpiar documento", "clearBtn"));
  filePanel.append(fileGroup);

  const reviewGroup = ribbonGroup("Revisión académica");
  reviewGroup.append(ribbonProxy("Auditar APA 7", "reauditBtn"));
  reviewGroup.append(ribbonProxy("Descargar informe", "downloadAuditBtn"));
  panelMap.get("revisar").append(reviewGroup);

  const viewGroup = ribbonGroup("Vista del documento");
  viewGroup.append(ribbonButton("Enfocar editor", () => preview.focus()));
  viewGroup.append(ribbonButton("Acercar", () => setZoom(0.1)));
  viewGroup.append(ribbonButton("Alejar", () => setZoom(-0.1)));
  viewGroup.append(ribbonButton("100 %", () => setZoom(0)));
  panelMap.get("vista").append(viewGroup);
  let zoom = 1;
  function setZoom(delta) {
    zoom = delta === 0 ? 1 : Math.min(1.5, Math.max(0.7, Math.round((zoom + delta) * 10) / 10));
    preview.style.zoom = String(zoom);
    updateDocumentStats();
  }

  // Word-like document statistics, updated without rewriting editable content.
  const statusLine = document.createElement("div");
  statusLine.className = "word-ribbon-status";
  statusLine.id = "wordRibbonStatus";
  statusLine.setAttribute("role", "status");
  statusLine.setAttribute("aria-live", "off");
  function updateDocumentStats() {
    const content = (preview.textContent || "").trim();
    const words = content ? content.split(/\s+/u).length : 0;
    const chars = content.length;
    statusLine.textContent = `${words} palabras · ${chars} caracteres · Zoom ${Math.round(zoom * 100)} %`;
  }
  preview.addEventListener("input", updateDocumentStats);
  new MutationObserver(() => updateDocumentStats()).observe(preview, { childList: true, subtree: true, characterData: true });
  updateDocumentStats();
  // Existing shell remains the editing parent. Hide the now-empty toolbar.
  toolbar.hidden = true;
  shell.prepend(panels);
  shell.prepend(tabs);
  shell.append(statusLine);
  shell.classList.add("word-ribbon-enabled");
  activate("inicio");
  window.EstiloAPARibbon = { activate };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWordRibbon);
} else {
  initWordRibbon();
}
