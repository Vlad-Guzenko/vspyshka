/* ---------- настоящие люди вблизи камеры: скелет и анимации ----------
   Модели — «Ultimate Animated Character Pack» от Quaternius (CC0), упакованы в people.js (tools/pack_people.html):
   общий скелет с анимациями и 23 персонажа — горожане, пожилые, в костюмах, рабочие, врачи, солдаты, полиция, зомби.
   У автора фигуры «чиби», голова в треть роста: в игре голова меньше, руки и ноги длиннее — пропорции ближе к настоящим.
   Раскраска — материалами по частям (кожа, рубашка, брюки, волосы), у каждого горожанина свои цвета */
const REAL = { ready: false, N: 64, slots: [], clips: {}, tpl: null, chars: {}, scale: 1, lift: 0, t: 0 };
// пропорции: голова меньше, ноги и руки длиннее (вдоль кости; нижние звенья растягиваются вместе с верхними)
const PROP_LEG = 1.3, PROP_ARM = 1.16, PROP_HEAD = .62;
// кого кем одевать: по роли, полу и возрасту; у кого своя каска или шляпа — головной убор агента не надеваем
const PEOPLE_BY = {
  m: ["Casual_Male", "Casual2_Male", "Casual3_Male", "Casual_Bald", "Suit_Male", "Worker_Male", "Casual_Male", "Casual3_Male"],
  f: ["Casual_Female", "Casual2_Female", "Casual3_Female", "Suit_Female", "Worker_Female", "Casual_Female", "Casual2_Female"],
  oldm: ["OldClassy_Male", "Casual_Bald", "Doctor_Male_Old"], oldf: ["OldClassy_Female", "Doctor_Female_Old", "Casual3_Female"],
  medicm: ["Doctor_Male_Young", "Doctor_Male_Old"], medicf: ["Doctor_Female_Young", "Doctor_Female_Old"],
  armym: ["Soldier_Male"], armyf: ["Soldier_Female"], policem: ["BlueSoldier_Male"], policef: ["BlueSoldier_Female"],
  workm: ["Worker_Male"], workf: ["Worker_Female"], zm: ["Zombie_Male"], zf: ["Zombie_Female"],
};
const OWN_HAT = new Set(["OldClassy_Male", "Worker_Male", "Soldier_Male", "Soldier_Female", "BlueSoldier_Male", "BlueSoldier_Female"]);
// у горожан рубашка и брюки — цвета агента; у формы (врачи, военные, полиция, рабочие) — свои
const UNIFORM = /^(Doctor|Soldier|BlueSoldier|Worker)/;
function charOf(a) {
  if (a.pmodel && REAL.chars[a.pmodel]) return a.pmodel;
  const f = a.sex === "f", h = (a.id * 2654435761) >>> 0, pk = list => list[h % list.length];
  let k;
  if (a.role === "zombie") k = h % 10 < 3 ? (f ? "zf" : "zm") : a.age === "old" ? (f ? "oldf" : "oldm") : f ? "f" : "m";
  else if (a.role === "medic") k = f ? "medicf" : "medicm";
  else if (a.role === "army") k = f && h % 5 === 0 ? "armyf" : "armym";
  else if (a.role === "police") k = f && h % 4 === 0 ? "policef" : "policem";
  else if (a.role === "worker" || a.role === "builder" || a.role === "sanitar" || a.role === "fire") k = f && h % 3 === 0 ? "workf" : "workm";
  else k = a.age === "old" ? (f ? "oldf" : "oldm") : f ? "f" : "m";
  a.pmodel = pk(PEOPLE_BY[k]); if (!REAL.chars[a.pmodel]) a.pmodel = Object.keys(REAL.chars)[0];
  return a.pmodel;
}
// people.js: gzip в base64 — распаковка асинхронная, люди появляются через долю секунды после загрузки
function initRealPeople() {
  if (!window.PEOPLE_GZ || !THREE.SkeletonUtils || typeof DecompressionStream === "undefined") return;
  const bin = atob(window.PEOPLE_GZ), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).text().then(t => buildPeople(JSON.parse(t))).catch(e => console.warn("модели людей не загрузились", e));
}
const _b64 = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
function charGeo(c) {
  const q = _b64(c.pos, Int16Array), p = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) { const a = i % 3; p[i] = c.mn[a] + (q[i] + 32768) / 65535 * (c.mx[a] - c.mn[a]); }
  const sw = _b64(c.sw, Uint8Array), w = new Float32Array(sw.length); for (let i = 0; i < sw.length; i++) w[i] = sw[i] / 255;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(_b64(c.si, Uint8Array)), 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(w, 4));
  g.setIndex(new THREE.BufferAttribute(_b64(c.idx, Uint16Array), 1));
  for (const [s, n, m] of c.groups) g.addGroup(s, n, m);
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
function buildPeople(P) {
  try {
    const R = P.rig, root = new THREE.Group(), dec = (o, arr) => { o.matrix.fromArray(arr); o.matrix.decompose(o.position, o.quaternion, o.scale); };
    dec(root, R.root);
    const bones = R.bones.map(r => { const b = new THREE.Bone(); b.name = r[0]; b.position.set(r[2], r[3], r[4]); b.quaternion.set(r[5], r[6], r[7], r[8]); b.scale.set(r[9], r[10], r[11]); return b; });
    // у арматуры своё имя: на него ссылаются дорожки анимации (без него three.js применил бы их к корню)
    const arm = new THREE.Group(); arm.name = R.armName || "CharacterArmature"; if (R.arm) dec(arm, R.arm); root.add(arm);
    R.bones.forEach((r, i) => (r[1] >= 0 ? bones[r[1]] : arm).add(bones[i]));
    for (const n in P.chars) { const c = P.chars[n]; REAL.chars[n] = { geo: charGeo(c), mats: c.mats }; }
    const first = Object.keys(REAL.chars)[0], mesh = new THREE.SkinnedMesh(REAL.chars[first].geo, new THREE.MeshStandardMaterial());
    dec(mesh, R.mesh); root.add(mesh); root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(R.order.map(i => bones[i]), R.inv.map(m => new THREE.Matrix4().fromArray(m))), new THREE.Matrix4().fromArray(R.bind));
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    for (const j of P.clips) { const c = THREE.AnimationClip.parse(j); REAL.clips[c.name] = c; }
    // рост после правки пропорций: макушка над ступнями; ноги длиннее — таз поднимается на прибавку длины ноги
    const B = {}; bones.forEach(b => B[b.name] = b);
    REAL.lift = (PROP_LEG - 1) * (B.LowerLegL.position.length() + (B.LowerLegL_end ? B.LowerLegL_end.position.length() : 0));
    // рост меряем на правленой фигуре, а в заготовку для слотов идёт исходная поза
    const saved = bones.map(b => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    applyProps(B); root.updateMatrixWorld(true);
    const top = B.Head_end.getWorldPosition(new THREE.Vector3()).y - Math.min(B.FootL.getWorldPosition(new THREE.Vector3()).y, 0);
    REAL.scale = 7.3 / top;
    bones.forEach((b, i) => { b.position.copy(saved[i][0]); b.quaternion.copy(saved[i][1]); b.scale.copy(saved[i][2]); });
    REAL.tpl = root;
    for (let i = 0; i < REAL.N; i++) REAL.slots.push(makeSlot());
    REAL.ready = true;
  } catch (e) { console.warn("модели людей не собрались", e); }
}
// пропорции поверх позы из анимации: анимация каждый кадр ставит масштаб костей заново
function applyProps(B) {
  B.Head.scale.setScalar(PROP_HEAD);
  for (const k of ["UpperLegL", "UpperLegR"]) B[k].scale.set(1, PROP_LEG, 1);
  for (const k of ["UpperArmL", "UpperArmR"]) B[k].scale.set(1, PROP_ARM, 1);
  for (const k of ["FistL", "FistR"]) B[k].scale.set(1, 1 / PROP_ARM, 1);
  B.Body.position.y += REAL.lift; // позицию таза анимация ставит каждый кадр
}
function makeSlot() {
  const root = THREE.SkeletonUtils.clone(REAL.tpl);
  const bones = {}; let mesh = null;
  root.traverse(o => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) bones[o.name] = o; });
  // прежние имена костей для прицеливания, оружия и головных уборов
  Object.assign(bones, { LeftArm: bones.UpperArmL, LeftForeArm: bones.LowerArmL, LeftHand: bones.FistL, RightArm: bones.UpperArmR, RightForeArm: bones.LowerArmR, RightHand: bones.FistR, Spine1: bones.Abdomen });
  const holder = new THREE.Group(); holder.add(root); root.scale.multiplyScalar(REAL.scale); holder.visible = false; scene.add(holder);
  const mixer = new THREE.AnimationMixer(root), actions = {};
  for (const k of ["Walk", "Run", "Idle", "Death", "Punch", "StandUp", "RecieveHit"]) if (REAL.clips[k]) actions[k] = mixer.clipAction(REAL.clips[k]);
  for (const k of ["Death", "StandUp"]) if (actions[k]) { actions[k].setLoop(THREE.LoopOnce); actions[k].clampWhenFinished = true; }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.3, .35, 2.6), gunMat); gun.visible = false; holder.add(gun);
  const hatMat = new THREE.MeshStandardMaterial({ roughness: .8 });
  const hat = new THREE.Group(); hat.visible = false; holder.add(hat);
  const capM = new THREE.Mesh(PARTS.cap, hatMat), visM = new THREE.Mesh(PARTS.visor, hatMat), domeM = new THREE.Mesh(PARTS.dome, hatMat);
  hat.add(capM, visM, domeM); hat.userData = { capM, visM, domeM, hatMat };
  // исходная поза костей, которые подправляются поверх анимации: у части из них в анимации нет ключей,
  // и без сброса правка копилась бы кадр за кадром
  const rest = ["Body", "Hips", "Abdomen", "Torso", "Head", "UpperLegL", "UpperLegR", "LowerLegL", "LowerLegR", "FootL", "FootR", "UpperArmL", "UpperArmR", "LowerArmL", "LowerArmR", "FistL", "FistR"]
    .filter(n => bones[n]).map(n => [bones[n], bones[n].position.clone(), bones[n].quaternion.clone(), bones[n].scale.clone()]);
  return { holder, root, mesh, mixer, actions, cur: null, agent: null, bones, gun, hat, mats: {}, char: null, palKey: "", rest };
}
// материалы слота по именам: у каждого персонажа свой набор частей, цвета ставятся при смене человека
function slotMat(s, name) { return s.mats[name] || (s.mats[name] = new THREE.MeshStandardMaterial({ roughness: name === "Face" ? .5 : .8, envMapIntensity: .5 })); }
function setChar(s, n) {
  if (s.char === n) return; s.char = n; s.palKey = "";
  const C = REAL.chars[n]; s.mesh.geometry = C.geo; s.mesh.material = C.mats.map(([m]) => slotMat(s, m));
}
// раскраска: кожа, волосы, одежда; у зомби кожа восковая, землистая, синюшная или в кровоподтёках, одежда грязная
function paintPalette(s, a) {
  const z = a.role === "zombie", burnt = a.burnt, dead = a.state === "dead", n = s.char, C = REAL.chars[n];
  const zskin = a.ztype === "spitter" ? "#9ab83a" : a.ztype === "titan" ? "#5a2620" : ["#7d8c69", "#9a9a8c", "#7f8a94", "#8a7a6a"][a.id % 4];
  const skin = burnt ? "#1b1512" : z ? mixHex(a.skin, zskin, .8) : a.burn > .3 ? mixHex(a.skin, "#7a2a18", a.burn * .8) : dead ? mixHex(a.skin, "#bdb7ad", .4) : a.skin;
  const cold = a.frozen ? 1 : a.cold > .05 && (a.buried || a.frost) ? a.cold : 0; // замерзающий синеет (sim18.js)
  const key = n + skin + a.cloth + a.pants + a.hair + (z ? "z" : "") + (dead ? "d" : "") + (burnt ? "b" : "") + Math.round(cold * 10);
  if (key === s.palKey) return; s.palKey = key;
  const own = UNIFORM.test(n) || /^Zombie/.test(n), dirt = (c, k) => z ? mixHex(c, "#3a2418", k) : c;
  for (const [m, base] of C.mats) {
    let col = base;
    if (m === "Skin") col = cold ? mixHex(skin, "#8fa8c8", cold * .75) : skin;
    else if (m === "Hair") col = z ? mixHex(a.hair, "#4a4a44", .3) : a.hair;
    else if (!own && /Shirt|Clothes|Top|Jacket|Coat/i.test(m) && !/Dark/i.test(m)) col = dirt(a.cloth, .45);
    else if (!own && /Pants|Trousers|Skirt/i.test(m)) col = dirt(a.pants, .35);
    else if (m !== "Face") col = dirt(base, .3);
    if (burnt && m !== "Face") col = "#141110";
    slotMat(s, m).color.set(col);
  }
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
// наклонить кость вокруг оси в мировых координатах (поверх позы из анимации)
const _q3 = new THREE.Quaternion();
function bendBone(bone, axis, ang) {
  if (!bone || !ang) return;
  _q1.setFromAxisAngle(axis.normalize(), ang);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3).invert();
  bone.quaternion.copy(_q3.multiply(_q2));
}
const _fw = new THREE.Vector3();
function updateRealPeople(dt) {
  if (!REAL.ready) return;
  REAL.t -= dt;
  // раз в четверть секунды выбираем ближайших к камере
  if (REAL.t <= 0) {
    REAL.t = .25;
    const cp = camera.position, maxD = fps.on ? 120 : prefs.quality === "low" ? 150 : 200, cand = [];
    if (prefs.realPeople !== false && (fps.on || camC.dist < 520)) for (const a of agents) {
      if (a.state === "saved" || (a.hidden && !a.onRoof) || (a.player && fps.on)) continue;
      const d = Math.hypot(X(a.x) - cp.x, Z(a.y) - cp.z, (a.onRoof ? a.roofZ : 0) - cp.y * .3);
      if (d < maxD) cand.push([d, a]);
    }
    // горожане на скамейках и за столиками кафе (cozy.js): не агенты симуляции, только картинка вблизи камеры
    if (prefs.realPeople !== false && (fps.on || camC.dist < 520)) for (const a of cozy.sitters) { const d = Math.hypot(X(a.x) - cp.x, Z(a.y) - cp.z, -cp.y * .3); if (d < maxD) cand.push([d + 12, a]); }
    cand.sort((p, q) => p[0] - q[0]);
    const want = new Set(cand.slice(0, REAL.N).map(p => p[1]));
    for (const s of REAL.slots) if (s.agent && !want.has(s.agent)) { s.agent.lod = false; s.agent = null; s.holder.visible = false; }
    for (const a of want) {
      if (a.lod) continue;
      const s = REAL.slots.find(s => !s.agent); if (!s) break;
      s.agent = a; a.lod = true; s.cur = null; s.mixer.stopAllAction(); setChar(s, charOf(a)); s.palKey = ""; s.holder.visible = true;
    }
  }
  for (const s of REAL.slots) {
    const a = s.agent; if (!a) continue;
    if (a.state === "saved" || (a.hidden && !a.onRoof) || a.gone) { a.lod = false; s.agent = null; s.holder.visible = false; continue; }
    setChar(s, charOf(a)); paintPalette(s, a);
    const z = a.role === "zombie", dead = a.state === "dead", sp = a.speed || 0;
    const sc = a.size * (a.ztype === "brute" ? 1.2 : a.ztype === "titan" ? 1.65 : 1), bld = a.build || 1;
    s.holder.position.set(X(a.x), (a.z || 0) + (a.onRoof ? a.roofZ : 0) + (hasHills ? gY(a.x, a.y) : 0), Z(a.y));
    s.holder.rotation.set(dead ? (a.roll || 0) * .3 : 0, Math.PI / 2 - a.dir, 0);
    s.holder.scale.set(sc * (a.ztype === "brute" ? 1.15 : a.ztype === "titan" ? 1.25 : bld), sc, sc * (a.ztype === "titan" ? 1.1 : bld));
    // выбор анимации
    if (a.riseT > 0 && s.actions.StandUp && !dead) {
      // встаёт с земли: анимация подъёма, кадр — по оставшемуся времени
      playAnim(s, "StandUp", .1);
      const act = s.actions.StandUp; act.paused = true; act.time = act.getClip().duration * (1 - clamp(a.riseT / 1.4));
    } else if (dead || a.riseT > 0 || a.ztype === "crawler") {
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
    for (const [b, p, q, sc] of s.rest) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); }
    s.mixer.update(dt);
    applyProps(s.bones);
    if (a.sit) sitPose(s, a);
    // осанка: зомби сутулятся и клонят голову набок, каждый по-своему; старики чуть горбятся; часть зомби хромает
    const upright = !dead && !(a.riseT > 0) && a.ztype !== "crawler";
    if (upright && (z || a.age === "old")) {
      s.root.updateMatrixWorld(true);
      const fx = Math.cos(a.dir), fz = Math.sin(a.dir), v = (a.id * 2654435761 % 1000) / 1000;
      bendBone(s.bones.Spine1, _v1.set(fz, 0, -fx), z ? .2 + v * .3 : .14);
      if (z) { s.root.updateMatrixWorld(true); bendBone(s.bones.Head, _v1.set(fx, 0, fz), (v - .5) * .7); }
    }
    if (z && upright && a.id % 3 === 0 && sp > 1) s.holder.rotation.z = Math.sin(simT * sp * .9 + a.id) * .07;
    // зомби тянут руки вперёд (кто обе, кто одну, а кто плетётся, свесив руки), стрелки держат оружие
    const aiming = a.armed && !z && !dead && (a.aimT > 0 || a.role === "army"), arms = z ? a.id % 4 : 0;
    if ((z && arms !== 3 && !dead && !(a.feedT > 0) && !(a.bash > 0) && a.ztype !== "crawler" && !(a.riseT > 0)) || aiming) {
      s.root.updateMatrixWorld(true);
      _fw.set(Math.cos(a.dir), z ? -.12 + Math.sin(simT * 2 + a.id) * .06 : -.05, Math.sin(a.dir)).normalize();
      if (arms !== 2) aimBone(s.bones.LeftArm, s.bones.LeftForeArm, _fw);
      aimBone(s.bones.RightArm, s.bones.RightForeArm, _fw);
      s.root.updateMatrixWorld(true);
      if (arms !== 2) aimBone(s.bones.LeftForeArm, s.bones.LeftHand, _fw);
      aimBone(s.bones.RightForeArm, s.bones.RightHand, _fw);
    }
    // регулировщик у перекрытой улицы (sim18.js): стоит лицом к подъезжающим и показывает объезд
    if (a.regul && !dead && sp < 1 && a.order && Math.hypot(a.order.x - a.x, a.order.y - a.y) < 6) { s.holder.rotation.y = Math.PI / 2 - (a.regulDir || 0); regulPose(s, a); }
    // головной убор сидит на кости головы
    s.hat.visible = !!a.hat && !OWN_HAT.has(s.char) && s.bones.Head !== undefined;
    if (s.hat.visible) {
      s.root.updateMatrixWorld(true);
      const hp = s.bones.Head.getWorldPosition(_v1).lerp(s.bones.Head_end.getWorldPosition(_v2), .78); s.holder.worldToLocal(hp); s.hat.position.copy(hp);
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
