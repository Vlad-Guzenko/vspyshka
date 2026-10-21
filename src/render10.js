/* ---------- ловушки, генераторы, КПП, флаги фракций, инфраструктура ---------- */
const trapObjs = new Map(), genObjs = new Map(), cpObjs = new Map(), facObjs = new Map();
const steelDark = new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: .6, roughness: .5 }), redMat = new THREE.MeshStandardMaterial({ color: 0xa83020, roughness: .6, metalness: .3 }), wireMat = new THREE.LineBasicMaterial({ color: 0x9a9a8a });
function buildTrapMesh(t) {
  const g = new THREE.Group();
  if (t.k === "mine") { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, .7, 12), steelDark); m.position.set(X(t.x), .35, Z(t.y)); g.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .4, 8), new THREE.MeshBasicMaterial({ color: 0xff3030 })); b.position.set(X(t.x), .8, Z(t.y)); g.add(b); g.userData.blink = b; }
  else if (t.k === "wire") { for (const [x, y] of [[t.x, t.y], [t.x2, t.y2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 2.4, 6), steelDark); p.position.set(X(x), 1.2, Z(y)); g.add(p); } const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X(t.x), 1.1, Z(t.y)), new THREE.Vector3(X(t.x2), 1.1, Z(t.y2))]), wireMat); g.add(line); }
  else if (t.k === "barrel") { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 12), redMat); b.position.set(X(t.x), 1.8, Z(t.y)); b.castShadow = true; g.add(b); for (const y of [.9, 2.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.32, .08, 6, 16).rotateX(Math.PI / 2), steelDark); r.position.set(X(t.x), y, Z(t.y)); g.add(r); } }
  return g;
}
function buildGenMesh(gn) {
  const g = new THREE.Group(); g.position.set(X(gn.x), 0, Z(gn.y));
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 3), new THREE.MeshStandardMaterial({ color: 0xe8b81a, roughness: .5, metalness: .3 })); body.position.y = 1.5; body.castShadow = true; g.add(body);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 2, 6), steelDark); pipe.position.set(-1.8, 3.8, .8); g.add(pipe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40ff60 })); lamp.position.set(2, 3.2, 0); g.add(lamp); g.userData.lamp = lamp;
  return g;
}
function buildCpMesh(cp) {
  const g = new THREE.Group();
  // палатка-изолятор и шлагбаум
  const tent = new THREE.Mesh(new THREE.CylinderGeometry(0, 7, 6, 4, 1).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: .9 })); tent.position.set(X(cp.tent[0]), 3, Z(cp.tent[1])); tent.castShadow = true; g.add(tent);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, gg => { gg.fillStyle = "#d42020"; gg.fillRect(22, 6, 20, 52); gg.fillRect(6, 22, 52, 20); }), transparent: true })); cross.position.set(X(cp.tent[0]), 3.2, Z(cp.tent[1]) + 3.6); g.add(cross);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(cp.v ? 14 : .4, .4, cp.v ? .4 : 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 })); bar.position.set(X(cp.x), 3, Z(cp.y)); g.add(bar); g.userData.bar = bar;
  const stripes = new THREE.Mesh(new THREE.BoxGeometry(cp.v ? 14.2 : .5, .2, cp.v ? .5 : 14.2), new THREE.MeshStandardMaterial({ color: 0xd42020 })); stripes.position.set(X(cp.x), 3.15, Z(cp.y)); g.add(stripes); g.userData.stripes = stripes;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 3.2, 6), steelDark); p.position.set(X(cp.x) + (cp.v ? s * 7 : 0), 1.6, Z(cp.y) + (cp.v ? 0 : s * 7)); g.add(p); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshStandardMaterial({ map: canvasTex(256, 80, gg => { gg.fillStyle = "#1d3566"; gg.fillRect(0, 0, 256, 80); gg.fillStyle = "#fff"; gg.font = "bold 44px Oswald, Arial Narrow, sans-serif"; gg.textAlign = "center"; gg.fillText("КПП · СТОП", 128, 56); }), side: THREE.DoubleSide })); sign.position.set(X(cp.x) + (cp.v ? 8 : 0), 7, Z(cp.y) + (cp.v ? 0 : 8)); if (!cp.v) sign.rotation.y = Math.PI / 2; g.add(sign);
  return g;
}
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
  for (const [cp, o] of cpObjs) { if (!cps.includes(cp)) { scene.remove(o); cpObjs.delete(cp); continue; } const open = cp.broken; o.userData.bar.rotation.z = cp.v ? (open ? 1.2 : 0) : 0; o.userData.bar.rotation.x = cp.v ? 0 : (open ? -1.2 : 0); o.userData.stripes.visible = !open; }
  for (const f of factions) if (!facObjs.has(f)) { const o = buildFlag(f); if (o) { scene.add(o); facObjs.set(f, o); } }
  for (const [f, o] of facObjs) { if (!factions.includes(f)) { scene.remove(o); facObjs.delete(f); continue; } o.userData.flag.rotation.y = Math.sin(simT * 2 + f.id) * .3; }
  // искры на электрозаборе
  if (dt) for (const a of agents) if (a.zapT > 0) { a.zapT -= dt; for (let i = 0; i < dt * 60; i++) emit(PS_ADD, { x: X(a.x) + rnd(-2, 2), y: rnd(1, 6), z: Z(a.y) + rnd(-2, 2), vx: rnd(-8, 8), vy: rnd(2, 12), vz: rnd(-8, 8), l: rnd(.1, .3), s0: 1.5, s1: .3, c: [1.4, 1.6, 2.2], a: 1, g: 30 }); }
}
// инфраструктура: трубы электростанции, баки водонасосной, мачта радиовышки
function decorateInfra(b, obj, w, d) {
  if (b.kind === "power") { for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 42, 12), parapetMat); ch.position.set(s * w * .25, b.h + 21, -d * .2); ch.castShadow = true; obj.add(ch); } b.chimneys = true; }
  if (b.kind === "water") { for (const [x, z] of [[-w * .28, d * .25], [w * .28, d * .25]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 16, 16), new THREE.MeshStandardMaterial({ color: 0x7fa7c7, metalness: .4, roughness: .4 })); t.position.set(x, b.h + 8, z); t.castShadow = true; obj.add(t); } }
  if (b.kind === "radio") { const mast = new THREE.Mesh(new THREE.CylinderGeometry(.4, 1.6, 110, 6), new THREE.MeshStandardMaterial({ color: 0xc8c8c0, metalness: .6, roughness: .4 })); mast.position.set(0, b.h + 55, 0); mast.castShadow = true; obj.add(mast); for (let i = 1; i <= 4; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2 + i * .6, .12, 6, 16).rotateX(Math.PI / 2), parapetMat); ring.position.set(0, b.h + 10 + i * 22, 0); obj.add(ring); } const top = new THREE.Mesh(new THREE.SphereGeometry(.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); top.position.set(0, b.h + 110, 0); obj.add(top); b.beacon = top; }
}
