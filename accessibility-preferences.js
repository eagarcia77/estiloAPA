/* Accessibility preferences for the application chrome only.
   Never changes #preview or the exported document. */
function initAccessibilityTools() {
  if (document.getElementById('apaAccessibilityTools')) return;
  const host = document.querySelector('.preview-panel');
  const status = document.getElementById('simpleQuickStatus');
  if (!host) return;
  const panel = document.createElement('section');
  panel.id = 'apaAccessibilityTools';
  panel.className = 'apa-accessibility-tools';
  panel.setAttribute('aria-label', 'Accessibility preferences');
  panel.innerHTML = `
    <details id="apaAccessibilityDetails">
      <summary aria-label="Open accessibility tools">Accessibility tools</summary>
      <div class="apa-accessibility-options">
        <p>Adjust the application interface without changing your document or DOCX export.</p>
        <label class="apa-a11y-toggle"><input type="checkbox" id="apaHighContrast"> High contrast interface</label>
        <label class="apa-a11y-toggle"><input type="checkbox" id="apaLargeControls"> Larger interface text and controls</label>
        <label class="apa-a11y-toggle"><input type="checkbox" id="apaReduceMotion"> Reduce interface motion</label>
        <div class="apa-a11y-actions">
          <button type="button" id="apaFocusEditor">Focus document editor</button>
          <button type="button" id="apaResetAccessibility">Reset preferences</button>
        </div>
        <p class="apa-a11y-note">Keyboard: Tab moves between controls; Shift+Tab goes back. These settings do not alter APA formatting.</p>
      </div>
    </details>
  `;
  const anchor = host.querySelector('.simple-quick-status');
  if (anchor) anchor.insertAdjacentElement('afterend', panel);
  else host.insertBefore(panel, host.firstChild);
  const contrast = panel.querySelector('#apaHighContrast');
  const large = panel.querySelector('#apaLargeControls');
  const motion = panel.querySelector('#apaReduceMotion');
  const apply = () => {
    document.body.classList.toggle('apa-ui-high-contrast', contrast.checked);
    document.body.classList.toggle('apa-ui-large-controls', large.checked);
    document.body.classList.toggle('apa-ui-reduce-motion', motion.checked);
  };
  [contrast, large, motion].forEach(input => input.addEventListener('change', apply));
  panel.querySelector('#apaFocusEditor').addEventListener('click', () => {
    panel.querySelector('details').open = false;
    const editor = document.getElementById('preview');
    if (editor) {
      editor.scrollIntoView({block:'nearest', behavior:'instant'});
      editor.focus({preventScroll:true});
    }
  });
  panel.querySelector('#apaResetAccessibility').addEventListener('click', () => {
    contrast.checked = false; large.checked = false; motion.checked = false;
    apply();
    if (status) status.setAttribute('data-accessibility-preferences', 'reset');
    panel.querySelector('summary').focus();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAccessibilityTools, {once:true});
else initAccessibilityTools();
