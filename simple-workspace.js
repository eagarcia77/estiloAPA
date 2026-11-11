// EstiloAPA simplified workspace: reorganize existing controls, do not duplicate
// handlers, replace document nodes, or change import/export semantics.
(function () {
  function initSimpleWorkspace() {
    const actions = document.getElementById("simplePrimaryActions");
    const setup = document.getElementById("simpleDocumentOptions");
    const review = document.getElementById("simpleReviewDetails");
    const fileInput = document.getElementById("files");
    const preview = document.getElementById("preview");
    if (!actions || !setup || !review || !fileInput || !preview || document.getElementById("simpleOpenBtn")) return;

    const button = (id, label, onClick, primary = false) => {
      const node = document.createElement("button");
      node.type = "button";
      node.id = id;
      node.textContent = label;
      if (primary) node.className = "primary";
      node.addEventListener("click", onClick);
      return node;
    };

    const open = button("simpleOpenBtn", "Open File", () => {
      setup.open = true;
      fileInput.click();
    }, true);
    // Preserve all listeners previously attached by the application.
    // Moving elements does not clone or recreate their event handlers.
    const sample = document.getElementById("demoBtn");
    const format = document.getElementById("formatBtn");
    const exportDocx = document.getElementById("downloadDocxBtn");
    const exportHtml = document.getElementById("downloadHtmlBtn");
    const settings = button("simpleSettingsBtn", "More Options", () => {
      setup.open = !setup.open;
      settings.setAttribute("aria-expanded", String(setup.open));
      if (setup.open) setup.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
    settings.setAttribute("aria-controls", "simpleDocumentOptions");
    settings.setAttribute("aria-expanded", String(setup.open));
    setup.addEventListener("toggle", () => settings.setAttribute("aria-expanded", String(setup.open)));

    const reviewButton = button("simpleReviewBtn", "Review", () => {
      review.open = !review.open;
      reviewButton.setAttribute("aria-expanded", String(review.open));
      if (review.open) review.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
    reviewButton.setAttribute("aria-controls", "simpleReviewDetails");
    reviewButton.setAttribute("aria-expanded", String(review.open));
    review.addEventListener("toggle", () => reviewButton.setAttribute("aria-expanded", String(review.open)));

    actions.prepend(open);
    if (sample) actions.append(sample);
    if (format) actions.append(format);
    // Keep export buttons in their original DOM scope, with native enabled state.
    if (exportDocx) actions.append(exportDocx);
    if (exportHtml) actions.append(exportHtml);
    actions.append(settings, reviewButton);

    const quickStatus = document.getElementById("simpleQuickStatus");
    const status = document.getElementById("status");
    if (status && quickStatus) {
      // Move the *same* status node into view; don't mirror changing error text.
      quickStatus.append(status);
    }

    // Ensure the main editor remains visible after an import initiated from
    // the simplified toolbar. Never rewrite or mutate #preview.
    const hideExtraInstructions = document.querySelector(".site-header .subtitle");
    if (hideExtraInstructions) hideExtraInstructions.classList.add("simple-intro");
    window.EstiloAPASimple = {
      openDocument: () => open.click(),
      toggleSettings: () => settings.click(),
      toggleReview: () => reviewButton.click(),
    };
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSimpleWorkspace, { once: true });
  } else initSimpleWorkspace();
})();
