/* ---------- взрывы и огонь: искры, подпалины, глыбы, стёкла ----------
   Всё — пулы фиксированного размера: искры — один LineSegments (штрих вдоль скорости), подпалины — один InstancedMesh,
   глыбы и осколки — пулы обломков (render4.js). Свободные элементы не рисуются, новых материалов на лету нет */
const SPARK_MAX = 1400, spS = new Float32Array(SPARK_MAX * 9); // x,y,z, vx,vy,vz, жизнь, макс. жизнь, высота земли
const spPos = new Float32Array(SPARK_MAX * 6), spCol = new Float32Array(SPARK_MAX * 6), spGeo = new THREE.BufferGeometry();
spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3).setUsage(THREE.DynamicDrawUsage));
spGeo.setAttribute("color", new THREE.BufferAttribute(spCol, 3).setUsage(THREE.DynamicDrawUsage));
const sparkLines = new THREE.LineSegments(spGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
sparkLines.frustumCulled = false; sparkLines.renderOrder = 7; scene.add(sparkLines);
let spN = 0;
// на слабой графике искр меньше: доля от настройки частиц и качества
const fxLoK = () => fxK * (prefs.quality === "low" ? .6 : 1);
function spark(x, y, z, vx, vy, vz, l, gy) {
  const i = spN < SPARK_MAX ? spN++ : Math.floor(Math.random() * SPARK_MAX), o = i * 9;
  spS[o] = x; spS[o + 1] = y; spS[o + 2] = z; spS[o + 3] = vx; spS[o + 4] = vy; spS[o + 5] = vz; spS[o + 6] = l; spS[o + 7] = l; spS[o + 8] = gy;
}
// веер искр: летят по дугам, отскакивают от земли и гаснут от бело-жёлтого к красному
function sparkBurst(x, y, z, n, speed, up, life, gy) {
  n = Math.round(n * fxLoK());
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), u = rnd(.05, 1) ** .7 * up, h = Math.sqrt(Math.max(0, 1 - u * u)), v = speed * rnd(.35, 1); spark(x, y, z, Math.cos(a) * h * v, u * v + rnd(0, 8), Math.sin(a) * h * v, life * rnd(.5, 1.2), gy); }
}
function stepSparks(dt) {
  let i = 0;
  while (i < spN) {
    const o = i * 9;
    spS[o + 6] -= dt;
    if (spS[o + 6] <= 0) { spN--; if (i < spN) spS.copyWithin(o, spN * 9, spN * 9 + 9); continue; }
    const dr = 1 - Math.min(1, dt * .7);
    spS[o + 3] *= dr; spS[o + 5] *= dr; spS[o + 4] = spS[o + 4] * dr - 38 * dt;
    spS[o] += spS[o + 3] * dt; spS[o + 1] += spS[o + 4] * dt; spS[o + 2] += spS[o + 5] * dt;
    if (spS[o + 1] < spS[o + 8] + .15 && spS[o + 4] < 0) { spS[o + 1] = spS[o + 8] + .15; spS[o + 4] *= -.3; spS[o + 3] *= .55; spS[o + 5] *= .55; spS[o + 6] *= .75; }
    // штрих: хвост тянется назад по скорости, не длиннее пяти единиц
    const vx = spS[o + 3], vy = spS[o + 4], vz = spS[o + 5], sp = Math.hypot(vx, vy, vz) || 1, len = Math.min(5, sp * .035) / sp, t = spS[o + 6] / spS[o + 7], w = i * 6;
    spPos[w] = spS[o]; spPos[w + 1] = spS[o + 1]; spPos[w + 2] = spS[o + 2]; spPos[w + 3] = spS[o] - vx * len; spPos[w + 4] = spS[o + 1] - vy * len; spPos[w + 5] = spS[o + 2] - vz * len;
    const h = t * t; spCol[w] = 1.6 * t + .4; spCol[w + 1] = (1.3 * h + .15) * t; spCol[w + 2] = .7 * h * h; spCol[w + 3] = spCol[w] * .35; spCol[w + 4] = spCol[w + 1] * .2; spCol[w + 5] = 0;
    i++;
  }
  spGeo.setDrawRange(0, spN * 2); sparkLines.visible = spN > 0;
  if (spN) { spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true; }
}

/* ---------- подпалина: чёрное пятно с рваными лучами, свежая ещё тлеет ---------- */
const SCORCH_MAX = 300;
const scorchTex = canvasTex(256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(.35, "rgba(255,255,255,.8)"); gr.addColorStop(.7, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = "rgba(255,255,255,.35)";
  for (let i = 0; i < 46; i++) { const a = rnd(0, TAU), l = rnd(60, 126), w = rnd(.04, .12); g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a - w) * l * .55, 128 + Math.sin(a - w) * l * .55); g.lineTo(128 + Math.cos(a) * l, 128 + Math.sin(a) * l); g.lineTo(128 + Math.cos(a + w) * l * .55, 128 + Math.sin(a + w) * l * .55); g.fill(); }
  for (let i = 0; i < 90; i++) { const a = rnd(0, TAU), d = rnd(70, 124); g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rnd(1, 4), 0, TAU); g.fill(); }
}, false);
const scorch = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: scorchTex, color: 0x17120e, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), SCORCH_MAX);
scorch.count = 0; scorch.receiveShadow = true; scorch.frustumCulled = false; scorch.renderOrder = 1; scene.add(scorch);
let scorchN = 0;
function addScorch(x, y, r) {
  const id = scorchN % SCORCH_MAX; scorchN++;
  _p.makeRotationY(rnd(0, TAU)); _p.scale(new THREE.Vector3(r, 1, r)); _p.setPosition(X(x), .08 + (id % 5) * .004 + (hasHills ? gY(x, y) : 0), Z(y));
  scorch.setMatrixAt(id, _p); scorch.count = Math.min(SCORCH_MAX, scorchN); scorch.instanceMatrix.needsUpdate = true;
}

/* ---------- стёкла: окна домов вокруг и стёкла машин осыпаются блестящими осколками ---------- */
function shatterGlass(x, y, R) {
  const q = fxLoK(), hit = [];
  for (const b of buildings) {
    if (b.state !== "ok") continue;
    const px = clamp(x, b.x0, b.x1), py = clamp(y, b.y0, b.y1), d = Math.hypot(px - x, py - y);
    if (d < R * 1.1) hit.push([d, b, px, py]);
  }
  hit.sort((a, b) => a[0] - b[0]);
  for (const [d, b, px, py] of hit.slice(0, 5)) {
    const k = 1 - d / (R * 1.1), n = Math.round((8 + 22 * k) * q), dx = px === x && py === y ? 0 : (x - px) / (d || 1), dy = px === x && py === y ? 0 : (y - py) / (d || 1);
    const along = Math.abs(dx) > Math.abs(dy) ? [0, 1] : [1, 0], top = Math.min(b.h, 40) + (b.baseY || 0);
    for (let i = 0; i < n; i++) {
      const s = rnd(-14, 14), sx = clamp(px + along[0] * s, b.x0, b.x1), sy = clamp(py + along[1] * s, b.y0, b.y1);
      addPiece(GLASS, X(sx + dx * .8), rnd((b.baseY || 0) + 3, top), Z(sy + dy * .8), dx * rnd(3, 12) + rnd(-3, 3), rnd(-1, 5), dy * rnd(3, 12) + rnd(-3, 3), rnd(.5, 1.3), "#d2e6ee", rnd(18, 30));
    }
  }
  let nc = 0;
  for (const c of cars) {
    if (c.gone || nc >= 8 || Math.hypot(c.x - x, c.y - y) > R * .9) continue; nc++;
    for (let i = 0; i < 4 * q; i++) addPiece(GLASS, X(c.x) + rnd(-3, 3), gY(c.x, c.y) + (c.z || 0) + 4.5, Z(c.y) + rnd(-3, 3), rnd(-8, 8), rnd(2, 8), rnd(-8, 8), rnd(.35, .8), "#c8dde6", rnd(15, 25));
  }
}

/* ---------- взрыв: всё, что дополняет огненный шар и дым (fxBoom в render3.js) ---------- */
function fxBoomMore(x, y, cx, gy, cz, R, k, P) {
  // искры: у больших — дальше и дольше
  sparkBurst(cx, gy + 2 + R * .05, cz, P.sp * Math.sqrt(k), 45 + R * .9, 1, .9 + k * .4, gy);
  // глыбы земли, асфальта, железа летят высоко, падают и остаются лежать
  const nc = Math.round(P.ch * k * fxLoK());
  for (let i = 0; i < nc; i++) { const a = rnd(0, TAU), v = rnd(8, 34) * Math.sqrt(k), s = rnd(.5, 1.8) * Math.min(1.6, Math.sqrt(k)); addPiece(ROCKS, cx + Math.cos(a) * rnd(0, R * .15), gy + rnd(1, 4), cz + Math.sin(a) * rnd(0, R * .15), Math.cos(a) * v, rnd(18, 55) * Math.sqrt(k), Math.sin(a) * v, s, pick(DIRT)); }
  // свежая подпалина и угли на ней
  addScorch(x, y, R * (P.dark ? .55 : .62));
  for (let i = 0; i < 18 * k * P.fb; i++) { const a = rnd(0, TAU), r = rnd(0, R * .35); emit(PS_ADD, { x: cx + Math.cos(a) * r, y: gy + .4, z: cz + Math.sin(a) * r, vx: 0, vy: rnd(0, .6), vz: 0, l: rnd(2.5, 7), s0: rnd(1, 2.4), s1: .4, c: EMB, c1: EMB2, a: .9, fp: .6 }); }
  shatterGlass(x, y, R);
}

/* ---------- угли у огня, тлеющее после пожара ---------- */
function fxCoals(x, y, z, r, n) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), d = rnd(0, r); emit(PS_ADD, { x: x + Math.cos(a) * d, y: y + .3, z: z + Math.sin(a) * d, vx: 0, vy: .2, vz: 0, l: rnd(1, 2.5), s0: rnd(1, 2), s1: .5, c: EMB, c1: EMB2, a: .8, fp: .5 }); } }

function stepFx(dt) { stepParticles(PS_FLAME, dt); if (dt) stepSparks(dt); }
function fxReset() {
  PS_FLAME.list.length = 0; spN = 0; spGeo.setDrawRange(0, 0); scorch.count = 0; scorchN = 0;
  for (const s of shocks) s.m.visible = false;
}
