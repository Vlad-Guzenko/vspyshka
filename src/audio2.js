/* ---------- новые звуки: плеватель, Титан, телефон, собаки, колокол ---------- */
sfx.spit = a => { play("flesh", a.x, a.y, .9, { rate: rnd(.45, .6), h: 6 }); play("groan" + Math.floor(Math.random() * 8), a.x, a.y, .7, { rate: rnd(1.3, 1.6), h: 6 }); };
sfx.titan = a => {
  // рёв: низкий хрип и крик поверх, с эхом
  playS("zgroan", a.x, a.y, 2.2, { rate: rnd(.4, .5), h: 10, wet: 1.4 }, "groan" + Math.floor(Math.random() * 8));
  play("scream" + Math.floor(Math.random() * 6), a.x, a.y, 1.6, { rate: rnd(.4, .5), h: 10, delay: .15, wet: 1.4 });
  play("thud", a.x, a.y, 1.2, { rate: .5, h: 2 });
  shake = Math.max(shake, 2 * clamp(1.3 - camDist() / 900, 0, 1));
};
sfx.phone = a => play("phone", a.x, a.y, .5, { h: 5 });
sfx.bark = (x, y) => play("bark", x, y, .6, { rate: rnd(.8, 1.25), h: 2 });
sfx.bell = (x, y) => play("bell", x, y, 1.2, { h: 40, wet: 1.5, rate: rnd(.95, 1.05) });
sfx.chime = () => play("chime", undefined, undefined, .35, { wet: .5 });
Object.assign(RECIPES, {
  phone: [1.3, (c, out) => { for (const t0 of [0, .7]) for (const f of [1000, 1340]) { const o = osc(c, "sine", f), g = c.createGain(); g.gain.setValueAtTime(0, 0); for (let t = t0; t < t0 + .5; t += .05) { g.gain.setValueAtTime(.12, t); g.gain.setValueAtTime(0, t + .025); } o.connect(g).connect(out); o.start(); } }],
  bark: [.32, (c, out) => { const o = osc(c, "sawtooth", 320), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(160, .25); const bp = filt(c, "bandpass", 900, 2); env(c, g, [[0, 0], [.02, 1.4], [.12, .6], [.3, .001, 1]]); o.connect(bp).connect(shaper(c, 2)).connect(g).connect(out); const n = noiseSrc(c, .32), hp = filt(c, "bandpass", 2200, 1), ng = c.createGain(); env(c, ng, [[0, 0], [.01, .5], [.15, .001, 1]]); n.connect(hp).connect(ng).connect(out); o.start(); n.start(); }],
  bell: [4, (c, out) => { for (const [f, a, d] of [[392, 1, 3.8], [588, .5, 2.6], [1047, .3, 1.8], [1570, .15, 1.2], [196, .4, 3.9]]) { const o = osc(c, "sine", f * rnd(.995, 1.005)), g = c.createGain(); env(c, g, [[0, 0], [.01, a], [d, .001, 1]]); o.connect(g).connect(out); o.start(); } const n = noiseSrc(c, .05), ng = c.createGain(); env(c, ng, [[0, 0], [.003, .6], [.04, .001, 1]]); n.connect(filt(c, "highpass", 3000)).connect(ng).connect(out); n.start(); }],
  chime: [1.2, (c, out) => { for (const [t, f] of [[0, 660], [.12, 880], [.24, 1320]]) { const o = osc(c, "sine", f), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .9); o.connect(g).connect(out); o.start(); } }],
});
Object.assign(LOOPS, {
  // гул толпы: много коротких «голосов» через форманты
  crowd: [6, (c, out) => {
    const bed = noiseSrc(c, 6, "pink"), bp = filt(c, "bandpass", 700, .7), bg = c.createGain(); bg.gain.value = .05; bed.connect(bp).connect(bg).connect(out); bed.start();
    for (let i = 0; i < 90; i++) {
      const t = Math.random() * 5.6, len = .15 + Math.random() * .35, f0 = (Math.random() < .5 ? 110 : 190) * (1 + Math.random() * .4);
      const o = osc(c, "sawtooth", f0), g = c.createGain(); o.frequency.linearRampToValueAtTime(f0 * (.85 + Math.random() * .3), t + len);
      g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .03); g.gain.linearRampToValueAtTime(0, t + len);
      const b1 = filt(c, "bandpass", 500 + Math.random() * 400, 5), b2 = filt(c, "bandpass", 1200 + Math.random() * 600, 6), sum = c.createGain();
      o.connect(b1).connect(sum); o.connect(b2).connect(sum); sum.connect(filt(c, "lowpass", 2200)).connect(g).connect(out); o.start();
    }
  }],
  // далёкие сирены: очень глухо, с медленным ростом и спадом
  farSirens: [12, (c, out) => {
    for (const [f0, f1, p, d] of [[480, 1100, 3.1, 0], [600, 1400, 4.7, 2]]) { const o = osc(c, "sawtooth", f0), g = c.createGain(); for (let t = d; t < 12; t += p) { o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + p * .5); o.frequency.linearRampToValueAtTime(f0, t + p); } g.gain.value = .12; o.connect(filt(c, "lowpass", 700)).connect(g).connect(out); o.start(); }
    const am = osc(c, "sine", .09), ag = c.createGain(); ag.gain.value = .5; const g2 = c.createGain(); g2.gain.value = .6; am.connect(ag).connect(g2.gain); am.start();
  }],
  // пустой город: ветер в проводах, хлопающая дверь, вороны
  dead: [9, (c, out) => {
    const n = noiseSrc(c, 9, "pink"), bp = filt(c, "bandpass", 900, 6), g = c.createGain(); g.gain.value = .18; const l = osc(c, "sine", .17), lg = c.createGain(); lg.gain.value = .14; l.connect(lg).connect(g.gain); n.connect(bp).connect(g).connect(out); n.start(); l.start();
    for (let i = 0; i < 4; i++) { const t = Math.random() * 8.5, s = noiseSrc(c, .08, "brown"), sg = c.createGain(); sg.gain.setValueAtTime(0, 0); sg.gain.setValueAtTime(.9, t); sg.gain.exponentialRampToValueAtTime(.001, t + .07); s.connect(filt(c, "lowpass", 500)).connect(sg).connect(out); s.start(); }
    for (let i = 0; i < 3; i++) { const t = Math.random() * 8, o = osc(c, "sawtooth", 900), og = c.createGain(); o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(600, t + .2); og.gain.setValueAtTime(0, 0); og.gain.setValueAtTime(.05, t); og.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(filt(c, "bandpass", 1500, 3)).connect(og).connect(out); o.start(); }
  }],
});

/* ---------- атмосфера: что слышно, зависит от того, жив ли город ---------- */
let ambT = 0, barkT = rnd(4, 12), bellLast = -1, dogSpot = null;
let initialPop = 0;
function updateAmbience(dt) {
  if (!AC || !audioReady || muted) return;
  const tx = camC.tx + W / 2, ty = camC.tz + H / 2, R = 140 + camC.dist * .5, zoomK = clamp(1.25 - camC.dist / 2400, .25, 1);
  const c = lastCounts || counts();
  if (!initialPop || c.H + c.I + c.Z + c.D + c.S > initialPop) initialPop = c.H + c.I + c.Z + c.D + c.S;
  const life = clamp((c.H + c.I) / Math.max(1, initialPop)), outbreak = c.Z > 10 ? clamp(c.Z / 80) : 0;
  // кто рядом с камерой: спокойные люди шумят, паникующие кричат сами
  let calm = 0, movingCars = 0;
  near(tx, ty, R, a => { if (a.state === "alive" && a.role !== "zombie" && !a.hidden && a.panic < .3) calm++; });
  nearCars(tx, ty, R, k => { if (k.moving && !k.gone && k.v > 3) movingCars++; });
  const day = 1 - nightK;
  setLoop("crowd", Math.min(1, calm / 25) * (.25 + day * .25) * zoomK * (1 - world.rain * .3));
  setLoop("farSirens", outbreak * .6 * (1 - zoomK * .3) * life);
  setLoop("dead", (1 - life) * .7 + (outbreak > .5 ? .2 : 0));
  // гул транспорта зависит от того, сколько машин вообще ездит
  if (loopNodes.hum) setLoop("hum", (.12 + day * .12) * (1 - world.rain * .4) * (.3 + life * .7) * (.4 + Math.min(1, movingCars / 8) * .6));
  // собаки лают в частном секторе и на зомби
  barkT -= dt;
  if (barkT <= 0) {
    barkT = rnd(6, 20) * (outbreak > .3 ? .4 : 1);
    const b = blocks.find(b => b.kind === "suburb" && Math.abs((b.x0 + b.x1) / 2 - tx) < R * 1.5 && Math.abs((b.y0 + b.y1) / 2 - ty) < R * 1.5);
    if (b && zoomK > .4) { const x = rnd(b.x0, b.x1), y = rnd(b.y0, b.y1); const n = outbreak > .3 ? 3 : 1; for (let i = 0; i < n; i++) setTimeout(() => sfx.bark(x, y), i * 280); }
  }
  // колокол собора отбивает час
  const hr = Math.floor(world.hour);
  if (oldTown && hr !== bellLast) { bellLast = hr; if (hr >= 7 && hr <= 21 && life > .3) { const n = hr % 12 || 12; for (let i = 0; i < Math.min(n, 6); i++) setTimeout(() => sfx.bell(oldTown.x, oldTown.y), i * 1500); } }
}
// за стенами звук глуше: в уличном виде смотрим, есть ли прямая видимость от камеры
const _spatial = spatial;
spatial = function (x, y, h) {
  const s = _spatial(x, y, h);
  if (!isFinite(s.g) || !isFinite(s.pan)) { s.g = 0; s.pan = 0; s.lp = 20000; s.wet = .2; }
  if (camC.dist < 160 && !fps.on) {
    const cx = camera.position.x + W / 2, cz = camera.position.z + H / 2;
    if (s.d > 20 && !los(cx, cz, x, y)) { s.g *= .45; s.lp = Math.min(s.lp, 900); s.wet = Math.min(.95, s.wet + .3); }
  }
  return s;
};
const _updateAudio = updateAudio;
updateAudio = function (dt) { _updateAudio(dt); updateAmbience(dt); };

/* ---------- музыка: спокойный слой, напряжение, пульс ---------- */
let music2 = null;
const SCALE = [0, 3, 5, 7, 10, 12, 15]; // минорная пентатоника
function startMusic2() {
  if (music2 || !AC) return;
  // спокойный слой: пад из двух расстроенных треугольников и редкие «капли» арпеджио
  const padLp = AC.createBiquadFilter(); padLp.type = "lowpass"; padLp.frequency.value = 700;
  const padG = AC.createGain(); padG.gain.value = 0; padLp.connect(padG).connect(musicBus);
  const padSend = AC.createGain(); padSend.gain.value = .8; padG.connect(padSend).connect(revSend);
  const pads = [220, 220.7, 330, 164.8].map((f, i) => { const o = AC.createOscillator(); o.type = i < 2 ? "triangle" : "sine"; o.frequency.value = f; const g = AC.createGain(); g.gain.value = i < 2 ? .18 : .1; o.connect(g).connect(padLp); o.start(); return o; });
  const lfo = AC.createOscillator(); lfo.frequency.value = .05; const lg = AC.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(padLp.frequency); lfo.start();
  const pluckG = AC.createGain(); pluckG.gain.value = 0; pluckG.connect(musicBus); const pluckSend = AC.createGain(); pluckSend.gain.value = 1.2; pluckG.connect(pluckSend).connect(revSend);
  const pulseG = AC.createGain(); pulseG.gain.value = 0; pulseG.connect(musicBus);
  music2 = { padG, pluckG, pulseG, pads, root: 220, beat: 0, nextT: AC.currentTime + .5, calm: 0, pulse: 0 };
  setInterval(scheduleMusic, 120);
}
function pluck(t, f, vol) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = f;
  const o2 = AC.createOscillator(); o2.type = "triangle"; o2.frequency.value = f * 2; const g2 = AC.createGain(); g2.gain.value = .25; o2.connect(g2).connect(g);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
  o.connect(g).connect(music2.pluckG); o.start(t); o.stop(t + 1.7); o2.start(t); o2.stop(t + 1.7);
}
function drum(t, kind, vol) {
  if (kind === "kick") { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + .12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(g).connect(music2.pulseG); o.start(t); o.stop(t + .4); }
  else { const n = AC.createBufferSource(); n.buffer = BUF.hat || (BUF.hat = (() => { const b = AC.createBuffer(1, SR * .08, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); return b; })()); const hp = AC.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000; const g = AC.createGain(); g.gain.value = vol; n.connect(hp).connect(g).connect(music2.pulseG); n.start(t); }
}
// планировщик: смотрит на полсекунды вперёд, чтобы ритм не плыл
function scheduleMusic() {
  const m = music2; if (!m || !AC) return;
  const now = AC.currentTime, inten = musicIntensity, on = musicOn ? 1 : 0, c = lastCounts;
  const calmK = clamp(1 - inten * 2.2) * (c && c.Z > 0 ? .6 : 1);
  m.padG.gain.setTargetAtTime(on * calmK * .5, now, 2); m.pluckG.gain.setTargetAtTime(on * calmK * .6, now, 1.5);
  m.pulseG.gain.setTargetAtTime(on * clamp((inten - .4) * 2.5) * .55, now, 1);
  const bpm = 92 + inten * 48, step = 60 / bpm / 2; // восьмые
  while (m.nextT < now + .6) {
    const t = m.nextT, b = m.beat;
    if (b % 16 === 0 && Math.random() < .5) m.root = pick([220, 196, 174.6, 146.8]);
    for (const p of m.pads) { /* пад следует за тоникой */ }
    if (b % 16 === 0) { m.pads[0].frequency.setTargetAtTime(m.root, t, 1.5); m.pads[1].frequency.setTargetAtTime(m.root * 1.004, t, 1.5); m.pads[2].frequency.setTargetAtTime(m.root * 1.5, t, 1.5); m.pads[3].frequency.setTargetAtTime(m.root * .75, t, 1.5); }
    if (calmK > .1 && (b % 4 === 0 ? Math.random() < .7 : Math.random() < .18)) pluck(t, m.root * Math.pow(2, pick(SCALE) / 12) * (Math.random() < .3 ? 2 : 1), .12 + Math.random() * .08);
    if (inten > .4) { if (b % 4 === 0) drum(t, "kick", .5 + inten * .3); if (b % 2 === 1 && inten > .55) drum(t, "hat", .06 + inten * .05); if (b % 8 === 6 && inten > .7) drum(t, "kick", .35); }
    m.nextT += step; m.beat++;
  }
}
const _startMusic = startMusic;
startMusic = function () { _startMusic(); startMusic2(); };

/* ---------- рация: голос диспетчера через синтез речи браузера ---------- */
let radioVoice = null;
function pickVoice() {
  if (!window.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang));
  return vs.find(v => /Dmitry|Pavel|Male/i.test(v.name)) || vs[0] || null;
}
if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", () => { radioVoice = pickVoice(); });
function speakRadio(text) {
  if (!window.speechSynthesis || prefs.radioVoice === false || muted) return;
  try {
    if (!radioVoice) radioVoice = pickVoice();
    if (!radioVoice) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, "")); u.voice = radioVoice; u.lang = "ru-RU"; u.rate = 1.08; u.pitch = .85; u.volume = clamp(prefs.master / 100 * .9, 0, 1);
    setTimeout(() => speechSynthesis.speak(u), 350);
  } catch (e) {}
}
