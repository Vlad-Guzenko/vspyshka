/* ---------- от первого лица: выживший или зомби ---------- */
const fps = { on: false, mode: "human", a: null, yaw: 0, pitch: 0, keys: {}, fire: false, cd: 0, kick: 0, bob: 0, score: 0, lastHp: 100, hurt: 0, msgT: 0, startT: 0, sense: true };
scene.add(camera);
// руки и оружие перед камерой
const vm = new THREE.Group(); vm.visible = false; camera.add(vm);
const skinM = new THREE.MeshStandardMaterial({ color: 0xd9a77f, roughness: .6 }), sleeveM = new THREE.MeshStandardMaterial({ color: 0x3e5f86, roughness: .8 }), gunM = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: .4, metalness: .7 });
const vmHuman = new THREE.Group(), vmZombie = new THREE.Group(); vm.add(vmHuman, vmZombie);
(() => {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, 2.6), sleeveM); arm.position.set(.9, -.9, -1.6); arm.rotation.x = .12; vmHuman.add(arm);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(.45, .55, .6), skinM); hand.position.set(.9, -.82, -2.9); vmHuman.add(hand);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.28, .42, 1.3), gunM); gun.position.set(.9, -.55, -3.3); vmHuman.add(gun);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.24, .6, .3), gunM); grip.position.set(.9, -.85, -2.95); grip.rotation.x = -.3; vmHuman.add(grip);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd080, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false })); flash.position.set(.9, -.5, -4.2); flash.scale.setScalar(1.6); flash.visible = false; vmHuman.add(flash); vmHuman.userData.flash = flash;
  const zs = new THREE.MeshStandardMaterial({ color: 0x7f8c6c, roughness: .7 }), zc = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: .9 });
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 1.1, -1, -1.2); vmZombie.add(g);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, 2.8), zs); fore.position.z = -1.3; g.add(fore);
    const rag = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .9), zc); rag.position.z = .1; g.add(rag);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .6), zs); f.position.set(-.18 + k * .12, .05, -2.9); f.rotation.x = .3; g.add(f); }
    vmZombie.userData[s] = g;
  }
})();
const flashlight = new THREE.SpotLight(0xfff2dd, 0, 140, .42, .5, 1.2); flashlight.position.set(.5, -.3, 0); camera.add(flashlight); camera.add(flashlight.target); flashlight.target.position.set(0, -.3, -10);
// чутьё зомби: живые светятся сквозь стены
const senseMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff4030, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 600);
senseMesh.count = 0; senseMesh.frustumCulled = false; senseMesh.renderOrder = 9; scene.add(senseMesh);

function startFps(mode) {
  let a = null;
  const near0 = (pred) => { let best = null, bd = 1e9; for (const b of agents) { if (!pred(b)) continue; const d = Math.hypot(X(b.x) - camC.tx, Z(b.y) - camC.tz); if (d < bd) { bd = d; best = b; } } return best; };
  if (mode === "human") { a = near0(b => b.state === "alive" && b.role === "civ" && !b.bitten); if (!a) return; if (!a.armed) arm(a, 12, 24); a.hp = 100; a.panic = 0; }
  else { a = near0(b => b.state === "alive" && b.role === "zombie") || near0(b => b.state === "alive" && b.role === "civ"); if (!a) return; if (a.role !== "zombie") turn(a); a.riseT = 0; a.zhp = 8; }
  fps.on = true; fps.mode = mode; fps.a = a; a.player = true; fps.yaw = a.dir; fps.pitch = 0; fps.score = 0; fps.lastHp = a.hp; fps.startT = simT;
  followA = null; cine = false; thirdPerson = false; tool = "watch"; renderTools();
  camera.fov = 72; camera.updateProjectionMatrix();
  $("fpsHud").hidden = false; $("fpsHelp").hidden = false; $("fpsPause").hidden = true; document.body.classList.add("fps");
  fpsMsg(mode === "human" ? "Ты выживший. Найди патроны у погибших полицейских и солдат, держись подальше от толп." : "Ты зомби. Догоняй людей и кусай. Красным светятся живые сквозь стены.");
  lockPointer();
}
function stopFps() {
  if (fps.a) fps.a.player = false;
  fps.on = false; fps.a = null; vm.visible = false; flashlight.intensity = 0; senseMesh.count = 0;
  camera.fov = 42; camera.updateProjectionMatrix();
  $("fpsHud").hidden = true; $("fpsHelp").hidden = true; $("fpsPause").hidden = true; document.body.classList.remove("fps"); $("cv").style.filter = "";
  if (document.pointerLockElement) document.exitPointerLock();
}
function lockPointer() { try { const p = cv.requestPointerLock && cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function fpsMsg(t) { $("fpsMsg").textContent = t; $("fpsMsg").hidden = false; fps.msgT = 5; }
document.addEventListener("pointerlockchange", () => { if (fps.on && document.pointerLockElement !== cv) { $("fpsPause").hidden = false; setPaused(true); } else if (fps.on) { $("fpsPause").hidden = true; setPaused(false); } });
document.addEventListener("mousemove", e => {
  if (!fps.on) return;
  const locked = document.pointerLockElement === cv;
  if (!locked && !(e.buttons & 2)) return; // без захвата курсора — смотреть с зажатой правой кнопкой
  fps.yaw += e.movementX * .0025; fps.pitch = clamp(fps.pitch - e.movementY * .0022, -1.3, 1.3);
});
cv.addEventListener("mousedown", e => { if (!fps.on) return; if (document.pointerLockElement !== cv && e.button === 0) lockPointer(); if (e.button === 0) fps.fire = true; }, true);
window.addEventListener("mouseup", e => { if (e.button === 0) fps.fire = false; });
window.addEventListener("keydown", e => { if (!fps.on) return; fps.keys[e.code] = true; if (e.code === "KeyR" && fps.mode === "human") reloadPlayer(); if (e.code === "KeyE") useNearby(); if (e.code === "KeyQ" && fps.mode === "zombie") { fps.sense = !fps.sense; } }, true);
window.addEventListener("keyup", e => { fps.keys[e.code] = false; });
function reloadPlayer() { const a = fps.a; if (a.reload <= 0 && a.mag < a.magMax && a.ammo > 0) { a.reload = 1.8; sfx.radio && play("thud", a.x, a.y, .3); } }
function useNearby() {
  const a = fps.a; if (!a) return;
  if (fps.mode === "human") {
    // подобрать патроны и оружие у погибших
    let got = 0; near(a.x, a.y, 10, b => { if (b !== a && b.state === "dead" && b.armed && (b.mag + b.ammo) > 0) { got += b.mag + b.ammo; if (b.role === "army" && a.magMax < 30) { a.magMax = 30; fpsMsg("Подобран автомат"); } b.mag = 0; b.ammo = 0; } });
    if (got) { a.ammo += got; fpsMsg(`Подобрано патронов: ${got}`); } else fpsMsg("Рядом нечего взять");
  }
}
// ввод игрока превращается в движение агента
function playerMove(a, dt) {
  const k = fps.keys, f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  const fx = Math.cos(fps.yaw), fy = Math.sin(fps.yaw), mx = fx * f - fy * r, my = fy * f + fx * r;
  const sprint = k.ShiftLeft || k.ShiftRight;
  const sp = fps.mode === "zombie" ? (sprint ? 24 : 9) : (sprint ? 18 : 6.5);
  return [mx, my, (f || r) ? sp : 0];
}
function fpsStep(dt) {
  const a = fps.a;
  if (!a) return;
  // игрок погиб или обратился
  if (fps.mode === "human" && a.role === "zombie") { fps.mode = "zombie"; a.zhp = 8; fpsMsg("Ты обратился. Теперь ты один из них — кусай живых."); }
  if (a.state === "dead") {
    if (fps.mode === "human" && a.reanimate && !a.burnt) { $("fpsDead").textContent = `Тебя загрызли. Через ${Math.max(0, Math.ceil(a.wakeAt - a.deadT))} с ты встанешь…`; $("fpsDead").hidden = false; return; }
    $("fpsDead").textContent = fps.mode === "zombie" ? `Тебя упокоили. Заражено людей: ${fps.score}. Esc — выход` : `Ты погиб. Продержался ${mmss(simT - fps.startT)}. Esc — выход`; $("fpsDead").hidden = false; return;
  }
  $("fpsDead").hidden = true;
  fps.cd -= dt; fps.kick = Math.max(0, fps.kick - dt * 6);
  if (a.hp < fps.lastHp - .5) fps.hurt = 1; fps.lastHp = a.hp; fps.hurt = Math.max(0, fps.hurt - dt * 1.5);
  a.dir = fps.yaw;
  if (fps.fire && fps.cd <= 0) {
    if (fps.mode === "human") playerShoot(a);
    else { fps.cd = .7; fps.swing = .35; let t = null, td = 8; near(a.x, a.y, 8, b => { if (b === a || b.state !== "alive" || b.role === "zombie") return; const d = Math.hypot(b.x - a.x, b.y - a.y), dot = (Math.cos(fps.yaw) * (b.x - a.x) + Math.sin(fps.yaw) * (b.y - a.y)) / (d || 1); if (d < td && dot > .5) { td = d; t = b; } }); if (t) { const was = t.bitten; bite(a, t); if (!was && t.bitten) { fps.score++; fpsMsg(`Укус! Заражено: ${fps.score}`); } } else play("flesh", a.x, a.y, .3, { rate: 1.6 }); }
  }
  fps.swing = Math.max(0, (fps.swing || 0) - dt);
}
const _rv = new THREE.Vector3();
function playerShoot(a) {
  if (a.reload > 0) return;
  if (a.mag <= 0) { if (a.ammo > 0) reloadPlayer(); else { fpsMsg("Патроны кончились. Ищи у погибших: E"); fps.cd = .4; } return; }
  const rifle = a.magMax >= 30; a.mag--; fps.cd = rifle ? .11 : .28; fps.kick = rifle ? .5 : 1; fps.pitch = clamp(fps.pitch + (rifle ? .008 : .02), -1.3, 1.3);
  vmHuman.userData.flash.visible = true; setTimeout(() => vmHuman.userData.flash.visible = false, 45);
  noises.push({ x: a.x, y: a.y, t: simT, r: 260 }); sfx.shot(rifle ? { x: a.x, y: a.y, role: "army" } : a);
  // луч из глаз: идём шагами, ищем зомби или стену
  camera.getWorldDirection(_rv);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  let hit = null, hx = 0, hy = 0, hh = 0;
  for (let s = 2; s < 340 && !hit; s += 1.5) {
    const px = ox + _rv.x * s, py = oy + _rv.y * s, pz = oz + _rv.z * s, sx = px + W / 2, sy = pz + H / 2;
    if (py < 0) { hx = sx; hy = sy; hh = 0; break; }
    const c = cellAt(sx, sy); if ((c === 3 || c === 6) && py < 40) { hx = sx; hy = sy; hh = py; break; }
    near(sx, sy, 2.5, b => { if (hit || b === a || b.state !== "alive") return; if (Math.hypot(b.x - sx, b.y - sy) < 1.4 && py > 0 && py < 7.6 * b.size) { hit = b; hh = py; hx = sx; hy = sy; } });
  }
  if (hit) {
    const head = hh > 6 * hit.size, ang = fps.yaw;
    if (hit.role === "zombie") { if (head) hit.zhp = 0; else hit.zhp--; hit.vx += Math.cos(ang) * 8; hit.vy += Math.sin(ang) * 8; fxHit(hit.x, hit.y, hh, ang); if (hit.zhp <= 0) { destroyZombie(hit, false); fpsMsg(head ? "В голову!" : "Зомби упал"); } }
    else { hit.hp -= 50; fxHit(hit.x, hit.y, hh, ang); if (hit.hp <= 0) kill(hit, false); fpsMsg("Ты попал в человека"); }
    fxShot({ muzzle: [ox + _rv.x * 3, oy - .4, oz + _rv.z * 3], role: "civ" }, hx, hy, true);
  } else fxShot({ muzzle: [ox + _rv.x * 3, oy - .4, oz + _rv.z * 3], role: "civ" }, hx || (ox + _rv.x * 300 + W / 2), hy || (oz + _rv.z * 300 + H / 2), false);
}
// камера в глазах персонажа
function fpsCamera(dt) {
  const a = fps.a; if (!a) return;
  const moving = Math.hypot(a.vx, a.vy) > 2; fps.bob += dt * Math.hypot(a.vx, a.vy) * .7;
  const lying = a.state === "dead";
  const h = lying ? 1.2 : (fps.mode === "zombie" ? 6.1 : 6.6) * a.size + (moving ? Math.sin(fps.bob) * .18 : 0);
  camera.position.set(X(a.x), h + (a.z || 0), Z(a.y));
  const cp = Math.cos(fps.pitch + fps.kick * .03);
  camera.lookAt(camera.position.x + Math.cos(fps.yaw) * cp, camera.position.y + Math.sin(fps.pitch + fps.kick * .03), camera.position.z + Math.sin(fps.yaw) * cp);
  if (lying) camera.rotateZ(.9);
  camC.tx = camera.position.x; camC.tz = camera.position.z; camC.dist = 40;
  scene.fog.near = 60; scene.fog.far = settings.night ? 420 : 1600;
  vm.visible = !lying; vmHuman.visible = fps.mode === "human"; vmZombie.visible = fps.mode === "zombie";
  vmHuman.position.set(moving ? Math.sin(fps.bob * .5) * .05 : 0, moving ? Math.abs(Math.cos(fps.bob * .5)) * .05 : 0, fps.kick * .25);
  vmHuman.rotation.x = fps.kick * .12; vmHuman.visible = vmHuman.visible && !(a.reload > 0 && Math.sin(simT * 10) > 2);
  if (a.reload > 0) vmHuman.position.y -= .6 * Math.sin(Math.min(1, a.reload / 1.8) * Math.PI);
  const sw = fps.swing || 0;
  for (const s of [-1, 1]) { const g = vmZombie.userData[s]; g.rotation.x = -.15 + (moving ? Math.sin(fps.bob + (s > 0 ? 0 : 1.5)) * .12 : 0) + (sw > 0 ? -sw * 2 : 0); g.rotation.y = sw > 0 ? -s * sw * 1.5 : 0; }
  flashlight.intensity = fps.mode === "human" && nightK > .3 ? 6 : 0;
  // чутьё
  let n = 0;
  if (fps.mode === "zombie" && fps.sense) for (const b of agents) {
    if (n >= 600 || b.state !== "alive" || b.role === "zombie") continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > 320) continue;
    _p.makeScale(5, 9, 1); _p.setPosition(X(b.x), 4, Z(b.y)); const q = camera.quaternion; _p.compose(new THREE.Vector3(X(b.x), 4, Z(b.y)), q, new THREE.Vector3(5, 9, 1)); senseMesh.setMatrixAt(n++, _p);
  }
  senseMesh.count = n; senseMesh.instanceMatrix.needsUpdate = true; senseMesh.material.opacity = .5 + .2 * Math.sin(simT * 4);
  $("cv").style.filter = fps.mode === "zombie" ? "saturate(.55) sepia(.35) hue-rotate(-20deg) contrast(1.15)" : "";
  // интерфейс
  const hp = fps.mode === "zombie" ? clamp(a.zhp / 8) * 100 : a.hp;
  $("fpsHp").style.width = clamp(hp, 0, 100) + "%"; $("fpsSt").style.width = (fps.mode === "zombie" ? 100 : clamp((a.stam ?? 1) * 100, 0, 100)) + "%";
  $("fpsAmmo").textContent = fps.mode === "human" ? (a.reload > 0 ? "Перезарядка…" : `${a.mag} / ${a.ammo}`) : `Заражено: ${fps.score}`;
  $("fpsStatus").textContent = fps.mode === "human" ? (a.bitten ? `Укушен: обратишься через ${Math.ceil(a.incT)} с` : a.onFire > 0 ? "Горишь! Беги" : a.burn > .2 ? "Ожоги" : "") : (fps.sense ? "Чутьё включено (Q)" : "Чутьё выключено (Q)");
  $("fpsVig").style.opacity = Math.max(fps.hurt, fps.mode === "human" && a.hp < 35 ? .45 : 0, fps.mode === "zombie" ? .35 : 0);
  $("fpsVig").className = "vig " + (fps.mode === "zombie" ? "z" : "");
  fps.msgT -= dt; if (fps.msgT <= 0) $("fpsMsg").hidden = true;
  // сердцебиение живых рядом с зомби
  if (fps.mode === "zombie") { fps.hb = (fps.hb || 0) - dt; let nd = 1e9, nb = null; near(a.x, a.y, 60, b => { if (b.state === "alive" && b.role !== "zombie") { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < nd) { nd = d; nb = b; } } }); if (nb && fps.hb <= 0) { fps.hb = .5 + nd / 80; play("heart", nb.x, nb.y, .9); } }
}
$("fpsResume").addEventListener("click", () => { lockPointer(); $("fpsPause").hidden = true; setPaused(false); });
$("fpsExit").addEventListener("click", () => { stopFps(); setPaused(false); });
$("playSelf").addEventListener("click", () => { $("fpsChoose").hidden = false; });
$("fpsChooseClose").addEventListener("click", () => { $("fpsChoose").hidden = true; });
$("fpsAsHuman").addEventListener("click", () => { $("fpsChoose").hidden = true; audio(); startFps("human"); });
$("fpsAsZombie").addEventListener("click", () => { $("fpsChoose").hidden = true; audio(); startFps("zombie"); });
