// Word-style local drafts. Stored only in the browser where the user opts in.
// Does not apply APA 7 again on recovery; manual formatting is authoritative.
(function () {
  "use strict";
  const DRAFT_KEY = "estiloapa.localDraft.v1";
  const PREF_KEY = "estiloapa.localDraft.autosave.v1";
  const MAX_HTML_CHARS = 1700000;
  const SAVE_DELAY = 1100;
  const preview = () => document.getElementById("preview");
  let autosave = false;
  let enabledStorage = true;
  let pendingTimer = null;
  let toggleButton, recoverButton, saveButton;
  let lastSaved = "";
  let draftAvailable = false;

  function storage() {
    try {
      const store = window.localStorage;
      if (!store) throw new Error("Browser storage is not available.");
      return store;
    } catch {
      enabledStorage = false;
      return null;
    }
  }
  function status(message, isError = false) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = message;
    el.className = isError ? "status error" : "status success";
  }
  function hasDocument() {
    const el = preview();
    return !!el && !!el.innerHTML.trim() &&
      !(el.querySelector(".placeholder") && el.textContent.trim().length < 160);
  }
  function readDraft() {
    const store = storage();
    if (!store) return null;
    try {
      const raw = store.getItem(DRAFT_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || entry.version !== 1 || typeof entry.html !== "string" ||
          !entry.html.length || entry.html.length > MAX_HTML_CHARS) return null;
      return entry;
    } catch { return null; }
  }
  function refreshControls() {
    if (recoverButton) {
      recoverButton.disabled = !draftAvailable;
      recoverButton.title = draftAvailable ? "Recover locally saved work" : "No saved draft is available";
    }
    if (saveButton) saveButton.disabled = !hasDocument() || !enabledStorage;
    if (toggleButton) {
      toggleButton.textContent = autosave ? "AutoSave: On" : "AutoSave: Off";
      toggleButton.setAttribute("aria-pressed", String(autosave));
      toggleButton.disabled = !enabledStorage;
    }
  }
  function saveDraft(silent = false) {
    if (!hasDocument()) {
      if (!silent) status("Open or edit a document before saving a draft.", true);
      return false;
    }
    const html = preview().innerHTML;
    if (html.length > MAX_HTML_CHARS) {
      if (!silent) status("This document is too large for browser draft storage. Download DOCX instead.", true);
      return false;
    }
    const store = storage();
    if (!store) {
      if (!silent) status("Local storage is unavailable in this browser. Download DOCX instead.", true);
      refreshControls();
      return false;
    }
    try {
      const when = new Date().toISOString();
      store.setItem(DRAFT_KEY, JSON.stringify({
        version: 1, html, savedAt: when
      }));
      lastSaved = when;
      draftAvailable = true;
      if (!silent) status("Draft saved in this browser. Download DOCX for a portable copy.");
      refreshControls();
      return true;
    } catch {
      if (!silent) status("Could not save locally. Check browser storage or download DOCX.", true);
      return false;
    }
  }
  function clearTimer() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }
  function schedule() {
    if (!autosave || !hasDocument()) return;
    clearTimer();
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      saveDraft(true);
    }, SAVE_DELAY);
  }
  function sanitizeDraftHTML(html) {
    // Locally stored drafts are untrusted input. Strip active content before
    // inserting it into the editable document; leave text/APA styles intact.
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll(
      "script,iframe,object,embed,form,meta,base,link,svg,math"
    ).forEach(node => node.remove());
    template.content.querySelectorAll("*").forEach(node => {
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (name.startsWith("on") || name === "srcdoc" ||
            ((name === "href" || name === "src" || name === "xlink:href") &&
            (/^\s*(javascript|vbscript):/i.test(value) ||
             /^\s*data:text\/html/i.test(value)))) {
          node.removeAttribute(attribute.name);
        }
      }
    });
    return template.innerHTML;
  }
  function recoverDraft() {
    const draft = readDraft();
    if (!draft) { status("No recoverable draft was found.", true); refreshControls(); return false; }
    if (hasDocument() && !window.confirm(
      "Recover the saved browser draft? This replaces the current document. Download DOCX first if needed."
    )) return false;
    const el = preview();
    clearTimer();
    try {
      const safeHTML = sanitizeDraftHTML(draft.html);
      window.apaResetProtectedDocument?.();
      el.innerHTML = safeHTML;
      el.dataset.apaReadyForEditing = "true";
      document.getElementById("downloadDocxBtn").disabled = false;
      document.getElementById("downloadHtmlBtn").disabled = false;
      document.getElementById("reauditBtn").disabled = false;
      document.getElementById("downloadAuditBtn").disabled = false;
      window.EstiloAPAWordTools?.resetHistory?.();
      el.focus();
      lastSaved = draft.savedAt;
      status("Local draft recovered. You can continue editing or download DOCX.");
      refreshControls();
      return true;
    } catch {
      status("Could not restore the browser draft. The current document was not intentionally reformatted.", true);
      return false;
    }
  }
  function deleteDraft() {
    const store = storage();
    if (!store) return false;
    try { store.removeItem(DRAFT_KEY); }
    catch { return false; }
    lastSaved = "";
    draftAvailable = false;
    refreshControls();
    return true;
  }
  function addFileControls() {
    const panel = document.getElementById("word-ribbon-panel-archivo");
    if (!panel || document.getElementById("wordLocalDraftTools")) return;
    const group = document.createElement("div");
    group.className = "word-ribbon-group";
    group.id = "wordLocalDraftTools";
    const label = document.createElement("span");
    label.className = "word-ribbon-group-label";
    label.textContent = "Local Drafts";
    group.append(label);
    const button = (id, text, action) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "word-ribbon-action";
      node.id = id;
      node.textContent = text;
      node.addEventListener("click", action);
      return node;
    };
    saveButton = button("wordSaveLocalDraft", "Save Draft", () => saveDraft());
    recoverButton = button("wordRecoverLocalDraft", "Recover Draft", recoverDraft);
    toggleButton = button("wordToggleAutosave", "AutoSave: Off", () => {
      autosave = !autosave;
      const store = storage();
      if (!store) autosave = false;
      else {
        try { store.setItem(PREF_KEY, autosave ? "true" : "false"); }
        catch { autosave = false; }
      }
      refreshControls();
      if (autosave) schedule();
      else clearTimer();
    });
    const deleteButton = button("wordDeleteLocalDraft", "Delete Draft", () => {
      if (!readDraft()) return;
      if (window.confirm("Delete the local draft from this browser?")) {
        if (deleteDraft()) status("Local draft deleted.");
      }
    });
    group.append(saveButton, recoverButton, toggleButton, deleteButton);
    const note = document.createElement("span");
    note.className = "word-local-draft-note";
    note.textContent = "Stored in this browser only, not encrypted or uploaded.";
    group.append(note);
    panel.append(group);
    refreshControls();
  }
  function init() {
    const el = preview();
    if (!el || !document.getElementById("word-ribbon-panel-archivo")) return;
    const store = storage();
    if (store) {
      try { autosave = store.getItem(PREF_KEY) === "true"; }
      catch { autosave = false; }
    }
    draftAvailable = !!readDraft();
    addFileControls();
    el.addEventListener("input", () => { schedule(); refreshControls(); });
    el.addEventListener("apa-document-loaded", () => {
      // Save only after import formatters have finished; do not auto-restore
      // an unrelated old draft over the newly imported file.
      schedule();
      refreshControls();
    });
    document.getElementById("clearBtn")?.addEventListener("click", () => {
      clearTimer();
      deleteDraft();
      refreshControls();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && autosave) {
        clearTimer();
        saveDraft(true);
      }
    });
    refreshControls();
    window.EstiloAPALocalDraft = {
      save: () => saveDraft(), recover: recoverDraft, remove: deleteDraft,
      toggleAutosave() { toggleButton?.click(); },
      getStatus: () => ({ autosave, hasDraft: draftAvailable, lastSaved })
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
