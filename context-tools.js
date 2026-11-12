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
    // Non-destructive semantic tools: only update attributes on selected media/cells.
    let selectedImage=null;
    let selectedCell=null;
    const altLabel=document.createElement('label');
    altLabel.className='academic-context-alt';
    altLabel.textContent='Alternative text';
    const altInput=document.createElement('input');
    altInput.type='text';altInput.id='academicContextAlt';
    altInput.maxLength=500;altInput.placeholder='Describe the image';
    altLabel.htmlFor=altInput.id;
    const applyAlt=make('Apply alt text',()=>{
      if(!selectedImage || !editor.contains(selectedImage))return;
      selectedImage.setAttribute('alt',altInput.value.trim());
      selectedImage.dispatchEvent(new Event('input',{bubbles:true}));
      altInput.focus();
    });
    const headerCell=make('Toggle header cell',()=>{
      if(!selectedCell || !editor.contains(selectedCell))return;
      const old=selectedCell;
      const replacement=document.createElement(old.tagName==='TH'?'td':'th');
      for(const attr of Array.from(old.attributes)){
        if(attr.name!=='scope')replacement.setAttribute(attr.name,attr.value);
      }
      if(replacement.tagName==='TH')replacement.setAttribute('scope','col');
      while(old.firstChild)replacement.append(old.firstChild);
      old.replaceWith(replacement);
      selectedCell=replacement;
      replacement.dispatchEvent(new Event('input',{bubbles:true}));
      replacement.focus();
    });
    bar.append(title,actions,altLabel,altInput);
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
      const nextImage=type==='image'?(image.tagName==='IMG'?image:image.querySelector('img')):null;
      const nextCell=type==='table'?element.closest('td,th'):null;
      if(nextImage!==selectedImage && nextImage)altInput.value=nextImage.getAttribute('alt')||'';
      selectedImage=nextImage;
      selectedCell=nextCell;
      current=type;bar.hidden=!type;
      altLabel.hidden=type!=='image';
      altInput.hidden=type!=='image';
      applyAlt.hidden=type!=='image';
      headerCell.hidden=type!=='table'||!selectedCell;
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
