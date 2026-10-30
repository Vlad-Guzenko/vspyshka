/* ---------- ловушки, генераторы, КПП, флаги фракций, инфраструктура ---------- */
const trapObjs = new Map(), genObjs = new Map(), cpObjs = new Map(), facObjs = new Map(), medObjs = new Map();
const steelDark = new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: .6, roughness: .5 }), redMat = new THREE.MeshStandardMaterial({ color: 0xa83020, roughness: .6, metalness: .3 }), wireMat = new THREE.LineBasicMaterial({ color: 0x9a9a8a });
function buildFlag(f) {
  const hb = buildings[f.hq]; if (!hb) return null;
  const g = new THREE.Group(); const x = hb.door ? hb.door[0] : (hb.x0 + hb.x1) / 2, y = hb.door ? hb.door[1] : (hb.y0 + hb.y1) / 2;
  g.position.set(X(x) + 4, 0, Z(y) + 4);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 22, 6), steelDark); mast.position.y = 11; g.add(mast);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.6), new THREE.MeshStandardMaterial({ color: FKIND[f.kind].col, side: THREE.DoubleSide })); flag.position.set(3, 19.5, 0); g.add(flag); g.userData.flag = flag;
  return g;
}
function updateWorld2(dt) {
  for (const t of traps) if (!trapObjs.has(t)) { const o = buildTrapMesh(t); scene.add(o); trapObjs.set(t, o); }
  for (const [t, o] of trapObjs) { if (!traps.includes(t)) { scene.remove(o); trapObjs.delete(t); continue; } if (o.userData.blink) o.userData.blink.visible = (simT * 2) % 1 < .5 && t.arm <= 0; }
  for (const gn of gens) if (!genObjs.has(gn)) { const o = buildGenMesh(gn); scene.add(o); genObjs.set(gn, o); }
  for (const [gn, o] of genObjs) { if (!gens.includes(gn)) { scene.remove(o); genObjs.delete(gn); continue; } o.userData.lamp.material.color.set(gn.fuel > 0 ? 0x40ff60 : 0x602020); if (dt && gn.fuel > 0 && Math.random() < dt * 8) smokeParticle(o.position.x - 1.8, 5, o.position.z + .8, .35, false); }
  for (const cp of cps) if (!cpObjs.has(cp)) { const o = buildCpMesh(cp); scene.add(o); cpObjs.set(cp, o); }
  for (const [cp, o] of cpObjs) { if (!cps.includes(cp)) { scene.remove(o); cpObjs.delete(cp); continue; } if (cp.road) { updateRoadPostMesh(cp, o, dt); continue; } const open = cp.broken; o.userData.bar.rotation.z = open ? 1.2 : 0; o.userData.stripes.visible = !open; }
  for (const m of medpoints) if (!medObjs.has(m)) { const o = buildMedMesh(m); scene.add(o); medObjs.set(m, o); }
  for (const [m, o] of medObjs) if (!medpoints.includes(m)) { scene.remove(o); medObjs.delete(m); }
  for (const f of factions) if (!facObjs.has(f)) { const o = buildFlag(f); if (o) { scene.add(o); facObjs.set(f, o); } }
  for (const [f, o] of facObjs) { if (!factions.includes(f)) { scene.remove(o); facObjs.delete(f); continue; } o.userData.flag.rotation.y = Math.sin(simT * 2 + f.id) * .3; }
  // искры на электрозаборе
  if (dt) for (const a of agents) if (a.zapT > 0) { a.zapT -= dt; for (let i = 0; i < dt * 60; i++) emit(PS_ADD, { x: X(a.x) + rnd(-2, 2), y: rnd(1, 6), z: Z(a.y) + rnd(-2, 2), vx: rnd(-8, 8), vy: rnd(2, 12), vz: rnd(-8, 8), l: rnd(.1, .3), s0: 1.5, s1: .3, c: [1.4, 1.6, 2.2], a: 1, g: 30 }); }
}
// инфраструктура: трубы электростанции, баки водонасосной, мачта радиовышки
function decorateInfra(b, obj, w, d) {
  if (b.kind === "power") { for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 42, 12), parapetMat); ch.position.set(s * w * .25, b.h + 21, -d * .2); ch.castShadow = true; ch.userData.chim = 2; obj.add(ch); } b.chimneys = true; }
  if (b.kind === "water") { for (const [x, z] of [[-w * .28, d * .25], [w * .28, d * .25]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x7fa7c7, metalness: .4, roughness: .4 })); t.position.set(x, b.h + 8, z); t.castShadow = true; obj.add(t); } }
  if (b.kind === "radio") { const mast = new THREE.Mesh(new THREE.CylinderGeometry(.4, 1.6, 110, 6), new THREE.MeshStandardMaterial({ color: 0xc8c8c0, metalness: .6, roughness: .4 })); mast.position.set(0, b.h + 55, 0); mast.castShadow = true; obj.add(mast); for (let i = 1; i <= 4; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2 + i * .6, .12, 6, 16).rotateX(Math.PI / 2), parapetMat); ring.position.set(0, b.h + 10 + i * 22, 0); obj.add(ring); } const top = new THREE.Mesh(new THREE.SphereGeometry(.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); top.position.set(0, b.h + 110, 0); obj.add(top); b.beacon = top; }
}
