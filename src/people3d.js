/* ---------- настоящие люди вблизи камеры: скелет и анимации ---------- */
// модель Quaternius «Animated Human» (CC0): ходьба, бег, стойка, удар, смерть; цвета — палитра 32×32 на человека
const REAL = { ready: false, N: 44, slots: [], clips: {}, tpl: null, scale: 1, t: 0 };
function initRealPeople() {
  if (!window.HUMAN_FBX || !THREE.FBXLoader || !THREE.SkeletonUtils) return;
  try {
    const bin = atob(window.HUMAN_FBX), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const obj = new THREE.FBXLoader().parse(u8.buffer, "");
    obj.updateMatrixWorld(true);
    let top = 0; obj.traverse(o => { if (o.isBone && o.name === "HeadTop_End") top = o.getWorldPosition(new THREE.Vector3()).y; });
    REAL.scale = 7.5 / (top || 525);
    for (const a of obj.animations) REAL.clips[a.name.split("|").pop()] = a;
    obj.traverse(o => { if (o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    REAL.tpl = obj;
    for (let i = 0; i < REAL.N; i++) REAL.slots.push(makeSlot());
    REAL.ready = true;
  } catch (e) { console.warn("модель людей не загрузилась", e); }
}
function makeSlot() {
  const root = THREE.SkeletonUtils.clone(REAL.tpl);
  const cv2 = document.createElement("canvas"); cv2.width = cv2.height = 32;
  const tex = new THREE.CanvasTexture(cv2); tex.encoding = THREE.sRGBEncoding; tex.magFilter = THREE.NearestFilter;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .75, envMapIntensity: .5 });
  const bones = {}; let mesh = null;
  root.traverse(o => { if (o.isSkinnedMesh) { o.material = mat; mesh = o; } if (o.isBone) bones[o.name] = o; });
  const holder = new THREE.Group(); holder.add(root); root.scale.setScalar(REAL.scale); holder.visible = false; scene.add(holder);
  const mixer = new THREE.AnimationMixer(root), actions = {};
  for (const k of ["Walk", "Run", "Idle", "Death", "Punch"]) if (REAL.clips[k]) { actions[k] = mixer.clipAction(REAL.clips[k]); }
  if (actions.Death) { actions.Death.setLoop(THREE.LoopOnce); actions.Death.clampWhenFinished = true; }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.3, .35, 2.6), gunMat); gun.visible = false; holder.add(gun);
  const hatMat = new THREE.MeshStandardMaterial({ roughness: .8 });
  const hat = new THREE.Group(); hat.visible = false; holder.add(hat);
  const capM = new THREE.Mesh(PARTS.cap, hatMat), visM = new THREE.Mesh(PARTS.visor, hatMat), domeM = new THREE.Mesh(PARTS.dome, hatMat);
  hat.add(capM, visM, domeM); hat.userData = { capM, visM, domeM, hatMat };
  return { holder, root, mixer, actions, cur: null, agent: null, cv: cv2, tex, mat, bones, gun, hat, palKey: "" };
}
// палитра: кожа, тёмные детали, волосы, рубашка, брюки
function paintPalette(s, a) {
  const z = a.role === "zombie", burnt = a.burnt, dead = a.state === "dead";
  const skin = burnt ? "#1b1512" : z ? mixHex(a.skin, a.ztype === "spitter" ? "#9ab83a" : a.ztype === "titan" ? "#5a2620" : "#7d8c69", .85) : a.burn > .3 ? mixHex(a.skin, "#7a2a18", a.burn * .8) : dead ? mixHex(a.skin, "#bdb7ad", .4) : a.skin;
  const shirt = burnt ? "#141110" : z ? mixHex(a.cloth, "#3a1a12", .55) : a.cloth, pants = burnt ? "#141110" : z ? mixHex(a.pants, "#2a1a14", .4) : a.pants;
  const key = skin + shirt + pants + a.hair;
  if (key === s.palKey) return; s.palKey = key;
  const g = s.cv.getContext("2d");
  g.fillStyle = skin; g.fillRect(0, 0, 32, 6);
  g.fillStyle = "#1e1e1e"; g.fillRect(0, 6, 32, 5);
  g.fillStyle = a.hair; g.fillRect(0, 11, 32, 6);
  g.fillStyle = shirt; g.fillRect(0, 17, 32, 6);
  g.fillStyle = pants; g.fillRect(0, 23, 32, 9);
  if (z || dead) { g.fillStyle = "rgba(90,6,4,.75)"; for (let i = 0; i < 18; i++) g.fillRect(Math.random() * 32, 17 + Math.random() * 14, 2 + Math.random() * 3, 1 + Math.random() * 2); }
  s.tex.needsUpdate = true;
}
function mixHex(a, b, t) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return "#" + c.getHexString(); }
function playAnim(s, name, fade = .25) {
  if (s.cur === name || !s.actions[name]) return;
  if (name === "Death") {
    // лежачая поза включается сразу: у мёртвых время анимации стоит, плавный переход не закончился бы
    for (const k in s.actions) if (k !== "Death") s.actions[k].stop();
    const d = s.actions.Death; d.reset(); d.enabled = true; d.setEffectiveWeight(1); d.setEffectiveTimeScale(1); d.play(); s.cur = name; return;
  }
  if (s.cur === "Death") { s.actions.Death.stop(); s.cur = null; }
  const next = s.actions[name]; next.reset(); next.enabled = true; next.setEffectiveWeight(1);
  if (s.cur && s.actions[s.cur]) s.actions[s.cur].crossFadeTo(next, fade, false);
  next.play(); s.cur = name;
}
// поднять руку вперёд: повернуть плечевую кость так, чтобы локоть смотрел по направлению dir
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
function aimBone(bone, child, dir) {
  if (!bone || !child) return;
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(false, false);
  _v1.setFromMatrixPosition(bone.matrixWorld); _v2.setFromMatrixPosition(child.matrixWorld);
  _v3.subVectors(_v2, _v1).normalize();
  _q1.setFromUnitVectors(_v3, dir);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(_q2));
}
const _fw = new THREE.Vector3();
function updateRealPeople(dt) {
  if (!REAL.ready) return;
  REAL.t -= dt;
  // раз в четверть секунды выбираем ближайших к камере
  if (REAL.t <= 0) {
    REAL.t = .25;
    const cp = camera.position, maxD = fps.on ? 110 : 150, cand = [];
    if (prefs.realPeople !== false && (fps.on || camC.dist < 420)) for (const a of agents) {
      if (a.state === "saved" || (a.hidden && !a.onRoof) || (a.player && fps.on)) continue;
      const d = Math.hypot(X(a.x) - cp.x, Z(a.y) - cp.z, (a.onRoof ? a.roofZ : 0) - cp.y * .3);
      if (d < maxD) cand.push([d, a]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    const want = new Set(cand.slice(0, REAL.N).map(p => p[1]));
    for (const s of REAL.slots) if (s.agent && !want.has(s.agent)) { s.agent.lod = false; s.agent = null; s.holder.visible = false; }
    for (const a of want) {
      if (a.lod) continue;
      const s = REAL.slots.find(s => !s.agent); if (!s) break;
      s.agent = a; a.lod = true; s.cur = null; s.mixer.stopAllAction(); s.palKey = ""; s.holder.visible = true;
    }
  }
  for (const s of REAL.slots) {
    const a = s.agent; if (!a) continue;
    if (a.state === "saved" || (a.hidden && !a.onRoof)) { a.lod = false; s.agent = null; s.holder.visible = false; continue; }
    paintPalette(s, a);
    const z = a.role === "zombie", dead = a.state === "dead", sp = a.speed || 0;
    const sc = a.size * (a.ztype === "brute" ? 1.2 : a.ztype === "titan" ? 1.65 : 1), bld = a.build || 1;
    s.holder.position.set(X(a.x), (a.z || 0) + (a.onRoof ? a.roofZ : 0) + (hasHills ? gY(a.x, a.y) : 0), Z(a.y));
    s.holder.rotation.set(dead ? (a.roll || 0) * .3 : 0, Math.PI / 2 - a.dir, 0);
    s.holder.scale.set(sc * (a.ztype === "brute" ? 1.15 : a.ztype === "titan" ? 1.25 : bld), sc, sc * (a.ztype === "titan" ? 1.1 : bld));
    // выбор анимации
    if (dead || a.riseT > 0 || a.ztype === "crawler") {
      playAnim(s, "Death", .15);
      const act = s.actions.Death, dur = act.getClip().duration;
      act.paused = true;
      act.time = a.riseT > 0 ? dur * clamp(a.riseT / 1.4) : a.ztype === "crawler" && !dead ? dur * .97 : Math.min(dur - .01, (a.deadT || 0) * 1.3);
      if (dead && a.reanimate && !a.burnt && a.deadT > a.wakeAt - 2.5) act.time = dur - .01 - Math.abs(Math.sin(simT * 30)) * .08; // судороги
    } else if (z && a.feedT > 0) { playAnim(s, "Punch"); s.actions.Punch.timeScale = .5; }
    else if (z && a.bash > 0) { playAnim(s, "Punch"); s.actions.Punch.timeScale = 1.2; }
    else if (sp > (z ? 13 : 9)) { playAnim(s, "Run"); s.actions.Run.timeScale = sp / (z ? 20 : 17); }
    else if (sp > 1) { playAnim(s, "Walk"); s.actions.Walk.timeScale = sp / (z ? 4.5 : 5.6); }
    else playAnim(s, "Idle");
    if (s.actions.Death) s.actions.Death.paused = !(dead || a.riseT > 0 || a.ztype === "crawler") ? false : true;
    s.mixer.update(dt);
    // зомби тянут руки вперёд, стрелки держат оружие
    const aiming = a.armed && !z && !dead && (a.aimT > 0 || a.role === "army");
    if ((z && !dead && !(a.feedT > 0) && !(a.bash > 0) && a.ztype !== "crawler" && !(a.riseT > 0)) || aiming) {
      s.root.updateMatrixWorld(true);
      _fw.set(Math.cos(a.dir), z ? -.12 + Math.sin(simT * 2 + a.id) * .06 : -.05, Math.sin(a.dir)).normalize();
      aimBone(s.bones.LeftArm, s.bones.LeftForeArm, _fw); aimBone(s.bones.RightArm, s.bones.RightForeArm, _fw);
      s.root.updateMatrixWorld(true);
      aimBone(s.bones.LeftForeArm, s.bones.LeftHand, _fw); aimBone(s.bones.RightForeArm, s.bones.RightHand, _fw);
    }
    // головной убор сидит на кости головы
    s.hat.visible = !!a.hat && s.bones.Head !== undefined;
    if (s.hat.visible) {
      s.root.updateMatrixWorld(true);
      const hp = s.bones.Head.getWorldPosition(_v1); s.holder.worldToLocal(hp); s.hat.position.copy(hp); s.hat.position.y += .95;
      s.hat.quaternion.copy(s.holder.quaternion).invert().multiply(s.bones.Head.getWorldQuaternion(_q2)); s.hat.rotateY(Math.PI / 2);
      s.hat.scale.setScalar(1 / sc * a.size * 1.05);
      const u = s.hat.userData, capLike = a.hat === "cap" || a.hat === "police" || a.hat === "hard" || a.hat === "bandana";
      u.capM.visible = capLike; u.visM.visible = a.hat === "cap" || a.hat === "police"; u.domeM.visible = !capLike;
      if (a.hat === "bandana") { u.capM.scale.set(1, .5, 1); } else u.capM.scale.set(1, 1, 1);
      const col = HAT_COL[a.hat] === null ? (a.hat === "hood" ? a.cloth : a.pants) : HAT_COL[a.hat];
      if (u.hatMat.userData.col !== col) { u.hatMat.userData.col = col; u.hatMat.color.set(col); }
    }
    // оружие в правой руке
    s.gun.visible = !!(a.armed && !z && !dead);
    if (s.gun.visible && s.bones.RightHand) {
      s.root.updateMatrixWorld(true);
      const hp = s.bones.RightHand.getWorldPosition(_v1);
      s.holder.worldToLocal(hp); s.gun.position.copy(hp); s.gun.rotation.set(0, 0, 0);
      s.gun.scale.set(1 / sc, 1 / sc, (a.role === "army" || a.rifle ? 1.2 : .5) / sc);
      if (aiming) s.gun.position.z += .6 / sc;
      a.muzzle = [X(a.x) + Math.cos(a.dir) * 3.2 * a.size, 5.6 * a.size + gY(a.x, a.y), Z(a.y) + Math.sin(a.dir) * 3.2 * a.size];
    }
  }
}
