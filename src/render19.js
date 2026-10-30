/* ---------- разрушения мелочей на картинке: огонь на мелочах и деревьях, фонтан из сломанного гидранта, поваленные светофоры,
   разорванные и обгоревшие заборы, сломанные взрывом деревья. Состояние — в sim3.js (stepWreck, wreckBlast) ---------- */
let wreckRT = 0;
const _wm = new THREE.Matrix4(), _wm2 = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _wv = new THREE.Vector3(), _wa = new THREE.Vector3(), _wc = new THREE.Color();
const WATER_C = [.72, .84, .95];
function updateWreck(dt) {
  wreckRT -= dt;
  if (wreckDirty && wreckRT <= 0) { wreckDirty = false; wreckRT = .4; buildProps(); refreshFences(); refreshHydrants(); refreshSignals(); }
  if (!dt) return;
  // огонь и дым над тем, что горит, — только рядом с камерой
  const cx = camC.tx + W / 2, cy = camC.tz + H / 2, R = 500 + camC.dist * .5, nearC = (x, y) => Math.abs(x - cx) < R && Math.abs(y - cy) < R;
  for (const p of props) if (p.burnT > 0) {
    const x = p.x + (p.dx || 0), y = p.y + (p.dy || 0); if (!nearC(x, y)) continue; const gy = gY(x, y);
    if (Math.random() < dt * 16) fireParticle(X(x) + rnd(-2, 2), gy + rnd(1, 4), Z(y) + rnd(-2, 2), .55);
    if (Math.random() < dt * 2.5) smokeParticle(X(x), gy + 5, Z(y), .6);
  }
  for (const t of trees) if (t.burnT > 0 && nearC(t.x, t.y)) {
    const gy = gY(t.x, t.y), h = t.h * 1.2;
    if (Math.random() < dt * 22) fireParticle(X(t.x) + rnd(-1, 1) * t.r, gy + h * rnd(.4, .9), Z(t.y) + rnd(-1, 1) * t.r, .8);
    if (Math.random() < dt * 3) smokeParticle(X(t.x), gy + h, Z(t.y), .9);
  }
  for (const f of fences) if (f.burnT > 0) { const x = (f[0] + f[2]) / 2, y = (f[1] + f[3]) / 2; if (nearC(x, y) && Math.random() < dt * 10) fireParticle(X(x + rnd(-.5, .5) * (f[2] - f[0])), gY(x, y) + 1, Z(y + rnd(-.5, .5) * (f[3] - f[1])), .4); }
  // сломанный гидрант: столб воды вверх, брызги падают обратно
  for (const h of hydrants) if (h.spray > 0 && nearC(h.x, h.y)) {
    const gy = gY(h.x, h.y), k = Math.min(1, h.spray / 30);
    for (let i = 0; i < dt * 50 * k; i++) emit(PS_SMOKE, { x: X(h.x) + rnd(-.4, .4), y: gy + 1.5, z: Z(h.y) + rnd(-.4, .4), vx: rnd(-3, 3), vy: rnd(28, 40) * (.6 + .4 * k), vz: rnd(-3, 3), l: rnd(1.6, 2.2), s0: 1, s1: 3.5, c: WATER_C, a: .55, g: 39 });
  }
}
// заборы: разорванные звенья пропадают, обгоревшие чернеют
function refreshFences() {
  if (!fenceInst) return;
  fences.forEach((f, i) => {
    if (f.gone) { if (!f.shownGone) { f.shownGone = true; fenceInst.setMatrixAt(i, _wm.makeScale(0, 0, 0)); } return; }
    fenceInst.setColorAt(i, _wc.setRGB(1, 1, 1).lerp(_wc2.setHex(0x1b1714), (f.char || 0) * .9));
  });
  fenceInst.instanceMatrix.needsUpdate = true; if (fenceInst.instanceColor) fenceInst.instanceColor.needsUpdate = true;
}
const _wc2 = new THREE.Color();
// гидрант: корпус обломан у земли, колпак отлетел и лежит рядом
function refreshHydrants() {
  if (!hydrantMesh) return;
  hydrants.forEach((h, i) => {
    if (!h.broken || h.shownBroken) return; h.shownBroken = true;
    const y = gY(h.x, h.y), a = h.tipA || 0;
    hydrantMesh.setMatrixAt(i, _wm.makeScale(1, .35, 1).setPosition(X(h.x), y, Z(h.y)));
    _wq.setFromAxisAngle(_wa.set(Math.sin(a), 0, -Math.cos(a)), 1.5);
    hydrantCap.setMatrixAt(i, _wm.compose(_wv.set(X(h.x + Math.cos(a) * 4), y + .4, Z(h.y + Math.sin(a) * 4)), _wq, _wa.set(1, 1, 1)));
  });
  hydrantMesh.instanceMatrix.needsUpdate = true; hydrantCap.instanceMatrix.needsUpdate = true;
}
// светофор после взрыва: столб лежит вдоль земли от взрыва, лампы погасли
function refreshSignals() {
  if (!tlPoles || !tlList.length) return;
  let any = false;
  tlList.forEach((t, j) => {
    if (!t.n.sigBroken || t.down) return; t.down = true; any = true;
    tlPoles.getMatrixAt(j, _wm); const px = _wm.elements[12], py = _wm.elements[13], pz = _wm.elements[14], a = (t.n.sigA || 0) + rnd(-.4, .4);
    // поворот вокруг основания столба
    _wq.setFromAxisAngle(_wa.set(Math.sin(a), 0, -Math.cos(a)), rnd(1.35, 1.55));
    const tilt = _wm2.makeTranslation(px, py, pz).multiply(new THREE.Matrix4().makeRotationFromQuaternion(_wq)).multiply(new THREE.Matrix4().makeTranslation(-px, -py, -pz));
    for (const [mesh, k] of [[tlPoles, j], [tlHeads, j], [tlLamps, j * 2], [tlLamps, j * 2 + 1]]) { mesh.getMatrixAt(k, _wm); mesh.setMatrixAt(k, _wm.premultiply(tilt)); }
  });
  if (any) for (const m of [tlPoles, tlHeads, tlLamps]) m.instanceMatrix.needsUpdate = true;
}
// дерево у центра взрыва сломано: кроны нет, от ствола остался пень
function snapTree(T, t, i) {
  t.shownSnap = true; if (i * 3 >= T.cityN) return;
  for (let k = 0; k < 3; k++) { const j = i * 3 + k; T.M.fill(0, j * 16, j * 16 + 16); const tl = T.tiles[T.tileOf[j]]; tl.instanceMatrix.array.fill(0, T.slotOf[j] * 16, T.slotOf[j] * 16 + 16); tl.instanceMatrix.needsUpdate = true; }
  const tr = T.trunk, m = tr.meshes[tr.tileOf[i]]; if (!m) return;
  const e = T.trunkM[i].elements; m.setMatrixAt(tr.slotOf[i], _wm.makeScale(1.4, e[5] * .3, 1.4).setPosition(e[12], e[13], e[14])); m.instanceMatrix.needsUpdate = true;
}
