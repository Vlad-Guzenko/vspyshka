/* ---------- ядерный взрыв: вспышка, огненный шар, гриб, волна ---------- */
let nukeFx = null;
const nukeBallMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, toneMapped: false, depthWrite: false });
const nukeRingMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffe0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
function fxNuke(x, y) {
  if (nukeFx) { for (const o of [nukeFx.ball, nukeFx.glow, nukeFx.wave, nukeFx.cond, nukeFx.light]) scene.remove(o); nukeFx = null; }
  const cx = X(x), cz = Z(y), gy = gY(x, y);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), nukeBallMat.clone()); ball.position.set(cx, 20 + gY(x, y), cz); scene.add(ball);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.copy(ball.position); scene.add(glow);
  const wave = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8c8a8, transparent: true, depthWrite: false, opacity: .8, side: THREE.DoubleSide })); wave.position.set(cx, gy + 2, cz); scene.add(wave);
  const cond = new THREE.Mesh(new THREE.TorusGeometry(1, .08, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false })); cond.position.set(cx, gy + 260, cz); scene.add(cond);
  const light = new THREE.PointLight(0xffd8a0, 30, 6000, 1.2); light.position.set(cx, gy + 120, cz); scene.add(light);
  nukeFx = { x: cx, z: cz, gy, ball, glow, wave, cond, light, t: 0 };
  $("flash").hidden = false; $("flash").style.transition = "none"; $("flash").style.opacity = 1;
  requestAnimationFrame(() => { $("flash").style.transition = "opacity 3s ease-out"; $("flash").style.opacity = 0; });
  setTimeout(() => $("flash").hidden = true, 3200);
  world.nukeGlow = 1;
  shake = Math.max(shake, 4); slowMo(3);
}
function updateNuke(dt) {
  const n = nukeFx; if (!n || !dt) return;
  n.t += dt; const t = n.t;
  // огненный шар растёт за пару секунд, потом поднимается и темнеет
  const r = Math.min(110, 110 * Math.sqrt(t / 2)), rise = 20 + Math.min(520, t * 22);
  n.ball.scale.setScalar(r); n.ball.position.y = n.gy + rise;
  const heat = clamp(1 - t / 25);
  n.ball.material.color.setRGB(1, .55 + heat * .4, .2 + heat * .55); n.ball.material.opacity = clamp(1.1 - t / 40, 0, 1);
  n.glow.position.copy(n.ball.position); n.glow.scale.setScalar(r * 6 * (.4 + heat)); n.glow.material.opacity = heat;
  n.light.position.y = n.gy + rise; n.light.intensity = 30 * heat * heat + 2 * heat;
  // ножка гриба и шапка
  if (t < 45) {
    for (let i = 0; i < dt * 60 * fxK; i++) { const h = rnd(0, rise - r * .5), w = 14 + h * .04; emit(PS_SMOKE, { x: n.x + rnd(-w, w), y: n.gy + h, z: n.z + rnd(-w, w), vx: rnd(-2, 2), vy: rnd(8, 20), vz: rnd(-2, 2), l: rnd(6, 12), s0: 30, s1: 70, c: [.35 + heat * .6, .22 + heat * .3, .12], c1: [.25, .22, .2], a: .55, fadeIn: true, dr: .3 }); }
    for (let i = 0; i < dt * 50 * fxK; i++) { const a = rnd(0, TAU), rr = r * rnd(.6, 1.3); emit(PS_SMOKE, { x: n.x + Math.cos(a) * rr, y: n.gy + rise + rnd(-r * .4, r * .5), z: n.z + Math.sin(a) * rr, vx: Math.cos(a) * rnd(6, 20), vy: rnd(-2, 6), vz: Math.sin(a) * rnd(6, 20), l: rnd(14, 30), s0: 60, s1: 150, c: [.5 + heat * .5, .3 + heat * .3, .15 + heat * .1], c1: [.3, .27, .25], a: .6, fadeIn: true, dr: .15 }); }
  }
  // волна по земле — там, где её сейчас считает симуляция
  if (nuke) {
    const R = nuke.R;
    n.wave.scale.setScalar(Math.max(1, R)); n.wave.material.opacity = clamp(1 - R / NUKE.RMAX) * .8;
    if (R < NUKE.RMAX) for (let i = 0; i < dt * 120 * fxK; i++) { const a = rnd(0, TAU); emit(PS_SMOKE, { x: n.x + Math.cos(a) * R, y: gY(n.x + Math.cos(a) * R + W / 2, n.z + Math.sin(a) * R + H / 2) + rnd(1, 12), z: n.z + Math.sin(a) * R, vx: Math.cos(a) * rnd(30, 60), vy: rnd(4, 14), vz: Math.sin(a) * rnd(30, 60), l: rnd(3, 6), s0: 16, s1: 50, c: [.55, .5, .44], a: .55, fadeIn: true, dr: .6 }); }
    // волна дошла до камеры — трясёт
    const dc = Math.hypot(camC.tx - n.x, camC.tz - n.z);
    if (Math.abs(dc - R) < 40 && R < NUKE.RMAX) shake = Math.max(shake, 9 * clamp(1 - R / NUKE.RMAX + .3));
  }
  n.cond.scale.setScalar(Math.min(900, t * 160)); n.cond.material.opacity = clamp(.5 - t / 10);
  // пепел оседает на город
  if (t > 6 && t < 120) for (let i = 0; i < dt * 30 * fxK; i++) emit(PS_SMOKE, { x: camC.tx + rnd(-300, 300), y: rnd(80, 200), z: camC.tz + rnd(-300, 300), vx: rnd(-3, 3), vy: -rnd(3, 7), vz: rnd(-3, 3), l: rnd(15, 25), s0: 1.2, s1: 1, c: [.6, .58, .55], a: .7 });
  if (t > 120) { for (const o of [n.ball, n.glow, n.wave, n.cond, n.light]) scene.remove(o); nukeFx = null; }
}
// отсчёт до удара: мигающая метка цели и сирена
const nukeMark = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, depthWrite: false, toneMapped: false }));
nukeMark.visible = false; nukeMark.renderOrder = 4; scene.add(nukeMark);
function updateNukeMark() {
  nukeMark.visible = !!(nuke && !nuke.det);
  if (nukeMark.visible) { nukeMark.position.set(X(nuke.x), gY(nuke.x, nuke.y) + .5, Z(nuke.y)); nukeMark.scale.setScalar(NUKE.R1); nukeMark.material.opacity = .4 + .5 * Math.sin(simT * 10); }
}

/* ---------- стройка: леса и башенный кран ---------- */
const scafMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, roughness: .8, metalness: .3 }), craneMat = new THREE.MeshStandardMaterial({ color: 0xe8b81a, roughness: .5, metalness: .4 });
function makeScaffold(b) {
  const g = new THREE.Group(), w = b.rot !== undefined ? b.w : b.x1 - b.x0, d = b.rot !== undefined ? b.d : b.y1 - b.y0, h = b.h, m = new THREE.Matrix4();
  const items = [];
  const perim = [[-w / 2 - 2, -d / 2 - 2, w / 2 + 2, -d / 2 - 2], [w / 2 + 2, -d / 2 - 2, w / 2 + 2, d / 2 + 2], [w / 2 + 2, d / 2 + 2, -w / 2 - 2, d / 2 + 2], [-w / 2 - 2, d / 2 + 2, -w / 2 - 2, -d / 2 - 2]];
  for (const [x0, z0, x1, z1] of perim) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 8));
    for (let i = 0; i <= n; i++) items.push([x0 + (x1 - x0) * i / n, h / 2, z0 + (z1 - z0) * i / n, .4, h, .4]);
    for (let y = 6; y < h; y += 12) items.push([(x0 + x1) / 2, y, (z0 + z1) / 2, Math.abs(x1 - x0) + .4, .5, Math.abs(z1 - z0) + .4]);
  }
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), scafMat, items.length);
  items.forEach(([x, y, z, sx, sy, sz], i) => { m.makeScale(sx, sy, sz).setPosition(x, y, z); inst.setMatrixAt(i, m); });
  inst.castShadow = true; inst.frustumCulled = false; g.add(inst);
  // кран рядом с домом
  const mastH = h + 50, mast = new THREE.Mesh(new THREE.BoxGeometry(3, mastH, 3), craneMat); mast.position.set(w / 2 + 10, mastH / 2, 0); mast.castShadow = true; g.add(mast);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(70, 2.2, 2.2), craneMat); jib.position.set(w / 2 + 10 - 20, mastH, 0); jib.castShadow = true; g.add(jib);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 5), parapetMat); cw.position.set(w / 2 + 10 + 13, mastH - 3, 0); g.add(cw);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), craneMat); cab.position.set(w / 2 + 10, mastH - 4, 3); g.add(cab);
  // стрела поворачивается вокруг мачты, по ней ездит тележка с крюком и грузом
  const arm = new THREE.Group(); arm.position.set(w / 2 + 10, mastH, 0); g.add(arm);
  jib.position.set(-20, 0, 0); arm.add(jib); cw.position.set(13, -3, 0); arm.add(cw);
  const trolley = new THREE.Group(); trolley.position.set(-30, -1.5, 0); arm.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1, 4).translate(0, -.5, 0), new THREE.MeshBasicMaterial({ color: 0x222 })); trolley.add(cable);
  const load = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 4), slabMat); load.castShadow = true; trolley.add(load);
  g.position.set(b.rot !== undefined ? X(b.cx) : X((b.x0 + b.x1) / 2), b.baseY || 0, b.rot !== undefined ? Z(b.cy) : Z((b.y0 + b.y1) / 2)); g.rotation.y = b.rot !== undefined ? -b.rot : 0; g.userData.jib = jib; g.userData.arm = arm; g.userData.trolley = trolley; g.userData.cable = cable; g.userData.load = load; g.userData.mastH = mastH;
  return g;
}
function updateConstruction() {
  for (const b of buildings) {
    if (!b.obj) continue;
    if (b.state === "construct" || (b.state === "ok" && b.scaf)) {
      if (b.topple || b.mound) { b.obj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot !== undefined ? -b.rot : 0); b.obj.position.set(b.rot !== undefined ? X(b.cx) : X((b.x0 + b.x1) / 2), b.baseY || 0, b.rot !== undefined ? Z(b.cy) : Z((b.y0 + b.y1) / 2)); b.obj.scale.set(1, 1, 1); b.obj.visible = true; b.obj.traverse(o => { if (o.isMesh) o.scale.y = 1; }); if (b.mound) { cityGroup.remove(b.mound); b.mound = null; } b.topple = b.broke = b.moundDone = b.impacted = false; b.ruinH = 0; }
      if (!b.scaf) {
        b.scaf = makeScaffold(b); cityGroup.add(b.scaf); b.obj.visible = true;
        if (b.mesh.userData.orig) { b.mesh.material = b.mesh.userData.orig; b.scorched = false; b.scorchK = 0; }
        for (const o of b.obj.children.slice()) { if (o.userData.shell) b.obj.remove(o); else o.visible = true; }
        if (b.roofIdx && b.roofBox && roofStuff) { const mm = new THREE.Matrix4(); const qq = new THREE.Quaternion(), yy = new THREE.Vector3(0, 1, 0); b.roofIdx.forEach((ri, k) => { const [x, y, z, sx, sy, sz, r] = b.roofBox[k]; qq.setFromAxisAngle(yy, r || 0); mm.compose(new THREE.Vector3(x, y, z), qq, new THREE.Vector3(sx, sy, sz)); roofStuff.setMatrixAt(ri, mm); }); roofStuff.instanceMatrix.needsUpdate = true; }
        if (b.sign) b.sign.visible = true;
      }
      // этажи появляются по одному: высота растёт ступенями, на верхнем этаже пыль и искры сварки
      const fl = Math.max(1, b.floors), stepP = Math.floor((b.prog || 0) * fl) / fl, drop = (b.h - b.ruinH) * (1 - stepP);
      if (b.state === "construct" && (b.lastStep || 0) !== stepP) { b.lastStep = stepP; const top = (b.baseY || 0) + b.ruinH + (b.h - b.ruinH) * stepP; for (let i = 0; i < 14; i++) smokeParticle(X(rnd(b.x0, b.x1)), top + 1, Z(rnd(b.y0, b.y1)), 1.4); }
      if (b.state === "construct" && stepP < 1 && Math.random() < .25) { const top = (b.baseY || 0) + b.ruinH + (b.h - b.ruinH) * stepP + 2, ex = Math.random() < .5 ? b.x0 : b.x1, ez = rnd(b.y0, b.y1); for (let i = 0; i < 6; i++) emit(PS_ADD, { x: X(ex), y: top, z: Z(ez), vx: rnd(-6, 6), vy: rnd(1, 8), vz: rnd(-6, 6), l: rnd(.15, .4), s0: 1.2, s1: .2, c: [2.2, 1.8, 1.0], a: 1, g: 25 }); }
      b.obj.position.y = (b.baseY || 0) - drop; b.obj.rotation.x *= .9; b.obj.rotation.z *= .9; b.obj.position.x = b.rot !== undefined ? X(b.cx) : X((b.x0 + b.x1) / 2);
      // кран работает: поворот стрелы, тележка ездит, груз опускается на стройку и поднимается
      const u = b.scaf.userData, ph = (simT * .12 + (b.x0 % 7)) % 1, rise = (b.h - b.ruinH) * (b.prog || 0) + b.ruinH;
      u.arm.rotation.y = Math.sin(simT * .25 + b.y0) * .9 - .4; u.trolley.position.x = -14 - 22 * (.5 + .5 * Math.sin(simT * .4));
      const drop2 = ph < .5 ? ph * 2 : 2 - ph * 2, hang = 4 + (u.mastH - rise - 8) * drop2; u.cable.scale.y = hang; u.load.position.y = -hang - 1.2; u.load.visible = ph < .5 || b.prog < 1;
      if (b.state === "ok") { cityGroup.remove(b.scaf); b.scaf = null; b.obj.position.y = b.baseY || 0; b.obj.rotation.x = b.obj.rotation.z = 0; b.ruinDone = false; b.hid = false; b.lastStep = -1; }
    }
  }
}
