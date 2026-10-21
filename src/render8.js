/* ---------- новые объекты: входы в метро, склады, плевки и кислота ---------- */
const metroObjs = [], depotObjs = new Map();
let metroKey = "";
function buildMetros() {
  for (const o of metroObjs) scene.remove(o); metroObjs.length = 0;
  const rail = new THREE.MeshStandardMaterial({ color: 0x8a8d8f, roughness: .5, metalness: .6 }), conc = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: .9 });
  const signTex = canvasTex(128, 128, g => { g.fillStyle = "#c81e1e"; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.font = "bold 92px Oswald, Arial, sans-serif"; g.textAlign = "center"; g.fillText("М", 64, 98); });
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: .35, side: THREE.DoubleSide });
  for (const m of metros) {
    const g = new THREE.Group(); g.position.set(X(m.x), gY(m.x, m.y), Z(m.y));
    // лестница вниз: тёмный провал, парапет, перила
    const hole = new THREE.Mesh(new THREE.BoxGeometry(10, .4, 5), new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 1 })); hole.position.set(0, .2, 0); g.add(hole);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.4, .6), conc); w.position.set(0, .7, s * 2.8); w.castShadow = true; g.add(w); const r = new THREE.Mesh(new THREE.BoxGeometry(10.5, .2, .2), rail); r.position.set(0, 3, s * 2.8); g.add(r); for (let k = -4; k <= 4; k += 4) { const p = new THREE.Mesh(new THREE.BoxGeometry(.2, 2, .2), rail); p.position.set(k, 2, s * 2.8); g.add(p); } }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, 9, 6), rail); post.position.set(-6.5, 4.5, 0); g.add(post);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), signMat); sign.position.set(-6.5, 9, 0); sign.rotation.y = Math.PI / 4; g.add(sign);
    scene.add(g); metroObjs.push(g);
  }
}
function buildDepot(d) {
  const g = new THREE.Group(); g.position.set(X(d.x), 0, Z(d.y));
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: .9 }), olive = new THREE.MeshStandardMaterial({ color: 0x4d5634, roughness: .8 });
  for (const [x, y, z, s] of [[-2, 1, -1.5, 2.2], [1, 1, -1, 2.2], [-.5, 3.1, -1.3, 2], [2.5, .9, 1.5, 1.8], [-2.5, .8, 1.8, 1.6], [0, .9, 2.4, 1.8]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * .9, s * .7), Math.random() < .5 ? wood : olive); b.position.set(x, y, z); b.rotation.y = rnd(-.3, .3); b.castShadow = b.receiveShadow = true; g.add(b); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 9, 5), new THREE.MeshStandardMaterial({ color: 0x333 })); pole.position.set(3.5, 4.5, -2.5); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshStandardMaterial({ color: 0xf2b33d, side: THREE.DoubleSide })); flag.position.set(5, 8, -2.5); g.add(flag);
  const tent = new THREE.Mesh(new THREE.BoxGeometry(9, .3, 7), new THREE.MeshStandardMaterial({ color: 0x5a6a44, roughness: .9, side: THREE.DoubleSide })); tent.position.set(0, 5.2, 0); tent.castShadow = true; g.add(tent);
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 5.2, 5), olive); p.position.set(x, 2.6, z); g.add(p); }
  g.userData.flag = flag; g.userData.crates = g.children.slice(0, 6);
  return g;
}
const ACID = [.55, 1.2, .2], ACID2 = [.2, .5, .05];
const meteorMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 1), new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: .9, emissive: 0xff6020, emissiveIntensity: .8 }));
meteorMesh.visible = false; scene.add(meteorMesh);
function updateMeteors(dt) {
  const m = meteors[0]; if (!m) { meteorMesh.visible = false; return; }
  const k = clamp(m.t / m.T), h = 900 * k * k, dx = 500 * k;
  meteorMesh.visible = true; meteorMesh.position.set(X(m.x) + dx, h, Z(m.y) + dx * .4); meteorMesh.rotation.x += dt * 3; meteorMesh.rotation.y += dt * 2;
  for (let i = 0; i < dt * 200; i++) emit(PS_ADD, { x: meteorMesh.position.x + rnd(-4, 4), y: h + rnd(-4, 4), z: meteorMesh.position.z + rnd(-4, 4), vx: rnd(-6, 6) + 40, vy: rnd(10, 30), vz: rnd(-6, 6) + 16, l: rnd(.4, 1), s0: rnd(8, 16), s1: 2, c: [2, 1.1, .4], c1: [.9, .2, .03], a: .9 });
  if (Math.random() < dt * 40) smokeParticle(meteorMesh.position.x, h, meteorMesh.position.z, 2.2);
  if (m.t < .3 && !m.flashed) { m.flashed = true; shake = Math.max(shake, 3); }
}
function updateExtras(dt) {
  updateMeteors(dt);
  const key = metros.map(m => m.x + ":" + m.y).join("|");
  if (key !== metroKey) { metroKey = key; buildMetros(); }
  for (const d of depots) { let o = depotObjs.get(d); if (!o) { o = buildDepot(d); o.position.y = hasHills ? gY(d.x, d.y) : 0; scene.add(o); depotObjs.set(d, o); } o.userData.flag.rotation.y = Math.sin(simT * 2) * .25; const k = clamp(d.ammo / d.max); o.userData.crates.forEach((c, i) => c.visible = i / 6 < k + .1); }
  for (const [d, o] of depotObjs) if (!depots.includes(d)) { scene.remove(o); depotObjs.delete(d); }
  if (!dt) return;
  // плевок летит дугой, кислота пузырится
  for (const s of spits) {
    const k = s.t / s.T, x = X(s.x + (s.tx - s.x) * k), z = Z(s.y + (s.ty - s.y) * k), y = 5 + Math.sin(k * Math.PI) * 10;
    for (let i = 0; i < dt * 120; i++) emit(PS_ADD, { x: x + rnd(-.4, .4), y: y + rnd(-.4, .4), z: z + rnd(-.4, .4), vx: rnd(-1, 1), vy: rnd(-2, 1), vz: rnd(-1, 1), l: rnd(.15, .4), s0: 2.2, s1: .5, c: ACID, a: .9 });
  }
  for (const ac of acids) {
    for (let i = 0; i < dt * 25; i++) { const a = rnd(0, TAU), r = rnd(0, ac.r); emit(PS_ADD, { x: X(ac.x + Math.cos(a) * r), y: .4, z: Z(ac.y + Math.sin(a) * r), vx: 0, vy: rnd(1, 4), vz: 0, l: rnd(.4, 1), s0: rnd(.8, 1.8), s1: .3, c: ACID, c1: ACID2, a: .7 }); }
    if (Math.random() < dt * 3) emit(PS_SMOKE, { x: X(ac.x), y: 1, z: Z(ac.y), vx: rnd(-1, 1), vy: 3, vz: rnd(-1, 1), l: 2, s0: 3, s1: 9, c: [.45, .6, .3], a: .25, fadeIn: true });
  }
}
