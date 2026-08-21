// APA7 Academic Formatter v3.4.8
// Stable editing guard for #preview. Automatic semantic/media/list normalizers
// must not rewrite or move DOM nodes while the user is actively editing text.

const APA_EDIT_STABILITY_VERSION = "3.4.8";
let apaEditForceDepth = 0;
let apaEditIdleTimer = null;
let apaEditComposing = false;

function aesPreview() {
  return document.querySelector("#preview");
}

function aesToolbar() {
  return document.querySelector("#apaEditorShell");
}

function aesSelectionInsidePreview() {
  const root = aesPreview();
  const selection = window.getSelection();
  if (!root || !selection || !selection.rangeCount) return false;
  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return Boolean(element && root.contains(element));
}

function aesSetEditing(active) {
  const root = aesPreview();
  if (!root) return;
  root.dataset.apaUserEditing = active ? "true" : "false";
  root.classList.toggle("apa-user-editing", Boolean(active));
}

function apaShouldDeferNormalization() {
  if (apaEditForceDepth > 0) return false;
  const root = aesPreview();
  if (!root) return false;
  if (apaEditComposing) return true;
  if (root.dataset.apaUserEditing === "true") return true;
  if (root.contains(document.activeElement)) return true;
  return aesSelectionInsidePreview();
}

function aesMarkEditing() {
  clearTimeout(apaEditIdleTimer);
  aesSetEditing(true);
}

function aesFinishEditing({ dispatch = true } = {}) {
  clearTimeout(apaEditIdleTimer);
  apaEditComposing = false;
  aesSetEditing(false);
  if (dispatch) {
    aesPreview()?.dispatchEvent(new CustomEvent("apa-editor-idle", {
      bubbles: false,
      detail: { version: APA_EDIT_STABILITY_VERSION }
    }));
  }
}

function aesScheduleFinish(delay = 320) {
  clearTimeout(apaEditIdleTimer);
  apaEditIdleTimer = setTimeout(() => {
    const root = aesPreview();
    const toolbar = aesToolbar();
    const active = document.activeElement;
    if (root?.contains(active) || toolbar?.contains(active) || aesSelectionInsidePreview()) return;
    aesFinishEditing();
  }, delay);
}

function apaWithForcedNormalization(callback) {
  apaEditForceDepth += 1;
  let result;
  try {
    result = callback();
  } catch (error) {
    apaEditForceDepth = Math.max(0, apaEditForceDepth - 1);
    throw error;
  }

  if (result && typeof result.then === "function") {
    return Promise.resolve(result).finally(() => {
      apaEditForceDepth = Math.max(0, apaEditForceDepth - 1);
    });
  }

  apaEditForceDepth = Math.max(0, apaEditForceDepth - 1);
  return result;
}

function aesInstallStyles() {
  if (document.querySelector("#apa-edit-stability-v348-style")) return;
  const style = document.createElement("style");
  style.id = "apa-edit-stability-v348-style";
  style.textContent = `
    #preview.apa-user-editing { caret-color:auto; }
    #preview.apa-user-editing:focus { outline:2px solid rgba(0,123,95,.18); outline-offset:3px; }
  `;
  document.head.append(style);
}

function aesInitialize() {
  aesInstallStyles();
  const root = aesPreview();
  if (!root) return;

  for (const eventName of ["focusin", "beforeinput", "input", "keydown", "paste", "cut"]) {
    root.addEventListener(eventName, aesMarkEditing, true);
  }

  root.addEventListener("compositionstart", () => {
    apaEditComposing = true;
    aesMarkEditing();
  }, true);

  root.addEventListener("compositionend", () => {
    apaEditComposing = false;
    aesMarkEditing();
  }, true);

  root.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next && (root.contains(next) || aesToolbar()?.contains(next))) return;
    aesScheduleFinish();
  }, true);

  // Actions outside the editable paper intentionally end the protected editing
  // session so audits, imports and exports may normalize the document once.
  document.addEventListener("pointerdown", (event) => {
    const action = event.target?.closest?.(
      "#formatBtn,#demoBtn,#clearBtn,#reauditBtn,#downloadDocxBtn,#downloadHtmlBtn,#downloadAuditBtn,#formatReferenceList,#auditReferencesNow"
    );
    if (!action) return;
    aesFinishEditing({ dispatch: false });
  }, true);

  root.addEventListener("apa-editor-idle", () => {
    const status = document.querySelector("#status");
    if (status?.dataset?.apaEditStatus === "true") {
      status.textContent = "Edición guardada en la vista previa. El documento puede normalizarse o exportarse.";
      status.className = "status success";
      delete status.dataset.apaEditStatus;
    }
  });

  root.addEventListener("input", () => {
    const status = document.querySelector("#status");
    if (status) status.dataset.apaEditStatus = "true";
  });
}

window.apaShouldDeferNormalization = apaShouldDeferNormalization;
window.apaWithForcedNormalization = apaWithForcedNormalization;
window.apaFinishProtectedEditing = aesFinishEditing;
window.APA_EDIT_STABILITY_VERSION = APA_EDIT_STABILITY_VERSION;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aesInitialize, { once: true });
} else {
  aesInitialize();
}
