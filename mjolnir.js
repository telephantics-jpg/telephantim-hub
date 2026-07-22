import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const wrap = document.getElementById("canvas-wrap");
const flashEl = document.getElementById("flash");

function stageSize() {
  const w = Math.max(1, wrap?.clientWidth || window.innerWidth);
  const h = Math.max(1, wrap?.clientHeight || window.innerHeight);
  return { w, h };
}

function isMobile() {
  return window.matchMedia("(max-width: 899px)").matches;
}

const scene = new THREE.Scene();
// Video background (your clip) — 3D relics stay fully interactive on top
const stageBgVideo = document.getElementById("stage-bg-video");
if (stageBgVideo) {
  stageBgVideo.muted = true;
  stageBgVideo.defaultMuted = true;
  stageBgVideo.loop = true;
  stageBgVideo.playsInline = true;
  stageBgVideo.setAttribute("playsinline", "");
  stageBgVideo.setAttribute("loop", "");
  const kick = () => stageBgVideo.play().catch(() => {});
  // Some browsers / VideoTexture ignore the loop attribute — force replay
  const replay = () => {
    try {
      stageBgVideo.currentTime = 0;
    } catch (_) {}
    kick();
  };
  stageBgVideo.addEventListener("ended", replay);
  // Fallback if "ended" never fires near the end
  stageBgVideo.addEventListener("timeupdate", () => {
    const d = stageBgVideo.duration;
    if (!d || !Number.isFinite(d)) return;
    if (d - stageBgVideo.currentTime < 0.12 && !stageBgVideo.loopingFix) {
      stageBgVideo.loopingFix = true;
      replay();
      setTimeout(() => {
        stageBgVideo.loopingFix = false;
      }, 400);
    }
  });
  stageBgVideo.addEventListener("loadeddata", kick);
  stageBgVideo.addEventListener("canplay", kick);
  kick();
  const bgTex = new THREE.VideoTexture(stageBgVideo);
  if ("colorSpace" in bgTex) bgTex.colorSpace = THREE.SRGBColorSpace;
  else if ("encoding" in bgTex) bgTex.encoding = THREE.sRGBEncoding;
  bgTex.minFilter = THREE.LinearFilter;
  bgTex.magFilter = THREE.LinearFilter;
  scene.background = bgTex;
} else {
  scene.background = new THREE.Color(0x05070c);
}
// Lighter fog so the video reads behind the relics
scene.fog = new THREE.FogExp2(0x0a1020, 0.012);

const { w: sw0, h: sh0 } = stageSize();
const camera = new THREE.PerspectiveCamera(isMobile() ? 28 : 34, sw0 / sh0, 0.1, 100);
// Start zoomed out + centered so BOTH relics are on screen
camera.position.set(0, isMobile() ? 2.55 : 2.35, isMobile() ? 14.2 : 11.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sw0, sh0, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3.5;
controls.maxDistance = 22;
controls.target.set(0, 1.1, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0;
controls.maxPolarAngle = Math.PI * 0.92;
// On mobile, allow page scroll outside canvas; keep rotate on canvas only
controls.enablePan = !isMobile();

const hemi = new THREE.HemisphereLight(0x6a8ab8, 0x1a1208, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
key.position.set(4, 8, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 30;
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0002;
scene.add(key);

const fill = new THREE.DirectionalLight(0x88aaff, 0.55);
fill.position.set(-5, 2, -3);
scene.add(fill);

const rim = new THREE.PointLight(0x66ccff, 0.8, 20);
rim.position.set(-2, 3, 4);
scene.add(rim);

const stormLight = new THREE.PointLight(0xaaddff, 0, 18, 2);
stormLight.position.set(0, 1.4, 0);
scene.add(stormLight);

// Soft pad under relics only — keep video bg open (no big dark disc)
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 48),
  new THREE.MeshStandardMaterial({
    color: 0x0a0e16,
    metalness: 0.55,
    roughness: 0.55,
    transparent: true,
    opacity: 0.35,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

// Floor ring + rune orbit removed — stage was too busy over the video bg
const ring = null;
const runeGroup = null;

const metalHead = new THREE.MeshStandardMaterial({ color: 0x6e7888, metalness: 0.95, roughness: 0.28 });
const metalDark = new THREE.MeshStandardMaterial({ color: 0x3a404c, metalness: 0.92, roughness: 0.4 });
const metalGold = new THREE.MeshStandardMaterial({
  color: 0xc9a227,
  metalness: 0.95,
  roughness: 0.32,
  emissive: 0x3a2a05,
  emissiveIntensity: 0.15,
});
const leather = new THREE.MeshStandardMaterial({ color: 0x4a2c18, metalness: 0.05, roughness: 0.85 });
const leatherDark = new THREE.MeshStandardMaterial({ color: 0x2a180e, metalness: 0.05, roughness: 0.9 });

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x101820);
envScene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x223044, side: THREE.BackSide })
  )
);
scene.environment = pmrem.fromScene(envScene, 0.04).texture;
pmrem.dispose();

const hammer = new THREE.Group();
hammer.position.y = 0.05;

const head = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.95, 0.95), metalHead);
head.position.set(0, 1.55, 0);
head.castShadow = true;
head.receiveShadow = true;
hammer.add(head);

const sidePlateGeo = new THREE.BoxGeometry(0.08, 0.82, 0.82);
const leftPlate = new THREE.Mesh(sidePlateGeo, metalDark);
leftPlate.position.set(-0.8, 1.55, 0);
leftPlate.castShadow = true;
hammer.add(leftPlate);
const rightPlate = leftPlate.clone();
rightPlate.position.x = 0.8;
hammer.add(rightPlate);

const capGeo = new THREE.BoxGeometry(1.45, 0.08, 0.85);
const topCap = new THREE.Mesh(capGeo, metalDark);
topCap.position.set(0, 2.05, 0);
topCap.castShadow = true;
hammer.add(topCap);
const botCap = topCap.clone();
botCap.position.y = 1.05;
hammer.add(botCap);

const faceInset = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.62, 0.06), metalDark);
faceInset.position.set(0, 1.55, 0.48);
hammer.add(faceInset);
const faceInsetB = faceInset.clone();
faceInsetB.position.z = -0.48;
hammer.add(faceInsetB);

const makeTrim = (w, h, d, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metalGold);
  m.position.set(x, y, z);
  m.castShadow = true;
  hammer.add(m);
};
makeTrim(1.58, 0.05, 0.98, 0, 1.95, 0);
makeTrim(1.58, 0.05, 0.98, 0, 1.15, 0);
makeTrim(0.05, 0.9, 0.98, -0.78, 1.55, 0);
makeTrim(0.05, 0.9, 0.98, 0.78, 1.55, 0);

const emblem = new THREE.Group();
emblem.position.set(0, 1.55, 0.52);
const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.04), metalGold);
diamond.rotation.z = Math.PI / 4;
emblem.add(diamond);
emblem.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.03), metalGold));
hammer.add(emblem);
const emblemBack = emblem.clone();
emblemBack.position.z = -0.52;
emblemBack.rotation.y = Math.PI;
hammer.add(emblemBack);

const endL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.7), metalGold);
endL.position.set(-0.88, 1.55, 0);
endL.castShadow = true;
hammer.add(endL);
const endR = endL.clone();
endR.position.x = 0.88;
hammer.add(endR);

const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 24), metalGold);
collar.position.set(0, 1.0, 0);
collar.castShadow = true;
hammer.add(collar);

const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 12, 32), metalDark);
collarRing.rotation.x = Math.PI / 2;
collarRing.position.set(0, 0.95, 0);
hammer.add(collarRing);

const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 1.05, 24), leather);
shaft.position.set(0, 0.45, 0);
shaft.castShadow = true;
shaft.receiveShadow = true;
hammer.add(shaft);

for (let i = 0; i < 9; i++) {
  const wrapRing = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.018, 8, 24), leatherDark);
  wrapRing.rotation.x = Math.PI / 2;
  wrapRing.position.set(0, 0.12 + i * 0.1, 0);
  hammer.add(wrapRing);
}

const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 24), metalGold);
pommel.position.set(0, -0.08, 0);
pommel.castShadow = true;
hammer.add(pommel);

const pommelTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), metalDark);
pommelTip.position.set(0, -0.16, 0);
pommelTip.castShadow = true;
hammer.add(pommelTip);

const strap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 10, 28, Math.PI * 1.3), leather);
strap.position.set(0, -0.22, 0);
strap.rotation.x = Math.PI / 2;
strap.rotation.z = Math.PI;
hammer.add(strap);

const wearMat = metalDark.clone();
wearMat.roughness = 0.55;
for (let i = 0; i < 12; i++) {
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.06 + Math.random() * 0.08, 0.04, 0.04), wearMat);
  const side = Math.random() > 0.5 ? 1 : -1;
  chip.position.set((Math.random() - 0.5) * 1.3, 1.2 + Math.random() * 0.7, side * (0.48 + Math.random() * 0.02));
  chip.rotation.set(Math.random(), Math.random(), Math.random());
  hammer.add(chip);
}

// Both relics on-screen together (left hammer · right staff)
hammer.position.set(-1.2, 0.05, 0);
scene.add(hammer);

// ---------- Caduceus: staff + fluid DNA-like snakes ----------
const caduceus = new THREE.Group();
caduceus.position.set(1.2, 0.05, 0);
caduceus.userData.isCaduceus = true;

const staffGold = new THREE.MeshStandardMaterial({
  color: 0xd4af37,
  metalness: 0.92,
  roughness: 0.28,
  emissive: 0x3a2a05,
  emissiveIntensity: 0.12,
});
const staffDark = new THREE.MeshStandardMaterial({ color: 0x4a3a18, metalness: 0.7, roughness: 0.4 });
const snakeMatA = new THREE.MeshStandardMaterial({
  color: 0x2ecc71,
  metalness: 0.35,
  roughness: 0.25,
  emissive: 0x0a4020,
  emissiveIntensity: 0.55,
});
const snakeMatB = new THREE.MeshStandardMaterial({
  color: 0x48dbfb,
  metalness: 0.35,
  roughness: 0.25,
  emissive: 0x053545,
  emissiveIntensity: 0.55,
});
const wingMat = new THREE.MeshStandardMaterial({
  color: 0xf5e6c8,
  metalness: 0.15,
  roughness: 0.45,
  emissive: 0x332208,
  emissiveIntensity: 0.15,
  side: THREE.DoubleSide,
});

// Cross staff (vertical + horizontal beam) — cleaner than a plain rod+orb
const crossH = 2.2;
const rod = new THREE.Mesh(new THREE.BoxGeometry(0.1, crossH, 0.1), staffGold);
rod.position.y = crossH * 0.5;
rod.castShadow = true;
caduceus.add(rod);
// Crossbeam
const beam = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.1), staffGold);
beam.position.y = 1.55;
beam.castShadow = true;
caduceus.add(beam);
// Soft rounded tips on cross ends
const tipGeo = new THREE.SphereGeometry(0.07, 12, 10);
for (const [x, y] of [
  [0, crossH],
  [0.55, 1.55],
  [-0.55, 1.55],
]) {
  const tip = new THREE.Mesh(tipGeo, staffGold);
  tip.position.set(x, y, 0);
  caduceus.add(tip);
}
// Base
const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 16), staffDark);
base.position.y = 0.02;
caduceus.add(base);

// Wings — present but not overpowering
function makeWing(side) {
  const g = new THREE.Group();
  const main = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12, 0, Math.PI), wingMat);
  main.scale.set(1.35, 0.38, 0.95);
  main.rotation.y = side > 0 ? -0.45 : 0.45;
  main.rotation.z = side > 0 ? -0.55 : 0.55;
  main.position.set(side * 0.1, 0.04, 0);
  g.add(main);
  for (let i = 0; i < 5; i++) {
    const feather = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.022, 0.38 - i * 0.04),
      wingMat
    );
    feather.position.set(
      side * (0.2 + i * 0.08),
      0.01 - i * 0.03,
      -0.04 - i * 0.045
    );
    feather.rotation.y = side * (0.22 + i * 0.03);
    feather.rotation.z = side * (-0.35 - i * 0.06);
    feather.rotation.x = -0.12;
    g.add(feather);
  }
  for (let i = 0; i < 3; i++) {
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.28 - i * 0.035), wingMat);
    up.position.set(side * (0.16 + i * 0.07), 0.12 + i * 0.04, -0.06);
    up.rotation.z = side * (-0.15 + i * 0.04);
    up.rotation.y = side * 0.18;
    g.add(up);
  }
  g.position.set(side * 0.08, 1.95, 0);
  g.scale.setScalar(0.92);
  return g;
}
caduceus.add(makeWing(1));
caduceus.add(makeWing(-1));

/** DNA double-helix — fewer turns, less clutter */
const HELIX_TURNS = 1.35;
const HELIX_HEIGHT = 1.55;
const HELIX_RADIUS = 0.32;
const HELIX_BASE_Y = 0.4;

function helixPoints(phase, turns = HELIX_TURNS, height = HELIX_HEIGHT, radius = HELIX_RADIUS, segs = 48) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const ang = u * Math.PI * 2 * turns + phase;
    // gentle organic pulse only (not busy)
    const r = radius * (1 + 0.04 * Math.sin(u * Math.PI * 2 + phase));
    pts.push(new THREE.Vector3(Math.cos(ang) * r, HELIX_BASE_Y + u * height, Math.sin(ang) * r));
  }
  return pts;
}

function buildSnakeTube(points, mat, radius = 0.055) {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
  const geo = new THREE.TubeGeometry(curve, 64, radius, 8, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return { mesh, curve };
}

const snakeAData = buildSnakeTube(helixPoints(0), snakeMatA, 0.058);
const snakeBData = buildSnakeTube(helixPoints(Math.PI), snakeMatB, 0.058);
caduceus.add(snakeAData.mesh);
caduceus.add(snakeBData.mesh);

// Snake heads
function snakeHead(mat, phase) {
  const g = new THREE.Group();
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat);
  g.add(headM);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), mat);
  jaw.rotation.x = Math.PI / 2;
  jaw.position.z = -0.1;
  g.add(jaw);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
  e1.position.set(0.035, 0.03, -0.05);
  const e2 = e1.clone();
  e2.position.x = -0.035;
  g.add(e1, e2);
  g.userData.phase = phase;
  return g;
}
const headA = snakeHead(snakeMatA, 0);
const headB = snakeHead(snakeMatB, Math.PI);
caduceus.add(headA);
caduceus.add(headB);

// Fewer DNA rungs (clean ladder, not busy)
const dnaRungs = new THREE.Group();
const rungMat = new THREE.MeshBasicMaterial({
  color: 0xaef5ff,
  transparent: true,
  opacity: 0.4,
});
const RUNG_COUNT = 5;
for (let i = 0; i < RUNG_COUNT; i++) {
  const u = (i + 0.5) / RUNG_COUNT;
  const ang = u * Math.PI * 2 * HELIX_TURNS;
  const y = HELIX_BASE_Y + u * HELIX_HEIGHT;
  const r = HELIX_RADIUS;
  const a = new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r);
  const b = new THREE.Vector3(Math.cos(ang + Math.PI) * r, y, Math.sin(ang + Math.PI) * r);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 6), rungMat);
  rung.position.copy(mid);
  rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  dnaRungs.add(rung);
}
caduceus.add(dnaRungs);

// Hit volume for grabbing
const cadHit = new THREE.Mesh(
  new THREE.CylinderGeometry(0.45, 0.35, 2.5, 12),
  new THREE.MeshBasicMaterial({ visible: false })
);
cadHit.position.y = 1.2;
caduceus.add(cadHit);

scene.add(caduceus);

// Caduceus energy (teal/emerald “life” sparks, similar to lightning)
const cadAura = new THREE.Group();
scene.add(cadAura);
const cadEnergy = new THREE.Group();
scene.add(cadEnergy);

function spawnCadEnergy(count = 5) {
  while (cadEnergy.children.length) {
    const c = cadEnergy.children.pop();
    c.geometry?.dispose();
    c.material?.dispose();
  }
  const origin = new THREE.Vector3(0, 1.4, 0);
  for (let i = 0; i < count; i++) {
    const end = origin.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6)
    );
    const pts = makeLightningPath(origin, end, 10, 0.22);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    cadEnergy.add(
      new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.9 })
      )
    );
    cadEnergy.add(
      new THREE.Line(
        geo.clone(),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
      )
    );
  }
}

function refreshSnakeMeshes(t) {
  // Rebuild helix with flowing phase — fewer turns, smoother tubes
  const flow = t * 1.1;
  const ptsA = helixPoints(flow, HELIX_TURNS, HELIX_HEIGHT, HELIX_RADIUS, 48);
  const ptsB = helixPoints(flow + Math.PI, HELIX_TURNS, HELIX_HEIGHT, HELIX_RADIUS, 48);
  const curveA = new THREE.CatmullRomCurve3(ptsA, false, "catmullrom", 0.45);
  const curveB = new THREE.CatmullRomCurve3(ptsB, false, "catmullrom", 0.45);

  snakeAData.mesh.geometry.dispose();
  snakeBData.mesh.geometry.dispose();
  snakeAData.mesh.geometry = new THREE.TubeGeometry(curveA, 64, 0.058, 8, false);
  snakeBData.mesh.geometry = new THREE.TubeGeometry(curveB, 64, 0.058, 8, false);

  // Heads ride the top of each helix
  const tipA = curveA.getPoint(0.97);
  const tipB = curveB.getPoint(0.97);
  const tanA = curveA.getTangent(0.97);
  const tanB = curveB.getTangent(0.97);
  headA.position.copy(tipA);
  headB.position.copy(tipB);
  headA.lookAt(tipA.clone().add(tanA));
  headB.lookAt(tipB.clone().add(tanB));
}

const lightningGroup = new THREE.Group();
scene.add(lightningGroup);
const auraGroup = new THREE.Group();
scene.add(auraGroup);
let auraEnabled = true;

function makeLightningPath(start, end, segments = 10, jagged = 0.25) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(start, end, t);
    if (i > 0 && i < segments) {
      p.x += (Math.random() - 0.5) * jagged;
      p.y += (Math.random() - 0.5) * jagged * 0.5;
      p.z += (Math.random() - 0.5) * jagged;
    }
    points.push(p);
  }
  return points;
}

function clearGroup(group) {
  while (group.children.length) {
    const c = group.children.pop();
    c.geometry?.dispose();
    c.material?.dispose();
  }
}

function spawnLightningBolts(count = 6) {
  clearGroup(lightningGroup);
  const origin = new THREE.Vector3(0, 1.55, 0);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const len = 1.2 + Math.random() * 2.2;
    const end = new THREE.Vector3(
      origin.x + Math.sin(phi) * Math.cos(theta) * len,
      origin.y + Math.cos(phi) * len * 0.6 + 0.4,
      origin.z + Math.sin(phi) * Math.sin(theta) * len
    );
    const pts = makeLightningPath(origin, end, 12 + Math.floor(Math.random() * 6), 0.35);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    lightningGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.95 })));
    lightningGroup.add(new THREE.Line(geo.clone(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })));
  }
}

function refreshAura() {
  clearGroup(auraGroup);
  if (!auraEnabled) return;
  const origin = new THREE.Vector3(0, 1.55, 0);
  for (let i = 0; i < 4; i++) {
    const end = origin.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.4)
    );
    const pts = makeLightningPath(origin, end, 6, 0.2);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    auraGroup.add(
      new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.25 + Math.random() * 0.25 })
      )
    );
  }
}

const sparkCount = 80;
const sparkGeo = new THREE.BufferGeometry();
const sparkPositions = new Float32Array(sparkCount * 3);
const sparkVel = [];
for (let i = 0; i < sparkCount; i++) {
  sparkPositions[i * 3 + 1] = -10;
  sparkVel.push(new THREE.Vector3());
}
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
const sparks = new THREE.Points(
  sparkGeo,
  new THREE.PointsMaterial({
    color: 0xcceeff,
    size: 0.06,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
scene.add(sparks);

function burstSparks() {
  const pos = sparkGeo.attributes.position.array;
  for (let i = 0; i < sparkCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 0.4;
    pos[i * 3 + 1] = 1.4 + Math.random() * 0.4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    sparkVel[i].set((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

function updateSparks(dt) {
  const pos = sparkGeo.attributes.position.array;
  for (let i = 0; i < sparkCount; i++) {
    if (pos[i * 3 + 1] < -5) continue;
    sparkVel[i].y -= 6 * dt;
    pos[i * 3] += sparkVel[i].x * dt;
    pos[i * 3 + 1] += sparkVel[i].y * dt;
    pos[i * 3 + 2] += sparkVel[i].z * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(sw0, sh0), 0.5, 0.4, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function fitCameraDefault() {
  const mobile = isMobile();
  // Always show BOTH Mjolnir + Caduceus, centered, zoomed out
  camera.position.set(0, mobile ? 2.55 : 2.35, mobile ? 14.2 : 11.2);
  camera.fov = mobile ? 28 : 34;
  camera.updateProjectionMatrix();
  controls.target.set(0, 1.05, 0);
  controls.minDistance = mobile ? 4.0 : 3.8;
  controls.maxDistance = 24;
  controls.update();
}

// ---------- Grabbable relics (Mjolnir + Caduceus) + cartoon hand ----------
const homePos = {
  hammer: new THREE.Vector3(-1.2, 0.05, 0),
  caduceus: new THREE.Vector3(1.2, 0.05, 0),
};
const grab = {
  active: false,
  hovering: false,
  target: null, // THREE.Object3D currently held
  kind: null, // "hammer" | "caduceus"
  offset: new THREE.Vector3(),
  hit: new THREE.Vector3(),
  last: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  spin: new THREE.Vector3(),
  cadPulse: 0,
};
let lastTossed = null;
const dragPlane = new THREE.Plane();
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const _camDir = new THREE.Vector3();
const grabbables = [hammer, caduceus];

const hand = new THREE.Group();
hand.visible = false;
const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c9a8, roughness: 0.65, metalness: 0.05 });
const gloveMat = new THREE.MeshStandardMaterial({
  color: 0xc9a227,
  roughness: 0.45,
  metalness: 0.35,
  emissive: 0x3a2a05,
  emissiveIntensity: 0.2,
});
const palm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.42), gloveMat);
palm.position.set(0, 0, 0.05);
hand.add(palm);
for (let i = 0; i < 4; i++) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.28), gloveMat);
  f.position.set(-0.12 + i * 0.09, 0.04, -0.28);
  f.rotation.x = -0.35;
  hand.add(f);
}
const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.2), gloveMat);
thumb.position.set(-0.22, 0.02, 0.05);
thumb.rotation.y = 0.7;
hand.add(thumb);
const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 10), skinMat);
wrist.rotation.x = Math.PI / 2;
wrist.position.set(0, 0, 0.32);
hand.add(wrist);
scene.add(hand);

const grabHint = document.getElementById("grab-hint");

function setCursor(mode) {
  if (!renderer?.domElement) return;
  renderer.domElement.style.cursor = mode === "grabbing" ? "grabbing" : mode === "grab" ? "grab" : "default";
}

function pointerNdc(event, out) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  out.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return true;
}

function projectOntoDragPlane(event, target, worldPos) {
  if (!pointerNdc(event, ndc)) return false;
  raycaster.setFromCamera(ndc, camera);
  camera.getWorldDirection(_camDir);
  dragPlane.setFromNormalAndCoplanarPoint(_camDir.clone().negate(), worldPos);
  return raycaster.ray.intersectPlane(dragPlane, target) !== null;
}

function isUiTarget(event) {
  return !!event.target.closest?.(
    ".sheet, .sheet-handle, .btn-luna, .btn-chip, .btn-min, .topbar, a, button, input, .float-actions, .dbox, .dialogue-layer, .world-switch, .scene-frame, .scene-fallback, .music-player"
  );
}

function pickGrabbable(event) {
  if (!pointerNdc(event, ndc)) return null;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(grabbables, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !grabbables.includes(obj)) obj = obj.parent;
  return obj || null;
}

function kindOf(obj) {
  if (obj === caduceus) return "caduceus";
  return "hammer";
}

function updateHandPose(target) {
  if (!hand.visible || !target) return;
  hand.position.copy(target.position);
  hand.position.y += 0.35;
  hand.position.x += 0.15;
  hand.position.z += 0.35;
  hand.lookAt(camera.position);
  hand.rotateX(-0.4);
  hand.scale.setScalar(grab.active ? 1.08 : 1);
}

let strikeTime = 0;

function strike(atObject) {
  strikeTime = 1.0;
  const originObj = atObject || grab.target || hammer;
  spawnLightningBolts(8 + Math.floor(Math.random() * 5));
  if (kindOf(originObj) === "caduceus" || originObj === caduceus) {
    spawnCadEnergy(7);
    grab.cadPulse = 1;
  } else {
    // Playful brawl often involves both — splash a little life-energy too
    if (Math.random() < 0.45) spawnCadEnergy(4);
  }
  burstSparks();
  stormLight.intensity = 8;
  bloom.strength = 1.4;
  flashEl?.classList.add("active");
  setTimeout(() => flashEl?.classList.remove("active"), 80);
  if (!grab.active && originObj) {
    originObj.rotation.z += (Math.random() - 0.5) * 0.25;
    originObj.rotation.x += (Math.random() - 0.5) * 0.12;
  }
}

// ---------- Playful relic-on-relic brawl (auto every so often) ----------
const duel = {
  active: false,
  t: 0,
  duration: 1.0,
  attacker: "hammer", // "hammer" | "caduceus"
  hit: false,
  // Much rarer playful bonks
  cooldown: 55 + Math.random() * 40,
};
const duelBump = {
  hammer: new THREE.Vector3(),
  caduceus: new THREE.Vector3(),
};

function startPlayfulDuel(forcedAttacker) {
  if (grab.active || duel.active) return false;
  duel.active = true;
  duel.t = 0;
  duel.hit = false;
  duel.attacker =
    forcedAttacker === "caduceus" || forcedAttacker === "hammer"
      ? forcedAttacker
      : Math.random() < 0.5
        ? "hammer"
        : "caduceus";
  duelBump.hammer.set(0, 0, 0);
  duelBump.caduceus.set(0, 0, 0);
  const aiKind = duel.attacker === "caduceus" ? "caduceus" : "mjolnir";
  try {
    window.ArtifactAI?.battleQuip?.(aiKind);
  } catch (_) {}
  if (grabHint) {
    grabHint.textContent =
      duel.attacker === "caduceus"
        ? "Caduceus pokes Mjolnir (playfully!)"
        : "Mjolnir bonks Caduceus (playfully!)";
  }
  return true;
}

function updatePlayfulDuel(dt) {
  if (!duel.active) {
    if (grab.active) return;
    duel.cooldown -= dt;
    if (duel.cooldown <= 0) {
      startPlayfulDuel();
      duel.cooldown = 50 + Math.random() * 45; // every ~50–95s
    }
    return;
  }

  duel.t += dt;
  const u = Math.min(1, duel.t / duel.duration);
  // Ease: lunge in, impact, bounce back
  const lunge = u < 0.42 ? u / 0.42 : u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);
  const amp = 1.05 * Math.sin(Math.min(1, lunge) * Math.PI * 0.5);

  const mid = new THREE.Vector3()
    .addVectors(homePos.hammer, homePos.caduceus)
    .multiplyScalar(0.5);
  mid.y += 0.55;

  if (duel.attacker === "hammer") {
    const dir = mid.clone().sub(homePos.hammer);
    duelBump.hammer.copy(dir).multiplyScalar(amp * 0.92);
    duelBump.caduceus.set(-amp * 0.18, amp * 0.12, (Math.random() - 0.5) * 0.02);
  } else {
    const dir = mid.clone().sub(homePos.caduceus);
    duelBump.caduceus.copy(dir).multiplyScalar(amp * 0.92);
    duelBump.hammer.set(amp * 0.18, amp * 0.12, (Math.random() - 0.5) * 0.02);
  }

  // Impact flash + spin
  if (!duel.hit && u >= 0.42) {
    duel.hit = true;
    const atkObj = duel.attacker === "caduceus" ? caduceus : hammer;
    const defObj = duel.attacker === "caduceus" ? hammer : caduceus;
    strike(atkObj);
    defObj.rotation.z += duel.attacker === "hammer" ? 0.55 : -0.45;
    defObj.rotation.x += 0.2;
    atkObj.rotation.z += duel.attacker === "hammer" ? -0.35 : 0.3;
  }

  if (u >= 1) {
    duel.active = false;
    duelBump.hammer.set(0, 0, 0);
    duelBump.caduceus.set(0, 0, 0);
  }
}

// Chat bubbles sit above the matching 3D speaker (Mjolnir / Caduceus)
const _labelProj = new THREE.Vector3();
const elBoxMj = document.getElementById("box-mjolnir");
const elBoxCad = document.getElementById("box-caduceus");

function placeBubble(el, object3d, headY) {
  if (!el || !wrap || !object3d) return;

  const w = wrap.clientWidth || window.innerWidth;
  const h = wrap.clientHeight || window.innerHeight;
  const isCad = el.id === "box-caduceus";

  // Minimized minds dock to corners — clear of the 3D relics mid-stage
  if (el.classList.contains("collapsed") || el.classList.contains("docked")) {
    const padX = isMobile() ? 10 : 14;
    const padY = isMobile() ? 118 : 100; // above Talk / sheet
    if (isCad) {
      el.style.left = `${w - padX}px`;
      el.style.top = `${h - padY}px`;
      el.style.transform = "translate(-100%, -100%)";
    } else {
      el.style.left = `${padX}px`;
      el.style.top = `${h - padY}px`;
      el.style.transform = "translate(0, -100%)";
    }
    el.style.visibility = el.classList.contains("show") ? "visible" : "hidden";
    return;
  }

  // Expanded: sit above the 3D speaker head
  el.style.transform = "translate(-50%, -100%)";
  object3d.getWorldPosition(_labelProj);
  _labelProj.y += headY;
  _labelProj.project(camera);

  // Behind camera / clipped
  if (_labelProj.z > 1 || _labelProj.z < -1) {
    el.style.visibility = "hidden";
    return;
  }

  let x = (_labelProj.x * 0.5 + 0.5) * w;
  let y = (-_labelProj.y * 0.5 + 0.5) * h;

  const halfW = isMobile() ? 105 : 145;
  const padTop = isMobile() ? 52 : 60;
  const padBot = isMobile() ? 130 : 110;
  x = Math.min(w - halfW, Math.max(halfW, x));
  y = Math.min(h - padBot, Math.max(padTop, y));

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.visibility = el.classList.contains("show") ? "visible" : "hidden";
}

function updateDialogueAnchors() {
  // Head height above each relic's base
  placeBubble(elBoxMj, hammer, 2.35);
  placeBubble(elBoxCad, caduceus, 2.5);
}

function onPointerDown(event) {
  if (isUiTarget(event)) return;
  if (event.button !== undefined && event.button !== 0) return;

  const picked = pickGrabbable(event);
  if (picked) {
    grab.active = true;
    grab.target = picked;
    grab.kind = kindOf(picked);
    controls.enabled = false;
    controls.autoRotate = false;
    setCursor("grabbing");
    hand.visible = true;
    if (grabHint) {
      grabHint.textContent =
        grab.kind === "caduceus"
          ? "Caduceus grabbed! Fluid snakes · drag & toss"
          : "Mjolnir grabbed! Drag around · release to toss";
    }

    projectOntoDragPlane(event, grab.hit, picked.position);
    grab.offset.copy(picked.position).sub(grab.hit);
    grab.last.copy(picked.position);
    grab.vel.set(0, 0, 0);
    picked.position.y += 0.2;
    strike(picked);
    // Wake the mind on grab — free minds / native / cached (partner often answers)
    try {
      const pid = grab.kind === "caduceus" ? "caduceus" : "mjolnir";
      window.ArtifactAI?.onRelicInteract?.(pid, "grab");
    } catch (_) {}
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch (_) {}
    event.preventDefault();
  }
}

function onPointerMove(event) {
  if (isUiTarget(event) && !grab.active) {
    setCursor("default");
    return;
  }

  if (grab.active && grab.target) {
    if (projectOntoDragPlane(event, grab.hit, grab.target.position)) {
      const next = grab.hit.clone().add(grab.offset);
      next.x = THREE.MathUtils.clamp(next.x, -4.5, 4.5);
      next.y = THREE.MathUtils.clamp(next.y, 0.2, 4.5);
      next.z = THREE.MathUtils.clamp(next.z, -4, 4);
      grab.vel.copy(next).sub(grab.target.position);
      grab.target.position.copy(next);
      grab.target.rotation.z = THREE.MathUtils.clamp(-grab.vel.x * 1.8, -0.6, 0.6);
      grab.target.rotation.x = THREE.MathUtils.clamp(grab.vel.z * 1.2, -0.5, 0.5);
      grab.spin.set(-grab.vel.z * 2, grab.vel.x * 2, 0);
    }
    updateHandPose(grab.target);
    setCursor("grabbing");
    return;
  }

  const over = pickGrabbable(event);
  grab.hovering = !!over;
  setCursor(over ? "grab" : "default");
  if (grabHint) {
    if (over === caduceus) grabHint.textContent = "Grab the Caduceus — DNA snakes flow";
    else if (over === hammer) grabHint.textContent = "Grab Mjolnir! (click & drag)";
    else grabHint.textContent = "Grab Mjolnir or Caduceus · open menu for pay links";
  }
}

function onPointerUp(event) {
  if (!grab.active) return;
  const was = grab.target;
  lastTossed = was;
  grab.active = false;
  controls.enabled = true;
  hand.visible = false;
  setCursor("default");
  if (grabHint) {
    grabHint.textContent =
      grab.kind === "caduceus"
        ? "Caduceus returns… snakes keep flowing"
        : "Mjolnir floats home… grab either relic anytime";
  }

  grab.vel.multiplyScalar(14);
  grab.spin.y += grab.vel.x * 0.5;
  const tossedHard = grab.vel.length() > 1.5;
  if (tossedHard) strike(was);
  // Only mind-react on a real toss — soft release just floats home quiet
  if (tossedHard) {
    try {
      const pid = grab.kind === "caduceus" ? "caduceus" : "mjolnir";
      window.ArtifactAI?.onRelicInteract?.(pid, "toss");
    } catch (_) {}
  }

  grab.target = null;
  try {
    renderer.domElement.releasePointerCapture(event.pointerId);
  } catch (_) {}
}

renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerup", onPointerUp);
renderer.domElement.addEventListener("pointercancel", onPointerUp);
renderer.domElement.addEventListener("pointerleave", () => {
  if (!grab.active) setCursor("default");
});

const toggleRotate = document.getElementById("toggle-rotate");
const toggleAura = document.getElementById("toggle-aura");
const spinSpeed = document.getElementById("spin-speed");
const btnStrike = document.getElementById("btn-strike");
const btnReset = document.getElementById("btn-reset");

function wireToggle(el, onChange) {
  if (!el) return;
  const flip = () => {
    el.classList.toggle("on");
    const on = el.classList.contains("on");
    el.setAttribute("aria-checked", on ? "true" : "false");
    onChange(on);
  };
  el.addEventListener("click", flip);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  });
}

wireToggle(toggleRotate, (on) => {
  controls.autoRotate = on;
});
wireToggle(toggleAura, (on) => {
  auraEnabled = on;
  if (!on) clearGroup(auraGroup);
});

spinSpeed?.addEventListener("input", () => {
  controls.autoRotateSpeed = (Number(spinSpeed.value) / 100) * 3.2;
});

btnStrike?.addEventListener("click", () => {
  // Manual strike also does a playful mutual bonk when not holding
  if (!grab.active) startPlayfulDuel();
  else strike(grab.target);
});
btnReset?.addEventListener("click", () => {
  fitCameraDefault();
  hammer.position.copy(homePos.hammer);
  hammer.rotation.set(0, 0, 0);
  caduceus.position.copy(homePos.caduceus);
  caduceus.rotation.set(0, 0, 0);
  grab.vel.set(0, 0, 0);
  grab.spin.set(0, 0, 0);
  grab.active = false;
  grab.target = null;
  duel.active = false;
  duelBump.hammer.set(0, 0, 0);
  duelBump.caduceus.set(0, 0, 0);
  hand.visible = false;
  controls.enabled = true;
  setCursor("default");
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.closest?.("input, textarea, a, button")) {
    e.preventDefault();
    if (!grab.active) startPlayfulDuel();
    else strike(grab.target);
  }
});

function resize() {
  const { w, h } = stageSize();
  camera.aspect = w / h;
  camera.fov = isMobile() ? 28 : 34;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  controls.enablePan = !isMobile();
  // Keep look target centered between both relics
  controls.target.set(0, 1.05, 0);
}

window.addEventListener("resize", resize);
if (typeof ResizeObserver !== "undefined" && wrap) {
  new ResizeObserver(resize).observe(wrap);
}
resize();
fitCameraDefault();

const clock = new THREE.Clock();
let auraTimer = 0;
let snakeTimer = 0;
/** Pause WebGL when Luna Camp (or other external scene) fills the screen */
let sceneActive = true;

window.addEventListener("telephantim-scene", (e) => {
  const d = e.detail || {};
  sceneActive = d.active !== false && d.scene === "telephantim";
  if (stageBgVideo) {
    if (sceneActive) stageBgVideo.play().catch(() => {});
    else stageBgVideo.pause();
  }
  if (sceneActive) {
    try {
      clock.getDelta(); // reset dt spike after pause
    } catch (_) {}
  }
});

function animate() {
  requestAnimationFrame(animate);
  if (!sceneActive) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  controls.update();

  // Fluid DNA snakes ~20fps rebuild for organic motion without killing perf
  snakeTimer += dt;
  if (snakeTimer > 0.05) {
    snakeTimer = 0;
    refreshSnakeMeshes(t);
  }
  dnaRungs.rotation.y = Math.sin(t * 0.6) * 0.08;
  snakeMatA.emissiveIntensity = 0.45 + 0.25 * Math.sin(t * 3) + grab.cadPulse * 0.8;
  snakeMatB.emissiveIntensity = 0.45 + 0.25 * Math.cos(t * 3.2) + grab.cadPulse * 0.8;
  grab.cadPulse = Math.max(0, grab.cadPulse - dt * 1.4);

  const held = grab.active ? grab.target : null;

  updatePlayfulDuel(dt);

  for (const obj of grabbables) {
    const kind = kindOf(obj);
    const home = (kind === "caduceus" ? homePos.caduceus : homePos.hammer).clone();
    home.y += Math.sin(t * 1.2 + (kind === "caduceus" ? 1.1 : 0)) * 0.06;
    // Playful brawl offset
    const bump = kind === "caduceus" ? duelBump.caduceus : duelBump.hammer;
    home.add(bump);

    if (held === obj) {
      obj.rotation.y += dt * 0.2;
      updateHandPose(obj);
      continue;
    }

    // Fling only for last tossed
    if (!grab.active && lastTossed === obj && grab.vel.lengthSq() > 0.00001) {
      grab.vel.multiplyScalar(Math.pow(0.92, dt * 60));
      grab.spin.multiplyScalar(Math.pow(0.94, dt * 60));
      obj.position.addScaledVector(grab.vel, dt);
      obj.rotation.x += grab.spin.x * dt;
      obj.rotation.y += grab.spin.y * dt;
      obj.rotation.z += grab.spin.z * dt;
    }

    // Spring home (or duel pose)
    const lerpRate = duel.active ? 1 - Math.pow(0.82, dt * 60) : 1 - Math.pow(0.9, dt * 60);
    obj.position.lerp(home, lerpRate);
    obj.rotation.x *= Math.pow(0.92, dt * 60);
    obj.rotation.z *= Math.pow(0.92, dt * 60);
    if (!grab.hovering && !duel.active) {
      obj.rotation.y += dt * (kind === "caduceus" ? 0.45 : 0.32);
    }
  }

  updateDialogueAnchors();

  auraTimer += dt;
  if (auraEnabled && auraTimer > 0.12) {
    auraTimer = 0;
    refreshAura();
  }
  const auraFollow = held || hammer;
  auraGroup.position.copy(auraFollow.position);
  cadEnergy.position.copy(caduceus.position);

  if (strikeTime > 0) {
    strikeTime = Math.max(0, strikeTime - dt * 1.6);
    stormLight.intensity = strikeTime * 8;
    bloom.strength = 0.55 + strikeTime * 0.9;
    lightningGroup.traverse((obj) => {
      if (obj.material?.opacity !== undefined) {
        obj.material.opacity = Math.max(0, strikeTime * 0.85);
      }
    });
    cadEnergy.traverse((obj) => {
      if (obj.material?.opacity !== undefined) {
        obj.material.opacity = Math.max(0, strikeTime * 0.85);
      }
    });
    if (strikeTime === 0) {
      clearGroup(lightningGroup);
      while (cadEnergy.children.length) {
        const c = cadEnergy.children.pop();
        c.geometry?.dispose();
        c.material?.dispose();
      }
      stormLight.intensity = 0;
      bloom.strength = 0.55;
    }
  }

  metalGold.emissiveIntensity =
    0.15 + strikeTime * 1.2 + (grab.active && grab.kind === "hammer" ? 0.4 : 0);
  staffGold.emissiveIntensity =
    0.12 + strikeTime * 1.0 + (grab.active && grab.kind === "caduceus" ? 0.5 : 0);
  updateSparks(dt);
  const fxAt = held || lastTossed || hammer;
  lightningGroup.position.copy(fxAt.position);
  stormLight.position.copy(fxAt.position);
  stormLight.position.y += 1.2;
  composer.render();
}

// Soft opening spark only — rare bonks later
setTimeout(() => strike(hammer), 700);
animate();
