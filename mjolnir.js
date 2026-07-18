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
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x05070c, 0.028);

const { w: sw0, h: sh0 } = stageSize();
const camera = new THREE.PerspectiveCamera(isMobile() ? 36 : 42, sw0 / sh0, 0.1, 100);
// Pulled back so full hammer is on screen on phones
camera.position.set(isMobile() ? 0.1 : 3.0, isMobile() ? 1.2 : 1.85, isMobile() ? 7.0 : 5.2);

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
controls.minDistance = 2.4;
controls.maxDistance = 14;
controls.target.set(0, 0.95, 0);
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

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 0.7, roughness: 0.45 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.35, 1.55, 64),
  new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.01;
scene.add(ring);

const runeGroup = new THREE.Group();
const runeMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.35 });
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const rune = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.22), runeMat);
  rune.position.set(Math.cos(a) * 1.9, 0.02, Math.sin(a) * 1.9);
  rune.rotation.y = -a;
  runeGroup.add(rune);
}
scene.add(runeGroup);

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

scene.add(hammer);

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
  camera.position.set(mobile ? 0.1 : 3.0, mobile ? 1.2 : 1.85, mobile ? 7.0 : 5.2);
  controls.target.set(0, 0.95, 0);
  controls.update();
}

let strikeTime = 0;

function strike() {
  strikeTime = 1.0;
  spawnLightningBolts(8 + Math.floor(Math.random() * 5));
  burstSparks();
  stormLight.intensity = 8;
  bloom.strength = 1.4;
  flashEl?.classList.add("active");
  setTimeout(() => flashEl?.classList.remove("active"), 80);
  hammer.rotation.z += (Math.random() - 0.5) * 0.25;
  hammer.rotation.x += (Math.random() - 0.5) * 0.12;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerDown(event) {
  if (event.target.closest?.(".panel, header, button, .toggle, input, .btn-luna, .btn-mini, .content, a")) return;
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(hammer, true).length) strike();
}

renderer.domElement.addEventListener("pointerdown", onPointerDown);

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

btnStrike?.addEventListener("click", strike);
btnReset?.addEventListener("click", () => {
  fitCameraDefault();
  hammer.rotation.set(0, 0, 0);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.closest?.("input, textarea, a, button")) {
    e.preventDefault();
    strike();
  }
});

function resize() {
  const { w, h } = stageSize();
  camera.aspect = w / h;
  camera.fov = isMobile() ? 36 : 42;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  controls.enablePan = !isMobile();
  // Slightly higher target so hammer sits above bottom sheet peek
  if (isMobile()) controls.target.set(0, 1.05, 0);
}

window.addEventListener("resize", resize);
if (typeof ResizeObserver !== "undefined" && wrap) {
  new ResizeObserver(resize).observe(wrap);
}
resize();
fitCameraDefault();

const clock = new THREE.Clock();
let auraTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  controls.update();
  hammer.position.y = 0.05 + Math.sin(t * 1.2) * 0.06;
  hammer.rotation.y += dt * 0.05;
  hammer.rotation.z = Math.sin(t * 0.7) * 0.03;

  runeGroup.rotation.y = t * 0.25;
  runeMat.opacity = 0.2 + Math.sin(t * 2) * 0.12;
  ring.material.opacity = 0.15 + Math.sin(t * 1.5) * 0.08;

  auraTimer += dt;
  if (auraEnabled && auraTimer > 0.12) {
    auraTimer = 0;
    refreshAura();
  }
  auraGroup.position.copy(hammer.position);

  if (strikeTime > 0) {
    strikeTime = Math.max(0, strikeTime - dt * 1.6);
    stormLight.intensity = strikeTime * 8;
    bloom.strength = 0.55 + strikeTime * 0.9;
    lightningGroup.traverse((obj) => {
      if (obj.material?.opacity !== undefined) {
        obj.material.opacity = Math.max(0, strikeTime * 0.85);
      }
    });
    if (strikeTime === 0) {
      clearGroup(lightningGroup);
      stormLight.intensity = 0;
      bloom.strength = 0.55;
    }
  }

  metalGold.emissiveIntensity = 0.15 + strikeTime * 1.2;
  updateSparks(dt);
  lightningGroup.position.copy(hammer.position);
  composer.render();
}

setTimeout(strike, 600);
animate();
