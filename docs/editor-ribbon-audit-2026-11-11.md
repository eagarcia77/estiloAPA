# EstiloAPA — Ribbon and Editor Control Audit
**Date:** 2026-11-11  
**Scope:** Source review, targeted code fixes and isolated JavaScript simulations on branch `fix/editor-ribbon-audit-indent-20261111`.  
**Important:** No claim of full browser, DOCX round-trip, cross-browser, or end-to-end testing.

## Root cause: No Indent
- The original `applyIndent("none")` set `element.style.textIndent = "0"` without `!important`, while institutional APA CSS (and heading classes) may use `!important`.
- `applyPreviewStyles()` reapplied the default first-line or reference hanging indentation after certain user actions, without respecting `data-apa-editor-indent`.
- The editor originally restored a cached `Range` before resolving the current caret, potentially formatting a previous paragraph.
- DOCX exporters applied default reference/first-line indentation even when the user explicitly chose No Indent.

**Fixes:** Explicit inline priority; preserve user override through preview refresh, HTML synchronization, and all four DOCX paths; target the current collapsed caret's paragraph; reset stale custom indent when changing paragraph style.

## Ribbon: tool-by-tool code audit
| Ribbon tab | Control(s) | Code audit | Verification |
|---|---|---|---|
| File | Apply Formatting | Proxies existing `formatBtn` | Wired; needs browser/document test |
| File | Try Sample | Proxies `demoBtn` | Wired; needs browser test |
| File | Export to Word | Proxies `downloadDocxBtn`; specialized export routing depends on profile | Wired; DOCX round-trip pending |
| File | Export HTML | Proxies `downloadHtmlBtn` | Wired; visual export pending |
| File | Clear Document | Proxies `clearBtn` and removes the document | Wired; recovery/confirmation UX pending |
| Home | Undo | `document.execCommand("undo")` | Browser-native, not dependable after scripted DOM changes; requires document transaction history |
| Home | Redo | `document.execCommand("redo")` | Same limitation |
| Home | Bold | `execCommand("bold")` | Wired; caret/selection browser test needed |
| Home | Italic | `execCommand("italic")` | Wired; browser test needed |
| Home | Underline | `execCommand("underline")` | Wired; browser test needed |
| Home | Clear Character Formatting | `execCommand("removeFormat")` | Wired; browser test needed |
| Home | APA 7 Style | `applyEditorBlockStyle` | Fixed stale-indent reset; browser test needed |
| Home | Left / Center / Right | `applyAlignment` | Fixed CSS precedence; isolated pass |
| Home | First Line Indent | `applyIndent("first")` | Fixed CSS precedence and DOCX output; isolated pass |
| Home | Hanging Indent | `applyIndent("hanging")` | Fixed CSS precedence and DOCX output; isolated pass |
| Home | No Indent | `applyIndent("none")` | Fixed CSS precedence, selection, refresh, export; isolated pass |
| Home | Single / 1.5 / Double | `applyLineSpacing` | Fixed CSS precedence; isolated pass |
| Insert | APA Table | `insertApaTable` with prompts and generated markup | Wired; table editing and full DOCX fidelity pending |
| Insert | Figure | `insertFigureCaption` | Wired; figure labels/note sequencing browser test pending |
| Insert | Link | `execCommand("createLink")` | Wired; URL validation/security hardening pending |
| Insert | Page Break | Inserts `apa-page-break` marker | Wired; actual page break in DOCX pending |
| Insert | Insert Picture | `image-editor-v344.js` injects controls into moved Insert group | Wired; import/replace/remove/browser test pending |
| Insert | Edit Picture | `ieEditSelectedImage` | Wired; browser test needed |
| Insert | Remove Picture | `ieRemoveSelectedImage` | Wired; browser test needed |
| APA Layout | APA Paragraph | `applyApaParagraphPreset` | Wired; default indent behavior intentional |
| APA Layout | APA Reference | `applyApaReferencePreset` | Wired; default hanging behavior intentional |
| APA Layout | References Heading | `insertReferencesHeading` | Wired; browser test pending |
| APA Layout | APA 7 Rules | Toggle help panel | Wired; browser test pending |
| APA Layout | Choose Profile / Document Font | Focus existing settings controls outside Ribbon | Wired, but not full in-Ribbon controls |
| Review | Review APA 7 | Proxy existing heuristic audit | Wired; academic accuracy requires human review |
| Review | Download Report | Proxy audit export | Wired; downloaded report inspection pending |
| View | Focus Editor | Calls `preview.focus()` | Wired; browser test pending |
| View | Zoom In / Zoom Out / 100% | Changes `preview.style.zoom` | Wired; responsive/mobile browser test pending |
| Ribbon | Tabs and arrow-key navigation | Moves existing toolbar nodes without cloning | Mock DOM pass; browser/screen-reader test pending |
| Ribbon | Word and character count | Reads `preview.textContent` | Wired; browser test pending |

## Cross-cutting risks requiring separate work
1. **Data loss / Backspace:** Previous hotfix is a guard, not proof that all destructive normalizers are fixed. Test IME, deletion, paste and MutationObserver interference with real documents.
2. **Undo/Redo:** Browser-native `execCommand` history may be invalidated by scripts replacing nodes; a transaction-based history engine is needed for dependable Word-like editing.
3. **Tables and images:** DOM-to-DOCX conversion has limitations for merged cells and media depending on profile; validate real OOXML output.
4. **Page fidelity:** HTML preview and DOCX page layout are not identical; page break handling and image positions require checks.
5. **Selection:** Test caret at boundaries, selection across paragraphs, and change of Ribbon tabs after clicking text.
6. **Accessibility:** Browser/screen-reader testing for Ribbon tabs, focus, labels and keyboard-only operation is pending.
7. **English UI:** Input prompts for APA tables, figures, links and picture editing now use English; document content is not translated.

## Targeted regression validation
- Isolated simulation: caret-based target selection, No Indent, First Line Indent, Hanging Indent, Alignment, Line Spacing and style reset — 7/7 passed.
- Added `tests/editor-ribbon-audit.test.cjs` with eight automated regression cases for Node CI (execution in GitHub Actions pending).
- This report records **static wiring inspection**; a wired button is not equivalent to verified end-to-end behavior.
