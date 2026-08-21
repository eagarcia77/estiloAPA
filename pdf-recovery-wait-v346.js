// APA7 Academic Formatter v3.4.6
// Ensures exports wait until every currently loaded PDF section has completed
// the v3.4.6 figure-recovery pass.

const PDF_RECOVERY_WAIT_VERSION = "3.4.6";
const baseRecoverPdfFiguresV346 = window.recoverPdfFiguresV346;

function prwPdfSectionsPending() {
  const preview = document.querySelector("#preview");
  const input = document.querySelector("#files");
  if (!preview || !input) return [];
  const names = new Set(
    [...(input.files || [])]
      .filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
      .map((file) => file.name)
  );
  if (!names.size) return [];
  return [...preview.querySelectorAll("section[data-source-file]")]
    .filter((section) => names.has(section.dataset.sourceFile) && section.dataset.pdfFigureRecoveryV346 !== "true");
}

async function recoverPdfFiguresAndWaitV346() {
  if (typeof baseRecoverPdfFiguresV346 === "function") await baseRecoverPdfFiguresV346();
  const started = Date.now();
  while (prwPdfSectionsPending().length && Date.now() - started < 45000) {
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  return prwPdfSectionsPending().length === 0;
}

window.recoverPdfFiguresV346 = recoverPdfFiguresAndWaitV346;
window.PDF_RECOVERY_WAIT_VERSION = PDF_RECOVERY_WAIT_VERSION;
