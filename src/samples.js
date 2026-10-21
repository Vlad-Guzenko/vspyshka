/* ---------- записанные звуки (CC0 и CC BY): грузятся рядом со страницей, синтез — запасной вариант ---------- */
const SAMPLE_GROUPS = {
  pistol: [1, 2, 3, 4].map(i => `pistol_${i}.wav`), rifle: [1, 2, 3, 4].map(i => `rifle_${i}.wav`), heavy: ["heavy_1.wav", "heavy_2.wav"], shotgun: ["shotgun_1.wav"],
  scream: Array.from({ length: 14 }, (_, i) => `scream_${i + 1}.wav`), pain: Array.from({ length: 6 }, (_, i) => `pain_${i + 1}.wav`),
  zgroan: ["zgroan_1.ogg", "zgroan_2.ogg", "zgroan_3.ogg"], zrunner: ["zrunner_1.ogg"], moans: ["moans.ogg"],
  exprec: ["exp_1.ogg", "exp_2.ogg", "exp_3.ogg", "exp_4.ogg"], glass: [1, 2, 3, 4, 5].map(i => `glass_${i}.ogg`), hit: [1, 2, 3, 4].map(i => `hit_${i}.ogg`), metal: [1, 2, 3, 4].map(i => `metal_${i}.ogg`), slam: [1, 2, 3].map(i => `slam_${i}.ogg`),
  rain: ["rain.ogg"], siren: ["siren.mp3"], heli: ["heli.mp3"], fire: ["fire.ogg"],
};
const SAMP = {};
async function loadSamples() {
  for (const [g, files] of Object.entries(SAMPLE_GROUPS)) for (const f of files) {
    try {
      const r = await fetch("snd/" + f); if (!r.ok) continue;
      const buf = await AC.decodeAudioData(await r.arrayBuffer());
      (SAMP[g] = SAMP[g] || []).push(buf);
    } catch (e) { /* нет файла — останется синтез */ }
  }
  // петли окружения заменяем записями
  for (const [k, g] of [["rain", "rain"], ["fire", "fire"], ["heli", "heli"], ["sirenPolice", "siren"]]) if (SAMP[g]) swapLoop(k, SAMP[g][0]);
}
function swapLoop(k, buffer) {
  const L = loopNodes[k]; if (!L || !L.src) return;
  try { L.src.stop(); } catch (e) {}
  const s = AC.createBufferSource(); s.buffer = buffer; s.loop = true; s.connect(L.lp); s.start(0, Math.random() * buffer.duration); L.src = s;
}
// сыграть случайную запись из группы, иначе — синтезированный запасной звук
function playS(group, x, y, vol, opt = {}, fallback) {
  const list = SAMP[group];
  if (!list || !list.length) { if (fallback) play(fallback, x, y, vol, opt); return; }
  const k = "__s_" + group; BUF[k] = list[Math.floor(Math.random() * list.length)];
  play(k, x, y, vol, opt);
}
