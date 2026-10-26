// MiniRoom: mounts the Den room. Positions are % of the room box, from slots.json.
(function(){
const SLOTS={"window": {"x": 0.56, "y": 0.075, "w": 0.36, "h": 0.25}, "frames": [{"id": "f1", "x": 0.07, "y": 0.08, "w": 0.21, "h": 0.14}, {"id": "f2", "x": 0.32, "y": 0.1, "w": 0.17, "h": 0.11}, {"id": "f3", "x": 0.1, "y": 0.255, "w": 0.15, "h": 0.1}, {"id": "f4", "x": 0.31, "y": 0.245, "w": 0.18, "h": 0.11}], "shelves": [{"id": "s1", "x": 0.05, "y": 0.47, "w": 0.5, "h": 0.03}, {"id": "s2", "x": 0.05, "y": 0.59, "w": 0.5, "h": 0.03}], "shelfSlots": [{"id": "s1-1", "x": 0.07, "y": 0.395, "w": 0.13, "h": 0.075}, {"id": "s1-2", "x": 0.23, "y": 0.395, "w": 0.13, "h": 0.075}, {"id": "s1-3", "x": 0.39, "y": 0.395, "w": 0.13, "h": 0.075}, {"id": "s2-1", "x": 0.07, "y": 0.515, "w": 0.13, "h": 0.075}, {"id": "s2-2", "x": 0.23, "y": 0.515, "w": 0.13, "h": 0.075}, {"id": "s2-3", "x": 0.39, "y": 0.515, "w": 0.13, "h": 0.075}], "lantern": {"x": 0.63, "y": 0.555, "w": 0.2, "h": 0.165}, "brazier": {"x": 0.62, "y": 0.775, "w": 0.26, "h": 0.125}, "bench": {"y": 0.715}};
const OBJ={gear:'gear',fork:'tuning-fork',tuning:'tuning-fork',map:'map',medal:'alpha-medallion',alpha:'alpha-medallion',crystal:'crystal',notebook:'notebook',book:'notebook',journal:'notebook'};
function box(el,s){Object.assign(el.style,{left:s.x*100+'%',top:s.y*100+'%',width:s.w*100+'%',height:s.h*100+'%'});return el}
function div(c){const d=document.createElement('div');d.className=c;return d}
function mount(root,opts={}){
  const base=opts.base||'';root.classList.add('room');
  const cv=box(document.createElement('canvas'),SLOTS.window);cv.className='room__stars';root.appendChild(cv);
  SLOTS.frames.forEach(f=>{const e=box(div('room__item room__frame'),f);e.dataset.slot=f.id;root.appendChild(e)});
  SLOTS.shelves.forEach(s=>root.appendChild(box(div('room__item room__shelf'),s)));
  const L=SLOTS.lantern,B=SLOTS.brazier;
  root.appendChild(box(div('room__glow'),{x:L.x-.15,y:L.y-.08,w:L.w+.3,h:L.h+.16}));
  root.appendChild(box(div('room__item room__lantern'),L));
  root.appendChild(box(div('room__glow room__glow--coals'),{x:B.x-.06,y:B.y-.06,w:B.w+.12,h:B.h}));
  root.appendChild(box(div('room__item room__brazier'),B));
  // starfield
  const ctx=cv.getContext('2d');let stars=[],raf,dpr=Math.min(2,devicePixelRatio||1);
  function size(){cv.width=cv.clientWidth*dpr;cv.height=cv.clientHeight*dpr;stars=Array.from({length:70},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,r:(Math.random()*1.3+.3)*dpr,v:(Math.random()*.06+.02)*dpr,p:Math.random()*6}))}
  size();addEventListener('resize',size);
  const still=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function draw(t){ctx.clearRect(0,0,cv.width,cv.height);for(const s of stars){if(!still){s.x-=s.v;if(s.x<0)s.x=cv.width}
    const a=.45+.4*Math.sin(t/1400+s.p);ctx.fillStyle=s.r>1.4*dpr?`rgba(232,196,106,${a})`:`rgba(190,200,212,${a})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill()}
    raf=requestAnimationFrame(draw)}
  raf=requestAnimationFrame(draw);
  const items={};
  function place(slot,src,label){const s=[...SLOTS.shelfSlots,...SLOTS.frames].find(x=>x.id===slot);if(!s)return;
    items[slot]&&items[slot].forEach(n=>n.remove());const nodes=[];
    if(slot[0]==='f'){const fr=root.querySelector(`[data-slot="${slot}"]`);fr.innerHTML='';const i=new Image();i.src=src;fr.appendChild(i)}
    else{const e=box(div('room__item'),s);e.style.backgroundImage=`url(${src})`;root.appendChild(e);nodes.push(e)}
    if(label){const l=box(div('room__label'),{x:s.x,y:s.y+s.h+(slot[0]==='f'?.005:.03),w:s.w,h:.02});l.textContent=label;root.appendChild(l);nodes.push(l)}
    items[slot]=nodes}
  // [shelf:"brass gear"] -> next free shelf slot, picks a matching object PNG (falls back to crystal)
  function shelf(text){const k=Object.keys(OBJ).find(k=>text.toLowerCase().includes(k));const free=SLOTS.shelfSlots.find(s=>!items[s.id]);if(!free)return null;
    place(free.id,base+'objects/'+(OBJ[k]||'crystal')+'@2x.png',text);return free.id}
  // [ideal:"..."] -> next free frame; pass an image URL (Mini's art) or text only
  function ideal(text,img){const free=SLOTS.frames.find(s=>!items[s.id]);if(!free)return null;
    place(free.id,img||'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><rect width="100" height="70" fill="#0b1a33"/><text x="50" y="40" font-family="Georgia" font-size="6" fill="#d4a63a" text-anchor="middle">${text.replace(/[<&]/g,'').slice(0,30)}</text></svg>`),null);items[free.id]=[];return free.id}
  function tag(str){const r=/\[(shelf|ideal):"([^"]+)"\]/g;let m;while(m=r.exec(str))(m[1]==='shelf'?shelf:ideal)(m[2])}
  // Leave something box
  if(opts.onLeave!==false){const f=document.createElement('form');f.className='room__leave';
    f.innerHTML='<input maxlength="140" placeholder="Leave something for Mini…" aria-label="Leave something"><button>Leave</button>';
    f.onsubmit=e=>{e.preventDefault();const v=f.querySelector('input').value.trim();if(v&&opts.onLeave)opts.onLeave(v);f.querySelector('input').value=''};root.appendChild(f)}
  return{place,shelf,ideal,tag,setMood:c=>root.style.setProperty('--mood',c),stop:()=>cancelAnimationFrame(raf),slots:SLOTS}
}
window.MiniRoom={mount,slots:SLOTS};
})();
