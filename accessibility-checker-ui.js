/* Accessibility checker UI: independent of document formatting and WAVE. */
import './js/accessibility-audit-core.js';
const ready = () => {
  const editor = document.getElementById('preview');
  const toolbar = document.querySelector('.preview-toolbar');
  if (!editor || !toolbar || document.getElementById('accessibilityCheckBtn')) return;
  const style = document.createElement('style');
  style.textContent = `
  .accessibility-controls{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.6rem 0}
  .accessibility-report{border:1px solid #8795a4;border-radius:.5rem;padding:1rem;margin:.75rem 0;max-height:24rem;overflow:auto;background:Canvas;color:CanvasText}
  .accessibility-report[hidden]{display:none}
  .accessibility-report li{margin:.6rem 0}
  .accessibility-report button{margin-left:.4rem}
  .accessibility-focus{outline:3px solid #a45d00!important;outline-offset:3px}
  `;
  document.head.appendChild(style);
  const controls = document.createElement('div');
  controls.className='accessibility-controls';
  const button = document.createElement('button');
  button.id='accessibilityCheckBtn'; button.type='button'; button.textContent='Check Accessibility';
  const wave = document.createElement('a');
  wave.href='https://wave.webaim.org/'; wave.target='_blank'; wave.rel='noopener noreferrer';
  wave.textContent='Official WAVE (external)';
  controls.append(button,wave);
  toolbar.after(controls);
  const report=document.createElement('section');
  report.className='accessibility-report';report.hidden=true;
  report.id='accessibilityReport';report.setAttribute('aria-label','Document accessibility findings');
  controls.after(report);
  let highlighted=null;
  const clearHighlight=()=>{if(highlighted){highlighted.classList.remove('accessibility-focus');highlighted=null;}};
  const title=document.createElement('h3');title.textContent='Accessibility Review';
  const summary=document.createElement('p');summary.setAttribute('role','status');
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.addEventListener('click',()=>{clearHighlight();report.hidden=true;button.focus();});
  button.addEventListener('click',()=>{
    clearHighlight();report.replaceChildren(title,summary,close);report.hidden=false;
    const api=globalThis.EstiloAPAAccessibility;
    if(!api){summary.textContent='Checker unavailable. Please reload.';return;}
    const result=api.inspect(editor);
    summary.textContent=`${result.summary.errors} errors and ${result.summary.warnings} warnings. Automated checks are partial and do not certify WCAG conformance.`;
    const list=document.createElement('ol');
    result.findings.forEach((finding)=>{
      const li=document.createElement('li');
      const description=document.createElement('span');
      description.textContent=`${finding.severity.toUpperCase()}: ${finding.message}. ${finding.suggestion}`;
      const locate=document.createElement('button');locate.type='button';locate.textContent='Locate';
      locate.setAttribute('aria-label',`Locate: ${finding.message}`);
      locate.addEventListener('click',()=>{
        clearHighlight();
        if(!editor.contains(finding.element)){summary.textContent='Document changed. Run the checker again.';return;}
        highlighted=finding.element;highlighted.classList.add('accessibility-focus');
        highlighted.scrollIntoView({block:'center',behavior:'auto'});
        highlighted.focus?.({preventScroll:true});
      });
      li.append(description,locate);list.appendChild(li);
    });
    if(result.findings.length)report.appendChild(list);
    else {const empty=document.createElement('p');empty.textContent='No issues detected by these limited checks. Manual accessibility review is still required.';report.appendChild(empty);}
    close.focus();
  });
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
