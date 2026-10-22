/* ---------- техника: погрузчик и навесное оборудование грузовиков ---------- */
const yellowMat = new THREE.MeshStandardMaterial({ color: 0xe8a81a, roughness: .55, metalness: .35 }), steelMat = new THREE.MeshStandardMaterial({ color: 0x55585b, roughness: .5, metalness: .7 }), tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .95 }), glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: .1, metalness: .6 });
function addBox(g, mat, sx, sy, sz, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
function buildLoader() {
  const g = new THREE.Group();
  addBox(g, yellowMat, 14, 4, 8, -1, 4.5, 0);
  addBox(g, yellowMat, 6, 5, 7, -6, 7.5, 0);
  addBox(g, glassMat, 5, 4, 7.2, 1, 9, 0);
  addBox(g, yellowMat, 5.6, .5, 7.6, 1, 11.2, 0);
  for (const [x, z] of [[-6, -4.4], [-6, 4.4], [5, -4.4], [5, 4.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 2.2, 14).rotateX(Math.PI / 2), tyreMat); w.position.set(x, 2.8, z); w.castShadow = true; g.add(w); }
  const arm = new THREE.Group(); arm.position.set(4, 6, 0); g.add(arm);
  addBox(arm, yellowMat, 10, 1.2, 1.2, 5, 0, -3); addBox(arm, yellowMat, 10, 1.2, 1.2, 5, 0, 3);
  const bucket = new THREE.Group(); bucket.position.set(10, 0, 0); arm.add(bucket);
  addBox(bucket, steelMat, 1, 4, 9.5, 1.5, -1.5, 0); addBox(bucket, steelMat, 3.5, .6, 9.5, 3, -3.3, 0);
  g.userData = { arm, bucket };
  return g;
}
const machineObjs = new Map();
function updateMachines() {
  for (const m of machines) {
    let o = machineObjs.get(m);
    if (!o) { o = buildLoader(); scene.add(o); machineObjs.set(m, o); }
    o.position.set(X(m.x), gY(m.x, m.y), Z(m.y)); o.rotation.y = -m.ang;
    const lift = m.bucket > 0 ? .5 + Math.sin(simT * 4) * .35 : .15;
    o.userData.arm.rotation.z = lift; o.userData.bucket.rotation.z = -lift * 1.3 + (m.bucket > 0 ? Math.sin(simT * 4 + 1) * .4 : 0);
  }
  for (const [m, o] of machineObjs) if (!machines.includes(m)) { scene.remove(o); machineObjs.delete(m); }
  // кузов самосвала, барабан бетономешалки, стрела эвакуатора
  for (const c of cars) {
    if (!c.service || !(c.service === "dump" || c.service === "mixer" || c.service === "tow")) continue;
    let o = carExtras.get(c);
    if (!o) {
      o = new THREE.Group();
      if (c.service === "dump") { const bed = new THREE.Group(); bed.position.set(-9, 5.6, 0); o.add(bed); addBox(bed, steelMat, 14, 4, 8, 7, 2, 0); o.userData.bed = bed; }
      if (c.service === "mixer") { const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 12, 14).rotateZ(Math.PI / 2 - .25), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: .5, metalness: .3 })); drum.position.set(-4, 9, 0); drum.castShadow = true; o.add(drum); const stripe = new THREE.Mesh(new THREE.TorusGeometry(3.9, .4, 6, 18).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd2552a })); stripe.position.set(-4, 9, 0); o.add(stripe); o.userData.drum = drum; o.userData.stripe = stripe; }
      if (c.service === "tow") { const boom = addBox(o, steelMat, 12, 1, 1, -9, 8, 0); boom.rotation.z = -.35; addBox(o, steelMat, 2, 6, 6, -6, 6, 0); }
      scene.add(o); carExtras.set(c, o);
    }
    o.visible = !c.gone;
    o.position.set(X(c.x), gY(c.x, c.y), Z(c.y)); o.rotation.y = -c.ang;
    if (o.userData.drum) { o.userData.drum.rotation.x += .05; o.userData.stripe.rotation.x = o.userData.drum.rotation.x; }
    if (o.userData.bed) o.userData.bed.rotation.z = c.deployed ? Math.min(.6, (o.userData.bed.rotation.z || 0) + .004) : Math.max(0, o.userData.bed.rotation.z - .02);
  }
  if (carExtras.size) { const live = new Set(cars); for (const [c, o] of carExtras) if (c.gone || !live.has(c)) { scene.remove(o); carExtras.delete(c); } }
}
const carExtras = new Map();
// палатки вакцинации
const tentObjs = new Map();
