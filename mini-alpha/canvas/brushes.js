/* Mini Alpha Canvas engine — vanilla, no deps. window.MiniCanvas */
(function(g){
'use strict';
var PALETTE=['#060e1e','#0b1a33','#1a2c4a','#2e3640','#5b6672','#9aa5b1','#d8dee4','#d4a63a','#f4d782','#e07a1f','#7a1414','#b32020'];
function hex(h){h=h.replace('#','');return[parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
function nearest(c){var r=hex(c),best=PALETTE[0],bd=1e9;PALETTE.forEach(function(p){var q=hex(p),d=(q[0]-r[0])*(q[0]-r[0])*.3+(q[1]-r[1])*(q[1]-r[1])*.59+(q[2]-r[2])*(q[2]-r[2])*.11;if(d<bd){bd=d;best=p;}});return best;}
function MiniCanvas(host,opt){
  if(!(this instanceof MiniCanvas))return new MiniCanvas(host,opt);
  opt=opt||{};var self=this;
  this.host=typeof host==='string'?document.querySelector(host):host;
  this.w=opt.width||1024;this.h=opt.height||1024;this.dpr=1;
  this.stampBase=opt.stampBase||'stamps/';
  this.background=opt.background||'#0b1a33';
  this.host.classList.add('mc-stage');
  this.layers=[];
  for(var i=0;i<3;i++){var c=document.createElement('canvas');c.width=this.w;c.height=this.h;c.className='mc-layer';c.dataset.layer=i;this.host.appendChild(c);this.layers.push({canvas:c,ctx:c.getContext('2d'),visible:true});}
  this.overlay=document.createElement('canvas');this.overlay.width=this.w;this.overlay.height=this.h;this.overlay.className='mc-layer mc-overlay';this.host.appendChild(this.overlay);
  this.octx=this.overlay.getContext('2d');
  this.layers[0].ctx.fillStyle=this.background;this.layers[0].ctx.fillRect(0,0,this.w,this.h);
  this.state={tool:'pen',color:'#d4a63a',size:8,opacity:1,layer:1,locked:true,stamp:'gear',stampScale:1,stampRotation:0};
  this.undoStack=[];this.redoStack=[];this.maxUndo=opt.maxUndo||30;this.listeners={};this._stamps={};
  this._bind();
}
var P=MiniCanvas.prototype;
P.on=function(e,f){(this.listeners[e]=this.listeners[e]||[]).push(f);return this;};
P._emit=function(e,d){(this.listeners[e]||[]).forEach(function(f){f(d);});};
P.setTool=function(t){this.state.tool=t;this._emit('change',this.state);return this;};
P.setColor=function(c){this.state.color=this.state.locked?nearest(c):c;this._emit('change',this.state);return this.state.color;};
P.setSize=function(s){this.state.size=Math.max(1,Math.min(200,+s));return this;};
P.setOpacity=function(o){this.state.opacity=Math.max(.05,Math.min(1,+o));return this;};
P.setLayer=function(i){this.state.layer=Math.max(0,Math.min(2,i|0));this._emit('change',this.state);return this;};
P.toggleLayer=function(i,v){var L=this.layers[i];L.visible=v===undefined?!L.visible:!!v;L.canvas.style.visibility=L.visible?'':'hidden';return L.visible;};
P.setPaletteLock=function(v){this.state.locked=!!v;if(v)this.state.color=nearest(this.state.color);this._emit('change',this.state);return this;};
P.setStamp=function(name,scale,rot){this.state.stamp=name;if(scale!=null)this.state.stampScale=scale;if(rot!=null)this.state.stampRotation=rot;return this;};
P.palette=function(){return PALETTE.slice();};
P._snap=function(){var L=this.layers[this.state.layer];this.undoStack.push({i:this.state.layer,img:L.ctx.getImageData(0,0,this.w,this.h)});if(this.undoStack.length>this.maxUndo)this.undoStack.shift();this.redoStack.length=0;};
P._swap=function(from,to){var s=from.pop();if(!s)return false;var L=this.layers[s.i];to.push({i:s.i,img:L.ctx.getImageData(0,0,this.w,this.h)});L.ctx.putImageData(s.img,0,0);this._emit('history',{undo:this.undoStack.length,redo:this.redoStack.length});return true;};
P.undo=function(){return this._swap(this.undoStack,this.redoStack);};
P.redo=function(){return this._swap(this.redoStack,this.undoStack);};
P.clearLayer=function(i){i=i==null?this.state.layer:i;var keep=this.state.layer;this.state.layer=i;this._snap();this.state.layer=keep;var c=this.layers[i].ctx;c.clearRect(0,0,this.w,this.h);if(i===0){c.fillStyle=this.background;c.fillRect(0,0,this.w,this.h);}};
P._pos=function(e){var r=this.overlay.getBoundingClientRect();var p=e.pressure;if(e.pointerType==='mouse'||!p)p=e.buttons?0.6:0.5;if(e.pointerType==='touch'&&p===0.5)p=0.6;return{x:(e.clientX-r.left)*this.w/r.width,y:(e.clientY-r.top)*this.h/r.height,p:p};};
P._bind=function(){var self=this,o=this.overlay;o.style.touchAction='none';
  o.addEventListener('pointerdown',function(e){e.preventDefault();o.setPointerCapture(e.pointerId);self.begin(self._pos(e));});
  o.addEventListener('pointermove',function(e){var pts=e.getCoalescedEvents?e.getCoalescedEvents():[e];if(!self._down){if(self.state.tool==='stamp')self._ghost(self._pos(e));return;}pts.forEach(function(ev){self.move(self._pos(ev));});});
  ['pointerup','pointercancel'].forEach(function(t){o.addEventListener(t,function(e){self.end(self._pos(e));});});
  o.addEventListener('wheel',function(e){if(self.state.tool!=='stamp')return;e.preventDefault();if(e.shiftKey)self.state.stampRotation+=e.deltaY>0?15:-15;else self.state.stampScale=Math.max(.1,Math.min(4,self.state.stampScale*(e.deltaY>0?.9:1.1)));self._ghost(self._pos(e));},{passive:false});
};
/* public stroke API (also used by Mini to draw programmatically) */
P.begin=function(p){this._down=true;this._last=p;this._snap();var t=this.state.tool;if(t==='stamp'){this.placeStamp(this.state.stamp,p.x,p.y,this.state.stampScale,this.state.stampRotation,true);this._down=false;return;}if(t==='smudge')this._pick=this._sample(p);this._dab(p,p);};
P.move=function(p){if(!this._down)return;this._dab(this._last,p);this._last=p;};
P.end=function(){this._down=false;this._last=null;};
P.stroke=function(points,o){var s=Object.assign({},this.state);Object.assign(this.state,o||{});if(this.state.locked&&o&&o.color)this.state.color=nearest(o.color);this.begin(points[0]);for(var i=1;i<points.length;i++)this.move(points[i]);this.end();var keep={layer:s.layer,tool:s.tool,color:s.color,size:s.size,opacity:s.opacity};Object.assign(this.state,keep);};
P._sample=function(p){var d=this.layers[this.state.layer].ctx.getImageData(Math.max(0,p.x|0),Math.max(0,p.y|0),1,1).data;return d;};
P._dab=function(a,b){var s=this.state,c=this.layers[s.layer].ctx,size=s.size*(.35+p(b)*1.3);function p(q){return q.p==null?.5:q.p;}
  var dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);c.save();c.globalAlpha=s.opacity;
  switch(s.tool){
  case 'pen':c.strokeStyle=s.color;c.lineCap=c.lineJoin='round';c.lineWidth=size;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x+.01,b.y);c.stroke();break;
  case 'eraser':c.globalCompositeOperation='destination-out';c.lineCap='round';c.lineWidth=size*1.5;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x+.01,b.y);c.stroke();break;
  case 'airbrush':var n=Math.max(1,dist/2|0),r=size*1.6;c.fillStyle=s.color;for(var i=0;i<=n;i++){var t=i/n,x=a.x+dx*t,y=a.y+dy*t;for(var k=0;k<size*1.2;k++){var ang=Math.random()*6.283,rr=r*Math.sqrt(Math.random())*Math.random();c.globalAlpha=s.opacity*.25*p(b);c.fillRect(x+Math.cos(ang)*rr,y+Math.sin(ang)*rr,1.4,1.4);}}break;
  case 'glow':var gc=(s.locked&&['#d4a63a','#f4d782','#e07a1f','#b32020'].indexOf(s.color)<0)?'#e07a1f':s.color;c.globalCompositeOperation='lighter';c.lineCap='round';
    c.shadowColor=gc;c.shadowBlur=size*2.2;c.strokeStyle=gc;c.globalAlpha=s.opacity*.35;c.lineWidth=size*1.6;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x+.01,b.y);c.stroke();
    c.shadowBlur=size*.6;c.globalAlpha=s.opacity*.9;c.strokeStyle='#f4d782';c.lineWidth=Math.max(1,size*.35);c.stroke();break;
  case 'smudge':var n2=Math.max(1,dist/(size*.25)|0),R=size;for(var j=1;j<=n2;j++){var x2=a.x+dx*j/n2,y2=a.y+dy*j/n2,sx=x2-dx/n2,sy=y2-dy/n2;
      c.globalAlpha=.55;c.save();c.beginPath();c.arc(x2,y2,R,0,6.283);c.clip();c.drawImage(this.layers[s.layer].canvas,sx-R,sy-R,R*2,R*2,x2-R,y2-R,R*2,R*2);c.restore();
      c.globalAlpha=.05;c.strokeStyle='#9aa5b1';c.lineWidth=.8;for(var q=-2;q<=2;q++){c.beginPath();c.moveTo(sx+q*R*.3,sy);c.lineTo(x2+q*R*.3,y2);c.stroke();}}break;
  }c.restore();};
P.loadStamp=function(name){var self=this;if(this._stamps[name])return this._stamps[name];this._stamps[name]=new Promise(function(res,rej){var im=new Image();im.onload=function(){res(im);};im.onerror=rej;im.src=self.stampBase+name+'.svg';});return this._stamps[name];};
P.placeStamp=function(name,x,y,scale,rot,noSnap){var self=this,L=this.state.layer;if(!noSnap)this._snap();this.octx.clearRect(0,0,this.w,this.h);
  return this.loadStamp(name).then(function(im){var c=self.layers[L].ctx,sz=256*(scale||1);c.save();c.translate(x,y);c.rotate((rot||0)*Math.PI/180);c.drawImage(im,-sz/2,-sz/2,sz,sz);c.restore();self._emit('stamp',{name:name,x:x,y:y});});};
P._ghost=function(p){var self=this,s=this.state;this.loadStamp(s.stamp).then(function(im){var o=self.octx,sz=256*s.stampScale;o.clearRect(0,0,self.w,self.h);o.save();o.globalAlpha=.45;o.translate(p.x,p.y);o.rotate(s.stampRotation*Math.PI/180);o.drawImage(im,-sz/2,-sz/2,sz,sz);o.strokeStyle='#d4a63a';o.setLineDash([6,6]);o.strokeRect(-sz/2,-sz/2,sz,sz);o.restore();});};
P.flatten=function(){var c=document.createElement('canvas');c.width=this.w;c.height=this.h;var x=c.getContext('2d');this.layers.forEach(function(L){if(L.visible)x.drawImage(L.canvas,0,0);});return c;};
P.toDataURL=function(){return this.flatten().toDataURL('image/png');};
P.exportPNG=function(name){var self=this;return new Promise(function(res){self.flatten().toBlob(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(name||'mini-canvas')+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},2000);res(b);},'image/png');});};
P.destroy=function(){this.host.innerHTML='';this.listeners={};};
MiniCanvas.PALETTE=PALETTE;MiniCanvas.nearest=nearest;
MiniCanvas.STAMPS=['circuit-trace','chip','fractal-shard','fractal-shard-red','gear','rivet','caduceus','mjolnir','alpha-mark','star','star-cluster','compass-star','waveform','waveform-bars','steel-plate','ember-glow'];
g.MiniCanvas=MiniCanvas;
})(window);
