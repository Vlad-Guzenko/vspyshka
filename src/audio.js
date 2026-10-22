/* ---------- звук: заранее синтезированные сэмплы, объёмная сцена, эхо улиц, музыка ---------- */
let busW = null, busV = null, AC = null, master = null, comp = null, sfxBus = null, revSend = null, ambBus = null, musicBus = null, muted = false, musicOn = true;
try { muted = localStorage.getItem("vspyshka-muted") === "1"; musicOn = localStorage.getItem("vspyshka-music") !== "0"; } catch (e) {}
const BUF = {};
let voices = 0, audioReady = false;
const SR = 44100;
// офлайн-рендер одного сэмпла: build(ctx, out, len) рисует граф, возвращает буфер
function render(len, build, ch = 1) {
  const ctx = new OfflineAudioContext(ch, Math.ceil(SR * len), SR);
  const out = ctx.createGain(); out.connect(ctx.destination);
  build(ctx, out, len);
  return ctx.startRendering();
}
function noiseSrc(ctx, len, color = "white") {
  const b = ctx.createBuffer(1, Math.ceil(SR * len), SR), d = b.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "brown") { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
    else if (color === "pink") { b0 = .997 * b0 + w * .029591; b1 = .985 * b1 + w * .032534; b2 = .95 * b2 + w * .048056; d[i] = (b0 + b1 + b2 + w * .05) * 2.5; }
    else d[i] = w;
  }
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function env(ctx, g, pts) { const p = g.gain; p.setValueAtTime(pts[0][1], 0); for (const [t, v, exp] of pts.slice(1)) exp ? p.exponentialRampToValueAtTime(Math.max(v, 1e-4), t) : p.linearRampToValueAtTime(v, t); }
function filt(ctx, type, f, q = .7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function shaper(ctx, k) { const ws = ctx.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * k); } ws.curve = c; return ws; }
function osc(ctx, type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }

const RECIPES = {
  // выстрелы: щелчок, корпус, низкий удар, перегруз
  pistol: [ .9, (c, out) => {
    const n = noiseSrc(c, .9), hp = filt(c, "highpass", 1800), g1 = c.createGain(); env(c, g1, [[0, 0], [.0006, 1.2], [.03, .001, 1]]); n.connect(hp).connect(g1).connect(out);
    const n2 = noiseSrc(c, .9), bp = filt(c, "bandpass", 900, .9), g2 = c.createGain(); env(c, g2, [[0, 0], [.002, 1], [.16, .001, 1]]); n2.connect(bp).connect(g2).connect(out);
    const o = osc(c, "sine", 160), g3 = c.createGain(); o.frequency.exponentialRampToValueAtTime(45, .12); env(c, g3, [[0, 0], [.003, 1.4], [.14, .001, 1]]); o.connect(g3).connect(shaper(c, 3)).connect(out);
    const n3 = noiseSrc(c, .9, "brown"), lp = filt(c, "lowpass", 500), g4 = c.createGain(); env(c, g4, [[0, 0], [.01, .5], [.8, .001, 1]]); n3.connect(lp).connect(g4).connect(out);
    n.start(); n2.start(); n3.start(); o.start(); }],
  rifle: [ .8, (c, out) => {
    const n = noiseSrc(c, .8), hp = filt(c, "highpass", 2600), g1 = c.createGain(); env(c, g1, [[0, 0], [.0004, 1.5], [.02, .001, 1]]); n.connect(hp).connect(g1).connect(out);
    const n2 = noiseSrc(c, .8), bp = filt(c, "bandpass", 1400, .8), g2 = c.createGain(); env(c, g2, [[0, 0], [.001, 1], [.1, .001, 1]]); n2.connect(bp).connect(shaper(c, 4)).connect(g2).connect(out);
    const o = osc(c, "sine", 120), g3 = c.createGain(); o.frequency.exponentialRampToValueAtTime(42, .1); env(c, g3, [[0, 0], [.002, 1.3], [.11, .001, 1]]); o.connect(g3).connect(out);
    const n3 = noiseSrc(c, .8, "brown"), lp = filt(c, "lowpass", 700), g4 = c.createGain(); env(c, g4, [[0, 0], [.01, .45], [.7, .001, 1]]); n3.connect(lp).connect(g4).connect(out);
    n.start(); n2.start(); n3.start(); o.start(); }],
  cannon: [ 3, (c, out) => {
    const n = noiseSrc(c, 3), hp = filt(c, "highpass", 1200), g1 = c.createGain(); env(c, g1, [[0, 0], [.001, 1.4], [.05, .001, 1]]); n.connect(hp).connect(g1).connect(out);
    const o = osc(c, "sine", 70), g3 = c.createGain(); o.frequency.exponentialRampToValueAtTime(24, 1); env(c, g3, [[0, 0], [.005, 1.6], [1.4, .001, 1]]); o.connect(g3).connect(shaper(c, 2)).connect(out);
    const n3 = noiseSrc(c, 3, "brown"), lp = filt(c, "lowpass", 400), g4 = c.createGain(); env(c, g4, [[0, 0], [.02, 1.4], [2.8, .001, 1]]); n3.connect(lp).connect(g4).connect(out);
    n.start(); n3.start(); o.start(); }],
  boom: [ 4.5, (c, out) => {
    const n = noiseSrc(c, 4.5), lp = filt(c, "lowpass", 3000), g1 = c.createGain(); lp.frequency.exponentialRampToValueAtTime(90, 2.5); env(c, g1, [[0, 0], [.004, 1.5], [3.8, .001, 1]]); n.connect(lp).connect(shaper(c, 2.5)).connect(g1).connect(out);
    const o = osc(c, "sine", 55), g3 = c.createGain(); o.frequency.exponentialRampToValueAtTime(18, 2.2); env(c, g3, [[0, 0], [.01, 1.8], [2.5, .001, 1]]); o.connect(g3).connect(out);
    const n3 = noiseSrc(c, 4.5, "brown"), lp3 = filt(c, "lowpass", 160), g4 = c.createGain(); env(c, g4, [[0, 0], [.1, 1.5], [4.4, .001, 1]]); n3.connect(lp3).connect(g4).connect(out);
    // осыпающиеся обломки
    for (let i = 0; i < 40; i++) { const t = .4 + Math.random() * 3.2, s = noiseSrc(c, .2), b = filt(c, "bandpass", 600 + Math.random() * 3000, 2), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(.25 * (1 - t / 4), t); g.gain.exponentialRampToValueAtTime(.001, t + .08); s.connect(b).connect(g).connect(out); s.start(); }
    n.start(); n3.start(); o.start(); }],
  collapse: [ 7, (c, out) => {
    const n3 = noiseSrc(c, 7, "brown"), lp3 = filt(c, "lowpass", 220), g4 = c.createGain(); env(c, g4, [[0, 0], [.6, 1.6], [4, 1.2], [6.9, .001, 1]]); n3.connect(lp3).connect(shaper(c, 2)).connect(g4).connect(out);
    const o = osc(c, "sine", 40), g3 = c.createGain(); o.frequency.linearRampToValueAtTime(28, 5); env(c, g3, [[0, 0], [.5, 1], [5, .001, 1]]); o.connect(g3).connect(out);
    for (let i = 0; i < 140; i++) { const t = Math.random() * 5.5, s = noiseSrc(c, .3), b = filt(c, "bandpass", 300 + Math.random() * 2500, 1.5), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(.35 * Math.random(), t); g.gain.exponentialRampToValueAtTime(.001, t + .05 + Math.random() * .15); s.connect(b).connect(g).connect(out); s.start(); }
    for (let i = 0; i < 25; i++) { const t = Math.random() * 3, s = noiseSrc(c, .4), b = filt(c, "highpass", 4000), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); s.connect(b).connect(g).connect(out); s.start(); } // стекло
    n3.start(); o.start(); }],
  thunder: [ 6, (c, out) => {
    const n = noiseSrc(c, 6, "brown"), lp = filt(c, "lowpass", 300), g = c.createGain(); env(c, g, [[0, 0], [.05, 1.4], [.6, .7], [1.1, 1.2], [5.9, .001, 1]]); n.connect(lp).connect(shaper(c, 2)).connect(g).connect(out);
    const n2 = noiseSrc(c, 6), hp = filt(c, "highpass", 1500), g2 = c.createGain(); env(c, g2, [[0, 0], [.005, .6], [.3, .001, 1]]); n2.connect(hp).connect(g2).connect(out); n.start(); n2.start(); }],
  flesh: [ .35, (c, out) => {
    const n = noiseSrc(c, .35), bp = filt(c, "bandpass", 2200, 3), g = c.createGain(); bp.frequency.exponentialRampToValueAtTime(300, .25); env(c, g, [[0, 0], [.01, 1], [.3, .001, 1]]); n.connect(bp).connect(g).connect(out);
    const o = osc(c, "sine", 90), g2 = c.createGain(); env(c, g2, [[0, 0], [.005, .8], [.12, .001, 1]]); o.connect(g2).connect(out); n.start(); o.start(); }],
  thud: [ .4, (c, out) => {
    const o = osc(c, "sine", 110), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(40, .2); env(c, g, [[0, 0], [.004, 1.4], [.3, .001, 1]]); o.connect(g).connect(out);
    const n = noiseSrc(c, .4), lp = filt(c, "lowpass", 900), g2 = c.createGain(); env(c, g2, [[0, 0], [.003, 1], [.2, .001, 1]]); n.connect(lp).connect(g2).connect(out); n.start(); o.start(); }],
  crash: [ 1.2, (c, out) => {
    const n = noiseSrc(c, 1.2), bp = filt(c, "bandpass", 1800, .7), g = c.createGain(); env(c, g, [[0, 0], [.004, 1.2], [1.1, .001, 1]]); n.connect(bp).connect(shaper(c, 3)).connect(g).connect(out);
    for (let i = 0; i < 8; i++) { const f = 1500 + Math.random() * 5000, o = osc(c, "sine", f), gg = c.createGain(); env(c, gg, [[0, 0], [.005, .08], [.8, .001, 1]]); o.connect(gg).connect(out); o.start(); }
    n.start(); }],
  horn: [ .7, (c, out) => {
    for (const f of [415, 520]) { const o = osc(c, "square", f), lp = filt(c, "lowpass", 1800), g = c.createGain(); env(c, g, [[0, 0], [.02, .25], [.6, .25], [.68, 0]]); o.connect(lp).connect(g).connect(out); o.start(); } }],
  radio: [ .6, (c, out) => {
    const n = noiseSrc(c, .6), bp = filt(c, "bandpass", 1800, 1.5), g = c.createGain(); env(c, g, [[0, 0], [.01, .5], [.25, .4], [.3, 0]]); n.connect(bp).connect(g).connect(out);
    const o = osc(c, "sine", 1150), g2 = c.createGain(); g2.gain.setValueAtTime(0, 0); g2.gain.setValueAtTime(.2, .35); g2.gain.setValueAtTime(0, .45); o.connect(g2).connect(out); n.start(); o.start(); }],
  nuke: [ 14, (c, out) => {
    const n = noiseSrc(c, 14, "brown"), lp = filt(c, "lowpass", 260), g = c.createGain(); env(c, g, [[0, 0], [.08, 2.4], [3, 1.8], [13.9, .001, 1]]); n.connect(lp).connect(shaper(c, 3)).connect(g).connect(out);
    const o = osc(c, "sine", 38), g2 = c.createGain(); o.frequency.exponentialRampToValueAtTime(16, 6); env(c, g2, [[0, 0], [.05, 2.2], [8, .001, 1]]); o.connect(g2).connect(out);
    const n2 = noiseSrc(c, 14), bp = filt(c, "bandpass", 900, .5), g3 = c.createGain(); env(c, g3, [[0, 0], [.02, 1.4], [1.5, .3], [10, .001, 1]]); n2.connect(bp).connect(g3).connect(out);
    for (let i = 0; i < 120; i++) { const t = 1 + Math.random() * 11, s = noiseSrc(c, .3), b = filt(c, "bandpass", 200 + Math.random() * 1500, 1.2), gg = c.createGain(); gg.gain.setValueAtTime(0, 0); gg.gain.setValueAtTime(.3 * Math.random(), t); gg.gain.exponentialRampToValueAtTime(.001, t + .2); s.connect(b).connect(gg).connect(out); s.start(); }
    n.start(); n2.start(); o.start(); }],
  heart: [ .9, (c, out) => {
    for (const [t, a] of [[0, 1], [.28, .7]]) { const o = osc(c, "sine", 55), g = c.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + .15); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g).connect(out); o.start(); } }],
};
// голоса: хрип зомби и крики людей через форманты
function voiceRecipe(kind, i) {
  const len = kind === "groan" ? 1 + Math.random() * 1.2 : .6 + Math.random() * .9;
  return [len, (c, out) => {
    const f0 = kind === "groan" ? 70 + Math.random() * 60 : (i % 2 ? 380 : 560) + Math.random() * 300;
    const o = osc(c, "sawtooth", f0), vib = osc(c, "sine", kind === "groan" ? 4 + Math.random() * 3 : 6 + Math.random() * 2), vg = c.createGain(); vg.gain.value = f0 * (kind === "groan" ? .04 : .05); vib.connect(vg).connect(o.frequency);
    if (kind === "groan") o.frequency.linearRampToValueAtTime(f0 * .8, len); else { o.frequency.linearRampToValueAtTime(f0 * 1.25, len * .3); o.frequency.linearRampToValueAtTime(f0 * .7, len); }
    // хрип: амплитудная «фрай»-модуляция
    const am = c.createGain(), fry = osc(c, "square", kind === "groan" ? 30 + Math.random() * 25 : 0.01), fg = c.createGain(); fg.gain.value = kind === "groan" ? .45 : 0; am.gain.value = .6; fry.connect(fg).connect(am.gain);
    const sum = c.createGain(); sum.gain.value = 1;
    const F = kind === "groan" ? [[450 + Math.random() * 200, 7], [850 + Math.random() * 300, 9], [2400, 12]] : [[900 + Math.random() * 200, 6], [1350 + Math.random() * 300, 8], [2900, 10]];
    o.connect(am);
    for (const [f, q] of F) { const b = filt(c, "bandpass", f, q); am.connect(b).connect(sum); }
    const br = noiseSrc(c, len), bb = filt(c, "bandpass", kind === "groan" ? 700 : 2500, 1), bgn = c.createGain(); bgn.gain.value = kind === "groan" ? .35 : .15; br.connect(bb).connect(bgn).connect(sum);
    const g = c.createGain(); env(c, g, [[0, 0], [len * .15, kind === "groan" ? 2.2 : 2.6], [len * .7, kind === "groan" ? 1.8 : 2.2], [len, .001, 1]]);
    sum.connect(shaper(c, 1.5)).connect(g).connect(out);
    o.start(); vib.start(); fry.start(); br.start();
  }];
}
// петли: гул города, моторы, огонь, дождь, сверчки, вертолёт, сирены, сигнализация
const LOOPS = {
  hum: [4, (c, out) => { const n = noiseSrc(c, 4, "brown"), lp = filt(c, "lowpass", 220), g = c.createGain(); g.gain.value = .8; n.connect(lp).connect(g).connect(out); const n2 = noiseSrc(c, 4, "pink"), bp = filt(c, "bandpass", 900, .5), g2 = c.createGain(); g2.gain.value = .08; n2.connect(bp).connect(g2).connect(out); n.start(); n2.start(); }],
  engine: [2, (c, out) => { const n = noiseSrc(c, 2, "brown"), lp = filt(c, "lowpass", 140), g = c.createGain(); g.gain.value = 1.2; const am = osc(c, "sine", 32), ag = c.createGain(); ag.gain.value = .3; am.connect(ag).connect(g.gain); n.connect(lp).connect(g).connect(out); const t = noiseSrc(c, 2, "pink"), bp = filt(c, "bandpass", 1100, .8), tg = c.createGain(); tg.gain.value = .12; t.connect(bp).connect(tg).connect(out); n.start(); am.start(); t.start(); }],
  fire: [3, (c, out) => { const n = noiseSrc(c, 3, "brown"), lp = filt(c, "lowpass", 600), g = c.createGain(); g.gain.value = .9; n.connect(lp).connect(g).connect(out); for (let i = 0; i < 160; i++) { const t = Math.random() * 2.9, s = noiseSrc(c, .05), hp = filt(c, "highpass", 2000 + Math.random() * 4000), gg = c.createGain(); gg.gain.setValueAtTime(0, 0); gg.gain.setValueAtTime(.4 * Math.random(), t); gg.gain.exponentialRampToValueAtTime(.001, t + .015 + Math.random() * .03); s.connect(hp).connect(gg).connect(out); s.start(); } n.start(); }],
  rain: [3, (c, out) => { const n = noiseSrc(c, 3, "pink"), hp = filt(c, "highpass", 400), lp = filt(c, "lowpass", 7000), g = c.createGain(); g.gain.value = .9; n.connect(hp).connect(lp).connect(g).connect(out); for (let i = 0; i < 300; i++) { const t = Math.random() * 2.95, s = noiseSrc(c, .03), bp = filt(c, "bandpass", 2000 + Math.random() * 5000, 3), gg = c.createGain(); gg.gain.setValueAtTime(0, 0); gg.gain.setValueAtTime(.3 * Math.random(), t); gg.gain.exponentialRampToValueAtTime(.001, t + .02); s.connect(bp).connect(gg).connect(out); s.start(); } n.start(); }],
  crickets: [2, (c, out) => { for (let k = 0; k < 3; k++) { const f = 4200 + k * 350 + Math.random() * 200, o = osc(c, "sine", f), g = c.createGain(); g.gain.value = 0; const ph = Math.random(); for (let t = ph * .3; t < 2; t += .28 + k * .05) for (let j = 0; j < 4; j++) { const tt = t + j * .025; if (tt > 1.98) break; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.12, tt + .006); g.gain.linearRampToValueAtTime(0, tt + .018); } o.connect(g).connect(out); o.start(); } }],
  heli: [1, (c, out) => { for (let t = 0; t < 1; t += .1) { const s = noiseSrc(c, .12, "brown"), lp = filt(c, "lowpass", 380), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.6, t + .01); g.gain.exponentialRampToValueAtTime(.01, t + .09); s.connect(lp).connect(g).connect(out); s.start(); } const o = osc(c, "sine", 2900), og = c.createGain(); og.gain.value = .02; o.connect(og).connect(out); o.start(); const n = noiseSrc(c, 1), hp = filt(c, "bandpass", 1600, .6), ng = c.createGain(); ng.gain.value = .12; n.connect(hp).connect(ng).connect(out); n.start(); }],
  sirenPolice: [4, (c, out) => { const o = osc(c, "square", 700), lp = filt(c, "lowpass", 2600), g = c.createGain(); g.gain.value = .22; o.frequency.setValueAtTime(700, 0); o.frequency.linearRampToValueAtTime(1500, 1.9); o.frequency.linearRampToValueAtTime(700, 3.98); o.connect(lp).connect(g).connect(out); o.start(); }],
  sirenFire: [6, (c, out) => { const o = osc(c, "sawtooth", 500), lp = filt(c, "lowpass", 2000), g = c.createGain(); g.gain.value = .2; o.frequency.setValueAtTime(480, 0); o.frequency.linearRampToValueAtTime(1150, 2.8); o.frequency.linearRampToValueAtTime(480, 5.98); o.connect(lp).connect(g).connect(out); o.start(); }],
  alarm: [1, (c, out) => { const o = osc(c, "square", 900), lp = filt(c, "lowpass", 3000), g = c.createGain(); g.gain.value = .2; for (let t = 0; t < 1; t += .25) { o.frequency.setValueAtTime(800, t); o.frequency.linearRampToValueAtTime(1600, t + .22); } o.connect(lp).connect(g).connect(out); o.start(); }],
  raid: [8, (c, out) => { for (const det of [0, 4]) { const o = osc(c, "sawtooth", 300 + det), lp = filt(c, "lowpass", 1400), g = c.createGain(); g.gain.value = .14; o.frequency.setValueAtTime(260, 0); o.frequency.linearRampToValueAtTime(820, 3.5); o.frequency.setValueAtTime(820, 4.2); o.frequency.linearRampToValueAtTime(260, 7.98); o.connect(lp).connect(g).connect(out); o.start(); } }],
  wind: [5, (c, out) => { const n = noiseSrc(c, 5, "pink"), bp = filt(c, "bandpass", 500, .4), g = c.createGain(); g.gain.value = .5; const l = osc(c, "sine", .23), lg = c.createGain(); lg.gain.value = .3; l.connect(lg).connect(g.gain); n.connect(bp).connect(g).connect(out); n.start(); l.start(); }],
};
const loopNodes = {};
function makeIR(seconds = 2.4) {
  // импульс улицы: ранние отражения от стен и долгий хвост
  const len = Math.floor(SR * seconds), ir = AC.createBuffer(2, len, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * .5;
    for (let k = 0; k < 14; k++) { const at = Math.floor(SR * (.02 + Math.random() * .25)); d[at] += (Math.random() < .5 ? -1 : 1) * (.6 - k * .03); }
  }
  return ir;
}
async function audio() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
  comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .25;
  master = AC.createGain(); master.gain.value = muted ? 0 : .8; master.connect(comp).connect(AC.destination);
  const rev = AC.createConvolver(); rev.buffer = makeIR(); const revG = AC.createGain(); revG.gain.value = .55; rev.connect(revG).connect(master);
  revSend = rev;
  sfxBus = AC.createGain(); sfxBus.connect(master);
  busW = AC.createGain(); busW.connect(sfxBus); busV = AC.createGain(); busV.connect(sfxBus);
  ambBus = AC.createGain(); ambBus.gain.value = .9; ambBus.connect(master);
  musicBus = AC.createGain(); musicBus.gain.value = musicOn ? .5 : 0; musicBus.connect(master);
  // сэмплы рендерятся в фоне, звук включается по мере готовности
  const jobs = Object.entries(RECIPES).map(([k, [len, fn]]) => render(len, fn).then(b => BUF[k] = b));
  renderBooms(jobs);
  for (let i = 0; i < 8; i++) { const [len, fn] = voiceRecipe("groan", i); jobs.push(render(len, fn).then(b => BUF["groan" + i] = b)); }
  for (let i = 0; i < 6; i++) { const [len, fn] = screamRecipe(i); jobs.push(render(len, fn).then(b => BUF["scream" + i] = b)); }
  for (const [k, [len, fn]] of Object.entries(LOOPS)) jobs.push(render(len, fn).then(b => { BUF["loop_" + k] = b; startLoop(k); }));
  Promise.all(jobs).then(() => { audioReady = true; startMusic(); loadSamples(); });
  applyPrefs();
}
function startLoop(k) {
  const s = AC.createBufferSource(); s.buffer = BUF["loop_" + k]; s.loop = true;
  const g = AC.createGain(); g.gain.value = 0; const pan = AC.createStereoPanner(); const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 18000;
  s.connect(lp).connect(g).connect(pan).connect(k === "hum" || k === "wind" || k === "rain" || k === "crickets" ? ambBus : sfxBus);
  if (k !== "hum" && k !== "wind" && k !== "rain" && k !== "crickets") { const send = AC.createGain(); send.gain.value = .25; g.connect(send).connect(revSend); }
  s.start(0, Math.random() * s.buffer.duration);
  loopNodes[k] = { g, pan, lp, src: s };
}
function setLoop(k, vol, pan = 0, lpF = 18000) {
  const L = loopNodes[k]; if (!L) return;
  const t = AC.currentTime; L.g.gain.setTargetAtTime(Math.max(0, vol), t, .25); L.pan.pan.setTargetAtTime(clamp(pan, -1, 1), t, .2); L.lp.frequency.setTargetAtTime(lpF, t, .3);
}
// положение источника относительно камеры: громкость, панорама, глухость с расстоянием
const _ap = new THREE.Vector3();
function spatial(x, y, h = 4) {
  _ap.set(X(x), h, Z(y));
  const d = _ap.distanceTo(camera.position);
  _ap.project(camera);
  const behind = _ap.z > 1;
  return { g: 1 / Math.pow(1 + d / 160, 1.35), pan: clamp(behind ? -_ap.x : _ap.x, -1, 1) * .85, lp: clamp(20000 * Math.exp(-d / 700), 500, 20000), wet: clamp(.15 + d / 900, .15, .9), d };
}
function play(name, x, y, vol = 1, opt = {}) {
  if (!AC || muted || !BUF[name]) return;
  const sp = x === undefined ? { g: 1, pan: 0, lp: 20000, wet: .2 } : spatial(x, y, opt.h);
  const v = opt.gain !== undefined ? opt.gain * vol : vol * sp.g;
  if (!opt.prio && (v < .012 || voices > 28)) return;
  voices++;
  const s = AC.createBufferSource(); s.buffer = BUF[name]; s.playbackRate.value = opt.rate || 1;
  const g = AC.createGain(); g.gain.value = v; const pan = AC.createStereoPanner(); pan.pan.value = sp.pan; const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = sp.lp;
  const base = name.replace("__s_", "");
  s.connect(lp).connect(g).connect(pan).connect(/^(pistol|rifle|heavy|shotgun|cannon|boom|collapse|thunder|crash|nuke|glass|metal|slam)/.test(base) ? busW : /^(groan|scream|flesh|pain|zgroan|zrunner|moans)/.test(base) ? busV : sfxBus);
  const send = AC.createGain(); send.gain.value = sp.wet * (opt.wet ?? 1); pan.connect(send).connect(revSend);
  s.onended = () => { voices--; s.disconnect(); };
  const off = opt.slice ? Math.random() * Math.max(0, s.buffer.duration - opt.slice) : 0;
  if (opt.slice) s.start(AC.currentTime + (opt.delay || 0), off, opt.slice); else s.start(AC.currentTime + (opt.delay || 0));
}
let shotBudget = 0;
const sfx = {
  shot(a) { if (shotBudget > 6) return; shotBudget++; const rifle = a.role === "army" || a.tank || a.magMax >= 30; playS(rifle ? "rifle" : "pistol", a.x, a.y, a.tank ? 1 : 1.2, { rate: rnd(.94, 1.06) }, rifle ? "rifle" : "pistol"); },
  pain(a) { if (Math.random() < .4) return; playS("pain", a.x, a.y, .7, { rate: (a.skirt || a.age === "kid" ? rnd(1.25, 1.45) : rnd(.92, 1.08)), h: 6 }, "flesh"); },
  scream(a) { if (Math.random() < .5) return; playS("scream", a.x, a.y, .8, { rate: a.skirt || a.age === "kid" ? rnd(1.25, 1.42) : a.age === "old" ? rnd(.85, .95) : rnd(.95, 1.08), h: 6 }, "scream" + Math.floor(Math.random() * 6)); },
  groan(a) {
    const opt = { rate: rnd(.85, 1.08) * (a.ztype === "brute" ? .8 : 1), h: 6 };
    if (a.ztype === "runner") return playS("zrunner", a.x, a.y, .8, opt, "groan1");
    if (Math.random() < .45) playS("moans", a.x, a.y, .9, { ...opt, slice: rnd(1.4, 2.4) }, "groan2"); else playS("zgroan", a.x, a.y, .85, opt, "groan" + Math.floor(Math.random() * 8));
  },
  boom(x, y, big) { if (BUF.boomN0) playBoom(x, y, big ? 2 : 1); else play("boom", x, y, 1.8, { prio: true }); if (big) playS("glass", x, y, .8, { delay: .4 }); },
  cannon(t) { play("cannon", t.x, t.y, 1.4, { h: 8 }); playS("heavy", t.x, t.y, 2, { rate: .62, h: 8 }); },
  collapse(b) { const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2; play("collapse", x, y, 2.4, { h: 30 }); for (let i = 0; i < 4; i++) playS(i % 2 ? "glass" : "slam", x, y, 1.2, { delay: rnd(0, 2.5), rate: rnd(.7, 1) }); },
  thunder() { play("thunder", undefined, undefined, .9, { delay: rnd(.2, 1.4) }); },
  jet() { /* пролёт озвучивается петлёй в updateAudio */ jetT = 6; },
  siren() {}, radio() { play("radio", undefined, undefined, .35); },
  crash(c) { if (!c) return; playS(Math.random() < .5 ? "glass" : "metal", c.x, c.y, 1.1, { rate: rnd(.8, 1.1) }, "crash"); playS("slam", c.x, c.y, .8, { rate: rnd(.7, .9) }); },
  deny() { play("chime", undefined, undefined, .45, { rate: .5 }); },
  horn(c) { play("horn", c.x, c.y, .7, { rate: rnd(.9, 1.1) }); },
  thud(c) { playS("hit", c.x, c.y, 1, { rate: rnd(.7, .9) }, "thud"); play("flesh", c.x, c.y, .7); },
  nuke(x, y) { const d = Math.hypot(X(x) - camC.tx, Z(y) - camC.tz) + camC.dist * .5; play("nuke", undefined, undefined, 2.6, { delay: Math.min(4, d / 1360), wet: .6 }); },
  shriek(a) { play("scream" + Math.floor(Math.random() * 6), a.x, a.y, 1.4, { rate: rnd(.55, .7), h: 6 }); play("groan" + Math.floor(Math.random() * 8), a.x, a.y, 1, { rate: 1.6 }); },
  bite(a) { play("flesh", a.x, a.y, .9, { rate: rnd(.8, 1.2) }); },
};
let jetT = 0, groanT = 0, birdT = 0, heartT = 0;
// окружение пересчитывается каждый кадр: что рядом с камерой, то и слышно
function updateAudio(dt) {
  shotBudget = 0;
  if (!AC || !audioReady || muted) return;
  const tx = camC.tx + W / 2, ty = camC.tz + H / 2, R = 120 + camC.dist * .5, zoomK = clamp(1.25 - camC.dist / 2400, .25, 1);
  let zn = 0, zc = null, cars0 = 0, fire = 0, fx = 0, fy = 0, siren = null, sd = 1e9, alarm = null, ad = 1e9;
  nearZ(tx, ty, R, z => { zn++; if (!zc || Math.random() < .2) zc = z; });
  nearCars(tx, ty, R, c => {
    if (c.moving && !c.gone) cars0++;
    if ((c.service === "police" || c.service === "fire" || c.service === "ambulance") && c.moving) { const d = Math.hypot(c.x - tx, c.y - ty); if (d < sd) { sd = d; siren = c; } }
    if (c.alarm > 0) { const d = Math.hypot(c.x - tx, c.y - ty); if (d < ad) { ad = d; alarm = c; } }
  });
  for (const f of fires) { const d = Math.hypot(f.x - tx, f.y - ty); if (d < R) { fire += f.r / 10; fx = f.x; fy = f.y; } }
  for (const b of buildings) if (b.fire > 0 && Math.abs((b.x0 + b.x1) / 2 - tx) < R && Math.abs((b.y0 + b.y1) / 2 - ty) < R) { fire += 3; fx = (b.x0 + b.x1) / 2; fy = (b.y0 + b.y1) / 2; }
  const day = 1 - nightK;
  setLoop("hum", (.25 + day * .2) * (1 - world.rain * .4));
  setLoop("wind", .12 + world.rain * .3 + (world.weather === "storm" ? .3 : 0));
  setLoop("rain", world.rain * .5 * (.5 + zoomK * .5));
  setLoop("crickets", nightK * (1 - world.rain) * .35 * zoomK);
  setLoop("engine", Math.min(1, cars0 / 6) * .55 * zoomK);
  if (fire > 0) { const s = spatial(fx, fy); setLoop("fire", Math.min(1.2, fire * .25) * s.g * 3, s.pan, s.lp); } else setLoop("fire", 0);
  if (siren) { const s = spatial(siren.x, siren.y); setLoop(siren.service === "police" ? "sirenPolice" : "sirenFire", s.g * 2.2, s.pan, s.lp); setLoop(siren.service === "police" ? "sirenFire" : "sirenPolice", 0); } else { setLoop("sirenPolice", 0); setLoop("sirenFire", 0); }
  if (alarm) { const s = spatial(alarm.x, alarm.y); setLoop("alarm", s.g * 1.4, s.pan, s.lp); } else setLoop("alarm", 0);
  if (evac) { const s = spatial(evac.hx, evac.hy, evac.alt + 8); setLoop("heli", s.g * 3.5, s.pan, s.lp); } else setLoop("heli", 0);
  // толпа зомби хрипит тем гуще, чем их больше рядом
  groanT -= dt;
  if (zn && groanT <= 0) { groanT = rnd(.15, .6) * 4 / Math.min(12, zn + 2); if (zc) sfx.groan(zc); }
  // днём птицы в парках
  birdT -= dt;
  if (day > .6 && world.rain < .3 && birdT <= 0 && zoomK > .5) { birdT = rnd(1.5, 5); chirp(); }
  // тревожная музыка
  const c = lastCounts || counts(), total = c.H + c.I + c.Z + 1, danger = clamp(c.Z / total * 2.2 + Math.min(zn, 8) / 16);
  musicIntensity += (danger - musicIntensity) * Math.min(1, dt * .3);
  heartT -= dt;
  if (musicOn && musicIntensity > .35 && heartT <= 0) { heartT = 60 / (62 + musicIntensity * 70); play("heart", undefined, undefined, .25 + musicIntensity * .35, { wet: .1 }); }
  if (jetT > 0) { jetT -= dt; }
  setLoop("raid", nuke && !nuke.det ? .9 : 0);
}
function chirp() {
  if (!AC) return;
  const t0 = AC.currentTime, n = 2 + Math.floor(Math.random() * 5), base = rnd(2600, 4800), pan = AC.createStereoPanner(); pan.pan.value = rnd(-.8, .8); pan.connect(ambBus);
  for (let i = 0; i < n; i++) {
    const o = AC.createOscillator(), g = AC.createGain(), t = t0 + i * rnd(.09, .16);
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), t + .04); o.frequency.exponentialRampToValueAtTime(base * .9, t + .08);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .09);
    o.connect(g).connect(pan); o.start(t); o.stop(t + .1);
  }
}
/* ---------- музыка: тёмный эмбиент, нарастает со вспышкой ---------- */
let musicIntensity = 0, musicNodes = null, lastCounts = null;
function startMusic() {
  if (musicNodes || !AC) return;
  const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400; lp.Q.value = 2;
  const g = AC.createGain(); g.gain.value = 0; lp.connect(g).connect(musicBus);
  const send = AC.createGain(); send.gain.value = .6; g.connect(send).connect(revSend);
  const voicesM = [55, 55.4, 82.4, 110.3].map((f, i) => { const o = AC.createOscillator(); o.type = i < 2 ? "sawtooth" : "triangle"; o.frequency.value = f; const og = AC.createGain(); og.gain.value = i < 2 ? .22 : .12; o.connect(og).connect(lp); o.start(); return o; });
  const lfo = AC.createOscillator(); lfo.frequency.value = .07; const lg = AC.createGain(); lg.gain.value = 180; lfo.connect(lg).connect(lp.frequency); lfo.start();
  // высокий диссонанс на пике
  const hi = [880, 932.3].map(f => { const o = AC.createOscillator(); o.type = "sine"; o.frequency.value = f; o.start(); return o; });
  const hg = AC.createGain(); hg.gain.value = 0; for (const o of hi) o.connect(hg); hg.connect(musicBus); const hs = AC.createGain(); hs.gain.value = .5; hg.connect(hs).connect(revSend);
  musicNodes = { g, lp, voicesM, hg };
  // смена гармонии раз в 10 секунд
  const roots = [55, 43.65, 49, 41.2];
  let k = 0;
  setInterval(() => { if (!musicNodes) return; k = (k + 1) % roots.length; const r = roots[k], t = AC.currentTime; voicesM[0].frequency.setTargetAtTime(r, t, 2); voicesM[1].frequency.setTargetAtTime(r * 1.006, t, 2); voicesM[2].frequency.setTargetAtTime(r * 1.5, t, 2); voicesM[3].frequency.setTargetAtTime(r * (k % 2 ? 2.38 : 2), t, 2); }, 10000);
  setInterval(() => { if (!musicNodes || !AC) return; const t = AC.currentTime, m = musicOn ? 1 : 0; musicNodes.g.gain.setTargetAtTime(m * (.05 + musicIntensity * .3), t, 1.5); musicNodes.hg.gain.setTargetAtTime(m * clamp(musicIntensity - .6) * .05, t, 2); }, 500);
}
function setMuted(m) { muted = m; try { localStorage.setItem("vspyshka-muted", m ? "1" : "0"); } catch (e) {} if (master) master.gain.value = m ? 0 : prefs.master / 100; $("mute").setAttribute("aria-pressed", m); $("mute").textContent = m ? "Звук выключен" : "Звук включён"; }
function setMusic(m) { musicOn = m; try { localStorage.setItem("vspyshka-music", m ? "1" : "0"); } catch (e) {} if (musicBus) musicBus.gain.value = m ? prefs.music / 100 : 0; $("music").setAttribute("aria-pressed", m); $("music").textContent = m ? "Музыка включена" : "Музыка выключена"; }
