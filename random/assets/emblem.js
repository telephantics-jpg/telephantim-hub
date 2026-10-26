// Mini Alpha emblem. MiniAlphaEmblem.mount(el) -> {setMood}. Global setMood(mood) drives all emblems.
(function(){
const SVG=`<svg viewBox="0 0 200 200" role="img" aria-label="Mini Alpha">
<defs>
<radialGradient id="ma-gBlue"><stop offset=".6" stop-color="#5b86b8" stop-opacity="1"/><stop offset="1" stop-color="#0b1a33" stop-opacity="0"/></radialGradient>
<radialGradient id="ma-gEmber"><stop offset=".55" stop-color="#ff7a1a"/><stop offset=".75" stop-color="#d4a63a" stop-opacity=".7"/><stop offset="1" stop-color="#0b1a33" stop-opacity="0"/></radialGradient>
<radialGradient id="ma-gGold"><stop offset=".6" stop-color="#d4a63a" stop-opacity=".7"/><stop offset="1" stop-color="#0b1a33" stop-opacity="0"/></radialGradient>
<linearGradient id="ma-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e9f0"/><stop offset=".45" stop-color="#9aa6b4"/><stop offset=".7" stop-color="#6c7888"/><stop offset="1" stop-color="#3a4a62"/></linearGradient>
<linearGradient id="ma-bevel" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#dfe6ee"/><stop offset="1" stop-color="#2a3a55"/></linearGradient>
<linearGradient id="ma-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4d782"/><stop offset=".55" stop-color="#d4a63a"/><stop offset="1" stop-color="#8a6218"/></linearGradient>
<linearGradient id="ma-gFlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#ff9a2e"/><stop offset="1" stop-color="#b8330f"/></linearGradient>
<linearGradient id="ma-shimG" x1="0" x2="1"><stop offset=".35" stop-color="#fff3cf" stop-opacity="0"/><stop offset=".5" stop-color="#fff3cf" stop-opacity=".8"/><stop offset=".65" stop-color="#fff3cf" stop-opacity="0"/></linearGradient>
<linearGradient id="ma-runG"><stop offset="0" stop-color="#f4d782" stop-opacity="0"/><stop offset="1" stop-color="#f4d782"/></linearGradient>
<filter id="ma-blur"><feGaussianBlur stdDeviation="1.2"/></filter>
<filter id="ma-engrave"><feDropShadow dx="-1" dy="-1" stdDeviation=".6" flood-color="#0b1a33" flood-opacity=".8"/><feDropShadow dx="1" dy="1.2" stdDeviation=".5" flood-color="#fff6dc" flood-opacity=".5"/></filter>
<clipPath id="ma-clip"><circle cx="100" cy="100" r="76"/></clipPath>
</defs>
<circle class="ma-aura" cx="100" cy="100" r="100"/>
<circle cx="100" cy="103" r="84" fill="#0b1a33" opacity=".6" filter="url(#ma-blur)"/>
<circle cx="100" cy="100" r="84" fill="url(#ma-bevel)"/>
<circle cx="100" cy="100" r="76" fill="url(#ma-steel)"/>
<g clip-path="url(#ma-clip)"><g class="ma-streaks" opacity=".35" stroke-width=".7" filter="url(#ma-blur)">${
 Array.from({length:60},(_,i)=>{const a=i*6*Math.PI/180,r1=20+(i*37%30),c=i%2?'#f2f6fa':'#2a3a55';
 return `<path d="M${100+r1*Math.cos(a)} ${100+r1*Math.sin(a)} A${r1} ${r1} 0 0 1 ${100+r1*Math.cos(a+.9)} ${100+r1*Math.sin(a+.9)}" stroke="${c}" fill="none"/>`}).join('')}
${Array.from({length:12},(_,i)=>{const r=14+i*5.3;return `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${i%2?'#eef3f8':'#3a4a62'}" stroke-dasharray="${8+i} ${5+i*2}"/>`}).join('')}</g>
<rect class="ma-shimmer" x="40" y="-20" width="120" height="240" fill="url(#ma-shimG)"/></g>
<g class="ma-ring" fill="none" stroke="#d4a63a" stroke-width=".8"><circle cx="100" cy="100" r="80"/><polygon points="${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180,r=i%2?74:80;return (100+r*Math.cos(a))+','+(100+r*Math.sin(a))}).join(' ')}"/></g>
<circle class="ma-rimglow" cx="100" cy="100" r="80" fill="none" stroke-width="5" filter="url(#ma-blur)"/>
<circle class="ma-runner" cx="100" cy="100" r="80" fill="none" stroke="url(#ma-runG)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="90 413"/>
<path class="ma-sweep" d="M100 100 L100 20 A80 80 0 0 1 156 43 Z" fill="#8e1b14" opacity=".25"/>
<g class="ma-alphaG"><text class="ma-alpha" x="100" y="128" text-anchor="middle" font-family="Georgia,'DejaVu Serif',serif" font-weight="700" font-size="96" fill="url(#ma-gold)" stroke="#8a6218" stroke-width=".8" filter="url(#ma-engrave)">&#945;</text></g>
<g class="ma-glints" fill="#fff3cf">${[[66,78],[132,72],[124,132]].map(([x,y])=>`<path d="M${x} ${y-7}L${x+1.5} ${y-1.5}L${x+7} ${y}L${x+1.5} ${y+1.5}L${x} ${y+7}L${x-1.5} ${y+1.5}L${x-7} ${y}L${x-1.5} ${y-1.5}Z"/>`).join('')}</g>
</svg>`;
const MOODS=['calm','thinking','firedup','wise','playful','focused'],all=[];
function mount(el,mood){el.classList.add('ma-emblem');el.innerHTML=SVG;const api={el,setMood(m){if(!MOODS.includes(m))m='calm';MOODS.forEach(x=>el.classList.remove('m-'+x));el.classList.add('m-'+m);el.dataset.mood=m}};api.setMood(mood||'calm');all.push(api);return api}
window.MiniAlphaEmblem={mount,MOODS};
window.setMood=m=>all.forEach(a=>a.setMood(m));
document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('[data-mini-alpha-emblem]').forEach(e=>mount(e,e.dataset.mood)));
})();
