// Interactive horizontal/vertical Word-style rulers for EstiloAPA.
// Rulers live OUTSIDE the editable #preview and never become exported content.
(function () {
  "use strict";
  const root = () => document.getElementById("preview");
  const readModel = () => window.EstiloAPAWordRulerIndents;
  const STEP = .125;
  const MAX_IN = 3;
  let horizontal, vertical, switchButton;
  let firstMarker, leftMarker, rightMarker;
  let chosenBlock = null, drag = null, metrics = null;
  let visible = true, raf = 0;

  const snap = n => Math.round(n / STEP) * STEP;
  const limit = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function blockForSelection() {
    const el = root(), selection = window.getSelection?.();
    if (!el || !selection?.rangeCount) return null;
    let node = selection.getRangeAt(0).startContainer;
    node = node.nodeType === 1 ? node : node.parentElement;
    const block = node?.closest?.("p,h1,h2,h3,h4,h5,h6,li,td,th");
    return block && el.contains(block) ? block : null;
  }
  function chosen() {
    const active = blockForSelection();
    if (active) chosenBlock = active;
    if (chosenBlock && !root()?.contains(chosenBlock)) chosenBlock = null;
    return chosenBlock;
  }
  function notify(message, error = false) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = message;
    el.className = error ? "status error" : "status success";
  }
  function applyIndent(kind, requested) {
    const block = chosen(), model = readModel();
    if (!block || !model) {
      notify("Place the cursor inside a paragraph to adjust ruler indents.", true);
      return false;
    }
    const old = model.read(block);
    const next = { ...old };
    const available = metrics?.available ?? 6.5;
    const cap = Math.min(MAX_IN, Math.max(0, available - 1));
    if (kind === "left") {
      next.left = limit(snap(requested), 0, Math.max(0, cap - old.right));
      // Moving the left marker shifts the entire paragraph indent, as in Word.
      next.first = limit(snap(old.first + next.left - old.left), 0, MAX_IN);
    } else if (kind === "first") {
      next.first = limit(snap(requested), 0, MAX_IN);
    } else if (kind === "right") {
      next.right = limit(snap(requested), 0, Math.max(0, cap - old.left));
    } else return false;
    model.apply(block, next);
    root().dispatchEvent(new Event("input", { bubbles: true }));
    syncMarkers();
    return true;
  }
  function makeMarker(name, description, key) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "word-ruler-marker word-ruler-" + name;
    marker.dataset.rulerKind = name;
    marker.setAttribute("role", "slider");
    marker.setAttribute("aria-label", description);
    marker.setAttribute("aria-valuemin", "0");
    marker.setAttribute("aria-valuemax", String(MAX_IN));
    marker.setAttribute("aria-valuenow", "0");
    marker.title = description + " (drag or use arrow keys)";
    marker.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !chosen()) return;
      event.preventDefault();
      drag = { kind: name, pointerId: event.pointerId, value: null };
      marker.setPointerCapture?.(event.pointerId);
    });
    marker.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId || drag.kind !== name || !metrics) return;
      const x = event.clientX - metrics.originPageX;
      const value = name === "right" ?
        (metrics.textRightX - (event.clientX - metrics.rootLeft)) / metrics.pixelsPerIn :
        x / metrics.pixelsPerIn;
      drag.value = limit(snap(value), 0, MAX_IN);
      const pos = name === "right" ?
        metrics.textRightX - drag.value * metrics.pixelsPerIn :
        metrics.textLeftX + drag.value * metrics.pixelsPerIn;
      marker.style.left = pos + "px";
      marker.setAttribute("aria-valuenow", String(drag.value));
    });
    const finish = event => {
      if (!drag || drag.pointerId !== event.pointerId || drag.kind !== name) return;
      const value = drag.value;
      drag = null;
      marker.releasePointerCapture?.(event.pointerId);
      if (value !== null) applyIndent(name, value);
      else syncMarkers();
    };
    marker.addEventListener("pointerup", finish);
    marker.addEventListener("pointercancel", finish);
    marker.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
      event.preventDefault();
      const model = readModel(), block = chosen();
      if (!model || !block) return;
      const current = model.read(block)[key];
      const next = event.key === "Home" ? 0 : current + (event.key === "ArrowRight" ? STEP : -STEP);
      applyIndent(name, next);
    });
    horizontal.append(marker);
    return marker;
  }
  function paintTicks(container, count, origin, unit, verticalAxis = false) {
    container.querySelectorAll(".word-ruler-tick").forEach(node => node.remove());
    const ticks = document.createDocumentFragment();
    // Tick marks are separate decorative nodes; they never enter the document.
    const quarter = unit / 4;
    const max = Math.min(64, Math.floor(count * 4));
    for (let i = 0; i <= max; i++) {
      const tick = document.createElement("span");
      tick.className = "word-ruler-tick";
      if (i % 4 === 0) tick.classList.add("major");
      else if (i % 2 === 0) tick.classList.add("medium");
      tick.setAttribute("aria-hidden", "true");
      tick.style[verticalAxis ? "top" : "left"] = (origin + i * quarter) + "px";
      if (i % 4 === 0) tick.textContent = String(i / 4);
      ticks.append(tick);
    }
    container.prepend(ticks);
  }
  function measure() {
    const el = root(), wrap = el?.parentElement;
    if (!el || !wrap || !horizontal) return null;
    const rect = el.getBoundingClientRect(), wrapRect = wrap.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const zoom = Number.parseFloat(cs.zoom || el.style.zoom || "1") || 1;
    const pixelsPerIn = 96 * zoom;
    const padLeft = Number.parseFloat(cs.paddingLeft || "0") * zoom;
    const padRight = Number.parseFloat(cs.paddingRight || "0") * zoom;
    const padTop = Number.parseFloat(cs.paddingTop || "0") * zoom;
    const textLeftX = padLeft;
    const textRightX = Math.max(textLeftX, rect.width - padRight);
    const rootOffset = rect.left - wrapRect.left + wrap.scrollLeft;
    const yOffset = rect.top - wrapRect.top + wrap.scrollTop;
    horizontal.style.width = rect.width + "px";
    horizontal.style.marginLeft = rootOffset + "px";
    horizontal.style.setProperty("--word-text-start", textLeftX + "px");
    horizontal.style.setProperty("--word-text-end", textRightX + "px");
    vertical.style.left = Math.max(0, rootOffset - 22) + "px";
    vertical.style.top = yOffset + "px";
    vertical.style.height = rect.height + "px";
    return {
      rootLeft: rect.left, originPageX: rect.left + textLeftX,
      textLeftX, textRightX, pixelsPerIn,
      available: (textRightX - textLeftX) / pixelsPerIn,
      padTop, height: rect.height, width: rect.width
    };
  }
  function syncMarkers() {
    if (!metrics) return;
    const data = readModel()?.read(chosen()) || { left: 0, first: .5, right: 0 };
    const positions = {
      left: metrics.textLeftX + data.left * metrics.pixelsPerIn,
      first: metrics.textLeftX + data.first * metrics.pixelsPerIn,
      right: metrics.textRightX - data.right * metrics.pixelsPerIn
    };
    for (const [name, marker, key] of [
      ["left", leftMarker, "left"],
      ["first", firstMarker, "first"],
      ["right", rightMarker, "right"]
    ]) {
      if (drag?.kind === name) continue;
      marker.style.left = positions[name] + "px";
      marker.setAttribute("aria-valuenow", String(data[key]));
      marker.setAttribute("aria-valuetext", data[key] + " inches");
    }
  }
  function render() {
    raf = 0;
    if (!visible || !horizontal || !root()) return;
    const m = measure();
    if (!m) return;
    metrics = m;
    paintTicks(horizontal, m.available, m.textLeftX, m.pixelsPerIn);
    paintTicks(vertical, Math.max(0, (m.height - m.padTop) / m.pixelsPerIn),
      m.padTop, m.pixelsPerIn, true);
    syncMarkers();
  }
  function scheduleRender() {
    if (raf) return;
    raf = window.requestAnimationFrame?.(render) || setTimeout(render, 16);
  }
  function toggleRulers(force) {
    visible = typeof force === "boolean" ? force : !visible;
    document.body.classList.toggle("word-rulers-hidden", !visible);
    if (switchButton) {
      switchButton.textContent = visible ? "Hide Rulers" : "Show Rulers";
      switchButton.setAttribute("aria-pressed", String(visible));
    }
    if (visible) scheduleRender();
  }
  function init() {
    const el = root(), wrap = el?.parentElement;
    const view = document.getElementById("word-ribbon-panel-vista");
    if (!el || !wrap?.classList?.contains("paper-wrap") || !view ||
      document.getElementById("wordRulerHorizontal")) return;
    wrap.classList.add("word-ruler-workspace");
    horizontal = document.createElement("div");
    horizontal.id = "wordRulerHorizontal";
    horizontal.className = "word-ruler-horizontal";
    horizontal.setAttribute("role", "group");
    horizontal.setAttribute("aria-label", "Horizontal ruler, inches");
    vertical = document.createElement("div");
    vertical.id = "wordRulerVertical";
    vertical.className = "word-ruler-vertical";
    vertical.setAttribute("aria-hidden", "true");
    wrap.prepend(horizontal);
    wrap.append(vertical);
    firstMarker = makeMarker("first", "First-line indent", "first");
    leftMarker = makeMarker("left", "Left paragraph indent", "left");
    rightMarker = makeMarker("right", "Right paragraph indent", "right");

    const group = document.createElement("div");
    group.className = "word-ribbon-group";
    const caption = document.createElement("span");
    caption.className = "word-ribbon-group-label";
    caption.textContent = "Rulers";
    switchButton = document.createElement("button");
    switchButton.type = "button";
    switchButton.id = "wordRulerToggleButton";
    switchButton.className = "word-ribbon-action";
    switchButton.textContent = "Hide Rulers";
    switchButton.setAttribute("aria-pressed", "true");
    switchButton.addEventListener("click", () => toggleRulers());
    group.append(caption, switchButton);
    view.append(group);

    document.addEventListener("selectionchange", () => {
      chosen();
      syncMarkers();
    });
    el.addEventListener("input", () => { chosen(); scheduleRender(); });
    el.addEventListener("apa-document-loaded", () => {
      chosenBlock = null;
      scheduleRender();
    });
    window.addEventListener("resize", scheduleRender);
    if (typeof ResizeObserver !== "undefined") {
      const resize = new ResizeObserver(scheduleRender);
      resize.observe(el);
      resize.observe(wrap);
    }
    wrap.addEventListener("scroll", scheduleRender, { passive: true });
    toggleRulers(true);
    window.EstiloAPAWordRulers = {
      show: () => toggleRulers(true),
      hide: () => toggleRulers(false),
      update: scheduleRender,
      apply: applyIndent,
      getActiveIndent: () => readModel()?.read(chosen()) || null
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
