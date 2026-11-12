// Shared Word-style page and paragraph layout model.
// APA 7 remains the default; explicit user choices override it after import.
(function () {
  "use strict";
  const SIZES = Object.freeze({
    letter: { width: 8.5, height: 11, twipsWidth: 12240, twipsHeight: 15840 },
    legal: { width: 8.5, height: 14, twipsWidth: 12240, twipsHeight: 20160 },
    a4: { width: 8.2677, height: 11.6929, twipsWidth: 11906, twipsHeight: 16838 }
  });
  const VALID_ORIENTATIONS = ["portrait","landscape"];
  const MARGINS = {
    apa: { top: 1, right: 1, bottom: 1, left: 1 },
    thesis: { top: 1, right: 1, bottom: 1, left: 1.5 },
    narrow: { top: .5, right: .5, bottom: .5, left: .5 },
    moderate: { top: .75, right: .75, bottom: .75, left: .75 },
    wide: { top: 1.25, right: 1.25, bottom: 1.25, left: 1.25 }
  };
  function numeric(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(Math.max(min, Math.min(max,n))*100)/100 : fallback;
  }
  function profile() {
    return document.getElementById("formatProfile")?.value || "apa7";
  }
  function thesis(profileName) {
    return ["thesis-doctoral","thesis-masters"].includes(profileName);
  }
  function defaults(profileName = profile()) {
    return {
      size:"letter", orientation:"portrait",
      margins:{...(thesis(profileName)?MARGINS.thesis:MARGINS.apa)}
    };
  }
  function normalise(raw, profileName = profile()) {
    const basic = defaults(profileName);
    const size = Object.hasOwn(SIZES,String(raw?.size||"")) ? raw.size : basic.size;
    const orientation = VALID_ORIENTATIONS.includes(raw?.orientation) ? raw.orientation : basic.orientation;
    const basis = raw?.margins || basic.margins;
    const dims = SIZES[size];
    const pageWidth = orientation === "landscape" ? dims.height : dims.width;
    const pageHeight = orientation === "landscape" ? dims.width : dims.height;
    const margins = {};
    for (const side of ["top","right","bottom","left"]) {
      margins[side] = numeric(basis[side], .25, 2.5, basic.margins[side]);
    }
    const atLeast = .75;
    if (margins.left + margins.right > pageWidth - atLeast ||
        margins.top + margins.bottom > pageHeight - atLeast) {
      return null;
    }
    return {size,orientation,margins};
  }
  function read(root = document.getElementById("preview"), profileName = profile()) {
    if (!root || root.dataset?.wordPageCustomized !== "true") return defaults(profileName);
    try {
      return normalise(JSON.parse(root.dataset.wordPageSettings),profileName) || defaults(profileName);
    } catch { return defaults(profileName); }
  }
  function pageDimensions(value) {
    const unit = SIZES[value.size];
    return value.orientation === "landscape" ?
      {width:unit.height,height:unit.width} :
      {width:unit.width,height:unit.height};
  }
  function applyPreview(root, config) {
    const dims = pageDimensions(config);
    const vars = {
      "--word-page-width": dims.width + "in",
      "--word-page-height": dims.height + "in",
      "--word-margin-top": config.margins.top + "in",
      "--word-margin-right": config.margins.right + "in",
      "--word-margin-bottom": config.margins.bottom + "in",
      "--word-margin-left": config.margins.left + "in"
    };
    for (const [name,value] of Object.entries(vars)) root.style.setProperty(name,value);
    // The print rule lives outside the editable document; no HTML is rebuilt.
    let style = document.getElementById("wordPagePrintSettings");
    if (!style) {
      style = document.createElement("style");
      style.id = "wordPagePrintSettings";
      document.head.append(style);
    }
    style.textContent = "@media print { @page { size: " +
      dims.width+"in "+dims.height+"in; margin:0; } }";
  }
  function apply(root, proposed, customized = true) {
    if (!root) return false;
    const config = normalise(proposed);
    if (!config) return false;
    root.dataset.wordPageCustomized = String(customized);
    root.dataset.wordPageSettings = JSON.stringify(config);
    applyPreview(root, config);
    // A layout change is not an import or document restyling operation.
    root.dispatchEvent(new Event("input", {bubbles:true}));
    return true;
  }
  function reset(root = document.getElementById("preview")) {
    return apply(root,defaults(),false);
  }
  function getDocxPage(options = {}) {
    const root = document.getElementById("preview");
    const profileName = options.thesis ? "thesis-doctoral" : profile();
    const value = read(root,profileName);
    const unit = SIZES[value.size];
    const twips = n => Math.round(n*1440);
    return {
      size:{
        width:unit.twipsWidth,height:unit.twipsHeight,
        orientation:value.orientation
      },
      margin:Object.fromEntries(Object.entries(value.margins)
        .map(([key,n])=>[key,twips(n)]))
    };
  }
  function setParagraph(block, patch = {}) {
    if (!block?.dataset || !block.style) return false;
    if (patch.before !== undefined) {
      const n = numeric(patch.before,0,72,0);
      block.dataset.wordSpacingBefore = String(n);
      block.style.setProperty("margin-top",n+"pt","important");
    }
    if (patch.after !== undefined) {
      const n = numeric(patch.after,0,72,0);
      block.dataset.wordSpacingAfter = String(n);
      block.style.setProperty("margin-bottom",n+"pt","important");
    }
    if (patch.keepNext !== undefined) {
      block.dataset.wordKeepNext = String(!!patch.keepNext);
      block.style.setProperty("break-after",patch.keepNext?"avoid-page":"auto","important");
    }
    if (patch.keepLines !== undefined) {
      block.dataset.wordKeepLines = String(!!patch.keepLines);
      block.style.setProperty("break-inside",patch.keepLines?"avoid-page":"auto","important");
    }
    return true;
  }
  function parseTabs(input) {
    let value = input;
    if (typeof value==="string") {
      try { value=JSON.parse(value); } catch {return [];}
    }
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0,12).map(x=>({
      position:numeric(x?.position,.25,10,1),
      type:["left","right","center"].includes(x?.type)?x.type:"left",
      leader:x?.leader==="dot"?"dot":"none"
    })).filter(x=>{
      const key=x.position.toFixed(2);
      if(seen.has(key))return false;
      seen.add(key);return true;
    }).sort((a,b)=>a.position-b.position);
  }
  function setTabs(block, positions) {
    if (!block?.dataset || !block.style) return false;
    const parsed=parseTabs(positions);
    block.dataset.wordTabStops=JSON.stringify(parsed);
    block.style.setProperty("white-space","pre-wrap","important");
    block.style.setProperty("tab-size","4","important");
    return true;
  }
  function decorateParagraph(block, options) {
    if (!block?.dataset || !options) return options;
    const d=block.dataset;
    if (d.wordSpacingBefore!==undefined || d.wordSpacingAfter!==undefined) {
      options.spacing={...(options.spacing||{})};
      if(d.wordSpacingBefore!==undefined)
        options.spacing.before=Math.round(numeric(d.wordSpacingBefore,0,72,0)*20);
      if(d.wordSpacingAfter!==undefined)
        options.spacing.after=Math.round(numeric(d.wordSpacingAfter,0,72,0)*20);
    }
    if(d.wordKeepNext!==undefined) options.keepNext=d.wordKeepNext==="true";
    if(d.wordKeepLines!==undefined) options.keepLines=d.wordKeepLines==="true";
    const tabs=parseTabs(d.wordTabStops);
    if(tabs.length) options.tabStops=tabs.map(x=>({
      type:x.type,position:Math.round(x.position*1440),
      ...(x.leader==="dot"?{leader:"dot"}:{})
    }));
    return options;
  }
  window.EstiloAPAWordPageLayout={
    SIZES, MARGINS, defaults, normalise, read, pageDimensions,
    apply,reset,getDocxPage,setParagraph,setTabs,parseTabs,decorateParagraph
  };
})();
