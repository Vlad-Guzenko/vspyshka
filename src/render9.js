/* ---------- стройка на экране: вышки, прожекторы, лагеря, сброс припасов, выделение отряда ---------- */
const towerObjs = new Map(), floodObjs = new Map(), campObjs = new Map(), dropObjs = new Map();
const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: .9 }), tarpMat = new THREE.MeshStandardMaterial({ color: 0x4d5634, roughness: .9 }), canvasMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: .9, side: THREE.DoubleSide });
function buildTowerMesh(t) {
  const g = new THREE.Group(); g.position.set(X(t.x), 0, Z(t.y));
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1, t.h, 1), woodMat); leg.position.set(x, t.h / 2, z); leg.castShadow = true; g.add(leg); }
  for (let y = 5; y < t.h - 2; y += 6) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(10.5, .6, .6), woodMat); b.position.set(0, y, s * 5); g.add(b); const b2 = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, 10.5), woodMat); b2.position.set(s * 5, y, 0); g.add(b2); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13, .8, 13), woodMat); deck.position.y = t.h - .4; deck.castShadow = deck.receiveShadow = true; g.add(deck);
  for (const [x, z, sx, sz] of [[0, -6.3, 13, .5], [0, 6.3, 13, .5], [-6.3, 0, .5, 13], [6.3, 0, .5, 13]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 3.4, sz), tarpMat); r.position.set(x, t.h + 1.7, z); g.add(r); }
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.6, 9, .6), woodMat); p.position.set(x, t.h + 4.5, z); g.add(p); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10.5, 4.5, 4).rotateY(Math.PI / 4), tarpMat); roof.position.y = t.h + 11; roof.castShadow = true; g.add(roof);
  return g;
}
const floodCone = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function buildFloodMesh(f) {
  const g = new THREE.Group(); g.position.set(X(f.x), 0, Z(f.y));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.4, .6, 26, 8), new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: .5, roughness: .5 })); pole.position.y = 13; pole.castShadow = true; g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x4a4d50, emissive: 0xfff1c0, emissiveIntensity: 0 })); head.position.y = 26.5; g.add(head); g.userData.head = head;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(70, 27, 24, 1, true).rotateX(Math.PI), floodCone.clone()); cone.position.y = 13; g.add(cone); g.userData.cone = cone;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); pool.position.y = .3; pool.renderOrder = 2; g.add(pool); g.userData.pool = pool;
  return g;
}
function buildCampMesh(c) {
  const g = new THREE.Group(); g.position.set(X(c.x), 0, Z(c.y));
  for (const [x, z, rot] of [[-18, 8, .3], [18, 10, -.4], [-6, -20, 1.2], [14, -14, 2.1]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0, 9, 8, 4, 1).rotateY(Math.PI / 4), canvasMat); t.position.set(x, 4, z); t.rotation.y = rot; t.castShadow = true; g.add(t);
  }
  const fire = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, .8, 10), new THREE.MeshStandardMaterial({ color: 0x55504a })); fire.position.set(0, .4, 6); g.add(fire); g.userData.fire = fire;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), new THREE.MeshStandardMaterial({ color: 0xf2b33d, side: THREE.DoubleSide })); flag.position.set(2, 16, -c.r + 4); g.add(flag);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 18, 6), woodMat); mast.position.set(0, 9, -c.r + 4); g.add(mast);
  return g;
}
function buildDropMesh() {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: .9 })); crate.position.y = 2.5; crate.castShadow = true; g.add(crate);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide, roughness: .9 })); canopy.position.y = 24; g.add(canopy); g.userData.canopy = canopy;
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; const line = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 20, 3), new THREE.MeshBasicMaterial({ color: 0xdddddd })); line.position.set(Math.cos(a) * 5, 14, Math.sin(a) * 5); line.rotation.z = Math.cos(a) * .35; line.rotation.x = -Math.sin(a) * .35; g.add(line); g.userData["l" + i] = line; }
  return g;
}
const selMarks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: .9, color: 0x4fe0ff, toneMapped: false }), 400);
selMarks.count = 0; selMarks.frustumCulled = false; selMarks.renderOrder = 3; scene.add(selMarks);
const orderRing = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fe0ff, transparent: true, depthWrite: false, toneMapped: false })); orderRing.visible = false; orderRing.renderOrder = 4; scene.add(orderRing);
const selBox = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3].map(() => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0x4fe0ff, toneMapped: false })); selBox.visible = false; selBox.renderOrder = 8; scene.add(selBox);
const _sm = new THREE.Matrix4();
function updateBuild(dt) {
  for (const t of towers) if (!towerObjs.has(t)) { const o = buildTowerMesh(t); scene.add(o); towerObjs.set(t, o); }
  for (const [t, o] of towerObjs) if (!towers.includes(t)) { scene.remove(o); towerObjs.delete(t); }
  for (const f of floods) if (!floodObjs.has(f)) { const o = buildFloodMesh(f); scene.add(o); floodObjs.set(f, o); }
  for (const [f, o] of floodObjs) { if (!floods.includes(f)) { scene.remove(o); floodObjs.delete(f); continue; } const k = nightK * (f.on ? 1 : 0); o.userData.head.material.emissiveIntensity = k * 4; o.userData.cone.material.opacity = k * .07; o.userData.pool.material.opacity = k * .75; }
  for (const c of camps) if (!campObjs.has(c)) { const o = buildCampMesh(c); scene.add(o); campObjs.set(c, o); }
  for (const [c, o] of campObjs) { if (!camps.includes(c)) { scene.remove(o); campObjs.delete(c); continue; } if (dt && nightK > .3) { const f = o.userData.fire; for (let i = 0; i < dt * 25; i++) fireParticle(f.position.x + o.position.x, 1, f.position.z + o.position.z, .45); } }
  for (const d of drops) {
    let o = dropObjs.get(d); if (!o) { o = buildDropMesh(); scene.add(o); dropObjs.set(d, o); }
    const k = clamp(d.t / d.T), h = 320 * k; o.position.set(X(d.x) + Math.sin(simT * 1.3) * 3, h, Z(d.y) + Math.cos(simT * 1.1) * 3); o.rotation.z = Math.sin(simT * 1.5) * .08;
    o.userData.canopy.visible = d.t > 0; for (let i = 0; i < 4; i++) o.userData["l" + i].visible = d.t > 0;
  }
  for (const [d, o] of dropObjs) if (!drops.includes(d)) { scene.remove(o); dropObjs.delete(d); }
  // выделенные бойцы и точка приказа
  let n = 0;
  for (const a of selected) { if (n >= 400) break; _sm.makeScale(8 + Math.sin(simT * 5) * .5, 1, 8 + Math.sin(simT * 5) * .5).setPosition(X(a.x), .3 + (a.onRoof ? a.roofZ : 0), Z(a.y)); selMarks.setMatrixAt(n++, _sm); }
  selMarks.count = n; selMarks.instanceMatrix.needsUpdate = true;
  orderRing.visible = !!(orderMark && simT - orderMark.t < 6);
  if (orderRing.visible) { orderRing.position.set(X(orderMark.x), .4, Z(orderMark.y)); orderRing.scale.setScalar(1 + (simT - orderMark.t) * .15); orderRing.material.opacity = clamp(1 - (simT - orderMark.t) / 6); }
}
