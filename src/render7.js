/* ---------- светофоры на перекрёстках ---------- */
let tlPoles = null, tlHeads = null, tlLamps = null;
function buildTrafficLights() {
  for (const m of [tlPoles, tlHeads, tlLamps]) if (m) { scene.remove(m); m.dispose(); }
  const n = Math.max(1, crossings.length * 2), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  tlPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .3, 14, 6).translate(0, 7, 0), new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: .5, roughness: .5 }), n);
  tlHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 3.4, 1.1), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6 }), n);
  tlLamps = new THREE.InstancedMesh(new THREE.SphereGeometry(.38, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), n * 2);
  tlLamps.setColorAt(0, new THREE.Color());
  crossings.forEach((cr, i) => {
    // столб на ближнем к машинам углу: вертикальная улица и горизонтальная
    for (let k = 0; k < 2; k++) {
      const x = cr.x + (k ? -1 : 1) * (cr.v.hw + 3), y = cr.y + (k ? 1 : -1) * (cr.h.hw + 3), j = i * 2 + k;
      const ty = gY(x, y);
      m.makeTranslation(X(x), ty, Z(y)); tlPoles.setMatrixAt(j, m);
      q.setFromAxisAngle(up, k ? Math.PI / 2 : 0);
      m.compose(new THREE.Vector3(X(x), ty + 13, Z(y)), q, one); tlHeads.setMatrixAt(j, m);
      for (let s = 0; s < 2; s++) { m.compose(new THREE.Vector3(X(x) + (k ? 0 : (s ? -.6 : .6)), ty + 13.9 - s * 1.8, Z(y) + (k ? (s ? -.6 : .6) : 0)), q, one); tlLamps.setMatrixAt(j * 2 + s, m); }
    }
  });
  for (const o of [tlPoles, tlHeads, tlLamps]) { o.castShadow = o !== tlLamps; o.frustumCulled = false; scene.add(o); }
  tlT = 0;
}
let tlT = 0;
const TL_COL = { g: new THREE.Color("#30ff60"), y: new THREE.Color("#ffc020"), r: new THREE.Color("#ff2a20"), off: new THREE.Color("#202020") };
function updateTrafficLights(dt) {
  if (!tlLamps) return; tlT -= dt; if (tlT > 0) return; tlT = .25;
  crossings.forEach((cr, i) => {
    for (let k = 0; k < 2; k++) {
      const st = lightFor(cr, k === 0), j = i * 2 + k;
      // верхняя лампа — красный/жёлтый, нижняя — зелёный
      tlLamps.setColorAt(j * 2, st === "g" ? TL_COL.off : TL_COL[st]);
      tlLamps.setColorAt(j * 2 + 1, st === "g" ? TL_COL.g : TL_COL.off);
    }
  });
  if (tlLamps.instanceColor) tlLamps.instanceColor.needsUpdate = true;
}

/* ---------- падение башни вбок ---------- */
const _tq = new THREE.Quaternion(), _tb = new THREE.Quaternion(), _tv = new THREE.Vector3(), _tu = new THREE.Vector3(0, 1, 0), _ta = new THREE.Vector3();
function animateTopple(b) {
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
  // во время падения сыплется мусор с фасада
  if (k < 1 && Math.random() < .5) { const hh = rnd(.3, 1) * b.h; addChunk(X(cx + ca * e) + ca * hh * Math.sin(th) + rnd(-6, 6), hh * Math.cos(th), Z(cy + sa * e) + sa * hh * Math.sin(th) + rnd(-6, 6), rnd(-6, 6), rnd(-4, 2), rnd(-6, 6), rnd(1.5, 4), facadeColor(b)); }
}
function fxToppleImpact(b) {
  const z = b.fallZone; if (!z) return;
  shake = Math.max(shake, 9 * clamp(1.4 - camDist() / 2000, .2, 1));
  for (let i = 0; i < 260 * fxK; i++) {
    const al = rnd(0, z.L), lat = rnd(-z.half, z.half), x = X(z.px + z.ca * al - z.sa * lat), zz = Z(z.py + z.sa * al + z.ca * lat);
    emit(PS_SMOKE, { x, y: rnd(2, 20), z: zz, vx: rnd(-25, 25), vy: rnd(4, 18), vz: rnd(-25, 25), l: rnd(6, 13), s0: rnd(14, 22), s1: rnd(50, 90), c: [.42, .39, .34], c1: [.5, .48, .44], a: .6, fadeIn: true, dr: .6 });
  }
  for (let i = 0; i < 60; i++) { const al = rnd(0, z.L); addChunk(X(z.px + z.ca * al) + rnd(-z.half, z.half), rnd(2, 12), Z(z.py + z.sa * al) + rnd(-z.half, z.half), rnd(-20, 20), rnd(8, 30), rnd(-20, 20), rnd(2, 6), Math.random() < .5 ? facadeColor(b) : "#7d7a73"); }
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
