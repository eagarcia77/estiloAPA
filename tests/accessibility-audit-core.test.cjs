/* Run with: node --test tests/accessibility-audit-core.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect}=require('../js/accessibility-audit-core.js');
function element(props={}) {
  const attrs=props.attrs||{};
  return {
    textContent:props.text||'',tagName:props.tagName||'P',
    style:props.style||{color:'',backgroundColor:''},
    hasAttribute(name){return Object.hasOwn(attrs,name);},
    getAttribute(name){return attrs[name]??null;},
    querySelector(selector){return props.children?.[selector]||null;},
    querySelectorAll(selector){return props.groups?.[selector]||[];}
  };
}
function container(groups={}){return element({groups});}
test('does not mutate the document',()=>{
  const img=element();
  const root=container({img:[img]});
  const result=inspect(root);
  assert.equal(result.summary.errors,1);
  assert.equal(result.findings[0].rule,'image-alt');
  assert.equal(img.hasAttribute('alt'),false);
});
test('decorative image with empty alt is allowed',()=>{
  const result=inspect(container({img:[element({attrs:{alt:''}})]}));
  assert.equal(result.summary.errors,0);
});
test('flags ambiguous links and skipped heading levels',()=>{
  const a=element({attrs:{href:'/example'},text:'click here'});
  const h1=element({tagName:'H1',text:'One'});
  const h3=element({tagName:'H3',text:'Three'});
  const rules=inspect(container({'a[href]':[a],'h1,h2,h3,h4,h5,h6':[h1,h3]})).findings.map(f=>f.rule);
  assert.deepEqual(rules,['link-purpose','heading-order']);
});
test('flags low contrast in explicit RGB styles',()=>{
  const p=element({text:'Example',style:{color:'rgb(140, 140, 140)',backgroundColor:'#ffffff'}});
  const result=inspect(container({'[style]':[p]}));
  assert.equal(result.findings[0]?.rule,'explicit-color-contrast');
});
test('warns for missing table headers and missing header scope',()=>{
  const noHeader=element({children:{th:null},groups:{th:[]}});
  const th=element({tagName:'TH'});
  const withHeader=element({children:{th},groups:{th:[th]}});
  const rules=inspect(container({table:[noHeader,withHeader]})).findings.map(f=>f.rule);
  assert.deepEqual(rules,['table-headers','table-header-association']);
});
