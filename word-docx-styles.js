// Preserve manual character formatting in all EstiloAPA DOCX export pipelines.
// Only styles explicitly present in the editor DOM override the APA 7 defaults.
(function () {
  "use strict";
  function color(value) {
    const s = String(value || "").trim();
    let match = /^#([0-9a-f]{6})$/i.exec(s);
    if (match) return match[1].toUpperCase();
    match = /^#([0-9a-f]{3})$/i.exec(s);
    if (match) return match[1].split("").map(c => c + c).join("").toUpperCase();
    match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
    if (match) {
      return match.slice(1, 4).map(value =>
        Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, "0")
      ).join("").toUpperCase();
    }
    return null;
  }
  function size(value) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(pt|px)\s*$/i.exec(String(value || ""));
    if (!match) return null;
    const points = Number(match[1]) * (match[2].toLowerCase() === "px" ? .75 : 1);
    return points >= 5 && points <= 96 ? Math.round(points * 2) : null;
  }
  function childStyle(node, previous = {}) {
    const next = { ...previous };
    if (!node || node.nodeType !== 1) return next;
    const tag = node.tagName;
    const css = node.style || {};
    if (["B", "STRONG"].includes(tag) || /^(bold|[6-9]00)$/i.test(css.fontWeight || "")) next.bold = true;
    if (["I", "EM"].includes(tag) || css.fontStyle === "italic") next.italics = true;
    if (tag === "U" || (css.textDecorationLine || css.textDecoration || "").includes("underline")) next.underline = true;
    if (["S", "STRIKE", "DEL"].includes(tag) || (css.textDecorationLine || css.textDecoration || "").includes("line-through")) next.strike = true;
    if (tag === "SUP" || css.verticalAlign === "super") { next.superScript = true; next.subScript = false; }
    if (tag === "SUB" || css.verticalAlign === "sub") { next.subScript = true; next.superScript = false; }
    const family = css.fontFamily || (tag === "FONT" ? node.getAttribute("face") : "");
    if (family) next.font = family.split(",")[0].replace(/^['"]|['"]$/g, "").trim();
    const pt = size(css.fontSize);
    if (pt) next.size = pt;
    const fg = color(css.color || (tag === "FONT" ? node.getAttribute("color") : ""));
    if (fg) next.color = fg;
    const bg = color(css.backgroundColor);
    if (bg) next.shading = { fill: bg };
    return next;
  }
  function runOptions(state = {}, defaultFont = "Times New Roman", defaultSize = 24) {
    const options = { font: state.font || defaultFont, size: state.size || defaultSize };
    for (const key of ["bold", "italics", "strike", "superScript", "subScript", "color", "shading"]) {
      if (state[key] !== undefined) options[key] = state[key];
    }
    if (state.underline) options.underline = {};
    return options;
  }
  window.EstiloAPAWordDocxStyles = { childStyle, runOptions, color, size };
})();
