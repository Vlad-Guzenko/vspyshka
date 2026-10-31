/* ---------- обломки: летят, кувыркаются, отскакивают от земли, машин и стен, остаются лежать ----------
   Три пула фиксированного размера, каждый — один InstancedMesh: блоки и плиты стен (лежат плашмя), неровные глыбы бетона, земли
   и асфальта от взрывов, осколки стекла (блестят и через полминуты исчезают). Лежащие не пересчитываются */
const DEB_MAX = 5000, ROCK_MAX = 2500, GLASS_MAX = 1500;
const debMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .9 }), DEB_MAX);
debMesh.count = 0; debMesh.castShadow = true; debMesh.receiveShadow = true; debMesh.frustumCulled = false; debMesh.setColorAt(0, new THREE.Color());
scene.add(debMesh);
let debris = [], debN = 0, debDirty = false;
function chunkPool(geo, mat, max, shadow) {
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.count = 0; mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.setColorAt(0, new THREE.Color()); scene.add(mesh);
  return { mesh, list: [], n: 0, dirty: false, max };
}
// глыба: икосаэдр с гранями, сплюснутый по-разному — то камень, то кусок плиты
const ROCKS = chunkPool(new THREE.IcosahedronGeometry(.62, 0), new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true }), ROCK_MAX, true);
const _shardG = new THREE.BufferGeometry(); _shardG.setAttribute("position", new THREE.Float32BufferAttribute([-.5, 0, -.4, .55, 0, -.2, -.1, 0, .6], 3)); _shardG.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
const GLASS = chunkPool(_shardG, new THREE.MeshStandardMaterial({ color: 0xd2e6ee, metalness: .9, roughness: .06, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }), GLASS_MAX, false);
const _dq = new THREE.Quaternion(), _de = new THREE.Euler(), _dm = new THREE.Matrix4(), _dv = new THREE.Vector3(), _ds = new THREE.Vector3();
function addChunk(x, y, z, vx, vy, vz, size, col, life = 1e9) {
  const id = debN % DEB_MAX; debN++;
  debris[id] = { x, y, z, vx, vy, vz, rx: rnd(0, 6), ry: rnd(0, 6), rz: 0, wr: rnd(-8, 8), sx: size * rnd(.6, 1.4), sy: size * rnd(.4, 1), sz: size * rnd(.6, 1.3), rest: false, life, flat: true, e: .32 };
  debMesh.setColorAt(id, _cc.set(col).multiplyScalar(rnd(.75, 1.15)));
  debMesh.count = Math.min(DEB_MAX, debN); debDirty = true;
}
// глыба (shape "rock") или осколок стекла ("glass")
function addPiece(P, x, y, z, vx, vy, vz, size, col, life = 1e9) {
  const id = P.n % P.max; P.n++;
  const glass = P === GLASS, s = size;
  P.list[id] = { x, y, z, vx, vy, vz, rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6), wr: rnd(-1, 1) * (glass ? 14 : 7), sx: s * rnd(.7, 1.4), sy: glass ? s : s * rnd(.45, 1), sz: s * rnd(.7, 1.3), rest: false, life, life0: life < 1e8 ? life : 0, flat: false, e: glass ? .15 : .38, dr: glass ? 1.1 : 0 };
  P.mesh.setColorAt(id, _cc.set(col).multiplyScalar(glass ? rnd(.85, 1.15) : rnd(.75, 1.15)));
  P.mesh.count = Math.min(P.max, P.n); P.dirty = true;
}
// куда упирается кусок: земля, крыша машины, стена дома. Машины и дома берём из симуляции (сетка соседей машин, клетки)
function chunkPhysics(d, dt) {
  d.vy -= 39 * dt; if (d.dr) { const k = 1 - Math.min(1, d.dr * dt); d.vx *= k; d.vz *= k; if (d.vy < -14) d.vy = -14; } // осколок стекла парусит
  const ox = d.x, oz = d.z;
  d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wr * dt; d.ry += d.wr * .7 * dt; if (!d.flat) d.rz += d.wr * .5 * dt;
  const sx = d.x + W / 2, sy = d.z + H / 2; let gy = hasHills ? gY(clamp(sx, 0, W - .01), clamp(sy, 0, H - .01)) : 0; // на склоне обломки ложатся на землю, а не проваливаются сквозь гору
  const half = d.flat ? (Math.abs(Math.cos(d.rx)) * d.sy + Math.abs(Math.sin(d.rx)) * d.sz) / 2 : d.sy * .45;
  // дом: выше крыши кусок падает на крышу, ниже — в клетку дома снаружи не влетает, отскакивает по той оси, по которой вошёл
  if (cellAt(sx, sy) === 3) {
    const b = chunkBld(sx, sy, d), top = b ? (b.baseY || 0) + b.h : gy + 45;
    if (d.y - half - d.vy * dt >= top - .6) gy = Math.max(gy, top);
    else {
      const inX = cellAt(ox + W / 2, sy) !== 3, inY = cellAt(sx, oz + H / 2) !== 3;
      if (inX) { d.x = ox; d.vx *= -.35; d.wr += rnd(-3, 3); } if (inY) { d.z = oz; d.vz *= -.35; d.wr += rnd(-3, 3); }
    }
  }
  // машина: сверху — отскок от крыши и сползание с неё, сбоку — отскок от борта
  if (d.y - gy < 14) nearCars(sx, sy, 14, c => {
    if (c.gone) return;
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang), dx = d.x + W / 2 - c.x, dy = d.z + H / 2 - c.y, al = dx * ca + dy * sa, lt = -dx * sa + dy * ca;
    const hl = (c.tank ? 13 : 10 * (c.len || 1)) + .4, hw = (c.tank ? 7 : 4.6) + .4; if (Math.abs(al) > hl || Math.abs(lt) > hw) return;
    const top = gy + (c.z || 0) + (c.tank ? 9 : c.bus || c.len > 1.4 ? 10 : 5.5);
    if (d.y - half > top) return;
    if (d.vy <= 0 && d.y - half - d.vy * dt >= top - .6) { // упал на крышу
      d.y = top + half; if (d.vy < -4) { d.vy *= -d.e; d.wr += rnd(-4, 4); } else d.vy = 0;
      const k = 1 - Math.min(1, dt * 3); d.vx *= k; d.vz *= k; const s = Math.sign(lt) || 1; d.vx += -sa * s * 10 * dt; d.vz += ca * s * 10 * dt; // скатывается к ближнему борту
      return;
    }
    const pa = hl - Math.abs(al), pl = hw - Math.abs(lt), nx = pa < pl ? ca * Math.sign(al) : -sa * Math.sign(lt), nz = pa < pl ? sa * Math.sign(al) : ca * Math.sign(lt), pen = Math.min(pa, pl);
    d.x += nx * pen; d.z += nz * pen; const vn = d.vx * nx + d.vz * nz; if (vn < 0) { d.vx -= (1 + d.e) * vn * nx; d.vz -= (1 + d.e) * vn * nz; d.wr += rnd(-5, 5); }
  });
  if (d.y < gy + half) {
    d.y = gy + half;
    if (d.vy < -5) { d.vy *= -d.e * rnd(.7, 1.2); d.vx *= .62; d.vz *= .62; d.wr = d.wr * .55 + rnd(-3, 3); }
    else {
      d.vy = 0; const k = 1 - Math.min(1, dt * 5); d.vx *= k; d.vz *= k; d.wr *= 1 - Math.min(1, dt * 6);
      // блок ложится на грань, а не замирает на ребре
      if (d.flat) { const q = Math.PI / 2, t = Math.round(d.rx / q) * q; d.rx += (t - d.rx) * Math.min(1, dt * 7); }
      if (Math.hypot(d.vx, d.vz) < .8 && Math.abs(d.wr) < .6) { if (d.flat) d.rx = Math.round(d.rx / (Math.PI / 2)) * (Math.PI / 2); d.rest = true; }
    }
  }
}
// дом под куском (запоминаем, чтобы не перебирать все дома, пока кусок катится по крыше)
function chunkBld(x, y, d) {
  const inB = b => b && b.state === "ok" && x >= b.x0 - 1 && x <= b.x1 + 1 && y >= b.y0 - 1 && y <= b.y1 + 1;
  if (inB(d.bld)) return d.bld;
  for (const b of buildings) if (inB(b)) return d.bld = b;
  return null;
}
function writeChunk(mesh, i, d) {
  let s = 1;
  if (d.life0 && d.life < 2) s = Math.max(0, d.life / 2); // осколки тают в последние две секунды
  _de.set(d.rx, d.ry, d.rz || 0); _dq.setFromEuler(_de);
  _dm.compose(_dv.set(d.x, d.y, d.z), _dq, _ds.set(d.sx * s, d.sy * s, d.sz * s)); mesh.setMatrixAt(i, _dm);
}
function stepPool(P, dt) {
  const L = P.list, mesh = P.mesh; let any = false;
  for (let i = 0; i < mesh.count; i++) {
    const d = L[i]; if (!d) continue;
    if (d.life0) { d.life -= dt; if (d.life <= 0) { if (d.sx) { d.sx = d.sy = d.sz = 0; d.rest = true; writeChunk(mesh, i, d); any = true; } continue; } }
    if (d.rest && !(d.life0 && d.life < 2)) continue;
    if (!d.rest) chunkPhysics(d, dt);
    writeChunk(mesh, i, d); any = true;
  }
  if (any) mesh.instanceMatrix.needsUpdate = true;
  if (P.dirty && mesh.instanceColor) { mesh.instanceColor.needsUpdate = true; P.dirty = false; }
}
function stepDebris(dt) {
  if (!dt) return;
  let any = false;
  for (let i = 0; i < debMesh.count; i++) {
    const d = debris[i]; if (!d || (d.rest && !debDirty)) continue;
    if (!d.rest) { if (d.e === undefined) { d.e = .32; d.flat = true; } chunkPhysics(d, dt); } // плиты из addSlab — без этих полей
    writeChunk(debMesh, i, d); any = true;
  }
  if (any) debMesh.instanceMatrix.needsUpdate = true;
  if (debDirty && debMesh.instanceColor) { debMesh.instanceColor.needsUpdate = true; debDirty = false; }
  stepPool(ROCKS, dt); stepPool(GLASS, dt);
}
// глыбы и осколки в убранной области исчезают вместе с обломками
function hidePieces(inside) { for (const P of [ROCKS, GLASS]) for (let i = 0; i < P.mesh.count; i++) { const d = P.list[i]; if (d && d.sx && d.rest && inside(d.x, d.z)) { d.sx = d.sy = d.sz = 0; writeChunk(P.mesh, i, d); P.mesh.instanceMatrix.needsUpdate = true; } } }
function clearDebris() { debris = []; debN = 0; debMesh.count = 0; for (const P of [ROCKS, GLASS]) { P.list = []; P.n = 0; P.mesh.count = 0; } }
// площадка вывезена: ни одного обломка вокруг, гребень упавшей башни и остов убраны
function onSiteCleared(b) {
  const [x0, y0, x1, y1] = rubbleBounds(null, b), wx0 = X(x0 - 24), wx1 = X(x1 + 24), wz0 = Z(y0 - 24), wz1 = Z(y1 + 24);
  for (let i = 0; i < debMesh.count; i++) { const d = debris[i]; if (!d || d.sx === 0) continue; if (d.x >= wx0 && d.x <= wx1 && d.z >= wz0 && d.z <= wz1) { d.sx = d.sy = d.sz = 0; d.y = -50; d.rest = true; debDirty = true; } }
  hidePieces((x, z) => x >= wx0 && x <= wx1 && z >= wz0 && z <= wz1);
  if (b.mound) { cityGroup.remove(b.mound); b.mound = null; }
  if (b.obj && b.state === "ruin") b.obj.visible = false;
  b.pieces = null; paintCells(x0, y0, x1, y1);
}
// куски остова и гребня с их положением в мире; крупные плиты, которые не привязать к клетке, уходят по доле вывезенного
const _pv = new THREE.Vector3();
function ruinPieces(b) {
  if (b.pieces) return b.pieces;
  const out = [], add = o => o.traverse(m => { if (!m.isMesh) return; m.getWorldPosition(_pv); const p = m.geometry.parameters || {}, big = Math.max(p.width || 0, p.depth || 0); out.push({ m, wx: _pv.x, wz: _pv.z, r: big > 30 ? 0 : big / 2, th: big > 30 ? rnd(.15, .7) : rnd(0, .2) }); });
  if (b.obj && b.obj.visible) for (const o of b.obj.children) if (o.userData.shell) add(o);
  if (b.mound) add(b.mound);
  return b.pieces = out;
}
// экскаватор убрал клетку завала: обломки на ней, куски остова рядом с ковшом; остов и обломанный низ башни оседают по мере вывоза
function onRubbleCleared(x, y, b) {
  const cx = Math.floor(x / CS) * CS, cy = Math.floor(y / CS) * CS, wx = X(cx + CS / 2), wz = Z(cy + CS / 2);
  for (let i = 0; i < debMesh.count; i++) { const d = debris[i]; if (!d || !d.rest || d.sx === 0) continue; if (Math.abs(d.x - wx) <= CS * .75 && Math.abs(d.z - wz) <= CS * .75) { d.sx = d.sy = d.sz = 0; d.y = -50; debDirty = true; } }
  hidePieces((x, z) => Math.abs(x - wx) <= CS * .75 && Math.abs(z - wz) <= CS * .75);
  paintCells(cx, cy, cx + CS, cy + CS);
  // куски убираем у всех руин, чей завал накрывает клетку: соседние площадки пересекаются, и чужой экскаватор тоже расчищает
  for (const o of buildings) {
    if (o.state !== "ruin" || x < o.x0 - 40 || x > o.x1 + 40 || y < o.y0 - 40 || y > o.y1 + 40) continue;
    const k = o !== b ? 1 : o.rubble0 ? clamp(o.rubbleLeft / o.rubble0) : 0;
    for (const p of ruinPieces(o)) if (p.m.visible && (k < p.th || Math.hypot(p.wx - wx, p.wz - wz) < CS * 1.5 + p.r)) p.m.visible = false;
    if (o !== b) continue;
    if (o.obj && o.ruinDone && !o.topple) o.obj.position.y = (o.baseY || 0) - (o.h - o.ruinH) - (1 - k) * o.ruinH * 1.8;
    if (o.mound && o.mound.userData.stump) { const u = o.mound.userData; u.stump.position.y = u.stumpY - (1 - k) * u.stumpH * 1.8; }
  }
}

/* ---------- обрушение: пыль, обломки, завал ---------- */
function facadeColor(b) { const st = STYLES[b.style] || STYLES[0]; return st.wall; }
function fxCollapse(b) {
  const cx = X((b.x0 + b.x1) / 2), cz = Z((b.y0 + b.y1) / 2), w = b.x1 - b.x0, d = b.y1 - b.y0, k = clamp(b.h / 120, .4, 2), by = b.baseY || 0;
  if (b.kind === "tower") slowMo(2.2);
  paintCells(...rubbleBounds(null, b));
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
  // вал пыли катится по улицам от основания, следом — вторая, более медленная волна
  const q = fxLoK(), R0 = Math.max(w, d) * .5;
  for (let i = 0; i < 110 * k; i++) {
    const a = rnd(0, TAU), late = Math.random() < .4;
    emit(PS_SMOKE, { x: cx + Math.cos(a) * R0, y: by + rnd(1, 7), z: cz + Math.sin(a) * R0, vx: Math.cos(a) * rnd(30, 75) * (late ? .6 : 1), vy: rnd(0, 5), vz: Math.sin(a) * rnd(30, 75) * (late ? .6 : 1), dl: late ? rnd(.4, 1.4) : 0, l: rnd(5, 10), s0: rnd(10, 16) * k, s1: rnd(40, 75) * k, c: [.5, .47, .42], c1: [.58, .56, .52], a: .55, fadeIn: true, dr: 1.1 });
  }
  // глыбы бетона и стёкла с фасадов
  for (let i = 0; i < 45 * k * q; i++) { const a = rnd(0, TAU); addPiece(ROCKS, cx + Math.cos(a) * R0 * rnd(.6, 1), by + rnd(2, b.h * .7), cz + Math.sin(a) * R0 * rnd(.6, 1), Math.cos(a) * rnd(4, 20), rnd(-4, 10), Math.sin(a) * rnd(4, 20), rnd(1.2, 3.5), Math.random() < .5 ? wall : pick(["#8f8c85", "#6e6b66", "#a19d94"])); }
  for (let i = 0; i < 60 * k * q; i++) { const side = Math.floor(rnd(0, 4)), px = side < 2 ? rnd(-w / 2, w / 2) : (side === 2 ? -w / 2 - 1 : w / 2 + 1), pz = side >= 2 ? rnd(-d / 2, d / 2) : (side === 0 ? -d / 2 - 1 : d / 2 + 1); addPiece(GLASS, cx + px, by + rnd(4, b.h * .9), cz + pz, px * rnd(.1, .5) + rnd(-4, 4), rnd(-2, 6), pz * rnd(.1, .5) + rnd(-4, 4), rnd(.5, 1.4), "#d2e6ee", rnd(18, 30)); }
  // постоянный завал на месте дома
  const n = Math.min(400, w * d / 30);
  for (let i = 0; i < n; i++) {
    const px = rnd(-w / 2 - 6, w / 2 + 6), pz = rnd(-d / 2 - 6, d / 2 + 6), edge = Math.max(Math.abs(px) / (w / 2 + 6), Math.abs(pz) / (d / 2 + 6));
    const s = rnd(2, 7) * (1.2 - edge);
    debris[debN % DEB_MAX] = null;
    addChunk(cx + px, by + s / 2 + rnd(0, b.ruinH * .3 * (1 - edge)), cz + pz, 0, 0, 0, s, Math.random() < .4 ? wall : pick(["#7d7a73", "#5f5c57", "#8d8a83", "#4b4845"]));
    debris[(debN - 1) % DEB_MAX].rest = true; debDirty = true;
  }
  flashLight(cx, by + 20, cz, 1.5, .4, 0xffd0a0);
}
function fxCannon(t, hx, hy) {
  const tx = X(t.x), tz = Z(t.y), ca = Math.cos(t.turret), sa = Math.sin(t.turret), mx = tx + ca * 22, mz = tz + sa * 22, gt = gY(t.x, t.y); // всё от земли под танком
  emit(PS_ADD, { x: mx, y: gt + 8.5, z: mz, vx: 0, vy: 0, vz: 0, l: .09, s0: 18, s1: 6, c: [2, 1.6, .8], a: 1 });
  for (let i = 0; i < 14; i++) emit(PS_SMOKE, { x: mx, y: gt + 8.5, z: mz, vx: ca * rnd(10, 40) + rnd(-6, 6), vy: rnd(1, 6), vz: sa * rnd(10, 40) + rnd(-6, 6), l: rnd(1.5, 3), s0: 4, s1: 18, c: [.5, .48, .45], a: .5, dr: 1.2 });
  flashLight(mx, gt + 10, mz, 2.5, .12, 0xffd080);
  trList.push({ a: [mx, gt + 8.5, mz], b: [X(hx), gY(hx, hy) + 3, Z(hy)], l: .07 });
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
    o.position.set(X(t.x), hasHills ? gY(t.x, t.y) : 0, Z(t.y)); carTilt(t, 26, 6); o.rotation.set(t.tR, -t.ang, t.tP, "YXZ");
    o.userData.turret.rotation.y = -(t.turret - t.ang);
    o.userData.barrel.position.x = 13 - t.recoil * 2.5;
    t.muzzle = [X(t.x) + Math.cos(t.turret) * 6, o.position.y + 9.5, Z(t.y) + Math.sin(t.turret) * 6];
    if (t.hp <= 0 && !o.userData.dead) { o.userData.dead = true; o.traverse(m => { if (m.material) { m.material = m.material.clone(); m.material.color.set("#1d1a17"); } }); }
    if (t.hp <= 0 && Math.random() < .3) smokeParticle(X(t.x), o.position.y + 8, Z(t.y), 1);
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
