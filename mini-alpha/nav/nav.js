/* Mini Alpha nav — MiniNav + MiniPanel. Plain JS, no deps. */
(function(g){
var I=null; // icon paths, loaded inline below
var P={chat:'M8 12h32v20H22l-8 7v-7H8Z M15 20h18M15 26h11',sketch:'M10 36V14M17 36V20M24 36V10M31 36V24M38 36V16M7 38h34',write:'M12 36l3-9L33 9l6 6-18 18Z M30 12l6 6M15 27l6 6M10 40h28',canvas:'M24 8a16 16 0 1 0 0 32c3 0 3-4 1-6s0-5 3-5h5a7 7 0 0 0 7-7C40 14 33 8 24 8Z M16 22h0M22 15h0M31 17h0',den:'M9 40V22L24 9l15 13v18Z M19 40V29h10v11 M24 18v4',more:'M24 5l4 15 15 4-15 4-4 15-4-15-15-4 15-4Z M24 19l-5 5 5 5 5-5Z',studio:'M10 30v-6a14 14 0 0 1 28 0v6 M8 30h6v10H8Z M34 30h6v10h-6Z',tools:'M30 8a8 8 0 0 0-7 11L9 33l6 6 14-14a8 8 0 0 0 11-7l-5 3-4-4 3-5Z',ideas:'M24 7a11 11 0 0 0-6 20v5h12v-5a11 11 0 0 0-6-20Z M19 37h10M21 41h6 M24 22v-6',settings:'M24 16a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.3 4.3M33.2 33.2l4.3 4.3M10.5 37.5l4.3-4.3M33.2 14.8l4.3-4.3',play:'M16 10l22 14-22 14Z'};
function icon(n){return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="'+(P[n]||P.more)+'" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>'}
function norm(t){return typeof t==='string'?{id:t.toLowerCase(),label:t,icon:t.toLowerCase()}:Object.assign({icon:t.id},t)}
var MiniNav={icon:icon,mount:function(el,o){
 o=o||{};var tabs=(o.tabs||['Chat','Sketch','Write','Canvas','Den']).map(norm),more=(o.more||['Studio','Tools','Ideas','Settings']).map(norm),cb=o.onSelect||function(){};
 el.classList.add('mn-root');
 el.innerHTML='<div class="mn-scrim"></div><div class="mn-drawer" role="dialog" aria-label="More" aria-hidden="true"><h3>More</h3><div class="mn-grid">'+more.map(function(t){return '<button class="mn-tile" data-id="'+t.id+'">'+icon(t.icon)+t.label+'</button>'}).join('')+'</div></div><nav class="mn-bar" role="tablist">'+tabs.map(function(t){return '<button class="mn-tab" role="tab" aria-selected="false" data-id="'+t.id+'">'+icon(t.icon)+'<span>'+t.label+'</span></button>'}).join('')+'<button class="mn-tab mn-more" aria-expanded="false" aria-label="More">'+icon('more')+'<span>More</span></button></nav>';
 var mb=el.querySelector('.mn-more'),dr=el.querySelector('.mn-drawer');
 function setOpen(v){el.classList.toggle('mn-open',v);mb.setAttribute('aria-expanded',v);dr.setAttribute('aria-hidden',!v);if(v)dr.querySelector('.mn-tile').focus()}
 function select(id,silent){el.querySelectorAll('.mn-tab[data-id]').forEach(function(b){b.setAttribute('aria-selected',b.dataset.id===id)});api.active=id;setOpen(false);if(!silent)cb(id)}
 el.addEventListener('click',function(e){var b=e.target.closest('button'),s=e.target.closest('.mn-scrim');if(s)return setOpen(false);if(!b)return;if(b===mb)return setOpen(!el.classList.contains('mn-open'));if(b.dataset.id)select(b.dataset.id)});
 document.addEventListener('keydown',function(e){if(e.key==='Escape')setOpen(false)});
 var api={select:select,open:function(){setOpen(true)},close:function(){setOpen(false)},toggle:function(){setOpen(!el.classList.contains('mn-open'))},active:null};
 select(o.active||tabs[0].id,true);return api}};
var MiniPanel={mount:function(el,o){
 o=o||{};el.classList.add('mp');
 var body=el.querySelector('.mp-body'),h=document.createElement('button');h.className='mp-handle';h.setAttribute('aria-label','Expand settings');h.setAttribute('aria-expanded','false');el.prepend(h);
 var open=false;function set(v){open=v;el.classList.toggle('mp-open',v);h.setAttribute('aria-expanded',v);h.setAttribute('aria-label',v?'Collapse settings':'Expand settings');el.style.transform='';o.onToggle&&o.onToggle(v)}
 var y0=null,dy=0,moved=false;
 h.addEventListener('pointerdown',function(e){y0=e.clientY;dy=0;moved=false;h.setPointerCapture(e.pointerId)});
 h.addEventListener('pointermove',function(e){if(y0==null)return;dy=e.clientY-y0;if(Math.abs(dy)>6)moved=true;if(open&&dy>0)el.style.transform='translateY('+dy+'px)'});
 h.addEventListener('pointerup',function(){if(y0==null)return;y0=null;if(!moved)set(!open);else if(dy<-30)set(true);else if(dy>30)set(false);else set(open)});
 h.addEventListener('pointercancel',function(){y0=null;set(open)});
 var pl=el.querySelector('.mp-play');if(pl){pl.innerHTML=icon('play');pl.addEventListener('click',function(){var v=pl.getAttribute('aria-pressed')!=='true';pl.setAttribute('aria-pressed',v);o.onPlay&&o.onPlay(v)})}
 return {open:function(){set(true)},close:function(){set(false)},toggle:function(){set(!open)},get isOpen(){return open}}}};
g.MiniNav=MiniNav;g.MiniPanel=MiniPanel})(window);
