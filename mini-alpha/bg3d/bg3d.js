// bg3d.js — Mini Alpha 3D background (Atlas). Requires import map entry "three".
import * as THREE from 'three';

let S = null;

export async function requestTiltPermission() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try { return (await D.requestPermission()) === 'granted'; } catch { return false; }
  }
  return !!D;
}

function panelTexture(seed, gold) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = gold ? '#E0BC6A' : '#C4CCD6'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i++) { // brushed streaks
    g.fillStyle = `rgba(255,255,255,${r() * 0.08})`; g.fillRect(0, i, 256, 1);
  }
  g.strokeStyle = '#fff'; g.lineWidth = 2; // circuit traces (emissive mask drawn separately)
  const e = document.createElement('canvas'); e.width = e.height = 256;
  const h = e.getContext('2d'); h.fillStyle = '#000'; h.fillRect(0, 0, 256, 256);
  h.strokeStyle = '#8CE0FF'; h.fillStyle = '#8CE0FF'; h.lineWidth = 2;
  const step = 32;
  for (let k = 0; k < 14; k++) {
    let x = Math.floor(r() * 8) * step + 16, y = Math.floor(r() * 8) * step + 16;
    h.beginPath(); h.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      const d = Math.floor(r() * 4); const L = step * (1 + Math.floor(r() * 3));
      x += [L, -L, 0, 0][d]; y += [0, 0, L, -L][d];
      h.lineTo(x, y);
    }
    h.stroke(); h.beginPath(); h.arc(x, y, 4, 0, 7); h.fill();
  }
  // fractal square subdivision etch on base
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  (function sub(x, y, w, d) { g.strokeRect(x + 2, y + 2, w - 4, w - 4); if (d && r() < 0.7) { const q = w / 2; sub(x, y, q, d - 1); sub(x + q, y + q, q, d - 1); } })(0, 0, 256, 4);
  const t1 = new THREE.CanvasTexture(c); t1.colorSpace = THREE.SRGBColorSpace;
  const t2 = new THREE.CanvasTexture(e); t2.colorSpace = THREE.SRGBColorSpace;
  return [t1, t2];
}

export function mountBackground(container = document.body, opts = {}) {
  if (S) unmount();
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer:coarse)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || opts.static;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cv = renderer.domElement;
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '-1', pointerEvents: 'none' });
  container.appendChild(cv);

  const scene = new THREE.Scene();
  // gradient background #E6EBF1 -> #C9D3DE
  const gc = document.createElement('canvas'); gc.width = 2; gc.height = 256;
  const gg = gc.getContext('2d'); const gr = gg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#E6EBF1'); gr.addColorStop(1, '#C9D3DE'); gg.fillStyle = gr; gg.fillRect(0, 0, 2, 256);
  const bgT = new THREE.CanvasTexture(gc); bgT.colorSpace = THREE.SRGBColorSpace; scene.background = bgT;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.Scene().add(new THREE.HemisphereLight(0xffffff,0x8090a0,3)) && (()=>{const e=new THREE.Scene();e.background=new THREE.Color(0xDDE4EC);return e;})(), 0.04).texture; pm.dispose();
  scene.fog = new THREE.Fog(0xD6DEE7, 8, 26);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60); camera.position.set(0, 0, 10);
  const key = new THREE.DirectionalLight(0xFFF4E0, 2.2); key.position.set(-5, 6, 6);
  const rim = new THREE.DirectionalLight(0x9CC8FF, 1.4); rim.position.set(5, 2, -6);
  scene.add(key, rim, new THREE.HemisphereLight(0xDDE6F0, 0x2A3550, 0.5));

  const tex = [panelTexture(7, false), panelTexture(13, true), panelTexture(29, false)];
  const panels = []; const geo = new THREE.BoxGeometry(1, 1, 0.06);
  const mats = tex.map(([m, e], i) => new THREE.MeshStandardMaterial({
    map: m, emissiveMap: e, emissive: 0x8CE0FF, emissiveIntensity: 0.6, envMapIntensity: 1,
    color: i === 1 ? 0xD4A64A : 0xA9B4C2, metalness: 0.45, roughness: i === 1 ? 0.3 : 0.25,
  }));
  const N = mobile ? 14 : 22;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, mats[i % 3]);
    const z = -2 - Math.random() * 14, s = 1 + Math.random() * 2.5;
    m.scale.set(s, s * (0.6 + Math.random() * 0.8), 1);
    m.position.set((Math.random() - 0.5) * (14 + -z), (Math.random() - 0.5) * (10 + -z * 0.6), z);
    m.rotation.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, Math.random() * 0.3);
    m.userData = { v: 0.05 + Math.random() * 0.1, ph: Math.random() * 6.28, r: (Math.random() - 0.5) * 0.05 };
    scene.add(m); panels.push(m);
  }
  // gold dust
  const DN = mobile ? 250 : 500, pos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) pos.set([(Math.random() - .5) * 20, (Math.random() - .5) * 14, -Math.random() * 14 + 2], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xE8C468, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(dust);

  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const onMouse = (e) => { tgt.x = (e.clientX / innerWidth - 0.5) * 2; tgt.y = (e.clientY / innerHeight - 0.5) * 2; };
  const onTilt = (e) => { if (e.gamma == null) return; tgt.x = Math.max(-1, Math.min(1, e.gamma / 30)); tgt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); };
  addEventListener('mousemove', onMouse);
  if (opts.tilt) addEventListener('deviceorientation', onTilt);

  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (reduced) draw(0); };
  const clock = new THREE.Clock(); let raf = 0, t = 0;
  function draw(dt) {
    t += dt;
    cur.x += (tgt.x - cur.x) * 0.05; cur.y += (tgt.y - cur.y) * 0.05;
    camera.position.x = cur.x * 0.8; camera.position.y = -cur.y * 0.5; camera.lookAt(0, 0, -6);
    for (const m of panels) {
      const u = m.userData; m.position.y += Math.sin(t * u.v + u.ph) * 0.002; m.rotation.z += u.r * dt;
      m.position.x += u.v * dt * 0.3; if (m.position.x > 14) m.position.x = -14;
    }
    mats.forEach((m, i) => m.emissiveIntensity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 2)));
    dust.rotation.y = t * 0.01; dust.position.y = Math.sin(t * 0.2) * 0.3;
    renderer.render(scene, camera);
  }
  const loop = () => { raf = requestAnimationFrame(loop); draw(Math.min(clock.getDelta(), 0.05)); };
  const onVis = () => { cancelAnimationFrame(raf); raf = 0; if (!document.hidden && !reduced) { clock.getDelta(); loop(); } };
  addEventListener('resize', resize); document.addEventListener('visibilitychange', onVis);
  resize(); if (reduced) draw(0); else loop();
  S = { renderer, cv, raf: () => raf, stop: () => cancelAnimationFrame(raf), off: () => {
    removeEventListener('mousemove', onMouse); removeEventListener('deviceorientation', onTilt);
    removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis);
  }, scene };
  return { unmount };
}

export function unmount() {
  if (!S) return;
  S.stop(); S.off();
  S.scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); });
  S.renderer.dispose(); S.cv.remove(); S = null;
}
