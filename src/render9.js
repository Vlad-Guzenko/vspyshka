/* ---------- стройка на экране: вышки, прожекторы, лагеря, сброс припасов, выделение отряда ---------- */
const towerObjs = new Map(), floodObjs = new Map(), campObjs = new Map(), dropObjs = new Map();
const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: .9 }), tarpMat = new THREE.MeshStandardMaterial({ color: 0x4d5634, roughness: .9 }), canvasMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: .9, side: THREE.DoubleSide });
const floodCone = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function buildFloodMesh(f) {
  const g = new THREE.Group(); g.position.set(X(f.x), 0, Z(f.y));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.4, .6, 26, 8), new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: .5, roughness: .5 })); pole.position.y = 13; pole.castShadow = true; g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x4a4d50, emissive: 0xfff1c0, emissiveIntensity: 0 })); head.position.y = 26.5; g.add(head); g.userData.head = head;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(70, 27, 24, 1, true).rotateX(Math.PI), floodCone.clone()); cone.position.y = 13; g.add(cone); g.userData.cone = cone;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); pool.position.y = .3; pool.renderOrder = 2; g.add(pool); g.userData.pool = pool;
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
