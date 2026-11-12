// Context-aware editing assistance without rewriting imported document content.
(function () {
  function init() {
    const editor=document.getElementById('preview');
    const ribbon=document.getElementById('wordRibbonTabs');
    if (!editor || !ribbon || document.getElementById('academicContextTools')) return;
    const bar=document.createElement('div');
    bar.id='academicContextTools';
    bar.className='academic-context-tools';
    bar.hidden=true;
    bar.setAttribute('role','group');
    bar.setAttribute('aria-label','Contextual document tools');
    const title=document.createElement('strong');
    title.id='academicContextTitle';
    const actions=document.createElement('div');
    actions.className='academic-context-actions';
    function make(label,handler) {
      const b=document.createElement('button');
      b.type='button';b.textContent=label;
      b.addEventListener('click',handler);actions.append(b);return b;
    }
    const edit=make('Editing tools',()=>{
      document.getElementById('word-ribbon-tab-inicio')?.click();
      document.getElementById('wordRibbonTabs')?.scrollIntoView({block:'nearest'});
    });
    const insert=make('Insert tools',()=>{
      document.getElementById('word-ribbon-tab-insertar')?.click();
      document.getElementById('wordRibbonTabs')?.scrollIntoView({block:'nearest'});
    });
    const review=make('Check accessibility',()=>{
      const checker=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Check Accessibility');
      if(checker) checker.click();
      else document.getElementById('simpleReviewDetails')?.setAttribute('open','');
    });
    bar.append(title,actions);
    const shell=document.getElementById('apaEditorShell');
    if(shell) shell.insertAdjacentElement('beforebegin',bar);
    else editor.closest('.paper-wrap')?.insertAdjacentElement('beforebegin',bar);
    let current='';
    function update() {
      const selection=window.getSelection();
      let node=selection && selection.rangeCount ? selection.anchorNode : null;
      if(!node || !editor.contains(node)) {
        const active=document.activeElement;
        if(active && editor.contains(active)) node=active;
      }
      const element=node && (node.nodeType===1?node:node.parentElement);
      const image=element?.closest('img,figure');
      const table=element?.closest('table');
      const type=image && editor.contains(image)?'image':table && editor.contains(table)?'table':'';
      if(type===current) return;
      current=type;bar.hidden=!type;
      title.textContent=type==='image'?'Image selected':type==='table'?'Table selected':'';
      edit.hidden=!type;insert.hidden=!type;review.hidden=!type;
    }
    document.addEventListener('selectionchange',update);
    editor.addEventListener('click',update);
    editor.addEventListener('keyup',update);
    editor.addEventListener('focusout',()=>requestAnimationFrame(update));
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
