/* Mini Alpha Sculpt: offline 3D studio (three.js r169, vendored). Local only. */
import * as THREE from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/addons/OrbitControls.js";
import { TransformControls } from "./vendor/addons/TransformControls.js";
import { GLTFExporter } from "./vendor/addons/GLTFExporter.js";
import { GLTFLoader } from "./vendor/addons/GLTFLoader.js";
import { RoomEnvironment } from "./vendor/addons/RoomEnvironment.js";
import { mergeVertices } from "./vendor/addons/BufferGeometryUtils.js";

/* Telephantix's palette only (Atlas's material defaults). Never black, pink or purple. */
export const PALETTE = {
  gold: { c: "#D4A64A", m: 1.0, r: 0.28, label: "Gold" },
  embergold: { c: "#C9822B", m: 1.0, r: 0.35, label: "Ember gold" },
  silver: { c: "#C8CED6", m: 1.0, r: 0.18, label: "Silver" },
  steel: { c: "#A9B4C2", m: 1.0, r: 0.22, label: "Steel" },
  gunmetal: { c: "#4A525C", m: 0.9, r: 0.4, label: "Gunmetal" },
  navy: { c: "#1F2F4D", m: 0.2, r: 0.55, label: "Navy" },
  deepred: { c: "#7A1E22", m: 0.3, r: 0.45, label: "Deep red" },
  emberglow: { c: "#C9822B", m: 0.4, r: 0.4, e: "#E07A2B", ei: 2.0, label: "Ember glow" },
  iceglow: { c: "#8CE0FF", m: 0.1, r: 0.3, e: "#8CE0FF", ei: 2.5, label: "Ice glow" },
};
const TYPES = ["sphere", "cube", "cylinder", "torus", "cone", "helix", "ball"];
const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const LS = "mini-sculpt-scene-v1";

function makeMat(key, m, r) {
  const p = PALETTE[key] || PALETTE.steel;
  const mat = new THREE.MeshStandardMaterial({ color: p.c, metalness: m ?? p.m, roughness: r ?? p.r, envMapIntensity: 1.0 });
  if (p.e) { mat.emissive = new THREE.Color(p.e); mat.emissiveIntensity = p.ei; }
  mat.userData.key = key in PALETTE ? key : "steel"; return mat;
}
class HelixCurve extends THREE.Curve {
  constructor(rad, h, turns, phase) { super(); this.rad = rad; this.h = h; this.turns = turns; this.phase = phase; }
  getPoint(t, o = new THREE.Vector3()) { const a = this.phase + t * this.turns * Math.PI * 2; return o.set(Math.cos(a) * this.rad, (t - 0.5) * this.h, Math.sin(a) * this.rad); }
}
function makeGeo(type, s) {
  s = s || [];
  switch (type) {
    case "sphere": return new THREE.SphereGeometry(clamp(s[0], 0.02, 3, 0.5), 48, 32);
    case "ball": return new THREE.SphereGeometry(clamp(s[0], 0.1, 3, 0.8), 160, 120);
    case "cube": return new THREE.BoxGeometry(clamp(s[0], 0.02, 4, 0.8), clamp(s[1], 0.02, 4, 0.8), clamp(s[2], 0.02, 4, 0.8), 8, 8, 8);
    case "cylinder": return new THREE.CylinderGeometry(clamp(s[0], 0, 3, 0.3), clamp(s[1], 0, 3, 0.3), clamp(s[2], 0.02, 6, 1), 40, 8);
    case "cone": return new THREE.ConeGeometry(clamp(s[0], 0.02, 3, 0.4), clamp(s[1], 0.02, 6, 1), 40, 6);
    case "torus": return new THREE.TorusGeometry(clamp(s[0], 0.05, 3, 0.6), clamp(s[1], 0.01, 1, 0.15), 24, 64);
    case "helix": { const rad = clamp(s[0], 0.02, 2, 0.3), h = clamp(s[1], 0.1, 6, 2), turns = clamp(s[2], 0.25, 8, 2.5), tube = clamp(s[3], 0.01, 0.5, 0.05), ph = clamp(s[4], -7, 7, 0);
      return new THREE.TubeGeometry(new HelixCurve(rad, h, turns, ph), Math.round(48 * turns), tube, 12, false); }
  }
  return new THREE.SphereGeometry(0.5, 32, 24);
}
/* ---------- recipes (offline "Ask Mini to build") ---------- */
const P = (type, size, pos, mat, rot, scl) => ({ type, size, pos, mat, rot, scl });
function wing(side) { const out = []; for (let i = 0; i < 5; i++) { const a = 0.35 + i * 0.22; out.push(P("cone", [0.09, 0.9 - i * 0.1], [side * (0.25 + i * 0.13), 1.55 + i * 0.03, -0.02], i % 2 ? "embergold" : "gold", [0, 0, side * (Math.PI / 2 - a)], [1, 1, 0.25])); } return out; }
export const RECIPES = {
  caduceus: () => [P("cylinder", [0.06, 0.08, 3.2], [0, 0, 0], "steel"), P("sphere", [0.17], [0, 1.72, 0], "gold"), P("cylinder", [0.03, 0.03, 0.7], [0, 1.45, 0], "gold", [0, 0, Math.PI / 2]),
    P("helix", [0.24, 2.6, 2.5, 0.055, 0], [0, -0.1, 0], "gold"), P("helix", [0.24, 2.6, 2.5, 0.055, Math.PI], [0, -0.1, 0], "silver"),
    P("sphere", [0.1], [0.2, 1.22, 0.1], "gold", 0, [1.4, 0.8, 1]), P("sphere", [0.1], [-0.2, 1.22, -0.1], "silver", 0, [1.4, 0.8, 1]),
    P("sphere", [0.025], [0.27, 1.25, 0.16], "iceglow"), P("sphere", [0.025], [-0.27, 1.25, -0.16], "iceglow"),
    P("cone", [0.1, 0.2], [0, -1.7, 0], "gunmetal", [Math.PI, 0, 0]), ...wing(1), ...wing(-1)],
  helix: () => [P("helix", [0.5, 3, 3, 0.09, 0], [0, 0, 0], "gold"), P("helix", [0.5, 3, 3, 0.09, Math.PI], [0, 0, 0], "silver"), ...Array.from({ length: 12 }, (_, i) => { const t = i / 11, a = t * 3 * Math.PI * 2; return P("cylinder", [0.03, 0.03, 1], [0, (t - 0.5) * 3, 0], i % 2 ? "steel" : "iceglow", [0, -a, Math.PI / 2]); })],
  tree: () => [P("cylinder", [0.14, 0.24, 1.6], [0, -0.6, 0], "embergold"), P("sphere", [0.75], [0, 0.6, 0], "deepred"), P("sphere", [0.5], [0.55, 0.3, 0.2], "deepred"), P("sphere", [0.5], [-0.5, 0.35, -0.1], "embergold"), P("sphere", [0.45], [0.1, 1.15, 0.1], "gold"), P("cylinder", [1.1, 1.2, 0.12], [0, -1.45, 0], "gunmetal")],
  sword: () => [P("cube", [0.16, 2.2, 0.04], [0, 0.6, 0], "steel"), P("cone", [0.08, 0.3], [0, 1.85, 0], "steel", 0, [1, 1, 0.25]), P("cube", [0.8, 0.08, 0.12], [0, -0.5, 0], "gold"), P("cylinder", [0.05, 0.05, 0.6], [0, -0.85, 0], "deepred"), P("sphere", [0.09], [0, -1.2, 0], "gold"), P("sphere", [0.04], [0, -0.5, 0.07], "iceglow")],
  crystal: () => [P("cone", [0.35, 1.6], [0, 0.5, 0], "iceglow", 0, [1, 1, 1]), P("cone", [0.35, 0.6], [0, -0.6, 0], "iceglow", [Math.PI, 0, 0]), P("cone", [0.18, 0.9], [0.45, 0, 0.1], "steel", [0, 0, -0.5]), P("cone", [0.16, 0.8], [-0.42, -0.05, -0.1], "silver", [0, 0, 0.55]), P("cylinder", [0.9, 1, 0.15], [0, -1, 0], "gunmetal")],
  planet: () => [P("sphere", [0.9], [0, 0, 0], "navy"), P("torus", [1.4, 0.06], [0, 0, 0], "gold", [1.3, 0.2, 0]), P("torus", [1.6, 0.03], [0, 0, 0], "steel", [1.3, 0.2, 0]), P("sphere", [0.18], [1.9, 0.6, 0], "silver"), P("sphere", [0.08], [-1.7, -0.7, 0.4], "iceglow")],
  tower: () => [P("cylinder", [0.5, 0.6, 2.4], [0, -0.2, 0], "steel"), P("cone", [0.65, 0.9], [0, 1.45, 0], "deepred"), ...Array.from({ length: 4 }, (_, i) => P("cube", [0.16, 0.25, 0.1], [Math.cos(i * 1.57) * 0.52, 0.5, Math.sin(i * 1.57) * 0.52], "emberglow", [0, -i * 1.57, 0])), P("torus", [0.58, 0.05], [0, 0.95, 0], "gold", [Math.PI / 2, 0, 0]), P("cylinder", [1, 1.1, 0.15], [0, -1.45, 0], "gunmetal")],
  garden: () => [P("cylinder", [1.3, 1.4, 0.15], [0, -1.2, 0], "gunmetal"), P("cylinder", [0.08, 0.12, 0.9], [-0.5, -0.7, 0], "embergold"), P("sphere", [0.4], [-0.5, -0.1, 0], "gold"), P("cone", [0.2, 0.7], [0.5, -0.8, 0.2], "iceglow"), P("sphere", [0.15], [0.3, -1, -0.4], "silver"), P("torus", [0.25, 0.04], [0.6, -1.1, -0.2], "gold", [Math.PI / 2, 0, 0])],
};
const SYN = { caduceus: /cadu|hermes|staff of|medic/i, helix: /helix|dna|spiral|coil/i, tree: /tree|forest|oak|plant/i, sword: /sword|blade|katana|dagger/i, crystal: /crystal|gem|shard|quartz|diamond/i, planet: /planet|saturn|moon|world|orb/i, tower: /tower|castle|keep|lighthouse/i, garden: /garden|flower|peace/i };
function offlineSpec(text) { for (const k in SYN) if (SYN[k].test(text)) return { key: k, parts: RECIPES[k]() }; const keys = Object.keys(RECIPES); let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const k = keys[h % keys.length]; return { key: k, parts: RECIPES[k]() }; }
export function validateSpec(spec) {
  const arr = spec && Array.isArray(spec.parts) ? spec.parts : Array.isArray(spec) ? spec : null; if (!arr) return null;
  const v3 = (a, lo, hi, d) => Array.isArray(a) ? [0, 1, 2].map((i) => clamp(a[i], lo, hi, d)) : [d, d, d];
  const out = arr.slice(0, 40).filter((p) => p && TYPES.includes(p.type) && p.type !== "ball").map((p) => ({ type: p.type, size: (Array.isArray(p.size) ? p.size : [p.size]).slice(0, 5).map((x) => clamp(x, -7, 6, 0.5)), pos: v3(p.pos, -4, 4, 0), rot: v3(p.rot, -7, 7, 0), scl: v3(p.scl || [1, 1, 1], 0.1, 3, 1), mat: PALETTE[p.mat] ? p.mat : "steel" }));
  return out.length ? out : null;
}
/* ---------- studio ---------- */
export function init(pane) {
  pane.innerHTML = `<div class="sc-view"><div class="sc-hud"></div></div>
  <div class="sc-ask"><input id="sc-ask" placeholder="Ask Mini to build... (caduceus, tree, sword, crystal, planet, tower, helix)" maxlength="300"><button id="sc-go">Build</button></div>
  <div class="sc-bar" id="sc-prim"><span class="sc-h">Add</span></div>
  <div class="sc-bar" id="sc-mode"><span class="sc-h">Tools</span></div>
  <div class="sc-bar" id="sc-brush"><span class="sc-h">Sculpt brush</span></div>
  <div class="sc-bar" id="sc-mat"><span class="sc-h">Material</span></div>
  <div class="sc-bar" id="sc-file"><span class="sc-h">Scene</span></div>`;
  const view = pane.querySelector(".sc-view"), hud = pane.querySelector(".sc-hud"), $ = (id) => pane.querySelector("#" + id);
  const say = (t) => { hud.textContent = t; };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.setClearColor(0x000000, 0);
  view.insertBefore(renderer.domElement, hud);
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 100); cam.position.set(3.2, 1.8, 5.2);
  const key = new THREE.DirectionalLight(0xfff4e0, 2.2); key.position.set(-4, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc8ff, 1.4); rim.position.set(4, 3, -5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdde6f0, 0x2a3550, 0.5));
  const root = new THREE.Group(); scene.add(root);
  // soft contact shadow
  const sc = document.createElement("canvas"); sc.width = sc.height = 128; const g2 = sc.getContext("2d"); const gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(31,47,77,1)"); gr.addColorStop(1, "rgba(31,47,77,0)"); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const updShadow = () => { const b = new THREE.Box3().setFromObject(root); if (b.isEmpty()) { shadow.visible = false; return; } shadow.visible = true; const s = b.getSize(new THREE.Vector3()); const c = b.getCenter(new THREE.Vector3()); shadow.position.set(c.x, b.min.y - 0.01, c.z); const w = Math.max(s.x, s.z) * 1.4 + 0.4; shadow.scale.set(w, w, 1); };

  let mode = "object", brush = "pull", size = 0.3, strength = 0.5, symX = true, sel = null, spin = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  // sculpt pointer handlers are registered BEFORE OrbitControls so they can veto orbiting
  let stroke = null, downAt = null;
  const pick = (e) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.intersectObjects(root.children, true)[0]; };
  const partOf = (o) => { while (o && o.parent !== root) o = o.parent; return o; };
  renderer.domElement.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    if (mode !== "sculpt" || !e.isPrimary) return; const hit = pick(e); if (!hit || !hit.object.isMesh) return;
    orbit.enabled = false; const m = hit.object; prepSculpt(m); stroke = { m, before: m.geometry.attributes.position.array.slice() }; applyBrush(m, hit.point); renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (e) => { if (!stroke) return; const hit = pick(e); if (hit && hit.object === stroke.m) applyBrush(stroke.m, hit.point, e.shiftKey); });
  const endStroke = () => { if (!stroke) return; const { m, before } = stroke; const after = m.geometry.attributes.position.array.slice(); stroke = null; orbit.enabled = true;
    push({ undo: () => setPos(m, before), redo: () => setPos(m, after) }); updShadow(); };
  renderer.domElement.addEventListener("pointerup", (e) => { endStroke(); if (mode === "object" && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && !tc.dragging) { const h = pick(e); select(h ? partOf(h.object) : null); } });
  renderer.domElement.addEventListener("pointercancel", endStroke);
  const orbit = new OrbitControls(cam, renderer.domElement); orbit.enableDamping = true; orbit.target.set(0, 0.2, 0); orbit.screenSpacePanning = true;
  const tc = new TransformControls(cam, renderer.domElement); scene.add(tc.getHelper ? tc.getHelper() : tc); tc.setSize(0.9);
  let tBefore = null;
  tc.addEventListener("dragging-changed", (ev) => { orbit.enabled = !ev.value; const o = tc.object; if (!o) return; if (ev.value) tBefore = snapT(o); else { const a = snapT(o), b = tBefore; push({ undo: () => putT(o, b), redo: () => putT(o, a) }); updShadow(); } });
  const snapT = (o) => [o.position.clone(), o.quaternion.clone(), o.scale.clone()];
  const putT = (o, t) => { o.position.copy(t[0]); o.quaternion.copy(t[1]); o.scale.copy(t[2]); updShadow(); };

  // ---- undo / redo ----
  const undoS = [], redoS = []; const push = (a) => { undoS.push(a); if (undoS.length > 40) undoS.shift(); redoS.length = 0; };
  const undo = () => { const a = undoS.pop(); if (a) { a.undo(); redoS.push(a); } }, redo = () => { const a = redoS.pop(); if (a) { a.redo(); undoS.push(a); } };
  const setPos = (m, arr) => { const p = m.geometry.attributes.position; p.array.set(arr); p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); };

  // ---- sculpting ----
  function prepSculpt(m) {
    if (m.userData.sc) return; let g = m.geometry.clone(); g.deleteAttribute("normal"); g.deleteAttribute("uv"); g = mergeVertices(g, 1e-4); g.computeVertexNormals();
    const n = g.attributes.position.count, idx = g.index.array, nb = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    m.geometry.dispose(); m.geometry = g; m.userData.sc = { nb: nb.map((s) => Uint32Array.from(s)) }; m.userData.sculpted = true;
  }
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
  function applyBrush(m, worldPt, invert) {
    const local = m.worldToLocal(worldPt.clone()); const sc = m.userData.sc; const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal, P = pos.array, N = nor.array;
    const s = m.getWorldScale(new THREE.Vector3()); const r = size / ((s.x + s.y + s.z) / 3); const k = strength * 0.06 * r * (invert ? -1 : 1);
    const centers = [local]; if (symX && Math.abs(local.x) > r * 0.05) centers.push(new THREE.Vector3(-local.x, local.y, local.z));
    for (const c of centers) {
      // average normal / point under brush (for flatten)
      const hits = []; nrm.set(0, 0, 0); const avg = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { const dx = P[i * 3] - c.x, dy = P[i * 3 + 1] - c.y, dz = P[i * 3 + 2] - c.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 < r * r) { const d = Math.sqrt(d2) / r, f = (1 - d * d) * (1 - d * d); hits.push(i, f); nrm.x += N[i * 3] * f; nrm.y += N[i * 3 + 1] * f; nrm.z += N[i * 3 + 2] * f; avg.x += P[i * 3]; avg.y += P[i * 3 + 1]; avg.z += P[i * 3 + 2]; } }
      if (!hits.length) continue; nrm.normalize(); avg.multiplyScalar(2 / hits.length);
      const orig = brush === "smooth" ? P.slice() : null;
      for (let j = 0; j < hits.length; j += 2) {
        const i = hits[j], f = hits[j + 1], o = i * 3;
        if (brush === "pull" || brush === "push") { const sg = brush === "pull" ? 1 : -1; P[o] += nrm.x * k * f * sg; P[o + 1] += nrm.y * k * f * sg; P[o + 2] += nrm.z * k * f * sg; }
        else if (brush === "inflate") { P[o] += N[o] * k * f; P[o + 1] += N[o + 1] * k * f; P[o + 2] += N[o + 2] * k * f; }
        else if (brush === "pinch") { const a = 0.15 * strength * f * (invert ? -1 : 1); P[o] += (c.x - P[o]) * a; P[o + 1] += (c.y - P[o + 1]) * a; P[o + 2] += (c.z - P[o + 2]) * a; }
        else if (brush === "flatten") { tmp.set(P[o] - avg.x, P[o + 1] - avg.y, P[o + 2] - avg.z); const d = tmp.dot(nrm) * 0.3 * strength * f; P[o] -= nrm.x * d; P[o + 1] -= nrm.y * d; P[o + 2] -= nrm.z * d; }
        else if (brush === "smooth") { const nb = sc.nb[i]; if (!nb.length) continue; let x = 0, y = 0, z = 0; for (const q of nb) { x += orig[q * 3]; y += orig[q * 3 + 1]; z += orig[q * 3 + 2]; } const a = 0.6 * strength * f; P[o] += (x / nb.length - P[o]) * a; P[o + 1] += (y / nb.length - P[o + 1]) * a; P[o + 2] += (z / nb.length - P[o + 2]) * a; }
      }
    }
    pos.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }

  // ---- parts ----
  function addPart(p, record = true) {
    const geo = makeGeo(p.type, p.size); const m = new THREE.Mesh(geo, makeMat(p.mat || "steel", p.metal, p.rough));
    m.userData.part = { type: p.type, size: p.size || [] };
    if (p.pos) m.position.fromArray(p.pos); if (p.rot) m.rotation.set(p.rot[0] || 0, p.rot[1] || 0, p.rot[2] || 0); if (p.scl) m.scale.fromArray(p.scl);
    if (p.verts) { try { const f = new Float32Array(Uint8Array.from(atob(p.verts), (c) => c.charCodeAt(0)).buffer); prepSculpt(m); if (f.length === m.geometry.attributes.position.array.length) setPos(m, f); } catch (_) {} }
    root.add(m); if (record) push({ undo: () => { root.remove(m); if (sel === m) select(null); updShadow(); }, redo: () => { root.add(m); updShadow(); } }); updShadow(); return m;
  }
  function select(o) { sel = o; if (o && mode === "object") tc.attach(o); else tc.detach(); syncMat(); say(o ? "Selected " + (o.userData.part?.type || o.name || "model") : "Tap a part to select it. Drag to orbit, pinch or wheel to zoom, two fingers or right-drag to pan."); }
  function clearScene(record = true) { const kids = root.children.slice(); select(null); kids.forEach((k) => root.remove(k)); if (record && kids.length) push({ undo: () => { kids.forEach((k) => root.add(k)); updShadow(); }, redo: () => { kids.forEach((k) => root.remove(k)); updShadow(); } }); updShadow(); }
  function buildParts(parts, label) { const before = root.children.slice(); clearScene(false); const made = parts.map((p) => addPart(p, false)); undoS.length = Math.max(0, undoS.length);
    push({ undo: () => { made.forEach((m) => root.remove(m)); before.forEach((k) => root.add(k)); select(null); updShadow(); }, redo: () => { before.forEach((k) => root.remove(k)); made.forEach((m) => root.add(m)); updShadow(); } });
    frame(); say(label); }
  function frame() { const b = new THREE.Box3().setFromObject(root); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2; orbit.target.copy(c); const dir = cam.position.clone().sub(c).normalize(); cam.position.copy(c).add(dir.multiplyScalar(Math.max(1.5, r / Math.sin((cam.fov * Math.PI) / 360) * 0.95))); orbit.update(); }

  // ---- UI ----
  const btn = (host, label, fn, cls) => { const b = document.createElement("button"); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; $(host).appendChild(b); return b; };
  [["Sphere", "sphere", [0.5]], ["Cube", "cube", [0.8, 0.8, 0.8]], ["Cylinder", "cylinder", [0.3, 0.3, 1.2]], ["Torus", "torus", [0.6, 0.15]], ["Cone", "cone", [0.4, 1]], ["Helix", "helix", [0.3, 2, 2.5, 0.06, 0]], ["Sculpt ball", "ball", [0.8]]]
    .forEach(([l, t, s]) => btn("sc-prim", l, () => { const m = addPart({ type: t, size: s, mat: curMat, pos: [0, 0.2, 0] }); select(m); if (t === "ball") setMode("sculpt"); }));
  const modeBtns = {}; const setMode = (m) => { mode = m; for (const k in modeBtns) modeBtns[k].classList.toggle("on", k === m || k === tc.mode && m === "object" && false); if (m === "sculpt") tc.detach(); else if (sel) tc.attach(sel); say(m === "sculpt" ? "Sculpt: drag on a part. Shift (desktop) inverts. Drag off the model to orbit." : "Object mode"); };
  modeBtns.object = btn("sc-mode", "Object", () => setMode("object"), "on"); modeBtns.sculpt = btn("sc-mode", "Sculpt", () => setMode("sculpt"));
  const gz = {}; ["translate", "rotate", "scale"].forEach((g, i) => { gz[g] = btn("sc-mode", ["Move", "Rotate", "Scale"][i], () => { tc.setMode(g); for (const k in gz) gz[k].classList.toggle("on", k === g); setMode("object"); }, i ? "" : "on"); });
  btn("sc-mode", "Duplicate", () => { if (!sel) return; const c = sel.clone(); c.traverse((o) => { if (o.isMesh) { o.geometry = o.geometry.clone(); o.material = o.material.clone(); } }); c.userData = JSON.parse(JSON.stringify({ part: sel.userData.part || null })); if (sel.userData.sc) { c.userData.sc = sel.userData.sc; c.userData.sculpted = true; } c.position.x += 0.4; root.add(c); push({ undo: () => { root.remove(c); select(null); updShadow(); }, redo: () => { root.add(c); updShadow(); } }); select(c); updShadow(); });
  btn("sc-mode", "Delete", () => { if (!sel) return; const o = sel; root.remove(o); select(null); push({ undo: () => { root.add(o); updShadow(); }, redo: () => { root.remove(o); updShadow(); } }); updShadow(); });
  btn("sc-mode", "Undo", undo); btn("sc-mode", "Redo", redo);
  const spinB = btn("sc-mode", "Turntable", () => { spin = !spin; spinB.classList.toggle("on", spin); });
  btn("sc-mode", "Frame", frame);
  const bb = {}; ["pull", "push", "smooth", "inflate", "pinch", "flatten"].forEach((b) => { bb[b] = btn("sc-brush", b[0].toUpperCase() + b.slice(1), () => { brush = b; for (const k in bb) bb[k].classList.toggle("on", k === b); if (mode !== "sculpt") setMode("sculpt"); }, b === "pull" ? "on" : ""); });
  const slider = (host, label, min, max, step, val, fn) => { const l = document.createElement("label"); l.innerHTML = label + ' <input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">'; const i = l.querySelector("input"); i.oninput = () => fn(+i.value); $(host).appendChild(l); return i; };
  slider("sc-brush", "Size", 0.05, 1.2, 0.01, size, (v) => (size = v)); slider("sc-brush", "Strength", 0.05, 1, 0.01, strength, (v) => (strength = v));
  const symB = btn("sc-brush", "Symmetry X", () => { symX = !symX; symB.classList.toggle("on", symX); }, "on");
  let curMat = "gold"; const sw = {};
  for (const k in PALETTE) { const b = btn("sc-mat", "", () => { curMat = k; for (const q in sw) sw[q].classList.toggle("on", q === k); if (sel) recolor(sel, k); }, "sc-sw" + (k === curMat ? " on" : "")); b.style.background = PALETTE[k].c; b.title = b.ariaLabel = PALETTE[k].label; sw[k] = b; }
  const metI = slider("sc-mat", "Metal", 0, 1, 0.01, 1, (v) => sel && sel.traverse((o) => o.isMesh && (o.material.metalness = v)));
  const rouI = slider("sc-mat", "Rough", 0.02, 1, 0.01, 0.28, (v) => sel && sel.traverse((o) => o.isMesh && (o.material.roughness = v)));
  function recolor(o, k) { const olds = []; o.traverse((x) => { if (x.isMesh) { olds.push([x, x.material]); x.material = makeMat(k); } }); push({ undo: () => olds.forEach(([x, m]) => { const n = x.material; x.material = m; x.userData.redoMat = n; }), redo: () => olds.forEach(([x]) => x.userData.redoMat && (x.material = x.userData.redoMat)) }); syncMat(); }
  function syncMat() { let m = null; sel && sel.traverse((o) => { if (!m && o.isMesh) m = o.material; }); if (m) { metI.value = m.metalness; rouI.value = m.roughness; } }
  btn("sc-file", "Export GLB", () => { new GLTFExporter().parse(root, (buf) => dl(new Blob([buf], { type: "model/gltf-binary" }), "mini-sculpt.glb"), (e) => say("Export failed: " + e), { binary: true }); });
  btn("sc-file", "PNG", () => { const png = snapshot(); const a = document.createElement("a"); a.href = png; a.download = "mini-sculpt.png"; a.click(); });
  btn("sc-file", "Save", () => { try { localStorage.setItem(LS, JSON.stringify(serialize())); say("Saved on this device."); } catch (e) { say("Save failed (storage full?)"); } });
  btn("sc-file", "Load", () => { try { const d = JSON.parse(localStorage.getItem(LS) || "null"); if (!d) return say("Nothing saved yet."); buildParts(d.parts, "Loaded your saved scene."); } catch (e) { say("Load failed."); } });
  btn("sc-file", "Clear", () => clearScene());
  const fl = document.createElement("label"); fl.className = "sc-file"; fl.innerHTML = 'Import GLB<input type="file" accept=".glb,.gltf,model/gltf-binary" hidden>'; $("sc-file").appendChild(fl);
  fl.querySelector("input").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const buf = await f.arrayBuffer(); new GLTFLoader().parse(buf, "", (gl) => { const o = gl.scene; const b = new THREE.Box3().setFromObject(o); const s = 2.2 / Math.max(0.001, b.getSize(new THREE.Vector3()).length()); o.scale.multiplyScalar(s); o.position.sub(b.getCenter(new THREE.Vector3()).multiplyScalar(s)); o.name = f.name; o.userData.imported = true; root.add(o); push({ undo: () => { root.remove(o); select(null); updShadow(); }, redo: () => { root.add(o); updShadow(); } }); select(o); updShadow(); frame(); }, (err) => say("Could not read that GLB.")); e.target.value = ""; };
  const dl = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  function snapshot() { tc.detach(); renderer.render(scene, cam); const c = renderer.domElement, o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, o.height); g.addColorStop(0, "#E6EBF1"); g.addColorStop(1, "#C9D3DE"); x.fillStyle = g; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); if (sel && mode === "object") tc.attach(sel); return o.toDataURL("image/png"); }
  function serialize() { const parts = []; root.children.forEach((o) => { if (!o.isMesh || !o.userData.part) return; const p = { type: o.userData.part.type, size: o.userData.part.size, pos: o.position.toArray(), rot: [o.rotation.x, o.rotation.y, o.rotation.z], scl: o.scale.toArray(), mat: o.material.userData.key || "steel", metal: o.material.metalness, rough: o.material.roughness };
    if (o.userData.sculpted) { const u8 = new Uint8Array(o.geometry.attributes.position.array.buffer.slice(0)); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); p.verts = btoa(s); } parts.push(p); }); return { v: 1, parts }; }

  // ---- Ask Mini ----
  async function ask(text) {
    text = String(text || "").trim().slice(0, 300); if (!text) return;
    const S = window.MiniScene; if (S && S.safe && !S.safe(text)) { const sp = offlineSpec("garden"); buildParts(sp.parts, "I made something kinder instead: a little garden of gold and light."); return; }
    const app = window.MiniApp; let parts = null, src = "offline";
    if (app && app.hasMind && app.hasMind() && app.bubble) {
      say("Mini is thinking up a design...");
      const sys = 'You design small 3D sculptures. Reply with ONLY strict JSON: {"parts":[{"type":T,"size":[numbers],"pos":[x,y,z],"rot":[x,y,z],"mat":M}]}. T is one of sphere(size [radius]), cube([w,h,d]), cylinder([rTop,rBottom,height]), torus([radius,tube]), cone([radius,height]), helix([radius,height,turns,tube,phase]). M is one of ' + Object.keys(PALETTE).join(", ") + ". At most 40 parts, sizes under 3, positions between -2 and 2, model centered at the origin, upright along y. No prose.";
      try { const out = await Promise.race([app.bubble(sys, "Picture for: " + text, { max: 900, temp: 0.5 }), new Promise((r) => setTimeout(() => r(null), 20000))]);
        const m = out && out.match(/\{[\s\S]*\}/); if (m) { parts = validateSpec(JSON.parse(m[0])); if (parts) src = "Mini"; } } catch (e) { console.warn("[sculpt ask]", e); }
    }
    if (!parts) { const sp = offlineSpec(text); parts = sp.parts; buildParts(parts, "Built a " + sp.key + " from shapes" + (app && app.hasMind && app.hasMind() ? " (Mini's design didn't parse, so I used my recipe)." : ".")); }
    else buildParts(parts, "Mini designed this from " + parts.length + " parts.");
  }
  $("sc-go").onclick = () => ask($("sc-ask").value); $("sc-ask").onkeydown = (e) => { if (e.key === "Enter") ask($("sc-ask").value); };

  // ---- loop ----
  function resize() { const w = view.clientWidth || 360, h = view.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(view); resize();
  let last = performance.now(); renderer.setAnimationLoop((t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; if (spin) root.rotation.y += dt * 0.6; orbit.update(); renderer.render(scene, cam); });
  select(null);
  const api = { THREE, scene, root, ask, build: (k) => { const sp = RECIPES[k] ? { key: k, parts: RECIPES[k]() } : offlineSpec(k); buildParts(sp.parts, "Built a " + sp.key + "."); }, snapshot, serialize, resize, setMode, select, undo, redo, recipes: Object.keys(RECIPES), validateSpec };
  window.MiniSculpt = api; return api;
}
