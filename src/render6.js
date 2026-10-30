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
    if (!o) { o = buildLoader(); o.scale.setScalar(1.3); scene.add(o); machineObjs.set(m, o); }
    o.visible = !(m.carried && !m.onTruck); // ещё за краем карты
    o.position.set(X(m.x), gY(m.x, m.y) + (m.carried && m.onTruck ? 3.9 : 0), Z(m.y)); o.rotation.y = -m.ang;
    // ковш: черпает у земли, при погрузке поднимается над бортом и опрокидывается
    const ph = (m.workT || 0) / (m.loading ? 1.2 : 1.1), lift = m.loading ? .9 - Math.sin(Math.min(1, ph) * Math.PI) * .25 : m.bucket > 0 ? .5 + Math.sin(simT * 4) * .35 : .15;
    o.userData.arm.rotation.z = lift; o.userData.bucket.rotation.z = m.loading ? -lift * 1.3 + Math.sin(Math.min(1, ph) * Math.PI) * 1.4 : -lift * 1.3 + (m.bucket > 0 ? Math.sin(simT * 4 + 1) * .4 : 0);
  }
  for (const [m, o] of machineObjs) if (!machines.includes(m)) { scene.remove(o); machineObjs.delete(m); }
  // кузов самосвала, барабан бетономешалки, стрела эвакуатора
  for (const c of cars) {
    if (!c.service || !(c.service === "dump" || c.service === "mixer" || c.service === "tow" || c.service === "fire" || c.service === "plow")) continue;
    let o = carExtras.get(c);
    if (!o) {
      o = new THREE.Group();
      if (c.service === "dump") {
        const orange = new THREE.MeshStandardMaterial({ color: 0xd8761c, roughness: .55, metalness: .25 }), dark = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: .8 });
        const bed = new THREE.Group(); bed.position.set(-15, 4.2, 0); o.add(bed); // кузов качается вокруг задней оси
        addBox(bed, orange, 18, .8, 8.4, 9, .4, 0); addBox(bed, orange, 18, 4.2, .5, 9, 2.5, -4.2); addBox(bed, orange, 18, 4.2, .5, 9, 2.5, 4.2); addBox(bed, orange, .6, 4.6, 8.4, 17.7, 2.7, 0); addBox(bed, orange, .5, 3.6, 8.4, .4, 2.2, 0);
        for (const x of [4, 9, 14]) addBox(bed, orange, .5, 4.4, 9, x, 2.6, 0); // рёбра бортов
        const heap = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 7), new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 1 })); heap.position.set(9, 2.2, 0); heap.visible = false; bed.add(heap);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(.6, .7, 6, 8), steelMat); cyl.position.set(-2, 4.5, 0); cyl.rotation.z = .5; o.add(cyl);
        o.userData.bed = bed; o.userData.heap = heap;
      }
      if (c.service === "mixer") { const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 12, 14).rotateZ(Math.PI / 2 - .25), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: .5, metalness: .3 })); drum.position.set(-4, 9, 0); drum.castShadow = true; o.add(drum); const stripe = new THREE.Mesh(new THREE.TorusGeometry(3.9, .4, 6, 18).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd2552a })); stripe.position.set(-4, 9, 0); o.add(stripe); o.userData.drum = drum; o.userData.stripe = stripe; }
      if (c.service === "plow") { const blade = new THREE.MeshStandardMaterial({ color: 0xe8781c, roughness: .5, metalness: .4 }); const b = addBox(o, blade, 1.2, 3.6, 13, 12.5, 1.9, 0); b.rotation.y = .3; addBox(o, steelMat, 3, .8, 1, 10.5, 2.4, 2.5); addBox(o, steelMat, 3, .8, 1, 10.5, 2.4, -2.5); addBox(o, blade, 1.4, .8, 1.4, -2, 9.2, 0); } // отвал спереди и маячок
      if (c.service === "tow" && c.model !== "tow") { const boom = addBox(o, steelMat, 12, 1, 1, -9, 8, 0); boom.rotation.z = -.35; addBox(o, steelMat, 2, 6, 6, -6, 6, 0); }
      if (c.service === "fire" && c.model === "ladder") { const base = new THREE.Group(); base.position.set(-6, 7.2, 0); o.add(base); addBox(base, steelMat, 3, 1.4, 3, 0, 0, 0); const lad = new THREE.Group(); base.add(lad); const rail = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, metalness: .6, roughness: .4 }); for (const s of [-1, 1]) addBox(lad, rail, 22, .35, .35, 11, .6, s * 1.1); for (let x = 1; x < 22; x += 2.2) addBox(lad, rail, .3, .3, 2.2, x, .6, 0); const ext = new THREE.Group(); ext.position.set(10, .9, 0); lad.add(ext); for (const s of [-1, 1]) addBox(ext, rail, 20, .3, .3, 10, 0, s * .8); ext.scale.x = .3; o.userData.ladder = lad; o.userData.ext = ext; }
      const FM = CAR_MODELS[c.model]; if (FM && FM.fit) o.scale.set(1, FM.fit[0], FM.fit[1]);
      scene.add(o); carExtras.set(c, o);
    }
    o.visible = !c.gone;
    o.position.set(X(c.x), gY(c.x, c.y), Z(c.y)); o.rotation.set(c.tR || 0, -c.ang, c.tP || 0, "YXZ"); // наклон уже посчитан в updateCars
    if (o.userData.drum) { o.userData.drum.rotation.x += .05; o.userData.stripe.rotation.x = o.userData.drum.rotation.x; }
    if (o.userData.heap) { const k = Math.min(1, (c.load || 0) / DUMP_CAP); o.userData.heap.visible = k > 0; o.userData.heap.scale.y = Math.max(.25, k); o.userData.heap.position.y = 1.4 + 1.6 * k; }
    if (o.userData.ladder) { const up = c.deployed && c.job && c.job.b && c.job.b.fire > 0 && c.job.b.floors >= 3, L = o.userData.ladder, E = o.userData.ext; L.rotation.z += ((up ? -.95 : 0) - L.rotation.z) * .04; E.scale.x += ((up ? 1 : .3) - E.scale.x) * .04; }
  }
  if (carExtras.size) { const live = new Set(cars); for (const [c, o] of carExtras) if (c.gone || !live.has(c)) { scene.remove(o); carExtras.delete(c); } }
}
const carExtras = new Map();
// палатки вакцинации
const tentObjs = new Map();
