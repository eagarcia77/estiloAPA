// EstiloAPA - Word-style ribbon that reuses the existing, tested editor commands.
// All legacy controls are moved, never cloned, so their event handlers survive.
const RIBBON_TABS = [
  ["archivo", "File"],
  ["inicio", "Home"],
  ["insertar", "Insert"],
  ["diseno", "APA Layout"],
  ["revisar", "Review"],
  ["vista", "View"],
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
  tabs.setAttribute("aria-label", "EstiloAPA Ribbon");

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
    // Clicking a tab expands a minimized Ribbon without replacing its commands.
    shell.classList.remove("word-ribbon-collapsed");
    if (typeof collapseButton !== "undefined") syncCollapseButton();
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
    const group = ribbonGroup("Images");
    group.append(ribbonButton("Insert Picture", () => insertImage.click()));
    insertPanel.append(group);
  }

  const designPanel = panelMap.get("diseno");
  moveGroup(5, designPanel);
  moveGroup(7, designPanel);
  const profileGroup = ribbonGroup("Academic Profile");
  profileGroup.append(ribbonButton("Choose Profile", () => document.getElementById("formatProfile")?.focus()));
  profileGroup.append(ribbonButton("Document Font", () => document.getElementById("fontFamily")?.focus()));
  designPanel.append(profileGroup);

  const filePanel = panelMap.get("archivo");
  const fileGroup = ribbonGroup("Documents");
  fileGroup.append(ribbonProxy("Apply Formatting", "formatBtn"));
  fileGroup.append(ribbonProxy("Try Sample", "demoBtn"));
  fileGroup.append(ribbonProxy("Export to Word", "downloadDocxBtn"));
  fileGroup.append(ribbonProxy("Export HTML", "downloadHtmlBtn"));
  fileGroup.append(ribbonProxy("Clear Document", "clearBtn"));
  filePanel.append(fileGroup);

  const reviewGroup = ribbonGroup("Academic Review");
  reviewGroup.append(ribbonProxy("Review APA 7", "reauditBtn"));
  reviewGroup.append(ribbonProxy("Download Report", "downloadAuditBtn"));
  panelMap.get("revisar").append(reviewGroup);

  const viewGroup = ribbonGroup("Document View");
  viewGroup.append(ribbonButton("Focus Editor", () => preview.focus()));
  const layoutButton = ribbonButton("Page View", () => {
    const enabled = document.body.classList.toggle("apa-page-view");
    layoutButton.textContent = enabled ? "Full Width" : "Page View";
    layoutButton.setAttribute("aria-pressed", String(enabled));
    layoutButton.title = enabled ? "Expand document to available screen width" : "Show US Letter page preview";
  });
  layoutButton.setAttribute("aria-pressed", "false");
  layoutButton.title = "Show US Letter page preview";
  viewGroup.append(layoutButton);
  viewGroup.append(ribbonButton("Zoom In", () => setZoom(0.1)));
  viewGroup.append(ribbonButton("Zoom Out", () => setZoom(-0.1)));
  viewGroup.append(ribbonButton("100%", () => setZoom(0)));
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
    statusLine.textContent = `${words} words · ${chars} characters · Zoom ${Math.round(zoom * 100)} %`;
  }
  preview.addEventListener("input", updateDocumentStats);
  new MutationObserver(() => updateDocumentStats()).observe(preview, { childList: true, subtree: true, characterData: true });
  updateDocumentStats();
  // Keep view controls accessible even when Ribbon panels are collapsed.
  // Only layout classes change: do not touch #preview HTML or the browser selection.
  const viewActions = document.createElement("div");
  viewActions.id = "wordRibbonActions";
  viewActions.className = "word-ribbon-view-actions";
  viewActions.setAttribute("role", "group");
  viewActions.setAttribute("aria-label", "Editor display options");

  const collapseButton = ribbonButton("Collapse Ribbon", () => {
    shell.classList.toggle("word-ribbon-collapsed");
    syncCollapseButton();
  });
  collapseButton.id = "wordRibbonCollapse";
  collapseButton.setAttribute("aria-controls", "wordRibbonPanels");
  function syncCollapseButton() {
    const collapsed = shell.classList.contains("word-ribbon-collapsed");
    collapseButton.setAttribute("aria-expanded", String(!collapsed));
    collapseButton.textContent = collapsed ? "Expand Ribbon" : "Collapse Ribbon";
  }

  const focusButton = ribbonButton("Focus Mode", () => {
    const enabled = document.body.classList.toggle("apa-focus-mode");
    syncFocusButton(enabled);
  });
  focusButton.id = "wordRibbonFocus";
  focusButton.setAttribute("aria-pressed", "false");
  function syncFocusButton(enabled = document.body.classList.contains("apa-focus-mode")) {
    focusButton.setAttribute("aria-pressed", String(enabled));
    focusButton.textContent = enabled ? "Exit Focus Mode" : "Focus Mode";
    focusButton.title = enabled
      ? "Show import and review panels again (Esc)"
      : "Hide secondary panels to maximize document editing space";
  }
  viewActions.append(collapseButton, focusButton);
  // Escape exits focus mode, without intercepting normal document editing.
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !document.body.classList.contains("apa-focus-mode")) return;
    document.body.classList.remove("apa-focus-mode");
    syncFocusButton(false);
  });

  // Existing shell remains the editing parent. Hide the now-empty toolbar.
  toolbar.hidden = true;
  shell.prepend(panels);
  shell.prepend(viewActions);
  shell.prepend(tabs);
  shell.append(statusLine);
  shell.classList.add("word-ribbon-enabled");
  activate("inicio");
  syncCollapseButton();
  syncFocusButton();
  window.EstiloAPARibbon = {
    activate,
    setCollapsed(value) {
      shell.classList.toggle("word-ribbon-collapsed", Boolean(value));
      syncCollapseButton();
    },
    setFocusMode(value) {
      document.body.classList.toggle("apa-focus-mode", Boolean(value));
      syncFocusButton();
    },
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWordRibbon);
} else {
  initWordRibbon();
}
