const APA_LIST_VERSION = "3.1";
let listNormalizationRunning = false;
let listNormalizeTimer = null;

function listRoot() {
  return document.querySelector("#preview");
}

function listText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function firstTextNode(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue?.trim()) return walker.currentNode;
  }
  return null;
}

function stripEmbeddedListNumber(li, expected) {
  const node = firstTextNode(li);
  if (!node) return false;
  const pattern = new RegExp(`^\\s*${expected}[.)]\\s+`);
  if (!pattern.test(node.nodeValue || "")) return false;
  node.nodeValue = String(node.nodeValue || "").replace(pattern, "");
  return true;
}

function normalizeOrderedList(ol) {
  if (!(ol instanceof HTMLOListElement)) return 0;
  let changes = 0;
  if (!ol.dataset.apaPreserveStart && ol.start !== 1) {
    ol.start = 1;
    changes += 1;
  }
  ol.classList.add("apa-numbered-list");
  ol.dataset.apaNumbering = "restart";

  const items = [...ol.querySelectorAll(":scope > li")];
  items.forEach((li, index) => {
    li.dataset.apaListIndex = String(index + 1);
    if (stripEmbeddedListNumber(li, index + 1)) changes += 1;
  });

  // Recupera elementos consecutivos que quedaron fuera de la lista como "10. texto".
  let expected = items.length + 1;
  let sibling = ol.nextElementSibling;
  while (sibling && ["P", "DIV"].includes(sibling.tagName)) {
    const text = listText(sibling.textContent);
    const match = text.match(/^(\d{1,3})[.)]\s+(.+)$/);
    if (!match || Number(match[1]) !== expected) break;
    const li = document.createElement("li");
    li.innerHTML = sibling.innerHTML;
    const first = firstTextNode(li);
    if (first) first.nodeValue = String(first.nodeValue || "").replace(new RegExp(`^\\s*${expected}[.)]\\s+`), "");
    li.dataset.apaListIndex = String(expected);
    ol.append(li);
    const remove = sibling;
    sibling = sibling.nextElementSibling;
    remove.remove();
    expected += 1;
    changes += 1;
  }
  return changes;
}

function recoverParagraphNumberRuns(container) {
  const children = [...container.children];
  let changes = 0;
  let index = 0;
  while (index < children.length) {
    const first = children[index];
    if (!["P", "DIV"].includes(first?.tagName || "")) { index += 1; continue; }
    const firstMatch = listText(first.textContent).match(/^1[.)]\s+(.+)$/);
    if (!firstMatch) { index += 1; continue; }

    const run = [first];
    let expected = 2;
    let cursor = index + 1;
    while (cursor < children.length) {
      const candidate = children[cursor];
      if (!["P", "DIV"].includes(candidate?.tagName || "")) break;
      const match = listText(candidate.textContent).match(/^(\d{1,3})[.)]\s+(.+)$/);
      if (!match || Number(match[1]) !== expected) break;
      run.push(candidate);
      expected += 1;
      cursor += 1;
    }

    if (run.length >= 2) {
      const ol = document.createElement("ol");
      ol.className = "apa-numbered-list";
      ol.start = 1;
      ol.dataset.apaNumbering = "restart";
      for (let i = 0; i < run.length; i += 1) {
        const source = run[i];
        const li = document.createElement("li");
        li.innerHTML = source.innerHTML;
        const textNode = firstTextNode(li);
        if (textNode) textNode.nodeValue = String(textNode.nodeValue || "").replace(new RegExp(`^\\s*${i + 1}[.)]\\s+`), "");
        li.dataset.apaListIndex = String(i + 1);
        ol.append(li);
      }
      run[0].before(ol);
      run.forEach((node) => node.remove());
      changes += run.length;
      index = cursor;
      continue;
    }
    index += 1;
  }
  return changes;
}

function normalizeNumberedLists(root = listRoot()) {
  if (!root || root.querySelector(".placeholder") || listNormalizationRunning) return 0;
  listNormalizationRunning = true;
  let changes = 0;
  try {
    const containers = [...root.querySelectorAll("section[data-source-file]")];
    if (!containers.length) containers.push(root);
    for (const container of containers) changes += recoverParagraphNumberRuns(container);
    for (const ol of root.querySelectorAll("ol")) changes += normalizeOrderedList(ol);
  } finally {
    listNormalizationRunning = false;
  }
  return changes;
}

function listAudit() {
  const root = listRoot();
  const audit = document.querySelector("#auditList");
  if (!root || !audit || root.querySelector(".placeholder")) return;
  audit.querySelectorAll("li[data-apa-list-audit]").forEach((node) => node.remove());
  normalizeNumberedLists(root);

  const ordered = [...root.querySelectorAll("ol")];
  const loose = [...root.querySelectorAll("p,div")].filter((node) => /^\d{1,3}[.)]\s+/.test(listText(node.textContent)));
  const wrongStart = ordered.filter((ol) => !ol.dataset.apaPreserveStart && ol.start !== 1);
  const itemCount = ordered.reduce((sum, ol) => sum + ol.querySelectorAll(":scope > li").length, 0);

  const li = document.createElement("li");
  li.dataset.apaListAudit = "true";
  li.className = loose.length || wrongStart.length ? "warn" : "ok";
  li.textContent = loose.length || wrongStart.length
    ? `Listas numeradas v${APA_LIST_VERSION}: ${ordered.length} lista(s), ${itemCount} elemento(s). Se detectaron ${loose.length} párrafo(s) numerado(s) suelto(s) y ${wrongStart.length} lista(s) con inicio irregular.`
    : `Listas numeradas v${APA_LIST_VERSION}: ${ordered.length} lista(s), ${itemCount} elemento(s); cada lista independiente reinicia correctamente en 1.`;
  audit.append(li);
}

function scheduleListNormalization() {
  clearTimeout(listNormalizeTimer);
  listNormalizeTimer = setTimeout(() => {
    const changes = normalizeNumberedLists();
    if (changes) listRoot()?.dispatchEvent(new Event("input", { bubbles: true }));
  }, 120);
}

function initializeListNormalizer() {
  const root = listRoot();
  if (!root) return;
  new MutationObserver(scheduleListNormalization).observe(root, { childList: true, subtree: true });
  root.addEventListener("input", scheduleListNormalization);
  document.querySelector("#reauditBtn")?.addEventListener("click", () => setTimeout(listAudit, 80));
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#downloadDocxBtn,#downloadHtmlBtn")) return;
    normalizeNumberedLists();
  }, true);
  setTimeout(() => { normalizeNumberedLists(); listAudit(); }, 250);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeListNormalizer);
else initializeListNormalizer();
