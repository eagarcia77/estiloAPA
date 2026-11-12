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
      review.open = false;
      // Ensure native file selection remains usable on mobile browsers.
      setup.open = true;
      fileInput.click();
    }, true);
    // The setup drawer is needed only while picking a file; afterward the
    // document regains full width, including if the native picker is canceled.
    const closePickerSetup = () => {
      setup.open = false;
    };
    // Do not collapse the ancestor <details> on file selection.\n    // iPadOS file providers may expose a lazy File handle; keep its input\n    // connected and visible until the asynchronous import has finished.\n    fileInput.addEventListener("cancel", closePickerSetup);\n    preview.addEventListener("apa-document-loaded", closePickerSetup);
    // Preserve all listeners previously attached by the application.
    // Moving elements does not clone or recreate their event handlers.
    const sample = document.getElementById("demoBtn");
    const format = document.getElementById("formatBtn");
    const exportDocx = document.getElementById("downloadDocxBtn");
    const exportHtml = document.getElementById("downloadHtmlBtn");
    const settings = button("simpleSettingsBtn", "More Options", () => {
      setup.open = !setup.open;
      if (setup.open) review.open = false;
      tools.open = false;
      settings.setAttribute("aria-expanded", String(setup.open));
      if (setup.open && window.matchMedia?.("(max-width: 1079px)")?.matches)
        setup.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    settings.setAttribute("aria-controls", "simpleDocumentOptions");
    settings.setAttribute("aria-expanded", String(setup.open));
    setup.addEventListener("toggle", () => settings.setAttribute("aria-expanded", String(setup.open)));

    const reviewButton = button("simpleReviewBtn", "Review", () => {
      review.open = !review.open;
      if (review.open) setup.open = false;
      tools.open = false;
      reviewButton.setAttribute("aria-expanded", String(review.open));
      // A desktop drawer stays beside the document. On small screens bring
      // the in-flow review section into view only when intentionally opened.
      if (review.open && window.matchMedia?.("(max-width: 1079px)")?.matches)
        review.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    reviewButton.setAttribute("aria-controls", "simpleReviewDetails");
    reviewButton.setAttribute("aria-expanded", String(review.open));
    review.addEventListener("toggle", () => reviewButton.setAttribute("aria-expanded", String(review.open)));
    // A permanent, visible exit inside the review panel.
    const closeReview = button("simpleCloseReviewBtn", "Close Review", () => {
      review.open = false;
      reviewButton.setAttribute("aria-expanded", "false");
      // Return focus to a visible command, never to a hidden More menu item.
      open.focus?.();
    });
    closeReview.className = "simple-close-review";
    closeReview.setAttribute("aria-label", "Close APA 7 Review panel");
    const reviewInner = review.querySelector?.(".simple-details-inner");
    if (reviewInner) reviewInner.prepend(closeReview);

    // Dismiss floating side panels when the user resumes editing the document.
    // No changes to #preview, selections, or academic formatting.
    document.addEventListener("pointerdown", event => {
      const target = event.target;
      if (review.open && !review.contains(target) && !reviewButton.contains(target)) {
        review.open = false;
        reviewButton.setAttribute("aria-expanded", "false");
      }
      if (setup.open && !setup.contains(target) && !settings.contains(target) &&
          !open.contains(target)) {
        setup.open = false;
        settings.setAttribute("aria-expanded", "false");
      }
    });

    // One compact command bar. Secondary commands remain the ORIGINAL
    // control nodes, moved inside a lightweight expandable tools tray.
    const tools = document.createElement("details");
    tools.id = "simpleToolsMenu";
    tools.className = "simple-tools-menu";
    const toolsLabel = document.createElement("summary");
    toolsLabel.textContent = "More";
    toolsLabel.setAttribute("aria-label", "More document tools");
    const toolsContent = document.createElement("div");
    toolsContent.className = "simple-tools-content";
    tools.append(toolsLabel, toolsContent);

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (tools.open) { tools.open = false; return; }
      if (setup.open) { setup.open = false; return; }
      if (review.open) review.open = false;
    });
    actions.prepend(open);
    if (exportDocx) actions.append(exportDocx);
    actions.append(tools);
    if (sample) toolsContent.append(sample);
    if (format) toolsContent.append(format);
    if (exportHtml) toolsContent.append(exportHtml);
    const clear = document.getElementById("clearBtn");
    if (clear) toolsContent.append(clear);
    toolsContent.append(settings, reviewButton);

    // Native <details> remains the source of truth. These classes affect
    // layout only; opening and closing never writes inside #preview.
    setup.open = false;
    review.open = false;
    // Keep advanced sections accessible next to the editor, not behind an
    // arbitrary scroll position. They never wrap or replace the document.
    setup.addEventListener("toggle", () => {
      document.body.classList.toggle("simple-setup-open", setup.open);
    });
    review.addEventListener("toggle", () => {
      document.body.classList.toggle("simple-review-open", review.open);
    });

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
      toggleTools: () => { tools.open = !tools.open; },
    };
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSimpleWorkspace, { once: true });
  } else initSimpleWorkspace();
})();
