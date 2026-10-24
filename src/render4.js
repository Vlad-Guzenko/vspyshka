/* ---------- обломки: летят, кувыркаются, остаются лежать ---------- */
const DEB_MAX = 5000;
const debMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .9 }), DEB_MAX);
debMesh.count = 0; debMesh.castShadow = true; debMesh.receiveShadow = true; debMesh.frustumCulled = false; debMesh.setColorAt(0, new THREE.Color());
scene.add(debMesh);
let debris = [], debN = 0, debDirty = false;
const _dq = new THREE.Quaternion(), _de = new THREE.Euler(), _dm = new THREE.Matrix4(), _dv = new THREE.Vector3(), _ds = new THREE.Vector3();
function addChunk(x, y, z, vx, vy, vz, size, col, life = 1e9) {
  const id = debN % DEB_MAX; debN++;
  debris[id] = { x, y, z, vx, vy, vz, rx: rnd(0, 6), ry: rnd(0, 6), wr: rnd(-8, 8), sx: size * rnd(.6, 1.4), sy: size * rnd(.4, 1), sz: size * rnd(.6, 1.3), rest: false, life };
  debMesh.setColorAt(id, _cc.set(col).multiplyScalar(rnd(.75, 1.15)));
  debMesh.count = Math.min(DEB_MAX, debN); debDirty = true;
}
function stepDebris(dt) {
  if (!dt) return;
  for (let i = 0; i < debMesh.count; i++) {
    const d = debris[i]; if (!d || (d.rest && !debDirty)) continue;
    if (!d.rest) {
      d.vy -= 39 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wr * dt; d.ry += d.wr * .7 * dt;
      const floor = d.sy / 2;
      if (d.y < floor) { d.y = floor; if (Math.abs(d.vy) > 6) { d.vy *= -.3; d.vx *= .6; d.vz *= .6; d.wr *= .5; } else { d.vy = 0; d.vx *= .8; d.vz *= .8; if (Math.hypot(d.vx, d.vz) < 1) d.rest = true; } }
    }
    _de.set(d.rx, d.ry, 0); _dq.setFromEuler(_de);
    _dm.compose(_dv.set(d.x, d.y, d.z), _dq, _ds.set(d.sx, d.sy, d.sz)); debMesh.setMatrixAt(i, _dm);
  }
  debMesh.instanceMatrix.needsUpdate = true;
  if (debDirty && debMesh.instanceColor) { debMesh.instanceColor.needsUpdate = true; debDirty = false; }
}
function clearDebris() { debris = []; debN = 0; debMesh.count = 0; }
// экскаватор убрал клетку завала: лежащие на ней обломки убираем
// площадка вывезена: ни одного обломка вокруг, гребень упавшей башни и остов убраны
function onSiteCleared(b) {
  const [x0, y0, x1, y1] = rubbleBounds(null, b), wx0 = X(x0 - 24), wx1 = X(x1 + 24), wz0 = Z(y0 - 24), wz1 = Z(y1 + 24);
  for (let i = 0; i < debMesh.count; i++) { const d = debris[i]; if (!d || d.sx === 0) continue; if (d.x >= wx0 && d.x <= wx1 && d.z >= wz0 && d.z <= wz1) { d.sx = d.sy = d.sz = 0; d.y = -50; d.rest = true; debDirty = true; } }
  if (b.mound) { cityGroup.remove(b.mound); b.mound = null; }
  if (b.obj && b.state === "ruin") b.obj.visible = false;
}
function onRubbleCleared(x, y) {
  const wx = X(Math.floor(x / CS) * CS + CS / 2), wz = Z(Math.floor(y / CS) * CS + CS / 2);
  for (let i = 0; i < debMesh.count; i++) { const d = debris[i]; if (!d || !d.rest || d.sx === 0) continue; if (Math.abs(d.x - wx) <= CS * .75 && Math.abs(d.z - wz) <= CS * .75) { d.sx = d.sy = d.sz = 0; d.y = -50; debDirty = true; } }
}

/* ---------- обрушение: пыль, обломки, завал ---------- */
function facadeColor(b) { const st = STYLES[b.style] || STYLES[0]; return st.wall; }
function fxCollapse(b) {
  const cx = X((b.x0 + b.x1) / 2), cz = Z((b.y0 + b.y1) / 2), w = b.x1 - b.x0, d = b.y1 - b.y0, k = clamp(b.h / 120, .4, 2), by = b.baseY || 0;
  if (b.kind === "tower") slowMo(2.2);
  shake = Math.max(shake, 5 * k * clamp(1.4 - camDist() / 1600, .2, 1));
  const wall = facadeColor(b);
  // плотная волна пыли расходится от основания
  for (let i = 0; i < 260 * k; i++) {
    const a = rnd(0, TAU), r = rnd(0, Math.max(w, d) * .6);
    emit(PS_SMOKE, { x: cx + Math.cos(a) * r, y: by + rnd(2, b.h * .5), z: cz + Math.sin(a) * r, vx: Math.cos(a) * rnd(10, 45), vy: rnd(2, 14), vz: Math.sin(a) * rnd(10, 45), l: rnd(6, 14), s0: rnd(14, 22) * k, s1: rnd(50, 90) * k, c: [.42, .39, .34], c1: [.5, .48, .44], a: .6, fadeIn: true, dr: .6 });
  }
  // обломки стен и бетона
  for (let i = 0; i < 160 * k; i++) {
    const side = Math.floor(rnd(0, 4)), px = side < 2 ? rnd(-w / 2, w / 2) : (side === 2 ? -w / 2 : w / 2), pz = side >= 2 ? rnd(-d / 2, d / 2) : (side === 0 ? -d / 2 : d / 2);
    addChunk(cx + px, by + rnd(2, b.h * .9), cz + pz, px * rnd(.3, 1.2) + rnd(-10, 10), rnd(-5, 18), pz * rnd(.3, 1.2) + rnd(-10, 10), rnd(1.5, 5), Math.random() < .5 ? wall : pick(["#8f8c85", "#6e6b66", "#a19d94"]));
  }
  fxCollapseSlabs(b);
  // постоянный завал на месте дома
  const n = Math.min(400, w * d / 30);
  for (let i = 0; i < n; i++) {
    const px = rnd(-w / 2 - 6, w / 2 + 6), pz = rnd(-d / 2 - 6, d / 2 + 6), edge = Math.max(Math.abs(px) / (w / 2 + 6), Math.abs(pz) / (d / 2 + 6));
    const s = rnd(2, 7) * (1.2 - edge);
    debris[debN % DEB_MAX] = null;
    addChunk(cx + px, by + s / 2 + rnd(0, b.ruinH * .3 * (1 - edge)), cz + pz, 0, 0, 0, s, Math.random() < .4 ? wall : pick(["#7d7a73", "#5f5c57", "#8d8a83", "#4b4845"]));
    debris[(debN - 1) % DEB_MAX].rest = true; debDirty = true;
  }
  flashLight(cx, 20, cz, 1.5, .4, 0xffd0a0);
}
function fxCannon(t, hx, hy) {
  const tx = X(t.x), tz = Z(t.y), ca = Math.cos(t.turret), sa = Math.sin(t.turret), mx = tx + ca * 22, mz = tz + sa * 22;
  emit(PS_ADD, { x: mx, y: 8.5, z: mz, vx: 0, vy: 0, vz: 0, l: .09, s0: 18, s1: 6, c: [2, 1.6, .8], a: 1 });
  for (let i = 0; i < 14; i++) emit(PS_SMOKE, { x: mx, y: 8.5, z: mz, vx: ca * rnd(10, 40) + rnd(-6, 6), vy: rnd(1, 6), vz: sa * rnd(10, 40) + rnd(-6, 6), l: rnd(1.5, 3), s0: 4, s1: 18, c: [.5, .48, .45], a: .5, dr: 1.2 });
  flashLight(mx, 10, mz, 2.5, .12, 0xffd080);
  trList.push({ a: [mx, 8.5, mz], b: [X(hx), 3, Z(hy)], l: .07 });
  shake = Math.max(shake, 2 * clamp(1.4 - camDist() / 900, 0, 1));
}

/* ---------- танки ---------- */
const tankMat = new THREE.MeshStandardMaterial({ color: 0x4f5636, roughness: .7, metalness: .35 }), trackMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1b, roughness: .9 });
function buildTank() {
  const g = new THREE.Group(), add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  add(new THREE.BoxGeometry(26, 4.5, 13), tankMat, 0, 4.2, 0);
  add(new THREE.BoxGeometry(6, 3, 12), tankMat, 11, 3, 0).rotation.z = .5;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(27, 4, 3.4), trackMat, 0, 2, s * 6.4);
  const turret = new THREE.Group(); turret.position.set(-1, 6.5, 0); g.add(turret);
  add(new THREE.CylinderGeometry(5.5, 6.5, 3.4, 10), tankMat, 0, 1.6, 0, turret);
  const barrel = add(new THREE.CylinderGeometry(.6, .7, 18, 8).rotateZ(Math.PI / 2), tankMat, 13, 1.8, 0, turret);
  add(new THREE.BoxGeometry(2, 1.2, 2), trackMat, -2, 3.8, 2.5, turret);
  g.userData = { turret, barrel };
  return g;
}
const tankObjs = new Map();
function updateTanks() {
  for (const t of tanks) {
    let o = tankObjs.get(t);
    if (!o) { o = buildTank(); scene.add(o); tankObjs.set(t, o); }
    o.position.set(X(t.x), hasHills ? gY(t.x, t.y) : 0, Z(t.y)); o.rotation.y = -t.ang;
    o.userData.turret.rotation.y = -(t.turret - t.ang);
    o.userData.barrel.position.x = 13 - t.recoil * 2.5;
    t.muzzle = [X(t.x) + Math.cos(t.turret) * 6, 9.5, Z(t.y) + Math.sin(t.turret) * 6];
    if (t.hp <= 0 && !o.userData.dead) { o.userData.dead = true; o.traverse(m => { if (m.material) { m.material = m.material.clone(); m.material.color.set("#1d1a17"); } }); }
    if (t.hp <= 0 && Math.random() < .3) smokeParticle(X(t.x), 8, Z(t.y), 1);
  }
  for (const [t, o] of tankObjs) if (!tanks.includes(t)) { scene.remove(o); tankObjs.delete(t); }
}

/* ---------- тени следуют за камерой: чётче вблизи ---------- */
const sunDir = new THREE.Vector3(-.5, .75, -.33).normalize();
function updateSun() {
  const ext = clamp(camC.dist * .95, 240, 1500);
  sun.target.position.set(camC.tx, 0, camC.tz);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 1800);
  const c = sun.shadow.camera;
  if (Math.abs(c.right - ext) > 1) { c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 100; c.far = 4000; c.updateProjectionMatrix(); }
  sun.target.updateMatrixWorld();
}
