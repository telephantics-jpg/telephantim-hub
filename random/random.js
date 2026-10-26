(function(){
  var root=document.querySelector('.rnd-section');if(!root)return;
  // Mood ring: swap the static PNG for the live emblem if emblem.js is loaded
  var box=root.querySelector('.rnd-emblem'),moodEl=root.querySelector('.rnd-mood');
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(box&&window.MiniAlphaEmblem){
    var holder=document.createElement('div');box.appendChild(holder);
    var em=MiniAlphaEmblem.mount(holder,'calm');
    var img=box.querySelector('img');if(img)img.style.visibility='hidden';
    var moods=['calm','thinking','wise','playful','firedup'],i=0;
    var show=function(){em.setMood(moods[i]);if(moodEl)moodEl.textContent='Mood: '+(moods[i]==='firedup'?'fired up':moods[i]);};
    show();
    if(!reduce)setInterval(function(){i=(i+1)%moods.length;show();},4500);
  }
  // iOS hint
  var ua=navigator.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var standalone=window.navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
  var hint=root.querySelector('.rnd-ios');if(hint&&ios&&!standalone)hint.hidden=false;
  // Android / Chrome install prompt
  var btn=root.querySelector('.rnd-install'),deferred=null;
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;if(btn)btn.hidden=false;});
  if(btn)btn.addEventListener('click',function(){if(!deferred)return;deferred.prompt();deferred.userChoice.finally(function(){deferred=null;btn.hidden=true;});});
  window.addEventListener('appinstalled',function(){if(btn)btn.hidden=true;});
})();
