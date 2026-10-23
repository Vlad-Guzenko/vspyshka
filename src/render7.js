/* ---------- светофоры на перекрёстках ---------- */
let tlPoles = null, tlHeads = null, tlLamps = null, tlList = [];
function buildTrafficLights() {
  for (const m of [tlPoles, tlHeads, tlLamps]) if (m) { scene.remove(m); m.dispose(); }
  tlList = [];
  for (const n of RN) { if (!n.sig) continue; for (const e of n.ed) { const l = e.b === n ? e.L[0] : e.L[1]; if (l) tlList.push({ n, e, l }); } }
  const cnt = Math.max(1, tlList.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  tlPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .3, 14, 6).translate(0, 7, 0), new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: .5, roughness: .5 }), cnt);
  tlHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 3.4, 1.1), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6 }), cnt);
  tlLamps = new THREE.InstancedMesh(new THREE.SphereGeometry(.38, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), cnt * 2);
  tlLamps.setColorAt(0, new THREE.Color());
  tlList.forEach((t, j) => {
    const s = laneEnd(t.l), p = lanePos(t.l, s), rx = -p.ty, ry = p.tx, side = t.e.hw - t.l.off + 3.5;
    const x = p.x + rx * side, y = p.y + ry * side, ty = gY(x, y);
    m.makeTranslation(X(x), ty, Z(y)); tlPoles.setMatrixAt(j, m);
    // лицевая сторона — навстречу машинам
    q.setFromAxisAngle(up, -Math.atan2(-p.ty, -p.tx));
    m.compose(new THREE.Vector3(X(x), ty + 13, Z(y)), q, one); tlHeads.setMatrixAt(j, m);
    for (let k = 0; k < 2; k++) { m.compose(new THREE.Vector3(X(x - p.tx * .6), ty + 13.9 - k * 1.8, Z(y - p.ty * .6)), q, one); tlLamps.setMatrixAt(j * 2 + k, m); }
  });
  for (const o of [tlPoles, tlHeads, tlLamps]) { o.count = tlList.length * (o === tlLamps ? 2 : 1); o.castShadow = o !== tlLamps; o.frustumCulled = false; scene.add(o); }
  tlT = 0;
}
let tlT = 0;
const TL_COL = { g: new THREE.Color("#30ff60"), y: new THREE.Color("#ffc020"), r: new THREE.Color("#ff2a20"), off: new THREE.Color("#202020") };
function updateTrafficLights(dt) {
  if (!tlLamps || !tlList.length) return; tlT -= dt; if (tlT > 0) return; tlT = .25;
  const dark = typeof settings !== "undefined" && settings.dark;
  tlList.forEach((t, j) => {
    const st = dark ? "off" : lightFor(t.n, t.e);
    // верхняя лампа — красный/жёлтый, нижняя — зелёный
    tlLamps.setColorAt(j * 2, st === "g" || st === "off" ? TL_COL.off : TL_COL[st]);
    tlLamps.setColorAt(j * 2 + 1, st === "g" ? TL_COL.g : TL_COL.off);
  });
  if (tlLamps.instanceColor) tlLamps.instanceColor.needsUpdate = true;
}

/* ---------- падение башни вбок ---------- */
const _tq = new THREE.Quaternion(), _tb = new THREE.Quaternion(), _tv = new THREE.Vector3(), _tu = new THREE.Vector3(0, 1, 0), _ta = new THREE.Vector3();
function animateTopple(b) {
  if (b.impacted) { if (!b.moundDone) { b.moundDone = true; b.obj.visible = false; makeToppleMound(b); } return; }
  const o = b.obj, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, ca = Math.cos(b.fallAng), sa = Math.sin(b.fallAng);
  const w = b.x1 - b.x0, d = b.y1 - b.y0, e = Math.min(w / 2 / Math.max(1e-3, Math.abs(ca)), d / 2 / Math.max(1e-3, Math.abs(sa)));
  // разгон как при свободном падении, в конце — небольшой отскок и оседание
  const k = b.state === "ruin" ? 1 : clamp(b.cT / b.fallT), th = b.fallMax * Math.pow(k, 2.3) - (k >= 1 ? Math.max(0, .05 - (b.cT - b.fallT) * .05) * 0 : 0);
  _ta.set(ca, 0, sa); const axis = _tu.clone().cross(_ta).normalize();
  _tq.setFromAxisAngle(axis, th); _tb.setFromAxisAngle(_tu, b.rot !== undefined ? -b.rot : 0);
  o.quaternion.copy(_tq).multiply(_tb);
  const pivot = new THREE.Vector3(X(cx + ca * e), b.baseY || 0, Z(cy + sa * e));
  _tv.set(X(cx), 0, Z(cy)).sub(pivot).applyQuaternion(_tq);
  const sink = k >= 1 ? Math.min(6, (b.cT - b.fallT) * 4) : 0;
  o.position.copy(pivot).add(_tv); o.position.y -= sink;
  // на половине наклона верх здания переламывается: верхние этажи отрываются и летят глыбами, остаётся обломанный низ
  if (k > .5 && !b.broke) {
    b.broke = true; const e2 = Math.min(w, d), col = facadeColor(b), hh0 = b.h * .55;
    for (let i = 0; i < 18; i++) { const hh = hh0 + Math.random() * (b.h - hh0), ox = rnd(-w / 2, w / 2), oz = rnd(-d / 2, d / 2); const px = X(cx + ca * e) + ca * hh * Math.sin(th) + ox * Math.cos(b.fallAng + Math.PI / 2), pz = Z(cy + sa * e) + sa * hh * Math.sin(th) + oz; addChunk(px, hh * Math.cos(th), pz, ca * rnd(8, 26) + rnd(-6, 6), rnd(-6, 4), sa * rnd(8, 26) + rnd(-6, 6), rnd(5, 9), Math.random() < .7 ? col : "#7d7a73"); }
    for (let i = 0; i < 90 * fxK; i++) emit(PS_SMOKE, { x: X(cx + ca * e) + ca * hh0 * Math.sin(th) + rnd(-e2, e2), y: hh0 * Math.cos(th) + rnd(-6, 6), z: Z(cy + sa * e) + sa * hh0 * Math.sin(th) + rnd(-e2, e2), vx: rnd(-12, 12), vy: rnd(-4, 8), vz: rnd(-12, 12), l: rnd(4, 9), s0: rnd(8, 14), s1: rnd(30, 60), c: [.45, .42, .38], c1: [.55, .52, .48], a: .55, fadeIn: true, dr: .5 });
    o.scale.y = .6;
  }
  // во время падения сыплется мусор с фасада
  if (k < 1 && Math.random() < .5) { const hh = rnd(.3, 1) * b.h; addChunk(X(cx + ca * e) + ca * hh * Math.sin(th) + rnd(-6, 6), hh * Math.cos(th), Z(cy + sa * e) + sa * hh * Math.sin(th) + rnd(-6, 6), rnd(-6, 6), rnd(-4, 2), rnd(-6, 6), rnd(1.5, 4), facadeColor(b)); }
}
// после удара: обломанный низ на месте и гребень обломков вдоль падения вместо целой лежащей коробки
function makeToppleMound(b) {
  const z = b.fallZone; if (!z) return;
  const g = new THREE.Group(), fm = new THREE.MeshStandardMaterial({ color: facadeColor(b), roughness: .9 }), mats = [fm, slabMat, innerMat, fm];
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  // низ здания: стены обломаны неровно
  const stump = new THREE.Group(); stump.position.set(X(cx), b.baseY || 0, Z(cy)); if (b.rot !== undefined) stump.rotation.y = -b.rot;
  const savedRuin = b.ruinH; b.ruinH = Math.min(b.h * .3, rnd(6, 16)); stump.add(makeRuinShell(b)); b.ruinH = savedRuin; g.add(stump);
  // гребень: куски перекрытий и фасада, выше у основания и ниже к концу
  const n = Math.ceil(z.L / 9);
  for (let i = 0; i < n; i++) {
    const al = (i + .5) / n * z.L, fall = 1 - al / z.L * .55, hw = z.half * rnd(.5, 1) * fall;
    for (let k = 0; k < 2; k++) {
      const lat = rnd(-z.half * .7, z.half * .7) * fall, h = rnd(2, 8) * fall + 1, bw = rnd(6, 14), bd = rnd(5, 10);
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), pick(mats)); m.position.set(X(z.px + z.ca * al - z.sa * lat), h / 2 - rnd(0, h * .3), Z(z.py + z.sa * al + z.ca * lat)); m.rotation.set(rnd(-.3, .3), -b.fallAng + rnd(-.5, .5), rnd(-.35, .35)); m.castShadow = m.receiveShadow = true; g.add(m);
    }
    if (i % 3 === 0) { const slab = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 1.2, 9), fm); slab.position.set(X(z.px + z.ca * al), rnd(1, 4), Z(z.py + z.sa * al)); slab.rotation.set(rnd(-.15, .15), -b.fallAng, rnd(-.2, .2)); slab.castShadow = true; g.add(slab); }
  }
  cityGroup.add(g); b.mound = g;
}
function fxToppleImpact(b) {
  const z = b.fallZone; if (!z) return;
  shake = Math.max(shake, 9 * clamp(1.4 - camDist() / 2000, .2, 1));
  for (let i = 0; i < 260 * fxK; i++) {
    const al = rnd(0, z.L), lat = rnd(-z.half, z.half), x = X(z.px + z.ca * al - z.sa * lat), zz = Z(z.py + z.sa * al + z.ca * lat);
    emit(PS_SMOKE, { x, y: rnd(2, 20), z: zz, vx: rnd(-25, 25), vy: rnd(4, 18), vz: rnd(-25, 25), l: rnd(6, 13), s0: rnd(14, 22), s1: rnd(50, 90), c: [.42, .39, .34], c1: [.5, .48, .44], a: .6, fadeIn: true, dr: .6 });
  }
  for (let i = 0; i < 160; i++) { const al = rnd(0, z.L); addChunk(X(z.px + z.ca * al) + rnd(-z.half, z.half), rnd(2, 14), Z(z.py + z.sa * al) + rnd(-z.half, z.half), rnd(-22, 22) + z.ca * rnd(0, 14), rnd(6, 30), rnd(-22, 22) + z.sa * rnd(0, 14), rnd(2, 7), Math.random() < .5 ? facadeColor(b) : "#7d7a73"); }
  flashLight(X(z.px + z.ca * z.L / 2), 20, Z(z.py + z.sa * z.L / 2), 1.2, .3, 0xffd0a0);
}

/* ---------- развалины: внутри видны перекрытия, стены обломаны неровно ---------- */
const slabMat = new THREE.MeshStandardMaterial({ color: 0x8a867e, roughness: .95 }), innerMat = new THREE.MeshStandardMaterial({ color: 0x5c5650, roughness: 1 });
function makeRuinShell(b) {
  const g = new THREE.Group(), rot = b.rot !== undefined, w = rot ? b.w : b.x1 - b.x0, d = rot ? b.d : b.y1 - b.y0, h = b.h, sunk = Math.max(0, h - b.ruinH), fm = b.mesh.userData.orig ? b.mesh.material : b.mesh.material;
  const wallMats = Array.isArray(fm) ? fm[0] : fm, t = 1.6;
  // стены режем на куски разной высоты
  for (const [ax, az, len, alongX] of [[0, -d / 2 + t / 2, w, true], [0, d / 2 - t / 2, w, true], [-w / 2 + t / 2, 0, d, false], [w / 2 - t / 2, 0, d, false]]) {
    const n = Math.max(2, Math.round(len / 14));
    for (let i = 0; i < n; i++) {
      const segH = sunk + b.ruinH * rnd(.3, 1.7), sl = len / n;
      const geo = new THREE.BoxGeometry(alongX ? sl : t, segH, alongX ? t : sl); boxUV(geo, alongX ? sl : t, alongX ? t : sl, segH / 12, Math.random());
      const m = new THREE.Mesh(geo, [wallMats, wallMats, innerMat, innerMat, wallMats, wallMats]);
      m.position.set(alongX ? -len / 2 + sl * (i + .5) : ax, segH / 2, alongX ? az : -len / 2 + sl * (i + .5)); m.castShadow = m.receiveShadow = true; g.add(m);
    }
  }
  // перекрытия этажей, часть просела
  for (let y = sunk + 3; y < sunk + b.ruinH * 1.4; y += 12) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w - t * 2, 1, d - t * 2), slabMat);
    s.position.set(rnd(-1, 1), y, rnd(-1, 1)); s.rotation.set(rnd(-.12, .12), 0, rnd(-.15, .15)); s.castShadow = s.receiveShadow = true; g.add(s);
  }
  // арматура торчит из обломов
  const rebar = new THREE.MeshStandardMaterial({ color: 0x3a2a20, metalness: .6, roughness: .5 });
  for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, rnd(3, 7), 4), rebar); r.position.set(rnd(-w / 2, w / 2), sunk + b.ruinH * rnd(.6, 1.3), rnd(-d / 2, d / 2)); r.rotation.set(rnd(-.6, .6), 0, rnd(-.6, .6)); g.add(r); }
  return g;
}
// крупные плиты отрываются при обрушении
function addSlab(x, y, z, vx, vy, vz, sx, sy, sz, col) {
  const id = debN % DEB_MAX; debN++;
  debris[id] = { x, y, z, vx, vy, vz, rx: rnd(0, 1), ry: rnd(0, 6), wr: rnd(-3, 3), sx, sy, sz, rest: false };
  debMesh.setColorAt(id, _cc.set(col)); debMesh.count = Math.min(DEB_MAX, debN); debDirty = true;
}
function fxCollapseSlabs(b) {
  const cx = X((b.x0 + b.x1) / 2), cz = Z((b.y0 + b.y1) / 2), w = b.x1 - b.x0, d = b.y1 - b.y0, col = facadeColor(b);
  const n = Math.min(26, 6 + Math.floor(b.floors * 1.2));
  for (let i = 0; i < n; i++) {
    const side = Math.floor(rnd(0, 4)), px = side < 2 ? rnd(-w / 2, w / 2) : (side === 2 ? -w / 2 - 2 : w / 2 + 2), pz = side >= 2 ? rnd(-d / 2, d / 2) : (side === 0 ? -d / 2 - 2 : d / 2 + 2);
    const big = rnd(6, Math.min(18, Math.max(w, d) * .4));
    addSlab(cx + px, rnd(b.h * .4, b.h), cz + pz, px * rnd(.2, .6), rnd(-4, 6), pz * rnd(.2, .6), side < 2 ? big : 1.4, rnd(6, 12), side < 2 ? 1.4 : big, i % 3 ? col : "#8a867e");
  }
}
