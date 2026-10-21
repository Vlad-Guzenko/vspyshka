/* ---------- сооружения покрасивее: лагерь, КПП, вышка, склад, медпункт, вакцинация, генератор, бочки ---------- */
// треугольная палатка-«домик»: конёк вдоль x, длина L, ширина Wd, высота Hh
function prismGeo(L, Wd, Hh) {
  const hx = L / 2, hz = Wd / 2, A = [-hx, 0, -hz], B = [hx, 0, -hz], C = [hx, Hh, 0], D = [-hx, Hh, 0], E = [-hx, 0, hz], F = [hx, 0, hz];
  const tri = [[A, C, B], [A, D, C], [E, F, C], [E, C, D], [A, E, D], [B, C, F]];
  const uvs = [[[0, 0], [1, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 1], [0, 1]], [[0, 0], [1, 0], [.5, 1]], [[0, 0], [.5, 1], [1, 0]]];
  const pos = [], uv = [];
  tri.forEach((t, i) => { for (let k = 0; k < 3; k++) { pos.push(...t[k]); uv.push(...uvs[i][k]); } });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
function blotches(g, w, h, cols, n, r0, r1) { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(r0, r1), rnd(r0 * .6, r1 * .8), rnd(0, 3), 0, TAU); g.fill(); } }
const camoTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#4d5634"; g.fillRect(0, 0, w, h); blotches(g, w, h, ["#3b4428", "#5f6a3e", "#2f3522", "#6b7148"], 40, 8, 22); noiseOn(g, w, h, 500, .06); });
const canvasWhiteTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#ebe9e0"; g.fillRect(0, 0, w, h); noiseOn(g, w, h, 700, .05); g.strokeStyle = "rgba(0,0,0,.08)"; g.lineWidth = 2; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } dirtOn(g, w, h, .18); });
const crossTentTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#ebe9e0"; g.fillRect(0, 0, w, h); noiseOn(g, w, h, 500, .05); g.fillStyle = "#d42020"; g.fillRect(w / 2 - 10, h / 2 - 30, 20, 60); g.fillRect(w / 2 - 30, h / 2 - 10, 60, 20); dirtOn(g, w, h, .15); });
const woodTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#7a5a36"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = `rgba(0,0,0,${rnd(.05, .2)})`; g.fillRect(0, y, w, 2); g.fillStyle = `rgba(255,220,160,${rnd(.03, .1)})`; g.fillRect(0, y + rnd(3, 12), w, 1); } noiseOn(g, w, h, 300, .08); });
const crateTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#4f5a36"; g.fillRect(0, 0, w, h); noiseOn(g, w, h, 500, .06); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = "rgba(240,240,230,.85)"; g.font = "bold 20px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("ПАТРОНЫ", w / 2, 50); g.font = "bold 16px Oswald, Arial Narrow, sans-serif"; g.fillText("5,45 × 39", w / 2, 74); g.fillText("1080 ШТ", w / 2, 94); });
const barrelTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#a83020"; g.fillRect(0, 0, w, h); noiseOn(g, w, h, 500, .07); rustOn(g, w, h, 5); g.fillStyle = "rgba(250,240,220,.85)"; g.font = "bold 18px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("ОГНЕОПАСНО", w / 2, 60); g.fillText("БЕНЗИН", w / 2, 82); g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); dirtOn(g, w, h, .3); });
const vacBannerTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = "#f4f1e8"; g.fillRect(0, 0, w, h); g.fillStyle = "#1d7a4a"; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8); g.fillStyle = "#1d7a4a"; g.font = "bold 34px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("ВАКЦИНАЦИЯ", w / 2, 44); });
const medBannerTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = "#f4f1e8"; g.fillRect(0, 0, w, h); g.fillStyle = "#d42020"; g.fillRect(8, 16, 32, 32); g.fillStyle = "#f4f1e8"; g.fillRect(20, 20, 8, 24); g.fillRect(12, 28, 24, 8); g.fillStyle = "#b81e1e"; g.font = "bold 32px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("МЕДПУНКТ", w / 2 + 16, 44); });
const stopSignTex = canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#c81e1e"; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; g.lineTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60); } g.closePath(); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 5; g.stroke(); g.fillStyle = "#fff"; g.font = "bold 40px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("СТОП", w / 2, h / 2 + 14); });
const campSignTex = canvasTex(256, 80, (g, w, h) => { g.fillStyle = "#4d5634"; g.fillRect(0, 0, w, h); g.strokeStyle = "#e8e2c8"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = "#e8e2c8"; g.font = "bold 36px Oswald, Arial Narrow, sans-serif"; g.textAlign = "center"; g.fillText("ЛАГЕРЬ · ВХОД", w / 2, 52); });
const camoMat = new THREE.MeshStandardMaterial({ map: camoTex, roughness: .95, side: THREE.DoubleSide }), whiteCanvasMat = new THREE.MeshStandardMaterial({ map: canvasWhiteTex, roughness: .9, side: THREE.DoubleSide }), crossTentMat = new THREE.MeshStandardMaterial({ map: crossTentTex, roughness: .9, side: THREE.DoubleSide });
const plankMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: .9 }), crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: .9 }), sandbagMat = new THREE.MeshStandardMaterial({ map: texSand, roughness: .95 }), steelMat2 = new THREE.MeshStandardMaterial({ color: 0x4a4d50, metalness: .5, roughness: .5 }), ropeMat = new THREE.LineBasicMaterial({ color: 0xcfc5a8 });
const coneMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: .7 }), coneWhite = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: .7 });
const stripeTex = canvasTex(128, 16, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = "#e8e8e8"; g.fillRect(x, 0, 16, h); g.fillStyle = "#d42020"; g.fillRect(x + 16, 0, 16, h); } });
stripeTex.wrapS = THREE.RepeatWrapping;
// палатка-домик с растяжками и колышками
function ridgeTent(L, Wd, Hh, mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(prismGeo(L, Wd, Hh), mat); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pts.push(new THREE.Vector3(sx * L / 2, Hh, 0), new THREE.Vector3(sx * (L / 2 + 2.5), 0, sz * (Wd / 2 + 2))); const peg = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .8, 4), steelMat2); peg.position.set(sx * (L / 2 + 2.5), .3, sz * (Wd / 2 + 2)); g.add(peg); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(Wd * .35, Hh * .8), new THREE.MeshStandardMaterial({ color: 0x1c1d18, roughness: 1 })); flap.position.set(L / 2 + .05, Hh * .4, 0); flap.rotation.y = Math.PI / 2; g.add(flap);
  return g;
}
// кольцо или дуга из мешков с песком
function sandbagArc(r, a0, a1, h = 2.2) {
  const g = new THREE.Group(); const n = Math.max(3, Math.round((a1 - a0) * r / 3.2));
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, 1.6), sandbagMat); m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); m.rotation.y = -a; m.castShadow = true; g.add(m); }
  return g;
}
function trafficCone(x, z) { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(.6, 2, 8), coneMat); c.position.y = 1; g.add(c); const ring = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .3, 8), coneWhite); ring.position.y = 1.1; g.add(ring); const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, .15, 1.4), new THREE.MeshStandardMaterial({ color: 0x222 })); base.position.y = .07; g.add(base); g.position.set(x, 0, z); return g; }
function signBoard(tex, w, h, x, y, z, rotY) { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, y, 6), steelMat2); post.position.y = y / 2; g.add(post); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, roughness: .6 })); s.position.y = y + h / 2; g.add(s); g.position.set(x, 0, z); g.rotation.y = rotY || 0; return g; }
function crates(g, list) { const out = []; for (const [x, y, z, s] of list) { const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * .7, s * .8), crateMat); b.position.set(x, y, z); b.rotation.y = rnd(-.3, .3); b.castShadow = b.receiveShadow = true; g.add(b); out.push(b); } return out; }

/* лагерь: палатки, костёр с камнями и брёвнами, бочки с водой, ящики, мешки у ворот, табличка */
function buildCampMesh(c) {
  const g = new THREE.Group(); g.position.set(X(c.x), 0, Z(c.y));
  for (const [x, z, rot] of [[-20, 6, .2], [20, 8, -.3], [-8, -22, 1.4], [16, -16, 1.9], [-26, -10, .6]]) { const t = ridgeTent(12, 8, 5, camoMat); t.position.set(x, 0, z); t.rotation.y = rot; g.add(t); }
  const fire = new THREE.Group(); fire.position.set(0, 0, 6);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; const st = new THREE.Mesh(new THREE.SphereGeometry(rnd(.6, .9), 6, 5), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 1 })); st.position.set(Math.cos(a) * 3.2, .4, Math.sin(a) * 3.2); fire.add(st); }
  for (const r of [0, 1.1, 2.2]) { const log = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0x2a1f14 })); log.rotation.z = Math.PI / 2; log.rotation.y = r; log.position.y = .5; fire.add(log); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; const stump = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1, 1.4, 7), plankMat); stump.position.set(Math.cos(a) * 6, .7, Math.sin(a) * 6); stump.castShadow = true; fire.add(stump); }
  g.add(fire); g.userData.fire = fire;
  for (const [x, z] of [[8, 24], [10.6, 24], [9.3, 26.4]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3, 10), new THREE.MeshStandardMaterial({ color: 0x3a6fa8, roughness: .6 })); b.position.set(x, 1.5, z); b.castShadow = true; g.add(b); }
  crates(g, [[-14, 1, 22, 2.6], [-11, 1, 22.5, 2.4], [-12.5, 2.8, 22, 2.2]]);
  const r = c.r - 6;
  for (const sx of [-1, 1]) { const arc = sandbagArc(5, sx < 0 ? Math.PI * .5 : Math.PI * 1.5, sx < 0 ? Math.PI * 1.5 : Math.PI * 2.5); arc.position.set(sx * 15, 0, r - 1); g.add(arc); }
  for (const sx of [-1, 1]) g.add(trafficCone(sx * 8, c.r + 4));
  g.add(signBoard(campSignTex, 9, 2.8, 12, 5, c.r + 3, 0));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 22, 6), steelMat2); mast.position.set(0, 11, -c.r + 6); g.add(mast);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), new THREE.MeshStandardMaterial({ color: 0xf2b33d, side: THREE.DoubleSide })); flag.position.set(2.5, 19.5, -c.r + 6); g.add(flag); g.userData.flag = flag;
  for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.9 + i * .4, .06, 5, 12).rotateX(Math.PI / 2), steelMat2); ring.position.set(0, 21 - i * 1.6, -c.r + 6); g.add(ring); }
  const net = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), camoMat.clone()); net.material.transparent = true; net.material.opacity = .85; net.position.set(-14, 6.5, 2); net.rotation.x = -Math.PI / 2 + .25; g.add(net);
  for (const [x, z] of [[-21, -3], [-7, -3], [-21, 7], [-7, 7]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 6.5, 5), plankMat); p.position.set(x, 3.2, z); g.add(p); }
  return g;
}
/* КПП: будка, шлагбаум с противовесом, мешки, конусы, знак «СТОП», палатка-изолятор с крестом, маячок */
function buildCpMesh(cp) {
  const g = new THREE.Group(); g.position.set(X(cp.x), 0, Z(cp.y)); g.rotation.y = cp.v ? 0 : Math.PI / 2;
  // в локальных координатах проход идёт вдоль z, барьер вдоль x
  const booth = new THREE.Group(); booth.position.set(9.5, 0, 3);
  const bb = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: .7 })); bb.position.y = 2.5; bb.castShadow = true; booth.add(bb);
  const win = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.6, 4.1), new THREE.MeshStandardMaterial({ color: 0x5a7fa0, metalness: .3, roughness: .2 })); win.position.y = 3.3; booth.add(win);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5, .4, 5), new THREE.MeshStandardMaterial({ color: 0x3a4a5a })); roof.position.y = 5.2; booth.add(roof);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa000 })); beacon.position.y = 5.9; booth.add(beacon); g.userData.beacon = beacon;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.2, .6, 4.2), new THREE.MeshStandardMaterial({ map: stripeTex })); stripe.position.y = 1; booth.add(stripe);
  g.add(booth);
  const pivot = new THREE.Mesh(new THREE.BoxGeometry(1, 3.4, 1), steelMat2); pivot.position.set(7.5, 1.7, 0); g.add(pivot);
  const bar = new THREE.Group(); bar.position.set(7.5, 3.2, 0);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 15, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ map: stripeTex.clone() })); arm.material.map.repeat.set(4, 1); arm.position.x = -7.5; bar.add(arm);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x222 })); cw.position.x = 1.4; bar.add(cw);
  g.add(bar); g.userData.bar = bar; g.userData.stripes = arm;
  const rest = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, 3, 6), steelMat2); rest.position.set(-7.2, 1.5, 0); g.add(rest);
  for (const sx of [-1, 1]) { const arc = sandbagArc(4, 0, Math.PI, 2); arc.position.set(sx * 12, 0, -3); arc.rotation.y = sx < 0 ? 0 : 0; g.add(arc); }
  for (const [x, z] of [[-4, -9], [4, -9], [-2, -14], [2, -14]]) g.add(trafficCone(x, z));
  g.add(signBoard(stopSignTex, 3.2, 3.2, -9.5, 4, -8, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshStandardMaterial({ map: canvasTex(256, 80, gg => { gg.fillStyle = "#1d3566"; gg.fillRect(0, 0, 256, 80); gg.fillStyle = "#fff"; gg.font = "bold 44px Oswald, Arial Narrow, sans-serif"; gg.textAlign = "center"; gg.fillText("КПП · ПРОВЕРКА", 128, 56); }), side: THREE.DoubleSide })); sign.position.set(0, 7.5, -1); g.add(sign);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 9, 6), steelMat2); p.position.set(sx * 5.2, 4.5, -1); g.add(p); }
  // изолятор: белая палатка с крестом, обнесённая лентой
  const tx = cp.v ? cp.tent[0] - cp.x : cp.tent[1] - cp.y, tz = cp.v ? cp.tent[1] - cp.y : -(cp.tent[0] - cp.x);
  const iso = ridgeTent(14, 10, 6, crossTentMat); iso.position.set(tx, 0, tz); iso.rotation.y = Math.PI / 2; g.add(iso);
  const tapePts = []; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4, a2 = (i + 1) / 4 * TAU + Math.PI / 4; const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 2.6, 5), steelMat2); p.position.set(tx + Math.cos(a) * 11, 1.3, tz + Math.sin(a) * 11); g.add(p); tapePts.push(new THREE.Vector3(tx + Math.cos(a) * 11, 2.2, tz + Math.sin(a) * 11), new THREE.Vector3(tx + Math.cos(a2) * 11, 2.2, tz + Math.sin(a2) * 11)); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tapePts), new THREE.LineBasicMaterial({ color: 0xd42020 })));
  g.add(signBoard(medBannerTex, 8, 2, tx + 9, 4, tz + 9, -Math.PI / 4));
  return g;
}
/* вышка: доски, раскосы, парапет из мешков, маскировочная сеть на крыше */
function buildTowerMesh(t) {
  const g = new THREE.Group(); g.position.set(X(t.x), 0, Z(t.y));
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1, t.h, 1), plankMat); leg.position.set(x, t.h / 2, z); leg.castShadow = true; g.add(leg); }
  for (let y = 5; y < t.h - 2; y += 6) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(10.5, .6, .6), plankMat); b.position.set(0, y, s * 5); g.add(b); const b2 = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, 10.5), plankMat); b2.position.set(s * 5, y, 0); g.add(b2); }
  const dl = Math.hypot(10, 6);
  for (let y = 5; y < t.h - 6; y += 6) for (const s of [-1, 1]) for (const k of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(dl, .5, .5), plankMat); d.position.set(0, y + 3, s * 5); d.rotation.z = k * Math.atan2(6, 10); g.add(d); const d2 = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, dl), plankMat); d2.position.set(s * 5, y + 3, 0); d2.rotation.x = k * Math.atan2(6, 10); g.add(d2); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13, .8, 13), plankMat); deck.position.y = t.h - .4; deck.castShadow = deck.receiveShadow = true; g.add(deck);
  for (const [x, z, sx, sz] of [[0, -6.2, 13, 1.6], [0, 6.2, 13, 1.6], [-6.2, 0, 1.6, 13], [6.2, 0, 1.6, 13]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 2.6, sz), sandbagMat); r.position.set(x, t.h + 1.3, z); r.castShadow = true; g.add(r); }
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.6, 9, .6), plankMat); p.position.set(x, t.h + 4.5, z); g.add(p); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10.5, 4.5, 4).rotateY(Math.PI / 4), camoMat); roof.position.y = t.h + 11; roof.castShadow = true; g.add(roof);
  const ladder = new THREE.Group(); for (let y = 2; y < t.h - 1; y += 2) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, .25, .25), plankMat); s.position.set(0, y, 0); ladder.add(s); } for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.3, t.h, .3), plankMat); r.position.set(sx * 1.1, t.h / 2, 0); ladder.add(r); } ladder.position.set(0, 0, 5.6); g.add(ladder);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1), new THREE.MeshStandardMaterial({ color: 0x333, emissive: 0xfff1c0, emissiveIntensity: .8 })); lamp.position.set(0, t.h + 9.5, -6.5); g.add(lamp);
  return g;
}
/* склад боеприпасов: ящики с трафаретом, маскировочный навес, полукольцо мешков */
function buildDepot(d) {
  const g = new THREE.Group(); g.position.set(X(d.x), 0, Z(d.y));
  g.userData.crates = crates(g, [[-2, 1, -1.5, 2.6], [1, 1, -1, 2.6], [-.5, 2.9, -1.3, 2.4], [2.5, .9, 1.5, 2.2], [-2.5, .8, 1.8, 2], [0, .9, 2.4, 2.2]]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 9, 5), steelMat2); pole.position.set(3.5, 4.5, -2.5); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshStandardMaterial({ color: 0xf2b33d, side: THREE.DoubleSide })); flag.position.set(5, 8, -2.5); g.add(flag); g.userData.flag = flag;
  const tent = new THREE.Mesh(new THREE.PlaneGeometry(11, 9), camoMat); tent.rotation.x = -Math.PI / 2 + .12; tent.position.set(0, 5.4, 0); tent.castShadow = true; g.add(tent);
  for (const [x, z] of [[-4.5, -3.5], [4.5, -3.5], [-4.5, 3.5], [4.5, 3.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 5.6, 5), steelMat2); p.position.set(x, 2.8, z); g.add(p); }
  const arc = sandbagArc(7.5, Math.PI * .15, Math.PI * .85, 1.9); arc.position.set(0, 0, -.5); g.add(arc);
  return g;
}
/* медпункт: большая белая палатка с крестами, койки, флаг и баннер */
function buildMedMesh(m) {
  const g = new THREE.Group(); g.position.set(X(m.x), 0, Z(m.y));
  g.add(ridgeTent(18, 12, 7, crossTentMat));
  for (const s of [-1, 1]) for (const k of [0, 1]) { const cot = new THREE.Mesh(new THREE.BoxGeometry(2.2, .5, 4.6), new THREE.MeshStandardMaterial({ color: 0x5a7a4a })); cot.position.set(s * 10, .6, k * 5.5 - 2); cot.castShadow = true; g.add(cot); for (const lx of [-.9, .9]) for (const lz of [-2, 2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.15, .6, .15), steelMat2); l.position.set(s * 10 + lx, .3, k * 5.5 - 2 + lz); g.add(l); } }
  for (const s of [-1, 1]) { const iv = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 4, 4), steelMat2); iv.position.set(s * 11.5, 2, -4.5); g.add(iv); const bag = new THREE.Mesh(new THREE.BoxGeometry(.5, .8, .2), new THREE.MeshStandardMaterial({ color: 0xe8f0ff, transparent: true, opacity: .8 })); bag.position.set(s * 11.5, 3.6, -4.5); g.add(bag); }
  crates(g, [[-6, .8, 9, 2], [-3.8, .8, 9.4, 1.8]]);
  g.add(signBoard(medBannerTex, 9, 2.2, 0, 4.5, 9.5, 0));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 12, 5), steelMat2); pole.position.set(11, 6, 6); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), new THREE.MeshStandardMaterial({ map: crossTentTex, side: THREE.DoubleSide })); flag.position.set(13, 10.5, 6); g.add(flag);
  return g;
}
/* пункт вакцинации: палатка, баннер, стол и очередь из стоек с лентой */
function updateTents() {
  for (const t of tents) {
    if (tentObjs.has(t)) continue;
    const g = new THREE.Group(); g.position.set(X(t.x), hasHills ? gY(t.x, t.y) : 0, Z(t.y));
    const tent = ridgeTent(14, 10, 6, whiteCanvasMat); g.add(tent);
    g.add(signBoard(vacBannerTex, 9, 2.2, 0, 4.5, 7.5, 0));
    const table = new THREE.Mesh(new THREE.BoxGeometry(5, .3, 2), plankMat); table.position.set(9, 2.2, 0); g.add(table);
    for (const [x, z] of [[7, -.8], [11, -.8], [7, .8], [11, .8]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.2, 2.2, .2), steelMat2); l.position.set(x, 1.1, z); g.add(l); }
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, .9, 1), new THREE.MeshStandardMaterial({ color: 0xf4f4f4 })); box.position.set(9, 2.8, 0); g.add(box);
    const pts = []; for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .25, 2.4, 6), steelMat2); p.position.set(14 + i * 3.5, 1.2, (i % 2 ? 1.5 : -1.5)); g.add(p); if (i) pts.push(new THREE.Vector3(14 + (i - 1) * 3.5, 2.2, ((i - 1) % 2 ? 1.5 : -1.5)), new THREE.Vector3(14 + i * 3.5, 2.2, (i % 2 ? 1.5 : -1.5))); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1d7a4a })));
    scene.add(g); tentObjs.set(t, g);
  }
  for (const [t, g] of tentObjs) if (!tents.includes(t)) { scene.remove(g); tentObjs.delete(t); }
}
/* генератор: жёлтый агрегат с решёткой, колёса, канистра, кабель */
function buildGenMesh(gn) {
  const g = new THREE.Group(); g.position.set(X(gn.x), 0, Z(gn.y));
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 3), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (gg, w, h) => { gg.fillStyle = "#e8b81a"; gg.fillRect(0, 0, w, h); gg.fillStyle = "#2a2a2a"; for (let y = 10; y < h - 8; y += 6) gg.fillRect(8, y, 40, 3); gg.fillStyle = "#222"; gg.font = "bold 14px Oswald, Arial Narrow, sans-serif"; gg.fillText("ДЭС-5", 64, 24); gg.fillStyle = "#c81e1e"; gg.fillRect(64, 34, 36, 12); noiseOn(gg, w, h, 200, .06); }), roughness: .5, metalness: .3 })); body.position.y = 1.9; body.castShadow = true; g.add(body);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(5.6, .3, 3.4), steelMat2); frame.position.y = .55; g.add(frame);
  for (const [x, z] of [[-2, 1.7], [2, 1.7], [-2, -1.7], [2, -1.7]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .4, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })); w.position.set(x, .5, z); g.add(w); }
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 2, 6), steelMat2); pipe.position.set(-1.8, 4.1, .8); g.add(pipe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40ff60 })); lamp.position.set(2, 3.6, 0); g.add(lamp); g.userData.lamp = lamp;
  const can = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, .8), new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: .6 })); can.position.set(3.6, .8, -1.2); can.rotation.y = .4; g.add(can);
  const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(2.5, 1.2, 1.5), new THREE.Vector3(5, .2, 4), new THREE.Vector3(9, .1, 7)]), new THREE.LineBasicMaterial({ color: 0x111 })); g.add(cable);
  return g;
}
/* ловушки: мина с табличкой, бочки с надписью, растяжка */
function buildTrapMesh(t) {
  const g = new THREE.Group();
  if (t.k === "mine") { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, .7, 12), steelDark); m.position.set(X(t.x), .35, Z(t.y)); g.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .4, 8), new THREE.MeshBasicMaterial({ color: 0xff3030 })); b.position.set(X(t.x), .8, Z(t.y)); g.add(b); g.userData.blink = b; }
  else if (t.k === "wire") { for (const [x, y] of [[t.x, t.y], [t.x2, t.y2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 2.4, 6), steelDark); p.position.set(X(x), 1.2, Z(y)); g.add(p); } const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X(t.x), 1.1, Z(t.y)), new THREE.Vector3(X(t.x2), 1.1, Z(t.y2))]), wireMat); g.add(line); const gr = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a4a2a })); gr.position.set(X(t.x), 1.4, Z(t.y)); g.add(gr); }
  else if (t.k === "barrel") { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 12), new THREE.MeshStandardMaterial({ map: barrelTex, roughness: .6, metalness: .3 })); b.position.set(X(t.x), 1.8, Z(t.y)); b.rotation.y = rnd(0, TAU); b.castShadow = true; g.add(b); for (const y of [.9, 2.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.32, .08, 6, 16).rotateX(Math.PI / 2), steelDark); r.position.set(X(t.x), y, Z(t.y)); g.add(r); } const cap = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .2, 8), steelDark); cap.position.set(X(t.x) + .6, 3.7, Z(t.y)); g.add(cap); }
  return g;
}
