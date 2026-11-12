// Lightweight quick actions. Reuse existing editor commands; do not modify document state.
(function () {
  function init() {
    if (document.getElementById('academicQuickActions')) return;
    const anchor = document.getElementById('apaAccessibilityTools');
    const toolbar = document.querySelector('.preview-toolbar');
    if (!toolbar) return;
    const bar = document.createElement('nav');
    bar.id = 'academicQuickActions';
    bar.className = 'academic-quick-actions';
    bar.setAttribute('aria-label', 'Quick document actions');
    const actions = [
      {label:'Undo', icon:'↶', selector:'#apaEditorShell [data-cmd="undo"]'},
      {label:'Redo', icon:'↷', selector:'#apaEditorShell [data-cmd="redo"]'},
      {label:'Save DOCX', icon:'↓', selector:'#downloadDocxBtn'},
      {label:'Focus editor', icon:'⌗', selector:'#preview', focus:true}
    ];
    actions.forEach(item => {
      const button = document.createElement('button');
      button.type='button'; button.className='academic-quick-button';
      button.setAttribute('aria-label', item.label);
      button.title=item.label;
      const symbol=document.createElement('span');
      symbol.setAttribute('aria-hidden','true'); symbol.textContent=item.icon;
      const label=document.createElement('span');
      label.textContent=item.label;
      button.append(symbol,label);
      button.addEventListener('click', () => {
        const target=document.querySelector(item.selector);
        if (!target || target.disabled) return;
        if (item.focus) target.focus();
        else target.click();
      });
      if (item.label==='Save DOCX') {
        const original=document.querySelector(item.selector);
        if (original) {
          const sync=()=>{button.disabled=original.disabled;};
          sync();
          new MutationObserver(sync).observe(original,{attributes:true,attributeFilter:['disabled']});
        }
      }
      bar.append(button);
    });
    if (anchor) anchor.insertAdjacentElement('afterend',bar);
    else toolbar.insertAdjacentElement('afterend',bar);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
