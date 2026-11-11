// APA7 Academic Formatter v3.4.8
// Stable editing guard for #preview. Automatic semantic/media/list normalizers
// must not rewrite or move DOM nodes while the user is actively editing text.

const APA_EDIT_STABILITY_VERSION = "3.4.8";
const aesNativeSetTimeout = window.setTimeout.bind(window);
const aesNativeClearTimeout = window.clearTimeout.bind(window);
let apaEditForceDepth = 0;
let apaEditIdleTimer = null;
let apaEditComposing = false;
const aesPendingNormalizations = new Map();
let aesDocumentGeneration = 0;
let aesBeforeDeleteSnapshot = null;
let aesDeletionCheckId = null;
let aesRestoringDelete = false;
let aesDeleteSnapshotExpiry = null;

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
  // A stale selection can remain in #preview after focus has moved elsewhere.
  // Selection alone must never block deferred normalizations indefinitely.
  return false;
}

function aesLooksLikeNormalization(callback) {
  if (typeof callback !== "function") return false;
  let source = "";
  try { source = Function.prototype.toString.call(callback); } catch { return false; }
  return /(applyModuleProfile|markModuleSemantics|normalizeMedia|normalizeApaMedia|normalizeFigures|normalizeTableCaptions|normalizeNumberedLists|recoverParagraphNumberRuns|applyApaFigureFormatting|classifyEmbeddedImages|repairMediaRoles|preserveOriginalPdfMedia|recoverPdfFiguresV34\d|formatReferencesApa7|scheduleSourceImages|scheduleApaFigureFormatting|scheduleListNormalization|scheduleMediaNormalization)/.test(source);
}

function aesQueueNormalization(timerId, callback, args, generation) {
  // Retain the original browser timer ID so clearTimeout can cancel a queued task.
  if (generation === aesDocumentGeneration) {
    aesPendingNormalizations.set(timerId, { callback, args, generation });
  }
}

function aesFlushPendingNormalizations() {
  if (apaShouldDeferNormalization() || !aesPendingNormalizations.size) return;
  const tasks = [...aesPendingNormalizations.values()];
  aesPendingNormalizations.clear();
  apaWithForcedNormalization(() => {
    for (const task of tasks) {
      if (task.generation !== aesDocumentGeneration) continue;
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
  const generation = aesDocumentGeneration;
  const timerId = aesNativeSetTimeout(() => {
    if (generation !== aesDocumentGeneration) return;
    if (apaShouldDeferNormalization()) {
      aesQueueNormalization(timerId, callback, args, generation);
      return;
    }
    callback(...args);
  }, delay);
  return timerId;
};
window.clearTimeout = function(timerId) {
  aesPendingNormalizations.delete(timerId);
  aesNativeClearTimeout(timerId);
};

// Use before replacing the entire document (new import, demo, clear).
// Invalidate both pending and not-yet-fired normalization callbacks.
function aesResetDocument() {
  aesDocumentGeneration += 1;
  aesBeforeDeleteSnapshot = null;
  aesNativeClearTimeout(aesDeletionCheckId);
  aesNativeClearTimeout(aesDeleteSnapshotExpiry);
  aesNativeClearTimeout(aesDeleteSnapshotExpiry);
  aesPendingNormalizations.clear();
  aesNativeClearTimeout(apaEditIdleTimer);
  apaEditComposing = false;
  aesSetEditing(false);
}


// Safety net: retain the complete document before a user-initiated deletion.
// If a single Backspace/Delete unexpectedly removes almost all document text,
// restore the snapshot instead of allowing irreversible data loss.
function aesDocumentTextLength(root) {
  return (root?.textContent || "").trim().length;
}

function aesIsDeleteIntent(event) {
  return (event.type === "beforeinput" && /^delete/i.test(event.inputType || "")) ||
    (event.type === "keydown" && ["Backspace", "Delete"].includes(event.key));
}

function aesDeletionCoversWholeDocument(root) {
  const selection = window.getSelection?.();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;
  try {
    const selectedLength = range.toString().trim().length;
    const documentLength = aesDocumentTextLength(root);
    return documentLength > 100 && selectedLength >= documentLength * 0.9;
  } catch { return false; }
}

function aesRecordDeleteIntent(event) {
  const root = aesPreview();
  if (!root || aesRestoringDelete || !aesIsDeleteIntent(event)) return;
  const length = aesDocumentTextLength(root);
  if (length < 100) return;
  if (aesDeletionCoversWholeDocument(root)) {
    event.preventDefault();
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = "Se bloqueó el borrado de casi todo el documento. Seleccione y elimine fragmentos más pequeños o utilice Limpiar.";
      status.className = "status error";
    }
    return;
  }
  // Duplicate beforeinput/keydown events must retain the earliest pre-deletion copy.
  if (!aesBeforeDeleteSnapshot || aesBeforeDeleteSnapshot.generation !== aesDocumentGeneration) {
    aesBeforeDeleteSnapshot = { generation: aesDocumentGeneration, html: root.innerHTML, length };
  }
}

function aesCheckDeleteIntegrity() {
  if (!aesBeforeDeleteSnapshot || aesRestoringDelete) return;
  const snapshot = aesBeforeDeleteSnapshot;
  const root = aesPreview();
  if (!root || snapshot.generation !== aesDocumentGeneration) {
    aesBeforeDeleteSnapshot = null;
    return;
  }
  const remaining = aesDocumentTextLength(root);
  // Only restore catastrophic loss, not ordinary paragraph or multi-line deletes.
  const catastrophic = snapshot.length >= 100 && remaining < snapshot.length * 0.15 &&
    snapshot.length - remaining > 100;
  if (!catastrophic) return;
  aesBeforeDeleteSnapshot = null;
  aesRestoringDelete = true;
  try {
    aesResetDocument();
    root.innerHTML = snapshot.html;
    root.focus?.();
    const status = document.querySelector("#status");
    if (status) {
      status.textContent = "Protección Backspace: se restauró el documento tras detectar un borrado masivo.";
      status.className = "status error";
    }
  } finally {
    aesRestoringDelete = false;
  }
}

function aesScheduleDeleteCheck() {
  if (!aesBeforeDeleteSnapshot) return;
  aesNativeClearTimeout(aesDeletionCheckId);
  aesDeletionCheckId = aesNativeSetTimeout(aesCheckDeleteIntegrity, 0);
  aesNativeClearTimeout(aesDeleteSnapshotExpiry);
  aesDeleteSnapshotExpiry = aesNativeSetTimeout(() => { aesBeforeDeleteSnapshot = null; }, 950);
}

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
    if (root?.contains(active) || toolbar?.contains(active)) return;
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
    badge.setAttribute("aria-label", `Version ${APA_EDIT_STABILITY_VERSION}`);
  }
  const help = document.querySelector("#previewHelp");
  if (help) {
    help.innerHTML = "<strong>APA 7 Editing:</strong> opening a file applies APA 7 formatting automatically. You can then type, delete, paste, and change styles without automatic reformatting. Use Reapply APA 7 only if you want to replace your edits with the original document.";
  }
}

function aesInitialize() {
  aesInstallStyles();
  aesUpdateUi();
  aesNativeSetTimeout(aesUpdateUi, 1600);
  const root = aesPreview();
  if (!root) return;

  root.addEventListener("keydown", aesRecordDeleteIntent, true);
  root.addEventListener("beforeinput", aesRecordDeleteIntent, true);
  root.addEventListener("input", aesScheduleDeleteCheck, true);
  // Observers in the formatting pipeline may rewrite nodes after the native input.
  new MutationObserver(() => {
    if (aesBeforeDeleteSnapshot) aesScheduleDeleteCheck();
  }).observe(root, { childList: true, subtree: true, characterData: true });

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

  // Leaving toolbar must also release the guard: preview focusout intentionally
  // retained it while toolbar controls were in use.
  aesToolbar()?.addEventListener("focusout", (event) => {
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
window.apaResetProtectedDocument = aesResetDocument;
window.apaCheckDeleteIntegrity = aesCheckDeleteIntegrity;
window.APA_EDIT_STABILITY_VERSION = APA_EDIT_STABILITY_VERSION;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aesInitialize, { once: true });
} else {
  aesInitialize();
}
