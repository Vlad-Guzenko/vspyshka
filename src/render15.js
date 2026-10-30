/* ---------- достопримечательности: храм, вокзал, школа, заправка, водонапорная башня, телебашня, стадион, колесо обозрения, стела ---------- */
const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: .25, metalness: .9 }), domeBlueMat = new THREE.MeshStandardMaterial({ color: 0x2b5a9a, roughness: .35, metalness: .5 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd2cfc6, roughness: .85 }), whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: .6 });
const redMat2 = new THREE.MeshStandardMaterial({ color: 0xc8281e, roughness: .55 }), darkGlassMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: .1, metalness: .7 });
const graniteMat = new THREE.MeshStandardMaterial({ color: 0x6e6862, roughness: .7 }), seatMats = [0x2a5aa8, 0xc8281e, 0xe8c040].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .7 }));
const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xfff4d8, emissiveIntensity: 0 }); glowSignMats.push(lampGlowMat);
const clockTex = canvasTex(128, 128, g => { g.fillStyle = "#f4f0e4"; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.strokeStyle = "#222"; g.lineWidth = 5; g.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.fillStyle = "#222"; g.fillRect(64 + Math.cos(a) * 48 - 3, 64 + Math.sin(a) * 48 - 3, 6, 6); } g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 26); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(92, 70); g.stroke(); });
const clockMat = new THREE.MeshStandardMaterial({ map: clockTex, transparent: true, emissive: 0xffffff, emissiveMap: clockTex, emissiveIntensity: 0 }); glowSignMats.push(clockMat);
const fieldTex = canvasTex(512, 340, (g, w, h) => {
  for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? "#3f8a3a" : "#479a40"; g.fillRect(x, 0, 32, h); }
  g.strokeStyle = "#f4f4ec"; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28); g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 42, 0, TAU); g.stroke(); g.strokeRect(14, h / 2 - 70, 70, 140); g.strokeRect(w - 84, h / 2 - 70, 70, 140);
});
const fieldMat = new THREE.MeshStandardMaterial({ map: fieldTex, roughness: .9 });
const lmAdd = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
// луковичный купол: профиль вращения
function onionGeo(r, h) { return new THREE.LatheGeometry([[0, 0], [r * .82, 0], [r * 1.02, h * .18], [r * 1.06, h * .34], [r * .9, h * .54], [r * .55, h * .74], [r * .2, h * .9], [.06, h]].map(([x, y]) => new THREE.Vector2(x, y)), 18); }
function crossOn(g, x, y, z, s = 1) { lmAdd(g, new THREE.BoxGeometry(.35 * s, 5 * s, .35 * s), goldMat, x, y + 2.5 * s, z); lmAdd(g, new THREE.BoxGeometry(2.6 * s, .35 * s, .35 * s), goldMat, x, y + 3.4 * s, z); }
function landSign(obj, text, bg, fg, w, y, z) { const m = signMat(textTex(512, 80, bg, fg, text, "bold 50px Arial")); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .156), m); s.position.set(0, y, z); obj.add(s); return s; }
// у дома своя форма вместо коробки: коробка убирается, главной частью (для копоти и развалин) становится mesh
function swapBody(b, obj, box, mesh) { obj.remove(box); box.geometry.dispose(); obj.add(mesh); b.mesh = mesh; mesh.castShadow = mesh.receiveShadow = true; }
function landmarkMesh(b, obj, box, w, d) {
  const h = b.h;
  if (b.kind === "church") {
    if (b.shape) return churchShape(b, obj, box, w, d); // кирха или часовня (buildings.js)
    // неф с апсидой, барабан с луковичным куполом, четыре малые главки, шатровая колокольня у входа
    lmAdd(obj, new THREE.CylinderGeometry(w * .32, w * .32, h * .8, 18, 1, false, Math.PI / 2, Math.PI), facadeMats[27], 0, h * .4, -d / 2);
    lmAdd(obj, new THREE.CylinderGeometry(6.5, 6.5, 10, 18), facadeMats[27], 0, h + 5, -2);
    const bigDome = Math.random() < .5 ? goldMat : domeBlueMat; lmAdd(obj, onionGeo(7.2, 13), bigDome, 0, h + 10, -2); crossOn(obj, 0, h + 23, -2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { lmAdd(obj, new THREE.CylinderGeometry(2.2, 2.2, 5, 12), facadeMats[27], sx * 8.5, h + 2.5, -2 + sz * 9); lmAdd(obj, onionGeo(2.6, 5.5), goldMat, sx * 8.5, h + 5, -2 + sz * 9); crossOn(obj, sx * 8.5, h + 10.5, -2 + sz * 9, .55); }
    const tw = lmAdd(obj, new THREE.BoxGeometry(10, h + 16, 10), facadeMats[27], 0, (h + 16) / 2, d / 2 - 1); boxUV(tw.geometry, 10, 10, (h + 16) / 12, 0);
    lmAdd(obj, new THREE.BoxGeometry(11, 7, 11), whiteMat, 0, h + 12, d / 2 - 1);
    lmAdd(obj, new THREE.ConeGeometry(7.4, 16, 8), domeBlueMat, 0, h + 16 + 8, d / 2 - 1).rotation.y = Math.PI / 8;
    lmAdd(obj, onionGeo(1.8, 4), goldMat, 0, h + 32, d / 2 - 1); crossOn(obj, 0, h + 36, d / 2 - 1, .6);
    b.h += 18; return true;
  }
  if (b.kind === "station") {
    // часовая башня посередине, колоннада у входа, вывеска
    const tw = lmAdd(obj, new THREE.BoxGeometry(16, h + 26, 14), facadeMats[22], 0, (h + 26) / 2, d / 2 - 5); boxUV(tw.geometry, 16, 14, (h + 26) / 12, 0);
    for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), clockMat); c.position.set(0, h + 18, s > 0 ? d / 2 + 2.05 : d / 2 - 12.05); c.rotation.y = s > 0 ? 0 : Math.PI; obj.add(c); }
    lmAdd(obj, new THREE.ConeGeometry(11.5, 14, 4), tileMats[2], 0, h + 26 + 7, d / 2 - 5).rotation.y = Math.PI / 4;
    lmAdd(obj, new THREE.CylinderGeometry(.5, .5, 8, 6), goldMat, 0, h + 44, d / 2 - 5);
    for (let k = -3; k <= 3; k++) lmAdd(obj, new THREE.CylinderGeometry(1.1, 1.3, 14, 12), whiteMat, k * 5.5, 7, d / 2 + 5);
    lmAdd(obj, new THREE.BoxGeometry(40, 2, 9), whiteMat, 0, 15, d / 2 + 4);
    landSign(obj, "ВОКЗАЛ", "#1d3566", "#f4f1e8", 26, 18.5, d / 2 + 8.6);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w * .36, 2.5, d + 1), tileMats[2]); r.position.set(s * w * .3, h + 1.25, 0); obj.add(r); }
    b.h += 20; return true;
  }
  if (b.kind === "school") {
    if (b.shape) schoolShape(b, obj, box, w, d); // корпус буквой П или Г (buildings.js)
    // крыльцо с козырьком, вывеска, флагшток; поле и дорожка нарисованы на земле, ворота стоят на поле
    lmAdd(obj, new THREE.BoxGeometry(16, .6, 6), whiteMat, 0, 10, d / 2 + 3);
    for (const s of [-1, 1]) lmAdd(obj, new THREE.BoxGeometry(.6, 10, .6), whiteMat, s * 7.4, 5, d / 2 + 5.6);
    landSign(obj, b.shape ? "ШКОЛА № " + (2 + bId(b) % 30) : "ШКОЛА № 1", "#f4f1e8", "#1d3566", 22, 13.5, d / 2 + .35);
    lmAdd(obj, new THREE.CylinderGeometry(.25, .3, 24, 6), steelPostMat, w / 2 - 6, 12, d / 2 + 10);
    lmAdd(obj, new THREE.BoxGeometry(.1, 3.2, 5), redMat2, w / 2 - 6, 21.8, d / 2 + 12.6);
    if (b.pitch) {
      const P = b.pitch, k = d / 2 + 6 + P.d / 2;
      for (const s of [-1, 1]) { const gz = k, gx = s * (P.w / 2 - 14); const goal = new THREE.Group(); goal.position.set(gx, 0, gz); lmAdd(goal, new THREE.BoxGeometry(.4, 4.4, .4), whiteMat, 0, 2.2, -6); lmAdd(goal, new THREE.BoxGeometry(.4, 4.4, .4), whiteMat, 0, 2.2, 6); lmAdd(goal, new THREE.BoxGeometry(.4, .4, 12.4), whiteMat, 0, 4.4, 0); obj.add(goal); }
    }
    return true;
  }
  if (b.kind === "gas") {
    // магазин в глубине, навес над колонками, стела с ценами у дороги
    // от центра магазина до края участка у дороги: магазин сдвинут в глубину участка (как в placeSpecial)
    const lot = b.lotRect, edge = lot ? (lot.d - SPECIAL.gas.d) / 2 - 4 + lot.d / 2 : 46, cz = (d / 2 + edge) / 2 - 2;
    // навес над тремя рядами; островки с колонками идут вдоль улицы между рядами — машина проезжает заправку насквозь
    // (ряды — в gasGeo, traffic.js: cz - 10, cz, cz + 10)
    lmAdd(obj, new THREE.BoxGeometry(34, 1.6, 28), whiteMat, 0, 10, cz); lmAdd(obj, new THREE.BoxGeometry(34.2, .9, 28.2), redMat2, 0, 9.1, cz);
    for (const sz of [-5, 5]) {
      lmAdd(obj, new THREE.BoxGeometry(14, .5, 2), concreteMat, 0, .25, cz + sz);
      for (const sx of [-3.5, 3.5]) { lmAdd(obj, new THREE.BoxGeometry(1.6, 3.6, 1.2), redMat2, sx, 2.3, cz + sz); lmAdd(obj, new THREE.BoxGeometry(1.7, 1, 1.3), whiteMat, sx, 4.5, cz + sz); }
      for (const sx of [-9, 9]) lmAdd(obj, new THREE.BoxGeometry(.9, 9, .9), whiteMat, sx, 4.5, cz + sz);
    }
    const py = new THREE.Group(); py.position.set(w / 2 + 12, 0, edge - 4); obj.add(py);
    lmAdd(py, new THREE.BoxGeometry(4.2, 14, 1.2), redMat2, 0, 7, 0);
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), signMat(canvasTex(128, 256, g => { g.fillStyle = "#c8281e"; g.fillRect(0, 0, 128, 256); g.fillStyle = "#fff"; g.font = "bold 46px Arial"; g.textAlign = "center"; g.fillText("АЗС", 64, 52); g.fillStyle = "#111"; g.fillRect(10, 76, 108, 168); g.fillStyle = "#ffcf3a"; g.font = "bold 30px monospace"; ["92 55.9", "95 61.4", "ДТ 69.2"].forEach((t, i) => g.fillText(t, 64, 112 + i * 50)); })));
    ps.position.set(0, 9, .65); py.add(ps);
    landSign(obj, "МАГАЗИН · КАФЕ", "#c8281e", "#fff", 14, 9.4, d / 2 + .35);
    return true;
  }
  if (b.kind === "wtower") {
    // кирпичная водонапорная башня: ствол с окошками, бак наверху, конусная крыша
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 30, 16), facadeMats[1]); shaft.position.y = 15; swapBody(b, obj, box, shaft);
    lmAdd(obj, new THREE.CylinderGeometry(8.5, 7, 10, 18), facadeMats[1], 0, 35, 0);
    lmAdd(obj, new THREE.CylinderGeometry(9.2, 9.2, 1, 18), whiteMat, 0, 40.5, 0);
    lmAdd(obj, new THREE.ConeGeometry(9.6, 6, 18), tileMats[0], 0, 44, 0);
    b.h = 46; return true;
  }
  if (b.kind === "tvtower") {
    // телебашня: сужающийся бетонный ствол, «тарелка» с остеклением, мачта с красно-белыми поясами
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 6.2, 150, 18), concreteMat); shaft.position.y = 75; swapBody(b, obj, box, shaft);
    lmAdd(obj, new THREE.CylinderGeometry(9, 9, 2.4, 6), concreteMat, 0, 1.2, 0);
    lmAdd(obj, new THREE.CylinderGeometry(9, 4, 6, 24), concreteMat, 0, 117, 0);
    lmAdd(obj, new THREE.CylinderGeometry(10.5, 10.5, 5, 24), darkGlassMat, 0, 122.5, 0);
    lmAdd(obj, new THREE.CylinderGeometry(11, 10, 1.6, 24), whiteMat, 0, 125.8, 0);
    lmAdd(obj, new THREE.CylinderGeometry(5, 5, 4, 18), concreteMat, 0, 136, 0);
    for (let k = 0; k < 6; k++) lmAdd(obj, new THREE.CylinderGeometry(.9 - k * .1, 1 - k * .1, 8, 8), k % 2 ? whiteMat : redMat2, 0, 154 + k * 8, 0);
    lmAdd(obj, new THREE.SphereGeometry(.9, 8, 6), lampGlowMat, 0, 202, 0);
    b.h = 200; return true;
  }
  if (b.kind === "stadium") {
    // трибуны по четырём сторонам поля, по углам мачты с прожекторами
    const fw = w - 40, fd = d - 40, slope = (L, inner, outer, hh) => { const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(outer - inner, 0), new THREE.Vector2(outer - inner, hh), new THREE.Vector2(0, 2.5)]); return new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false }); };
    const sm = pick(seatMats), main = new THREE.Mesh(slope(fw, 0, 20, 18).translate(0, 0, -fw / 2).rotateY(-Math.PI / 2).translate(0, 0, fd / 2), sm); swapBody(b, obj, box, main);
    lmAdd(obj, slope(fw, 0, 20, 18).translate(0, 0, -fw / 2).rotateY(Math.PI / 2).translate(0, 0, -fd / 2), sm, 0, 0, 0);
    lmAdd(obj, slope(fd, 0, 20, 14).translate(0, 0, -fd / 2).translate(fw / 2, 0, 0), sm, 0, 0, 0);
    lmAdd(obj, slope(fd, 0, 20, 14).translate(0, 0, -fd / 2).rotateY(Math.PI).translate(-fw / 2, 0, 0), sm, 0, 0, 0);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd).rotateX(-Math.PI / 2), fieldMat); field.position.y = .45; field.receiveShadow = true; obj.add(field);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { lmAdd(obj, new THREE.CylinderGeometry(.6, .9, 34, 8), steelPostMat, sx * (w / 2 - 4), 17, sz * (d / 2 - 4)); const panel = lmAdd(obj, new THREE.BoxGeometry(6, 4, .8), lampGlowMat, sx * (w / 2 - 5), 35, sz * (d / 2 - 5)); panel.rotation.set(.4, Math.atan2(-sx, -sz), 0, "YXZ"); }
    b.h = 20; return true;
  }
  if (b.kind === "ferris") {
    // колесо обозрения крутится: в общий блок не склеивается, вращение — в updateLandmarks
    const plat = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), concreteMat); plat.position.y = .8; swapBody(b, obj, box, plat);
    lmAdd(obj, new THREE.BoxGeometry(6, 5, 4), redMat2, w / 2 - 5, 3.3, 0);
    for (const s of [-1, 1]) for (const lx of [-9, 9]) { const leg = lmAdd(obj, new THREE.BoxGeometry(1, 30, 1), whiteMat, lx / 2, 15, s * 3.6); leg.rotation.z = -Math.sign(lx) * .3; }
    const wheel = new THREE.Group(); wheel.position.set(0, 29, 0); obj.add(wheel);
    for (const s of [-1, 1]) { lmAdd(wheel, new THREE.TorusGeometry(22, .45, 6, 48), whiteMat, 0, 0, s * 2.4); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, sp = lmAdd(wheel, new THREE.BoxGeometry(.35, 22, .35), whiteMat, Math.cos(a) * 11, Math.sin(a) * 11, 0); sp.rotation.z = a + Math.PI / 2; }
    lmAdd(wheel, new THREE.CylinderGeometry(1.4, 1.4, 6, 10).rotateX(Math.PI / 2), steelPostMat, 0, 0, 0);
    const cabs = []; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, c = new THREE.Group(); c.position.set(Math.cos(a) * 22, Math.sin(a) * 22, 0); lmAdd(c, new THREE.BoxGeometry(3.2, 3, 3.4), pick(seatMats), 0, -2.4, 0); wheel.add(c); cabs.push(c); }
    b.anim = { wheel, cabs }; b.h = 52; return true;
  }
  if (b.kind === "hangar") {
    // ангар: арочная металлическая крыша от земли до земли, ворота на торце
    const r = d / 2, arch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), metalRoofMat); swapBody(b, obj, box, arch);
    lmAdd(obj, new THREE.BoxGeometry(.4, r * .8, r * 1.1), steelPostMat, w / 2 + .1, r * .4, 0);
    b.h = r; return true;
  }
  if (b.kind === "basehq") {
    // штаб части: вывеска над входом и флагшток
    landSign(obj, "ВОИНСКАЯ ЧАСТЬ", "#3f4630", "#f4f1e8", 24, 9.5, d / 2 + .35);
    lmAdd(obj, new THREE.CylinderGeometry(.25, .3, 22, 6), steelPostMat, w / 2 + 6, 11, d / 2 + 8); lmAdd(obj, new THREE.BoxGeometry(.1, 3, 5), redMat2, w / 2 + 6, 20.2, d / 2 + 10.6);
    return false;
  }
  if (b.kind === "monument") {
    // стела с золотой звездой на гранитном постаменте и чаша вечного огня перед ней
    const stela = new THREE.Mesh(new THREE.BoxGeometry(3.2, 34, 5.5).translate(0, 17 + 3, 0), graniteMat); swapBody(b, obj, box, stela);
    lmAdd(obj, new THREE.BoxGeometry(12, 1.5, 12), graniteMat, 0, .75, 0); lmAdd(obj, new THREE.BoxGeometry(8, 1.5, 8), graniteMat, 0, 2.25, 0);
    const pts = []; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + Math.PI / 2, r = k % 2 ? 1.5 : 3.6; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    lmAdd(obj, new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .8, bevelEnabled: false }).translate(0, 0, -.4), goldMat, 0, 40, 0);
    lmAdd(obj, new THREE.CylinderGeometry(1.8, 1.2, 1.4, 12), graniteMat, 0, 3.7, 4.8);
    b.flame = { lx: 0, ly: 4.6, lz: 4.8 }; b.h = 44; return true;
  }
  return false;
}
// земля под достопримечательностями: беговая дорожка и поле у школы
function drawLandmarkGround(g) {
  for (const b of buildings) if (b.pitch) {
    const P = b.pitch; g.save(); g.translate(P.x, P.y); g.rotate(P.rot);
    g.fillStyle = "#a8573a"; g.beginPath(); g.roundRect ? g.roundRect(-P.w / 2, -P.d / 2, P.w, P.d, P.d / 2) : g.rect(-P.w / 2, -P.d / 2, P.w, P.d); g.fill();
    g.fillStyle = "#4f8f3e"; g.beginPath(); g.roundRect ? g.roundRect(-P.w / 2 + 8, -P.d / 2 + 8, P.w - 16, P.d - 16, (P.d - 16) / 2) : g.rect(-P.w / 2 + 8, -P.d / 2 + 8, P.w - 16, P.d - 16); g.fill();
    g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = .6; g.strokeRect(-P.w / 2 + 16, -P.d / 2 + 12, P.w - 32, P.d - 24); g.beginPath(); g.moveTo(0, -P.d / 2 + 12); g.lineTo(0, P.d / 2 - 12); g.stroke(); g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.stroke();
    g.restore();
  }
}
// колесо крутится, кабинки висят ровно; у стелы горит огонь
function updateLandmarks(dt) {
  for (const b of buildings) {
    if (b.anim && b.state === "ok" && b.obj) { const w = b.anim.wheel; w.rotation.z += dt * .05; for (const c of b.anim.cabs) c.rotation.z = -w.rotation.z; }
    if (b.flame && b.state === "ok" && b.obj && Math.random() < dt * 14) { const v = new THREE.Vector3(b.flame.lx, b.flame.ly, b.flame.lz).applyMatrix4(b.obj.matrixWorld); fireParticle(v.x + rnd(-.4, .4), v.y, v.z + rnd(-.4, .4), .35); }
  }
}
