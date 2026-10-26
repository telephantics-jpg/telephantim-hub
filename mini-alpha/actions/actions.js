/* Mini Alpha message actions — Atlas. MiniActions.attach(messageEl,{onRiff,onWhy,onSend(target),onKeep}) */
(function(g){
const P={"riff": "<path d=\"M10 38 L20 28 M20 28 L20 16 M20 28 L32 28 M20 16 L28 8 M32 28 L40 20 M24 8h4v4 M36 20h4v4\"/><circle cx=\"20\" cy=\"28\" r=\"3\"/><circle cx=\"10\" cy=\"38\" r=\"2\"/>", "why": "<path d=\"M24 6a18 18 0 1 0 0 36a18 18 0 1 0 0-36Z\"/><path d=\"M18 19a6 6 0 1 1 9 5c-2 1-3 2-3 5v1 M24 35v1\"/>", "send": "<path d=\"M8 14v24h24 M14 32L34 12 M22 12h12v12\"/><path d=\"M38 6h4v4 M38 18h4v4\"/>", "keep": "<path d=\"M6 38h36 M10 38v4 M38 38v4 M24 6v14 M18 14l6 6 6-6 M16 26h16v12H16Z\"/>", "sketch": "<path d=\"M8 34V18 M16 34V12 M24 34V22 M32 34V8 M40 34V16 M6 40h36\"/>", "write": "<path d=\"M10 38l4-12L32 8l8 8-18 18Z M28 12l8 8 M10 38h28\"/>", "check": "<path d=\"M10 25l9 9 19-20\"/>"};
const svg=n=>'<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter">'+P[n]+'</g></svg>';
const B=(cls,icon,label,extra)=>{const b=document.createElement('button');b.type='button';b.className='ma-btn '+cls;b.setAttribute('aria-label',label);b.title=label;b.innerHTML=svg(icon)+'<span class="ma-label">'+label+'</span>';if(extra)for(const k in extra)b.setAttribute(k,extra[k]);return b};
let openPop=null;
function close(){if(openPop){openPop.pop.hidden=true;openPop.btn.setAttribute('aria-expanded','false');openPop=null}}
document.addEventListener('click',e=>{if(openPop&&!openPop.row.contains(e.target))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openPop){const b=openPop.btn;close();b.focus()}});
function toast(text){const t=document.createElement('div');t.className='ma-toast';t.setAttribute('role','status');t.innerHTML=svg('check')+'<span>'+(text||'Kept in the Den')+'</span>';document.body.appendChild(t);
 setTimeout(()=>t.classList.add('ma-out'),1600);setTimeout(()=>t.remove(),2000);return t}
function attach(el,h){h=h||{};if(el.querySelector(':scope > .ma-row'))return el.querySelector(':scope > .ma-row');
 const row=document.createElement('div');row.className='ma-row';row.setAttribute('role','group');row.setAttribute('aria-label','Message actions');
 const riff=B('ma-riff','riff','Riff on this'),why=B('ma-why','why','Why?'),send=B('ma-send','send','Send to Canvas'),keep=B('ma-keep','keep','Keep in the Den',{'aria-pressed':'false'});
 const pop=document.createElement('div');pop.className='ma-pop';pop.setAttribute('role','menu');pop.hidden=true;
 const ps=B('','sketch','Sketch',{role:'menuitem','data-target':'sketch'}),pw=B('','write','Write',{role:'menuitem','data-target':'write'});pop.append(ps,pw);
 riff.onclick=()=>h.onRiff&&h.onRiff(el);why.onclick=()=>h.onWhy&&h.onWhy(el);
 send.onclick=e=>{e.stopPropagation();close();h.onSend&&h.onSend('canvas',el)};
 [ps,pw].forEach(b=>b.onclick=e=>{e.stopPropagation();const t=b.dataset.target;close();send.focus();h.onSend&&h.onSend(t,el)});
 keep.onclick=()=>{if(keep.classList.contains('ma-kept'))return;keep.classList.add('ma-kept');keep.setAttribute('aria-pressed','true');keep.querySelector('.ma-label').textContent='Kept';keep.setAttribute('aria-label','Kept in the Den');toast();h.onKeep&&h.onKeep(el)};
 row.append(riff,why,send,keep);el.appendChild(row);return row}
g.MiniActions={attach,toast,icons:P};
})(window);
