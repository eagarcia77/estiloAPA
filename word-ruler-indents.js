// Word-like paragraph ruler geometry and DOCX indent conversion.
// A deliberately small shared model; visual rulers never become document HTML.
(function () {
  "use strict";
  const MAX_IN = 3;
  const inch = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(MAX_IN, n)) * 1000) / 1000 : 0;
  };
  function read(block) {
    if (!block) return { left: 0, first: .5, right: 0 };
    const d = block.dataset || {};
    switch (d.apaEditorIndent) {
      case "none": return { left: 0, first: 0, right: 0 };
      case "first": return { left: 0, first: .5, right: 0 };
      case "hanging": return { left: .5, first: 0, right: 0 };
      case "custom":
        return {
          left: inch(d.apaEditorIndentLeft),
          first: inch(d.apaEditorIndentFirst),
          right: inch(d.apaEditorIndentRight)
        };
      default: {
        if (typeof window.getComputedStyle !== "function") {
          return { left: 0, first: .5, right: 0 };
        }
        const style = window.getComputedStyle(block);
        const asInches = text => {
          const n = Number.parseFloat(text);
          if (!Number.isFinite(n)) return 0;
          if (String(text).trim().endsWith("in")) return n;
          if (String(text).trim().endsWith("pt")) return n / 72;
          return n / 96; // computed lengths are normally CSS px
        };
        const left = inch(asInches(style.paddingLeft));
        return {
          left,
          first: inch(left + asInches(style.textIndent)),
          right: inch(asInches(style.paddingRight))
        };
      }
    }
  }
  function apply(block, values) {
    if (!block?.dataset || !block.style) return false;
    const left = inch(values.left);
    const first = inch(values.first);
    const right = inch(values.right);
    const offset = Math.round((first - left) * 1000) / 1000;
    block.dataset.apaEditorIndent = "custom";
    block.dataset.apaEditorIndentLeft = String(left);
    block.dataset.apaEditorIndentFirst = String(first);
    block.dataset.apaEditorIndentRight = String(right);
    block.classList?.toggle("no-indent", left === 0 && first === 0 && right === 0);
    block.style.setProperty("padding-left", left + "in", "important");
    block.style.setProperty("text-indent", offset + "in", "important");
    block.style.setProperty("padding-right", right + "in", "important");
    block.style.setProperty("margin-left", "0", "important");
    return true;
  }
  function toDocx(block) {
    if (block?.dataset?.apaEditorIndent !== "custom") return null;
    const { left, first, right } = read(block);
    const indent = { left: Math.round(left * 1440), right: Math.round(right * 1440) };
    const offset = Math.round((first - left) * 1440);
    if (offset < 0) indent.hanging = -offset;
    else indent.firstLine = offset;
    return indent;
  }
  window.EstiloAPAWordRulerIndents = { inch, read, apply, toDocx };
})();
