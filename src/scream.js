/* ---------- крики: надрывный голос с дрожью, срывами и хрипом ---------- */
function screamRecipe(i) {
  const female = i % 2 === 0, len = .7 + Math.random() * 1.1;
  return [len, (c, out) => {
    const f0 = female ? 520 + Math.random() * 260 : 300 + Math.random() * 170;
    // контур высоты: взлёт, дрожь, срыв вниз в конце; случайное блуждание
    const N = 256, curve = new Float32Array(N); let walk = 0;
    for (let k = 0; k < N; k++) { const t = k / (N - 1); walk += (Math.random() - .5) * .04; walk *= .97; const env = t < .15 ? .8 + t / .15 * .35 : t < .7 ? 1.15 - (t - .15) * .15 : 1.07 - (t - .7) * 1.1; curve[k] = f0 * (env + walk + Math.sin(t * len * TAU * (5 + i % 3)) * .025); }
    const o = osc(c, "sawtooth", f0); o.frequency.setValueCurveAtTime(curve, 0, len);
    const o2 = osc(c, "square", f0 / 2); o2.frequency.setValueCurveAtTime(curve.map(v => v / 2), 0, len); // подгармоника — надрыв
    const g2 = c.createGain(); g2.gain.value = .18;
    // шероховатость: голос «рвётся» шумовой модуляцией
    const rough = c.createGain(); rough.gain.value = .7; const rn = noiseSrc(c, len), rl = filt(c, "lowpass", 90), rg = c.createGain(); rg.gain.value = .9; rn.connect(rl).connect(rg).connect(rough.gain);
    o.connect(rough); o2.connect(g2).connect(rough);
    const sum = c.createGain();
    // форманты гласной «а» с лёгким переходом к «э»
    const F = female ? [[1000, 7], [1500, 8], [3000, 10], [4200, 12]] : [[800, 7], [1250, 8], [2650, 10], [3600, 12]];
    for (const [f, q] of F) { const b = filt(c, "bandpass", f, q); b.frequency.linearRampToValueAtTime(f * (1.1 + Math.random() * .15), len); rough.connect(b).connect(sum); }
    const br = noiseSrc(c, len), bb = filt(c, "bandpass", female ? 3200 : 2400, .8), bg = c.createGain(); bg.gain.value = .45; br.connect(bb).connect(bg).connect(sum); // дыхание
    const g = c.createGain(); env(c, g, [[0, 0], [.04, 3.2], [len * .6, 2.8], [len, .001, 1]]);
    sum.connect(shaper(c, 2.2)).connect(g).connect(out);
    o.start(); o2.start(); rn.start(); br.start();
  }];
}
