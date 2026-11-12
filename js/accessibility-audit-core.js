/* EstiloAPA accessibility audit core. Independent, non-mutating document checks.
 * Not affiliated with WAVE/WebAIM; does not claim WCAG conformance.
 */
(function(root) {
  'use strict';
  function inspect(container) {
    if (!container || typeof container.querySelectorAll !== 'function') throw new TypeError('Document container required');
    var findings = [];
    function add(rule, severity, node, message, suggestion) {
      findings.push({ rule:rule, severity:severity, element:node, message:message, suggestion:suggestion });
    }
    function text(el) { return (el.textContent || '').replace(/\s+/g,' ').trim(); }
    container.querySelectorAll('img').forEach(function(img) {
      if (!img.hasAttribute('alt')) add('image-alt','error',img,'Image has no alt attribute','Write meaningful alternative text, or use alt="" for a decorative image.');
      else if (img.getAttribute('alt').trim().length > 180) add('alt-length','warning',img,'Alternative text may be too long','Keep alt text concise; place detailed explanations in the document.');
    });
    container.querySelectorAll('a[href]').forEach(function(a) {
      var label = text(a) || a.getAttribute('aria-label') || '';
      if (!label.trim()) add('link-name','error',a,'Link has no accessible name','Add descriptive link text.');
      else if (/^(click here|here|read more|link)$/i.test(label.trim())) add('link-purpose','warning',a,'Link text lacks context','Describe the link destination.');
    });
    container.querySelectorAll('table').forEach(function(table) {
      if (!table.querySelector('th')) add('table-headers','warning',table,'Table has no header cells','Use th elements with scope="col" or scope="row" where appropriate.');
      table.querySelectorAll('th').forEach(function(th) {
        if (!th.hasAttribute('scope') && !th.hasAttribute('headers')) add('table-header-association','warning',th,'Header association needs review','Add scope or explicit headers for complex tables.');
      });
    });
    // Check explicitly declared opaque foreground/background colors only.
    // Inherited, transparent, image and gradient backgrounds require manual review.
    function rgb(value) {
      var match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
      if (match) {
        var h=match[1];if(h.length===3)h=h.split('').map(function(c){return c+c;}).join('');
        return [0,2,4].map(function(i){return parseInt(h.slice(i,i+2),16);});
      }
      match=/^rgba?\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*(?:,\\s*([\\d.]+))?\\s*\\)$/i.exec(value.trim());
      if (!match || (match[4]!==undefined && Number(match[4])!==1))return null;
      var values=[Number(match[1]),Number(match[2]),Number(match[3])];
      return values.every(function(n){return n>=0&&n<=255;})?values:null;
    }
    function luminance(c) {
      var v=c.map(function(n){n=n/255;return n<=0.04045?n/12.92:Math.pow((n+0.055)/1.055,2.4);});
      return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
    }
    container.querySelectorAll('[style]').forEach(function(el) {
      var fg=rgb(el.style.color||''),bg=rgb(el.style.backgroundColor||'');
      if(!fg||!bg||!text(el))return;
      var a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
      if(ratio<4.5) add('explicit-color-contrast','warning',el,'Possible low text contrast ('+ratio.toFixed(2)+':1)','Verify WCAG 2.2 contrast requirements; large text may use a 3:1 threshold.');
    });
    var previous=0;
    container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) {
      var level=Number(h.tagName.slice(1));
      if (!text(h)) add('empty-heading','error',h,'Empty heading','Add meaningful heading text.');
      if (previous && level>previous+1) add('heading-order','warning',h,'Heading level skipped','Review heading hierarchy.');
      previous=level;
    });
    container.querySelectorAll('[role="img"]').forEach(function(el) {
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) add('role-image-name','error',el,'Image role has no accessible name','Add aria-label or aria-labelledby.');
    });
    return { findings:findings, summary:{
      errors:findings.filter(function(x){return x.severity==='error';}).length,
      warnings:findings.filter(function(x){return x.severity==='warning';}).length,
      checkedAt:new Date().toISOString()
    }, disclaimer:'Automated checks are partial. Manual review and WAVE evaluation are still required.' };
  }
  var api={inspect:inspect};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.EstiloAPAAccessibility=api;
})(typeof globalThis!=='undefined'?globalThis:this);
