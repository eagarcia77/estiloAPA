const THESIS_ALIGNMENT_VERSION = "2.8";

function ensureThesisAlignmentStyles() {
  if (document.querySelector("#thesis-alignment-v28")) return;
  const style = document.createElement("style");
  style.id = "thesis-alignment-v28";
  style.textContent = `
    /* v2.8: el texto corriente de tesis/disertación nunca hereda centrado. */
    .apa-paper.thesis-profile p:not(.thesis-cover-block):not(.thesis-major-heading):not(.thesis-chapter-title),
    .apa-paper.thesis-profile li,
    .apa-paper.thesis-profile .thesis-section-heading,
    .apa-paper.thesis-profile .thesis-reference,
    .apa-paper.thesis-profile .apa-reference,
    .apa-paper.thesis-profile .thesis-table-label,
    .apa-paper.thesis-profile .thesis-table-title,
    .apa-paper.thesis-profile .thesis-figure-label,
    .apa-paper.thesis-profile .thesis-figure-title,
    .apa-paper.thesis-profile .thesis-note,
    .apa-paper.thesis-profile .apa-note {
      text-align: left !important;
    }

    .apa-paper.thesis-profile .thesis-cover-block,
    .apa-paper.thesis-profile .thesis-major-heading,
    .apa-paper.thesis-profile .thesis-chapter-heading,
    .apa-paper.thesis-profile .thesis-chapter-title,
    .apa-paper.thesis-profile .thesis-references-heading {
      text-align: center !important;
    }
  `;
  document.head.append(style);
}

ensureThesisAlignmentStyles();
