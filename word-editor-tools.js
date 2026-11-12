// Word-like editing tools for EstiloAPA. The document is the source of truth.
// Never normalize APA 7 styles after import or mutate #preview for search.
(function () {
  "use strict";
  const HISTORY_LIMIT = 36;
  const HISTORY_BYTES = 8 * 1024 * 1024;
  const TYPING_WINDOW = 700;
  const WORD_CHAR = /[\p{L}\p{N}_]/u;
  const root = () => document.getElementById("preview");
  const shell = () => document.getElementById("apaEditorShell");
  let entries = [];
  let index = -1;
  let restoring = false;
  let typingAt = 0;
  let typingType = "";
  let lastRange = null;
  let searchPanel = null;
  let searchInput = null;
  let replaceInput = null;
  let matchLabel = null;
  let caseCheckbox = null;
  let wholeCheckbox = null;
  let currentMatch = 0;

  function inside(node) {
    const el = root();
    return !!el && !!node && (node === el || el.contains(node));
  }
  function getRange() {
    const selected = window.getSelection?.();
    if (selected?.rangeCount && inside(selected.getRangeAt(0).commonAncestorContainer)) {
      return selected.getRangeAt(0);
    }
    if (lastRange && inside(lastRange.commonAncestorContainer)) return lastRange;
    return null;
  }
  function rememberSelection() {
    const selected = window.getSelection?.();
    if (selected?.rangeCount && inside(selected.getRangeAt(0).commonAncestorContainer)) {
      lastRange = selected.getRangeAt(0).cloneRange();
    }
  }
  function setSelection(range) {
    const selected = window.getSelection?.();
    if (!range || !selected) return;
    root().focus?.({ preventScroll: true });
    selected.removeAllRanges();
    selected.addRange(range);
    rememberSelection();
  }
  function nodePath(node) {
    const el = root(), path = [];
    while (node && node !== el) {
      const parent = node.parentNode;
      if (!parent) return null;
      const at = Array.prototype.indexOf.call(parent.childNodes, node);
      if (at < 0) return null;
      path.unshift(at);
      node = parent;
    }
    return node === el ? path : null;
  }
  function locatePath(path) {
    if (!Array.isArray(path)) return null;
    let node = root();
    for (const at of path) node = node?.childNodes?.[at];
    return node || null;
  }
  function captureSelection() {
    const range = getRange();
    if (!range) return null;
    const start = nodePath(range.startContainer), end = nodePath(range.endContainer);
    if (!start || !end) return null;
    return { start, startOffset: range.startOffset, end, endOffset: range.endOffset };
  }
  function restoreSelection(where) {
    if (!where) { root()?.focus?.(); return; }
    const a = locatePath(where.start), b = locatePath(where.end);
    if (!a || !b) { root()?.focus?.(); return; }
    const limit = node => node.nodeType === 3 ? node.data.length : node.childNodes.length;
    try {
      const range = document.createRange();
      range.setStart(a, Math.min(where.startOffset, limit(a)));
      range.setEnd(b, Math.min(where.endOffset, limit(b)));
      setSelection(range);
    } catch { root()?.focus?.(); }
  }
  function snapshot() {
    const el = root();
    return el ? { html: el.innerHTML, selection: captureSelection() } : null;
  }
  function stateEquals(a, b) { return !!a && !!b && a.html === b.html; }
  function ensureHistory() {
    if (index >= 0) return;
    const state = snapshot();
    if (state) { entries = [state]; index = 0; }
  }
  function limitHistory() {
    let bytes = entries.reduce((sum, item) => sum + item.html.length * 2, 0);
    while (entries.length > 2 && (entries.length > HISTORY_LIMIT || bytes > HISTORY_BYTES)) {
      const removed = entries.shift();
      bytes -= removed.html.length * 2;
      index--;
    }
  }
  function commit(inputType = "") {
    if (restoring) return;
    ensureHistory();
    const next = snapshot();
    if (!next || index < 0) return;
    const current = entries[index];
    if (stateEquals(current, next)) { current.selection = next.selection; return; }
    entries.splice(index + 1);
    const now = Date.now();
    const typing = inputType === "insertText" || inputType === "deleteContentBackward" ||
      inputType === "deleteContentForward";
    if (typing && typingType === inputType && now - typingAt < TYPING_WINDOW &&
        index > 0 && index === entries.length - 1) {
      entries[index] = next; // One Undo for a short uninterrupted typing burst.
    } else {
      entries.push(next);
      index = entries.length - 1;
    }
    typingAt = typing ? now : 0;
    typingType = typing ? inputType : "";
    limitHistory();
  }
  function synchronizeHistory() {
    ensureHistory();
    const state = snapshot();
    if (state && index >= 0 && !stateEquals(entries[index], state)) commit();
  }
  function restore(state) {
    if (!state || !root()) return;
    restoring = true;
    try {
      window.apaResetProtectedDocument?.();
      root().innerHTML = state.html;
      lastRange = null;
      restoreSelection(state.selection);
      root().dispatchEvent(new Event("input", { bubbles: true }));
    } finally { restoring = false; typingAt = 0; typingType = ""; }
  }
  function undo() {
    synchronizeHistory();
    if (index <= 0) return false;
    restore(entries[--index]);
    return true;
  }
  function redo() {
    synchronizeHistory();
    if (index < 0 || index >= entries.length - 1) return false;
    restore(entries[++index]);
    return true;
  }
  function resetHistory() {
    entries = [];
    index = -1;
    typingAt = 0;
    typingType = "";
    lastRange = null;
    ensureHistory();
  }
  function changed() {
    const el = root();
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    rememberSelection();
  }
  function report(message, error = false) {
    const status = document.getElementById("status");
    if (status) {
      status.textContent = message;
      status.className = error ? "status error" : "status success";
    }
  }
  function makeButton(label, callback, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-ribbon-action";
    button.textContent = label;
    if (title) button.title = title;
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", callback);
    return button;
  }
  function makeGroup(label) {
    const group = document.createElement("div");
    group.className = "word-ribbon-group";
    const caption = document.createElement("span");
    caption.className = "word-ribbon-group-label";
    caption.textContent = label;
    group.append(caption);
    return group;
  }
  function command(name, value) {
    const range = getRange();
    if (!range) { report("Place the cursor in the document first.", true); return false; }
    setSelection(range);
    const success = document.execCommand(name, false, value ?? null);
    if (success) changed();
    else report("This formatting command is not available in your browser.", true);
    return success;
  }
  function selectDocument() {
    const range = document.createRange();
    range.selectNodeContents(root());
    setSelection(range);
  }
  function applySpanStyle(property, value) {
    const range = getRange();
    if (!range || range.collapsed) {
      report("Select text in a paragraph to apply this formatting.", true);
      return false;
    }
    const block = node => {
      const el = node.nodeType === 1 ? node : node.parentElement;
      return el?.closest?.("p,h1,h2,h3,h4,h5,h6,li,td,th");
    };
    if (!block(range.startContainer) || block(range.startContainer) !== block(range.endContainer)) {
      report("Select text within one paragraph or table cell.", true);
      return false;
    }
    const span = document.createElement("span");
    span.style.setProperty(property, value);
    try {
      span.append(range.extractContents());
      range.insertNode(span);
      const selected = document.createRange();
      selected.selectNodeContents(span);
      setSelection(selected);
      changed();
      return true;
    } catch {
      report("The selected text could not be formatted.", true);
      return false;
    }
  }

  function currentTableCell() {
    const range = getRange();
    if (!range) return null;
    const node = range.startContainer.nodeType === 1 ?
      range.startContainer : range.startContainer.parentElement;
    const cell = node?.closest?.("td,th");
    return cell && inside(cell) ? cell : null;
  }
  function tableContext() {
    const cell = currentTableCell();
    const table = cell?.closest?.("table");
    if (!table) { report("Place the cursor inside a table first.", true); return null; }
    // Merged tables require structure-aware operations not provided by this tool.
    if ([...table.querySelectorAll("td,th")].some(item =>
      Number(item.getAttribute("rowspan") || 1) > 1 ||
      Number(item.getAttribute("colspan") || 1) > 1)) {
      report("Complex merged tables must be edited in Word after export.", true);
      return null;
    }
    return { cell, table, row: cell.closest("tr"), column: cell.cellIndex };
  }
  function editTable(action) {
    const context = tableContext();
    if (!context) return false;
    const { table, row, column } = context;
    if (action === "addRow") {
      const inserted = document.createElement("tr");
      for (const existing of [...row.cells]) {
        const cell = document.createElement("td");
        cell.textContent = "";
        inserted.append(cell);
      }
      row.after(inserted);
    } else if (action === "addColumn") {
      for (const targetRow of [...table.rows]) {
        const added = document.createElement("td");
        added.textContent = "";
        const target = targetRow.cells[column];
        if (target) target.after(added);
        else targetRow.append(added);
      }
    } else if (action === "deleteRow") {
      if (table.rows.length <= 1) return false;
      row.remove();
    } else if (action === "deleteColumn") {
      if (table.rows[0]?.cells.length <= 1) return false;
      for (const targetRow of [...table.rows]) targetRow.cells[column]?.remove();
    } else return false;
    changed();
    return true;
  }
  function openOutline() {
    const headings = [...root().querySelectorAll(
      "h1,h2,h3,h4,h5,h6,[data-apa-heading-level],.apa-editor-title"
    )];
    const list = document.createElement("section");
    list.className = "word-outline";
    list.setAttribute("aria-label", "Document Outline");
    const title = document.createElement("strong");
    title.textContent = "Document Outline";
    const close = makeButton("Close", () => list.remove());
    const head = document.createElement("div");
    head.className = "word-outline-header";
    head.append(title, close);
    list.append(head);
    if (!headings.length) {
      const empty = document.createElement("p");
      empty.textContent = "No document headings found.";
      list.append(empty);
    } else {
      for (const heading of headings.slice(0, 250)) {
        const jump = makeButton((heading.textContent || "Untitled heading").trim().slice(0, 90), () => {
          heading.scrollIntoView?.({ behavior: "smooth", block: "center" });
          list.remove();
        });
        jump.className = "word-outline-link";
        list.append(jump);
      }
    }
    document.getElementById("wordDocumentOutline")?.remove();
    list.id = "wordDocumentOutline";
    shell().parentNode.insertBefore(list, shell());
  }

  function textMap() {
    const el = root();
    if (!el) return { text: "", spans: [] };
    const spans = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, text = "";
    while ((node = walker.nextNode())) {
      if (!node.data) continue;
      let parent = node.parentElement, excluded = false;
      while (parent && parent !== el) {
        if (parent.getAttribute?.("contenteditable") === "false" ||
            ["SCRIPT", "STYLE"].includes(parent.tagName)) { excluded = true; break; }
        parent = parent.parentElement;
      }
      if (excluded) continue;
      spans.push({ node, start: text.length, end: text.length + node.data.length });
      text += node.data;
    }
    return { text, spans };
  }
  function searchMatches() {
    const query = searchInput?.value || "";
    if (!query) return [];
    const text = textMap().text;
    const source = caseCheckbox?.checked ? text : text.toLocaleLowerCase();
    const needle = caseCheckbox?.checked ? query : query.toLocaleLowerCase();
    const matches = [];
    let from = 0;
    while (from <= source.length - needle.length && matches.length < 5000) {
      const at = source.indexOf(needle, from);
      if (at < 0) break;
      const before = at > 0 ? text[at - 1] : "";
      const after = at + needle.length < text.length ? text[at + needle.length] : "";
      const allowed = !wholeCheckbox?.checked || (!WORD_CHAR.test(before) && !WORD_CHAR.test(after));
      if (allowed) matches.push({ start: at, end: at + needle.length });
      from = at + Math.max(1, needle.length);
    }
    return matches;
  }
  function rangeAtOffsets(start, end) {
    const spans = textMap().spans;
    const a = spans.find(part => part.start <= start && start < part.end) ||
      spans.find(part => part.start === start);
    const b = spans.find(part => part.start < end && end <= part.end) ||
      spans.find(part => part.end === end);
    if (!a || !b) return null;
    const range = document.createRange();
    range.setStart(a.node, start - a.start);
    range.setEnd(b.node, end - b.start);
    return range;
  }
  function updateMatches(select = false) {
    const matches = searchMatches();
    if (matches.length) currentMatch = Math.max(0, Math.min(currentMatch, matches.length - 1));
    else currentMatch = 0;
    if (matchLabel) matchLabel.textContent = matches.length ?
      String(currentMatch + 1) + " of " + matches.length + " matches" : "No matches";
    if (select && matches.length) {
      const found = matches[currentMatch];
      const range = rangeAtOffsets(found.start, found.end);
      if (range) {
        setSelection(range);
        const node = range.startContainer.nodeType === 3 ?
          range.startContainer.parentElement : range.startContainer;
        node?.scrollIntoView?.({ block: "center", inline: "nearest" });
      }
    }
    return matches;
  }
  function navigate(direction) {
    const matches = searchMatches();
    if (!matches.length) { updateMatches(); return; }
    currentMatch = (currentMatch + direction + matches.length) % matches.length;
    updateMatches(true);
  }
  function replaceRange(match, withText) {
    const range = rangeAtOffsets(match.start, match.end);
    if (!range) return false;
    range.deleteContents();
    const text = document.createTextNode(withText);
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    setSelection(range);
    return true;
  }
  function replaceOne() {
    const matches = searchMatches();
    if (!matches.length) { updateMatches(); return; }
    const chosen = matches[Math.min(currentMatch, matches.length - 1)];
    if (!replaceRange(chosen, replaceInput.value)) return;
    changed();
    updateMatches(true);
  }
  function replaceAll() {
    const original = searchMatches();
    if (!original.length) { updateMatches(); return; }
    let changedCount = 0;
    // Recompute node locations after each replacement. Work backward so the
    // original positions of earlier matches remain stable without rewriting HTML.
    for (let i = original.length - 1; i >= 0; i--) {
      const current = searchMatches();
      const match = current.find(part => part.start === original[i].start);
      if (match && replaceRange(match, replaceInput.value)) changedCount++;
    }
    if (changedCount) changed();
    currentMatch = 0;
    updateMatches();
    report("Replaced " + changedCount + " occurrence(s).");
  }
  function openSearch(showReplace = false) {
    if (!searchPanel) return;
    searchPanel.hidden = false;
    searchPanel.classList.toggle("word-find-replace-mode", showReplace);
    searchPanel.setAttribute("aria-label", showReplace ? "Find and Replace" : "Find");
    searchInput.focus();
    searchInput.select();
    updateMatches();
  }
  function closeSearch() {
    if (!searchPanel) return;
    searchPanel.hidden = true;
    root()?.focus?.();
  }
  function makeSearchPanel() {
    const container = document.createElement("section");
    container.id = "wordFindPanel";
    container.className = "word-find-panel";
    container.hidden = true;
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Find and Replace");

    const header = document.createElement("div");
    header.className = "word-find-header";
    const label = document.createElement("strong");
    label.textContent = "Find and Replace";
    header.append(label, makeButton("Close", closeSearch));
    const row = document.createElement("div");
    row.className = "word-find-row";
    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Find in document";
    searchInput.setAttribute("aria-label", "Find text");
    searchInput.addEventListener("input", () => { currentMatch = 0; updateMatches(true); });
    row.append(searchInput, makeButton("Previous", () => navigate(-1)),
      makeButton("Next", () => navigate(1)));
    matchLabel = document.createElement("span");
    matchLabel.className = "word-find-count";
    matchLabel.setAttribute("role", "status");
    matchLabel.textContent = "No matches";
    row.append(matchLabel);
    const replacement = document.createElement("div");
    replacement.className = "word-find-row word-replace-row";
    replaceInput = document.createElement("input");
    replaceInput.type = "text";
    replaceInput.placeholder = "Replace with";
    replaceInput.setAttribute("aria-label", "Replacement text");
    replacement.append(replaceInput, makeButton("Replace", replaceOne),
      makeButton("Replace All", replaceAll));
    const flags = document.createElement("div");
    flags.className = "word-find-flags";
    const flag = (text, description) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      label.append(input, document.createTextNode(" " + text));
      input.setAttribute("aria-label", description);
      input.addEventListener("change", () => { currentMatch = 0; updateMatches(true); });
      flags.append(label);
      return input;
    };
    caseCheckbox = flag("Match case", "Search is case sensitive");
    wholeCheckbox = flag("Whole words", "Match whole words only");
    container.append(header, row, replacement, flags);
    searchPanel = container;
    shell().parentNode.insertBefore(container, shell());
  }
  function addRibbonTools() {
    const home = document.getElementById("word-ribbon-panel-inicio");
    const insert = document.getElementById("word-ribbon-panel-insertar");
    const review = document.getElementById("word-ribbon-panel-revisar");
    if (!home || !insert || !review) return;
    const edit = makeGroup("Find & Selection");
    edit.append(makeButton("Find", () => openSearch(false), "Ctrl+F"),
      makeButton("Replace", () => openSearch(true), "Ctrl+H"),
      makeButton("Select All", selectDocument));
    home.append(edit);

    const lists = makeGroup("Lists");
    lists.append(makeButton("Bullets", () => command("insertUnorderedList")),
      makeButton("Numbering", () => command("insertOrderedList")));
    home.append(lists);

    const character = makeGroup("Character");
    const family = document.createElement("select");
    family.id = "wordFontFamily";
    family.setAttribute("aria-label", "Font family");
    const familyDefault = document.createElement("option");
    familyDefault.textContent = "Font Family";
    familyDefault.value = "";
    family.append(familyDefault);
    for (const name of ["Times New Roman", "Arial", "Calibri", "Georgia", "Verdana"]) {
      const option = document.createElement("option");
      option.textContent = name;
      option.value = name;
      family.append(option);
    }
    family.addEventListener("change", () => {
      if (family.value) applySpanStyle("font-family", family.value);
      family.value = "";
    });
    character.append(family);
    const size = document.createElement("select");
    size.id = "wordFontSize";
    size.setAttribute("aria-label", "Font size in points");
    const placeholder = document.createElement("option");
    placeholder.textContent = "Font Size";
    placeholder.value = "";
    size.append(placeholder);
    for (const pts of [10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48]) {
      const option = document.createElement("option");
      option.value = String(pts);
      option.textContent = String(pts) + " pt";
      size.append(option);
    }
    size.addEventListener("change", () => {
      if (size.value) applySpanStyle("font-size", size.value + "pt");
      size.value = "";
    });
    character.append(size,
      makeButton("Strike", () => command("strikeThrough")),
      makeButton("Superscript", () => command("superscript")),
      makeButton("Subscript", () => command("subscript")));
    const fontColor = document.createElement("input");
    fontColor.type = "color";
    fontColor.value = "#222222";
    fontColor.title = "Font Color";
    fontColor.setAttribute("aria-label", "Font Color");
    fontColor.addEventListener("change", () => command("foreColor", fontColor.value));
    const highlight = document.createElement("input");
    highlight.type = "color";
    highlight.value = "#ffff00";
    highlight.title = "Text Highlight";
    highlight.setAttribute("aria-label", "Text Highlight");
    highlight.addEventListener("change", () => command("hiliteColor", highlight.value));
    character.append(fontColor, highlight);
    home.append(character);

    const reviewGroup = makeGroup("Navigation");
    reviewGroup.append(makeButton("Find", () => openSearch(false)),
      makeButton("Find and Replace", () => openSearch(true)));
    review.append(reviewGroup);

    const clip = makeGroup("Clipboard");
    clip.append(makeButton("Copy", () => command("copy"), "Ctrl+C"),
      makeButton("Cut", () => command("cut"), "Ctrl+X"));
    home.append(clip);

    const tableTools = makeGroup("Table Editing");
    tableTools.append(
      makeButton("Add Row", () => editTable("addRow")),
      makeButton("Add Column", () => editTable("addColumn")),
      makeButton("Delete Row", () => editTable("deleteRow")),
      makeButton("Delete Column", () => editTable("deleteColumn"))
    );
    insert.append(tableTools);
    const view = document.getElementById("word-ribbon-panel-vista");
    if (view) {
      const navigation = makeGroup("Navigation");
      navigation.append(makeButton("Document Outline", openOutline));
      view.append(navigation);
    }
    const file = document.getElementById("word-ribbon-panel-archivo");
    if (file) {
      const printing = makeGroup("Print");
      printing.append(makeButton("Print Document", () => window.print?.(), "Ctrl+P"));
      file.append(printing);
    }
  }
  function keydown(event) {
    const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (!shortcut) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    } else if (key === "y") {
      event.preventDefault(); redo();
    } else if (key === "f" || key === "h") {
      event.preventDefault(); openSearch(key === "h");
    } else if (key === "s") {
      const exportButton = document.getElementById("downloadDocxBtn");
      if (!exportButton?.disabled) {
        event.preventDefault();
        exportButton.click();
      }
    }
  }
  function init() {
    const el = root();
    if (!el || !shell() || document.getElementById("wordFindPanel")) return;
    ensureHistory();
    el.addEventListener("beforeinput", event => {
      if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
        event.preventDefault();
        if (event.inputType === "historyUndo") undo(); else redo();
        return;
      }
      ensureHistory();
    }, true);
    el.addEventListener("input", event => commit(event.inputType || ""));
    el.addEventListener("apa-document-loaded", () => {
      resetHistory();
      // Some import-specific figure/list formatters run after this listener.
      // Rebase once all synchronous import listeners have completed.
      if (typeof queueMicrotask === "function") queueMicrotask(resetHistory);
    });
    el.addEventListener("keyup", rememberSelection);
    el.addEventListener("mouseup", rememberSelection);
    el.addEventListener("keydown", keydown, true);
    document.addEventListener("selectionchange", rememberSelection);
    // Existing history toolbar buttons must use the same history as keyboard.
    for (const [name, action] of [["undo", undo], ["redo", redo]]) {
      shell().querySelectorAll('button[data-cmd="' + name + '"]').forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          action();
        }, true);
      });
    }
    makeSearchPanel();
    addRibbonTools();
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && searchPanel && !searchPanel.hidden) {
        event.preventDefault();
        closeSearch();
      }
    }, true);
    window.EstiloAPAWordTools = {
      undo, redo, resetHistory, find: () => openSearch(false),
      replace: () => openSearch(true), selectAll: selectDocument,
      historyState: () => ({ length: entries.length, index })
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
