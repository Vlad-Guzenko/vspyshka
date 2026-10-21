/* ---------- взрывы: хлопок, удар, гул с перекатами, обломки; вблизи и вдали по-разному ---------- */
function boomNearRecipe(seed) {
  return [5.2, (c, out) => {
    const R = () => Math.random();
    // хлопок: короткий шумовой удар с перегрузом
    const cr = noiseSrc(c, .05), crh = filt(c, "highpass", 1200), crg = c.createGain(); env(c, crg, [[0, 0], [.0015, 2.2], [.035, .001, 1]]);
    cr.connect(crh).connect(shaper(c, 6)).connect(crg).connect(out);
    // тело взрыва: розовый шум, фильтр быстро закрывается
    const bn = noiseSrc(c, 5.2, "pink"), blp = filt(c, "lowpass", 6000, .9), bg = c.createGain();
    blp.frequency.setValueAtTime(6000, 0); blp.frequency.exponentialRampToValueAtTime(900, .25); blp.frequency.exponentialRampToValueAtTime(160, 1.6 + R() * .5);
    env(c, bg, [[0, 0], [.004, 2.4], [.3, 1.1], [2.8 + R(), .001, 1]]);
    bn.connect(blp).connect(shaper(c, 3.2)).connect(bg).connect(out);
    // удар низов
    const so = osc(c, "sine", 72 + R() * 10), sg = c.createGain(); so.frequency.exponentialRampToValueAtTime(26, 1.1);
    env(c, sg, [[0, 0], [.003, 2.6], [.25, 1.4], [1.4, .001, 1]]); so.connect(sg).connect(shaper(c, 2.5)).connect(out);
    // гул с перекатами
    const rn = noiseSrc(c, 5.2, "brown"), rlp = filt(c, "lowpass", 140 + R() * 40, 1.2), rg = c.createGain();
    env(c, rg, [[0, 0], [.12, 1.6], [1.4, 1], [5.1, .001, 1]]);
    const am = osc(c, "sine", 2.5 + R() * 3), amg = c.createGain(); amg.gain.value = .45; am.connect(amg).connect(rg.gain);
    rn.connect(rlp).connect(rg).connect(out);
    // осыпающиеся обломки и стекло
    for (let i = 0; i < 70; i++) { const t = .2 + Math.pow(R(), 1.6) * 3.2, s = noiseSrc(c, .2), b = filt(c, "bandpass", 500 + R() * 4500, 1.8), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(.35 * (1 - t / 3.6) * R(), t); g.gain.exponentialRampToValueAtTime(.001, t + .03 + R() * .08); s.connect(b).connect(g).connect(out); s.start(); }
    for (let i = 0; i < 9; i++) { const t = .35 + R() * 1.6, s = noiseSrc(c, .4, "brown"), b = filt(c, "lowpass", 260), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(.9 * R(), t); g.gain.exponentialRampToValueAtTime(.001, t + .2); s.connect(b).connect(g).connect(out); s.start(); }
    for (let i = 0; i < 7; i++) { const t = .3 + R() * 1.4, o = osc(c, "sine", 3000 + R() * 4500), g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g).connect(out); o.start(t); }
    cr.start(); bn.start(); so.start(); rn.start(); am.start();
  }];
}
function boomFarRecipe() {
  // вдали остаётся только низкий раскат
  return [6, (c, out) => {
    const rn = noiseSrc(c, 6, "brown"), lp = filt(c, "lowpass", 240, 1), g = c.createGain();
    env(c, g, [[0, 0], [.04, 1.8], [.6, 1.2], [5.9, .001, 1]]);
    const am = osc(c, "sine", 1.6 + Math.random() * 2), amg = c.createGain(); amg.gain.value = .5; am.connect(amg).connect(g.gain);
    rn.connect(lp).connect(shaper(c, 2)).connect(g).connect(out);
    const so = osc(c, "sine", 52), sg = c.createGain(); so.frequency.exponentialRampToValueAtTime(24, 1.5); env(c, sg, [[0, 0], [.02, 1.6], [1.8, .001, 1]]); so.connect(sg).connect(out);
    rn.start(); am.start(); so.start();
  }];
}
const BOOM_VARIANTS = 3;
function renderBooms(jobs) {
  for (let i = 0; i < BOOM_VARIANTS; i++) { const [len, fn] = boomNearRecipe(i); jobs.push(render(len, fn).then(b => BUF["boomN" + i] = b)); }
  for (let i = 0; i < 2; i++) { const [len, fn] = boomFarRecipe(); jobs.push(render(len, fn).then(b => BUF["boomF" + i] = b)); }
}
// воспроизведение взрыва: не теряется в толпе звуков, вдали — глухой раскат с запаздыванием звука
function playBoom(x, y, power) {
  if (!AC || muted) return;
  const sp = spatial(x, y, 10), d = sp.d;
  const near = clamp(1 - d / 900), delay = Math.min(1.6, d / 1360);
  const floor = .16 + power * .14, g = Math.max(sp.g * 2.6, floor) * (.6 + power * .5);
  const rate = power > 1.5 ? rnd(.78, .9) : power > .9 ? rnd(.95, 1.05) : rnd(1.15, 1.3);
  if (near > .05) play("boomN" + Math.floor(Math.random() * BOOM_VARIANTS), x, y, 1, { gain: g * near, rate, delay, prio: true, wet: .6 });
  play("boomF" + Math.floor(Math.random() * 2), x, y, 1, { gain: g * (1 - near * .6), rate: rate * .9, delay, prio: true, wet: .9 });
  if (SAMP.exprec && near > .15) { BUF.__s_exprec = pick(SAMP.exprec); play("__s_exprec", x, y, 1, { gain: g * near * .9, rate: rate * .92, delay, prio: true, wet: .5 }); }
}
