/* ---------- люди: одно тело из 9 частей на InstancedMesh, анимация в коде ---------- */
// модель смотрит вдоль +X, рост 7,3 ед. (1,8 м), бёдра на высоте 3,6
const HIP = 3.6, SHO = 6.05;
const PARTS = {
  legL: new THREE.BoxGeometry(.74, 1.8, .8).translate(0, -.9, 0),
  shin: new THREE.BoxGeometry(.62, 1.8, .66).translate(0, -.9, 0),
  shoe: new THREE.BoxGeometry(1.1, .4, .66).translate(.25, -.2, 0),
  fore: new THREE.BoxGeometry(.5, 1.45, .5).translate(0, -.7, 0),
  bag: new THREE.BoxGeometry(1.1, 1, .45),
  skirt: new THREE.CylinderGeometry(.95, 1.35, 1.5, 10).translate(0, -.75, 0),
  torso: new THREE.BoxGeometry(1.15, 2.7, 1.95).translate(0, 1.35, 0),
  arm: new THREE.BoxGeometry(.56, 1.4, .56).translate(0, -.65, 0),
  head: new THREE.SphereGeometry(.62, 12, 9).scale(.95, 1.12, .9),
  hair: new THREE.SphereGeometry(.68, 12, 8, 0, TAU, 0, Math.PI * .55).scale(1, 1.05, .95),
  gun: new THREE.BoxGeometry(3, .38, .3),
  cap: new THREE.CylinderGeometry(.7, .72, .42, 12).translate(0, .2, 0),
  visor: new THREE.BoxGeometry(.9, .08, 1.1).translate(.7, .1, 0),
  dome: new THREE.SphereGeometry(.76, 12, 8, 0, TAU, 0, Math.PI * .5).scale(1, 1, .95),
  vest: new THREE.BoxGeometry(1.32, 1.8, 2.12).translate(0, 1.55, 0),
  beard: new THREE.BoxGeometry(.42, .5, .85).translate(.2, -.1, 0),
  glasses: new THREE.BoxGeometry(.16, .26, 1.3),
  lhair: new THREE.BoxGeometry(.6, 1.5, 1.25).translate(-.1, -.5, 0),
};
const HAT_COL = { cap: null, beanie: null, hood: null, bandana: "#8a2222", police: "#1a2a4a", helmet: "#4d5634", fire: "#d8b020", hard: "#f08a1c", helmetBlk: "#1c1d20", fireRed: "#b8261a", fireWhite: "#e8e8e4" };
const isHelmet = h => h === "helmet" || h === "fire" || h === "hard" || h === "helmetBlk" || h === "fireRed" || h === "fireWhite";
const personMat = new THREE.MeshStandardMaterial({ roughness: .82 });
const skinMat = new THREE.MeshStandardMaterial({ roughness: .6 });
const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: .5, metalness: .6 });
let pCap = 0, pm = {};
function makePeople(cap) {
  for (const k in pm) { scene.remove(pm[k]); pm[k].dispose(); }
  pCap = cap;
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); scene.add(m); return m; };
  pm = { shins: mk(PARTS.shin, personMat, cap * 2), shoes: mk(PARTS.shoe, personMat, cap * 2), fore: mk(PARTS.fore, personMat, cap * 2), bag: mk(PARTS.bag, personMat, cap), skirt: mk(PARTS.skirt, personMat, cap), legs: mk(PARTS.legL, personMat, cap * 2), torso: mk(PARTS.torso, personMat, cap), arms: mk(PARTS.arm, personMat, cap * 2), head: mk(PARTS.head, skinMat, cap), hair: mk(PARTS.hair, personMat, cap), gun: mk(PARTS.gun, gunMat, cap),
    cap: mk(PARTS.cap, personMat, cap), visor: mk(PARTS.visor, personMat, cap), dome: mk(PARTS.dome, personMat, cap), vest: mk(PARTS.vest, personMat, cap), beard: mk(PARTS.beard, personMat, cap), glasses: mk(PARTS.glasses, gunMat, cap), lhair: mk(PARTS.lhair, personMat, cap) };
  // тени отбрасывают только крупные части тела: остальное в карте теней не видно, а стоит дорого
  for (const k of ["gun", "glasses", "hair", "beard", "visor", "cap", "dome", "vest", "bag", "skirt", "fore", "shoes", "shins", "lhair"]) pm[k].castShadow = false;
}
makePeople(1200);
const _r = new THREE.Matrix4(), _l = new THREE.Matrix4(), _u = new THREE.Matrix4(), _p = new THREE.Matrix4(), _t = new THREE.Matrix4(), _c = new THREE.Color(), _c2 = new THREE.Color();
const ZSKIN = new THREE.Color("#7f8c6c"), BURNT = new THREE.Color("#17120f"), BLOODC = new THREE.Color("#4a0b08");
const _jm = new THREE.Matrix4(), _jt = new THREE.Matrix4();
// сегмент, подвешенный к родителю: возвращает матрицу, чтобы к ней прицепить следующий
function joint(mesh, idx, parent, x, y, z, rz, rx, out) {
  _jm.makeRotationZ(rz); if (rx) _jm.multiply(_jt.makeRotationX(rx)); _jm.setPosition(x, y, z);
  out.multiplyMatrices(parent, _jm); if (mesh) mesh.setMatrixAt(idx, out); return out;
}
const _th = new THREE.Matrix4(), _sh = new THREE.Matrix4(), _ua = new THREE.Matrix4(), _fa = new THREE.Matrix4(), ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
function part(mesh, idx, base, x, y, z, rz, rx, sx = 1) {
  // base · T(x,y,z) · Rz · Rx
  _p.makeRotationZ(rz); if (rx) _p.multiply(_t.makeRotationX(rx));
  if (sx !== 1) _p.scale(new THREE.Vector3(sx, sx, sx));
  _p.setPosition(x, y, z);
  mesh.setMatrixAt(idx, _t.multiplyMatrices(base, _p));
}
function colorOf(a, hex, kind) {
  _c.set(hex);
  if (a.burnt) return _c.copy(BURNT).lerp(_c2.set(hex), .08);
  if (a.burn > .05) _c.lerp(_c2.set(kind === "skin" ? "#7a2a18" : "#2a1d16"), clamp(a.burn * 1.2, 0, .85));
  if (a.role === "zombie" || (a.state === "dead" && a.reanimate && a.deadT > a.wakeAt - 4)) {
    if (kind === "skin") return a.ztype === "spitter" ? _c.lerp(_c2.set("#9ab83a"), .9) : a.ztype === "titan" ? _c.lerp(_c2.set("#5a2620"), .9) : _c.lerp(ZSKIN, .85).multiplyScalar(a.ztype === "screamer" ? 1.1 : a.ztype === "brute" ? .7 : .8);
    return _c.multiplyScalar(a.ztype === "titan" ? .3 : .55).lerp(BLOODC, .3);
  }
  if (a.state === "dead") return kind === "skin" ? _c.lerp(_c2.set("#b9b4ac"), .4) : _c.lerp(BLOODC, .25);
  if (a.bitten && kind === "skin") return _c.lerp(_c2.set("#c9c3a2"), clamp(1 - a.incT / settings.inc, 0, .6));
  return _c;
}
const _fr = new THREE.Frustum(), _frM = new THREE.Matrix4(), _frS = new THREE.Sphere(new THREE.Vector3(), 9);
function updatePeople(dt) {
  const list = agents.filter(a => a.state !== "saved" && !(a.player && fps.on && a.state === "alive"));
  if (list.length > pCap) makePeople(Math.ceil(list.length * 1.5));
  let i = 0, gi = 0, bi = 0, ki = 0, ci = 0, vi = 0, di = 0, vsi = 0, bdi = 0, gli = 0, lhi = 0;
  // кто за кадром — не рисуем; вдали мелочи внешности не нужны
  _fr.setFromProjectionMatrix(_frM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const far = camC.dist > 900 && !fps.on;
  for (const a of list) {
    const s = a.size, dead = a.state === "dead", z = a.role === "zombie", zt = z ? a.ztype : null;
    if ((a.hidden && !a.onRoof) || a.lod) continue;
    _frS.center.set(X(a.x), 4 + (a.onRoof ? a.roofZ : 0), Z(a.y)); if (!_fr.intersectsSphere(_frS)) continue;
    const wounded = !dead && !z && a.hp < 45, bld = a.build || 1;
    const sp = a.speed || 0, run = clamp((sp - 6) / 10), amp = dead ? 0 : clamp(sp / 6) * (.55 + run * .35);
    const ph = a.phase, sw = Math.sin(ph) * amp, bob = dead ? 0 : Math.abs(Math.cos(ph)) * amp * .35;
    // поза корня: стоит / лежит / встаёт / ест
    let lie = 0, lower = 0, lean = run * .25;
    if (dead) lie = Math.PI / 2;
    else if (a.riseT > 0) lie = Math.PI / 2 * clamp(a.riseT / 1.4) ** 2;
    if (z && !dead) lean = .32 + Math.sin(ph * .5 + a.id) * .05;
    if (a.age === "old" && !dead) lean = Math.max(lean, .22);
    if (wounded) lean = Math.max(lean, .3 + Math.sin(ph) * .05); // раненый сгибается и хромает
    if (zt === "brute") lean = .15; if (zt === "titan") lean = .2;
    if (a.spitAnim > 0) lean -= .35 * Math.sin(a.spitAnim * 6.3);
    const crawl = zt === "crawler" && !dead;
    if (crawl) lie = Math.PI / 2 * .93;
    if (z && a.feedT > 0 && !dead) { lower = 2.6; lean = 1.05; }
    if (a.grabT > 0 && !dead) lean = -.25;
    let jx = 0, jz = 0;
    const conv = dead && a.reanimate && !a.burnt && a.deadT > a.wakeAt - 2.5;
    if (conv) { jx = Math.sin(simT * 41 + a.id) * .25; jz = Math.cos(simT * 37 + a.id) * .25; }
    _r.makeRotationY(-a.dir);
    _r.setPosition(X(a.x) + jx, bob + (a.z || 0) + (a.onRoof ? a.roofZ : 0) + (hasHills ? gY(a.x, a.y) : 0), Z(a.y) + jz);
    if (zt === "brute") _r.scale(new THREE.Vector3(s * 1.3, s * 1.12, s * 1.45));
    else if (zt === "titan") _r.scale(new THREE.Vector3(s * 1.9, s * 1.65, s * 2.1));
    else _r.scale(new THREE.Vector3(s * bld, s, s * bld));
    if (lie > 0) {
      const k = Math.sin(lie);
      _l.makeRotationX(a.roll || 0).multiply(_t.makeTranslation(0, k * 1, 0)).multiply(_u.makeRotationZ(lie * (crawl ? -1 : a.id % 2 ? 1 : -1))).multiply(_p.makeTranslation(0, -HIP * k, 0));
      _r.multiply(_l);
    }
    if (lower) _r.multiply(_l.makeTranslation(0, -lower, 0));
    // верх тела наклоняется вокруг бёдер
    _u.makeTranslation(0, HIP, 0).multiply(_l.makeRotationZ(-lean)).multiply(_t.makeTranslation(0, -HIP, 0));
    const upper = _u.clone().premultiply(_r);
    // ноги
    let lA = sw, rA = -sw;
    if (dead) { const r = a.id * 2.3; lA = Math.sin(r) * .4; rA = Math.cos(r) * .5; }
    if (z && a.feedT > 0 && !dead) { lA = 1.5; rA = 1.3; }
    if (z && !dead) { lA *= .8; rA *= 1.1; } // хромота
    if (wounded) { rA *= .45; lA *= 1.15; }
    if (conv) { lA += Math.sin(simT * 33 + a.id) * .5; rA += Math.cos(simT * 29) * .5; }
    const pc = colorOf(a, a.pants).clone(), shoeC = _c2.set(a.role === "army" ? "#2a2a20" : a.role === "fire" ? "#111" : "#2a2522").clone();
    // колено сгибается в фазе переноса ноги
    const kneeL = dead ? .2 : (z && a.feedT > 0) ? 2.3 : Math.max(0, Math.sin(ph + 1.3)) * amp * 1.5 + .05, kneeR = dead ? .5 : (z && a.feedT > 0) ? 2.1 : Math.max(0, Math.sin(ph + 1.3 + Math.PI)) * amp * 1.5 + .05;
    for (const [k, side, ang, knee] of [[0, -.48, lA, kneeL], [1, .48, rA, kneeR]]) {
      joint(pm.legs, i * 2 + k, _r, 0, HIP, side, ang, dead ? side * .25 : 0, _th); pm.legs.setColorAt(i * 2 + k, pc);
      if (crawl) { pm.shins.setMatrixAt(i * 2 + k, ZERO_M); pm.shoes.setMatrixAt(i * 2 + k, ZERO_M); continue; } // ползун без ног
      joint(pm.shins, i * 2 + k, _th, 0, -1.75, 0, -knee, 0, _sh); pm.shins.setColorAt(i * 2 + k, a.skirt && !z ? colorOf(a, a.skin, "skin") : pc);
      joint(pm.shoes, i * 2 + k, _sh, 0, -1.75, 0, knee * .6 - ang * .3, 0, _jt.identity()); pm.shoes.setColorAt(i * 2 + k, shoeC);
    }
    if (a.skirt && !z) { part(pm.skirt, ki, _r, 0, HIP + .35, 0, 0, 0); pm.skirt.setColorAt(ki++, colorOf(a, a.pants)); }
    // туловище и голова
    part(pm.torso, i, upper, 0, HIP - .05, 0, 0, 0); pm.torso.setColorAt(i, colorOf(a, a.cloth));
    const headTilt = z && !dead ? Math.sin(ph * .3 + a.id) * .3 : 0;
    part(pm.head, i, upper, .05, SHO + .85, 0, zt === "screamer" && a.shriek > 0 ? -.7 : z ? .25 : 0, headTilt); pm.head.setColorAt(i, colorOf(a, a.skin, "skin"));
    const helmet = isHelmet(a.hat);
    part(pm.hair, i, upper, -.05, SHO + .95, 0, -.15, headTilt, helmet ? 1.12 : 1); pm.hair.setColorAt(i, colorOf(a, a.hair));
    // головные уборы, жилеты, бороды, очки, длинные волосы
    if (a.hat && !far) {
      const hc = HAT_COL[a.hat] === null ? colorOf(a, a.hat === "hood" ? a.cloth : a.pants).clone() : colorOf(a, HAT_COL[a.hat]).clone();
      if (a.hat === "cap" || a.hat === "police" || a.hat === "hard") { part(pm.cap, ci, upper, -.05, SHO + 1.2, 0, 0, headTilt); pm.cap.setColorAt(ci++, hc); if (a.hat !== "hard") { part(pm.visor, vi, upper, -.05, SHO + 1.2, 0, 0, headTilt); pm.visor.setColorAt(vi++, hc); } }
      else if (a.hat === "bandana") { part(pm.cap, ci, upper, -.05, SHO + 1.05, 0, 0, headTilt, .95); pm.cap.setColorAt(ci++, hc); }
      else { part(pm.dome, di, upper, -.05, SHO + .95, 0, 0, headTilt, isHelmet(a.hat) && a.hat !== "hard" ? 1.15 : a.hat === "hood" ? 1.2 : 1.05); pm.dome.setColorAt(di++, hc); }
    }
    if (a.vest && !far) { part(pm.vest, vsi, upper, 0, HIP - .05, 0, 0, 0); pm.vest.setColorAt(vsi++, colorOf(a, a.vest)); }
    if (a.beard && !helmet && !far) { part(pm.beard, bdi, upper, .5, SHO + .55, 0, 0, headTilt); pm.beard.setColorAt(bdi++, colorOf(a, a.hair)); }
    if (a.glasses && !dead && !far) { part(pm.glasses, gli, upper, .6, SHO + .95, 0, 0, headTilt); pm.glasses.setColorAt(gli++, _c.set("#1a1a1a")); }
    if (a.longHair && !helmet && a.hat !== "hood" && !far) { part(pm.lhair, lhi, upper, -.5, SHO + .95, 0, -.1, headTilt); pm.lhair.setColorAt(lhi++, colorOf(a, a.hair)); }
    // руки: размах при ходьбе, у зомби вытянуты вперёд, у стрелков — на оружии
    let la = -sw * .9, ra = sw * .9, lx = -.08, rx = .08;
    const aiming = a.armed && !dead && !z && (a.aimT > 0 || a.role === "army");
    if (z && !dead) { la = 1.35 + Math.sin(simT * 2 + a.id) * .12; ra = 1.45 + Math.cos(simT * 2.3 + a.id) * .12; if (a.feedT > 0) { la = .9 + Math.sin(simT * 9) * .3; ra = 1 + Math.cos(simT * 8) * .3; } if (a.bash > 0) { la += Math.sin(simT * 20) * .5; ra -= Math.sin(simT * 20) * .5; } }
    else if (aiming) { if (a.aimT > 0) { la = 1.45; ra = 1.35; lx = .55; rx = -.15; } else { la = .38 - sw * .25; ra = .32 - sw * .25; lx = .42; rx = -.08; } }
    else if (a.panic > .5 && !dead && sp > 8) { la = -sw * 1.4; ra = sw * 1.4; }
    else if (wounded) { la = .75; ra = sw * .5; lx = .5; } // держится за бок
    if (dead) { const r = a.id * 1.7; la = 1.2 + Math.sin(r); ra = -1 + Math.cos(r) * .6; lx = -.9; rx = .9; }
    if (conv) { la += Math.sin(simT * 35 + a.id) * .7; ra += Math.cos(simT * 31) * .7; }
    if (a.grabT > 0 && !dead) { la = 1.9; ra = 1.7; lx = .3; rx = -.3; }
    const ac = colorOf(a, a.cloth).clone(), hc = colorOf(a, a.skin, "skin").clone();
    // локоть: на бегу согнут сильнее, у зомби почти прямой, у стрелка держит оружие
    const elbow = dead ? .4 : z ? .12 : aiming ? .25 : a.grabT > 0 ? .3 : .25 + run * 1.1 + (a.bag ? .6 : 0);
    joint(pm.arms, i * 2, upper, 0, SHO - .15, -1.25, la, lx, _ua); pm.arms.setColorAt(i * 2, ac);
    joint(pm.fore, i * 2, _ua, 0, -1.35, 0, elbow, 0, _fa); pm.fore.setColorAt(i * 2, a.role === "civ" && a.short ? hc : ac);
    joint(pm.arms, i * 2 + 1, upper, 0, SHO - .15, 1.25, ra, rx, _ua); pm.arms.setColorAt(i * 2 + 1, ac);
    joint(pm.fore, i * 2 + 1, _ua, 0, -1.35, 0, elbow, 0, _fa); pm.fore.setColorAt(i * 2 + 1, a.role === "civ" && a.short ? hc : ac);
    if (a.bag && !z && !dead) { _jm.makeTranslation(0, -1.75, .35); pm.bag.setMatrixAt(bi, _jt.multiplyMatrices(_fa, _jm)); pm.bag.setColorAt(bi++, _c.set(a.bag)); }
    // оружие в руках
    if (a.armed && !z && !dead) {
      const rifle = a.role === "army", aimed = a.aimT > 0;
      _p.makeRotationZ(aimed ? 0 : rifle ? -.75 : -1.2); _p.scale(new THREE.Vector3(rifle ? 1 : .45, 1, 1)); _p.setPosition(aimed ? 1.8 : rifle ? 1.3 : .9, aimed ? SHO - .55 : rifle ? SHO - 1.7 : SHO - 2, aimed ? .25 : rifle ? .7 : 1.3);
      pm.gun.setMatrixAt(gi++, _t.multiplyMatrices(upper, _p));
      a.muzzle = [X(a.x) + Math.cos(a.dir) * 3.6 * s, (SHO - .5) * s + gY(a.x, a.y), Z(a.y) + Math.sin(a.dir) * 3.6 * s];
    }
    i++;
  }
  for (const k of ["legs", "torso", "arms", "head", "hair", "shins", "shoes", "fore"]) { pm[k].count = i * (k === "legs" || k === "arms" || k === "shins" || k === "shoes" || k === "fore" ? 2 : 1); pm[k].instanceMatrix.needsUpdate = true; pm[k].instanceColor.needsUpdate = true; }
  pm.bag.count = bi; pm.skirt.count = ki; pm.cap.count = ci; pm.visor.count = vi; pm.dome.count = di; pm.vest.count = vsi; pm.beard.count = bdi; pm.glasses.count = gli; pm.lhair.count = lhi;
  for (const k of ["bag", "skirt", "cap", "visor", "dome", "vest", "beard", "glasses", "lhair"]) { pm[k].instanceMatrix.needsUpdate = true; if (pm[k].instanceColor) pm[k].instanceColor.needsUpdate = true; }
  pm.gun.count = gi; pm.gun.instanceMatrix.needsUpdate = true;
}

/* ---------- пятна: кровь, копоть, обломки ---------- */
const DEC_MAX = 6000;
const splatTex = canvasTex(128, 128, (g) => {
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.fill();
  for (let i = 0; i < 26; i++) { const a = rnd(0, TAU), d = rnd(20, 52), r = rnd(3, 12); g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r * (1 - d / 70), 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { const a = rnd(0, TAU), d = rnd(40, 62); g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rnd(.8, 2.4), 0, TAU); g.fill(); }
}, false);
const decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: splatTex, transparent: true, depthWrite: false, roughness: .3, metalness: .1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), DEC_MAX);
decals.count = 0; decals.receiveShadow = true; decals.frustumCulled = false; decals.renderOrder = 1;
decals.setColorAt(0, new THREE.Color());
scene.add(decals);
const DCOL = ["#4f0505", "#120e0b", "#2b2210", "#3a332a", "#3f6a14"];
let decN = 0, decDirty = false;
const decInfo = [];
function addDecal(x, y, r, type) {
  const id = decN % DEC_MAX; decN++;
  decInfo[id] = { x, y, rot: rnd(0, TAU), r };
  setDecal(id, r);
  decals.setColorAt(id, _c.set(DCOL[type] || DCOL[0]).multiplyScalar(rnd(.8, 1.2)));
  decals.count = Math.min(DEC_MAX, decN); decDirty = true;
  return id;
}
function setDecal(id, r) {
  const d = decInfo[id]; if (!d) return; d.r = r;
  _p.makeRotationY(d.rot); _p.scale(new THREE.Vector3(r, 1, r)); _p.setPosition(X(d.x), .06 + (id % 7) * .004 + (hasHills ? gY(d.x, d.y) : 0), Z(d.y));
  decals.setMatrixAt(id, _p); decDirty = true;
}
function updateDecals(dt) {
  // лужи под телами растекаются
  for (const a of agents) if (a.state === "dead" && a.poolId >= 0 && a.poolR < a.poolMax && a.z <= 0) { a.poolR += dt * .45; const d = decInfo[a.poolId]; if (d) { d.x = a.x; d.y = a.y; } setDecal(a.poolId, a.poolR); }
  if (decDirty) { decDirty = false; decals.instanceMatrix.needsUpdate = true; if (decals.instanceColor) decals.instanceColor.needsUpdate = true; }
}
function clearDecals() { decN = 0; decals.count = 0; decInfo.length = 0; }

/* ---------- метки наблюдателя: укушенные, выбранный ---------- */
const ringTex = canvasTex(64, 64, g => { g.strokeStyle = "#fff"; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 26, 0, TAU); g.stroke(); }, false);
const marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: .8, toneMapped: false }), 3000);
marks.count = 0; marks.frustumCulled = false; marks.renderOrder = 3; marks.setColorAt(0, new THREE.Color()); scene.add(marks);
let showMarks = true, hoverA = null, followA = null;
function updateMarks() {
  let n = 0;
  const put = (a, r, col) => { _p.makeScale(r, 1, r).setPosition(X(a.x), .25 + (hasHills ? gY(a.x, a.y) : 0), Z(a.y)); marks.setMatrixAt(n, _p); marks.setColorAt(n, _c.set(col)); n++; };
  if (showMarks) for (const a of agents) if (a.state === "alive" && a.bitten && n < 2990) put(a, 6 + Math.sin(simT * 6) * .6, "#e8c447");
  if (highlight) { const col = { H: "#5fb3e8", I: "#e8c447", Z: "#7fdf5a", D: "#ff6a5a", F: "#f2d04a" }[highlight] || "#fff"; for (const a of agents) if (n < 2980 && matchType(a, highlight)) put(a, 7 + Math.sin(simT * 5) * .8, col); }
  if (hoverA && hoverA.state !== "saved") put(hoverA, 9, "#ffffff");
  if (followA && followA.state !== "saved") put(followA, 11, "#f2b33d");
  marks.count = n; marks.instanceMatrix.needsUpdate = true; if (marks.instanceColor) marks.instanceColor.needsUpdate = true;
}
