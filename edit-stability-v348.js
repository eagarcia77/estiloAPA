// APA7 Academic Formatter v3.4.8
// Stable editing guard for #preview. Automatic semantic/media/list normalizers
// must not rewrite or move DOM nodes while the user is actively editing text.

const APA_EDIT_STABILITY_VERSION = "3.4.8";
const aesNativeSetTimeout = window.setTimeout.bind(window);
const aesNativeClearTimeout = window.clearTimeout.bind(window);
let apaEditForceDepth = 0;
let apaEditIdleTimer = null;
let apaEditComposing = false;
let aesPendingNormalizationId = 0;
const aesPendingNormalizations = new Map();

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

function aesLooksLikeNormalization(callback) {
  if (typeof callback !== "function") return false;
  let source = "";
  try { source = Function.prototype.toString.call(callback); } catch { return false; }
  return /(applyModuleProfile|markModuleSemantics|normalizeMedia|normalizeApaMedia|normalizeFigures|normalizeTableCaptions|normalizeNumberedLists|recoverParagraphNumberRuns|applyApaFigureFormatting|classifyEmbeddedImages|repairMediaRoles|preserveOriginalPdfMedia|recoverPdfFiguresV34\d|formatReferencesApa7|scheduleSourceImages|scheduleApaFigureFormatting|scheduleListNormalization|scheduleMediaNormalization)/.test(source);
}

function aesQueueNormalization(callback, args) {
  const id = ++aesPendingNormalizationId;
  aesPendingNormalizations.set(id, { callback, args });
  return id;
}

function aesFlushPendingNormalizations() {
  if (apaShouldDeferNormalization() || !aesPendingNormalizations.size) return;
  const tasks = [...aesPendingNormalizations.values()];
  aesPendingNormalizations.clear();
  apaWithForcedNormalization(() => {
    for (const task of tasks) {
      try { task.callback(...task.args); }
      catch (error) { console.error("APA v3.4.8 normalización diferida", error); }
    }
  });
}

// Existing modules use short setTimeout calls after every DOM/input mutation.
// Intercept only callbacks that are clearly document normalizers. Other timers,
// including typing audit debounce and UI feedback, keep their normal behavior.
window.setTimeout = function(callback, delay = 0, ...args) {
  if (!aesLooksLikeNormalization(callback)) {
    return aesNativeSetTimeout(callback, delay, ...args);
  }
  return aesNativeSetTimeout(() => {
    if (apaShouldDeferNormalization()) {
      aesQueueNormalization(callback, args);
      return;
    }
    callback(...args);
  }, delay);
};
window.clearTimeout = function(timerId) {
  aesNativeClearTimeout(timerId);
};

function aesMarkEditing() {
  aesNativeClearTimeout(apaEditIdleTimer);
  aesSetEditing(true);
}

function aesFinishEditing({ dispatch = true } = {}) {
  aesNativeClearTimeout(apaEditIdleTimer);
  apaEditComposing = false;
  aesSetEditing(false);
  if (dispatch) {
    aesPreview()?.dispatchEvent(new CustomEvent("apa-editor-idle", {
      bubbles: false,
      detail: { version: APA_EDIT_STABILITY_VERSION }
    }));
  }
  aesNativeSetTimeout(aesFlushPendingNormalizations, 20);
}

function aesScheduleFinish(delay = 320) {
  aesNativeClearTimeout(apaEditIdleTimer);
  apaEditIdleTimer = aesNativeSetTimeout(() => {
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

function aesUpdateUi() {
  const badge = document.querySelector(".badge");
  if (badge) {
    badge.textContent = `v${APA_EDIT_STABILITY_VERSION}`;
    badge.setAttribute("aria-label", `Versión ${APA_EDIT_STABILITY_VERSION}`);
  }
  const help = document.querySelector("#previewHelp");
  if (help) {
    help.innerHTML = "<strong>Edición protegida v3.4.8:</strong> puede escribir, borrar, cortar y pegar directamente en esta vista previa sin que los normalizadores reconstruyan el texto mientras el cursor está activo. Las reglas APA 7 se reanudan al salir del editor, volver a auditar o exportar.";
  }
}

function aesInitialize() {
  aesInstallStyles();
  aesUpdateUi();
  aesNativeSetTimeout(aesUpdateUi, 1600);
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

  document.addEventListener("pointerdown", (event) => {
    const action = event.target?.closest?.(
      "#formatBtn,#demoBtn,#clearBtn,#reauditBtn,#downloadDocxBtn,#downloadHtmlBtn,#downloadAuditBtn,#formatReferenceList,#auditReferencesNow"
    );
    if (!action) return;
    aesFinishEditing({ dispatch: false });
  }, true);

  root.addEventListener("apa-editor-idle", () => {
    aesFlushPendingNormalizations();
    const status = document.querySelector("#status");
    if (status?.dataset?.apaEditStatus === "true") {
      status.textContent = "Cambios de texto conservados. La vista previa salió del modo de edición protegida.";
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
window.apaFlushPendingNormalizations = aesFlushPendingNormalizations;
window.APA_EDIT_STABILITY_VERSION = APA_EDIT_STABILITY_VERSION;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aesInitialize, { once: true });
} else {
  aesInitialize();
}
