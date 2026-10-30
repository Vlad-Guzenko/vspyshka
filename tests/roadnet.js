// Качество дорожной сети по планировкам и номерам города (сидам): node tests/roadnet.js [сидов=10] [планировки через запятую] [первый сид=1]
// Строит только город (genCity, без жителей) и считает, где сеть «как попало»:
//   острые — узлы, где две улицы расходятся под углом меньше 30°; близкие — пары узлов ближе 30 ед. (7,5 м); короткие — рёбра короче 30 ед.;
//   тупики — концы улиц не на краю карты и не тупики-разъезды пригорода; огрызки — из них короче 100 ед.;
//   пересечения — улицы пересекаются без перекрёстка; вода, дома — длина улиц (ед.) по озеру и сквозь дома;
//   впритык — длина улиц, вдоль которых в стороне от перекрёстков идёт другая улица ближе, чем помещаются оба тротуара;
//   разрыв — доля длины сети вне самого большого связного куска.
// Город — улицы не за городом (не rural) и не горные трассы; пересечения, вода и разрывы — по всей сети.
// Печатает средние по планировкам и худшие города: «планировка № сид» воспроизводится в игре вводом номера в «Новой игре».
// JSON=файл — записать все замеры; RELIEF=plain — равнина (по умолчанию горы, как в игре); MAP=big — большая карта
const fs = require('fs'), path = require('path'), os = require('os'), { execFile } = require('child_process');
const ALL = Object.keys({ grid: 1, organic: 1, ring: 1, radial: 1, diag: 1, winding: 1, old: 1, park: 1, mega: 1, suburb: 1, industry: 1, river: 1, port: 1, mountain: 1, valley: 1 });
const nSeeds = +process.argv[2] || 10, lays = (process.argv[3] || ALL.join(',')).split(','), seed0 = +process.argv[4] || 1;
// балл — на 100 городских рёбер, чтобы большой город не был хуже маленького только размером; впритык — в % длины городских улиц
const W_ = { sharp: 2, close: 2, short: 1, stubs: 2, dead: .5, cross: 4 };
const score = m => Object.keys(W_).reduce((s, k) => s + m[k] * W_[k], 0) * 100 / Math.max(1, m.edges) + (m.wet + m.bld) / 20 + m.tight / Math.max(1, m.len) * 100 + m.frag * 200;

if (require.main !== module) module.exports = { measure, score };
else if (process.env.RN_WORKER) {
  const files = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'mountain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'];
  const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
  const stub = `let dn=0;function addDecal(){return dn++}function fxBlood(){}function fxHit(){}function fxShot(){}function fxBoom(){}function fxDebris(){}function fxCollapse(){}function fxToppleImpact(){}function fxCannon(){}function onBanner(t){} function onResult(){} function onRadio(){} const world={hour:13}; function hourLabel(){return ""} function mmss(t){return t} let lastCounts=null; function slowMo(){}
const sfx=new Proxy({},{get:()=>()=>{}});`;
  const body = `
settings.fast = true; if (process.env.MAP) mapSize = process.env.MAP; if (process.env.RELIEF) relief = process.env.RELIEF;
return { gen: (l, s) => { genCity(l, s); return { RN, RE, layoutKey, citySeed }; }, edgePos, segX, waterD, cellAt, W: () => W, H: () => H };`;
  const G = new Function(stub + src + body)();
  const [lay, s0, n] = [process.env.RN_LAYOUT, +process.env.RN_S0, +process.env.RN_N];
  for (let s = s0; s < s0 + n; s++) {
    const t0 = Date.now(), R = G.gen(lay, s), m = measure(R, G); m.layout = lay; m.seed = R.citySeed; m.ms = Date.now() - t0;
    console.log('JSON ' + JSON.stringify(m));
  }
} else {
  var res = []; const jobs = []; for (const l of lays) for (let s = seed0; s < seed0 + nSeeds; s += 5) jobs.push([l, s, Math.min(5, seed0 + nSeeds - s)]);
  const par = Math.max(2, os.cpus().length - 2); let next = 0, done = 0;
  const run = () => {
    if (next >= jobs.length) return; const [l, s, n] = jobs[next++];
    execFile('node', [__filename], { env: { ...process.env, RN_WORKER: 1, RN_LAYOUT: l, RN_S0: s, RN_N: n }, maxBuffer: 1 << 24 }, (err, out) => {
      const got = (out || '').split('\n').filter(x => x.startsWith('JSON ')).map(x => JSON.parse(x.slice(5)));
      if (got.length < n) console.log('сбой', l, s, err && err.message.slice(0, 400));
      res.push(...got); if (++done === jobs.length) report(); else run();
    });
  };
  for (let i = 0; i < par; i++) run();
}
function report() {
  const K = ['edges', 'sharp', 'close', 'short', 'dead', 'stubs', 'cross', 'wet', 'bld', 'tight', 'frag'];
  const hdr = 'планировка  рёбер острые близкие корот тупики огрыз пересеч вода дома впритык разрыв  балл';
  const row = (name, ms) => { const a = k => ms.reduce((s, m) => s + m[k], 0) / ms.length; return name.padEnd(11) + [a('edges').toFixed(0).padStart(6), a('sharp').toFixed(1).padStart(7), a('close').toFixed(1).padStart(8), a('short').toFixed(1).padStart(6), a('dead').toFixed(1).padStart(7), a('stubs').toFixed(1).padStart(6), a('cross').toFixed(1).padStart(8), a('wet').toFixed(0).padStart(5), a('bld').toFixed(0).padStart(5), a('tight').toFixed(0).padStart(8), (a('frag') * 100).toFixed(1).padStart(6) + '%', a('score').toFixed(1).padStart(6)].join(''); };
  for (const m of res) m.score = score(m);
  console.log(hdr);
  const byL = lays.map(l => [l, res.filter(m => m.layout === l)]).filter(p => p[1].length);
  for (const [l, ms] of byL) console.log(row(l, ms));
  console.log(row('ВСЕГО', res));
  console.log('\nхудшие города (планировка № номер):');
  for (const m of res.slice().sort((a, b) => b.score - a.score).slice(0, 12)) console.log(`  ${m.layout} № ${m.seed}`.padEnd(22), 'балл', m.score.toFixed(1).padStart(6), ' ', K.filter(k => k !== 'edges' && m[k]).map(k => k + ' ' + (k === 'frag' ? (m[k] * 100).toFixed(1) + '%' : Math.round(m[k]))).join(', '));
  console.log(`\nгенерация в среднем ${(res.reduce((s, m) => s + m.ms, 0) / res.length / 1000).toFixed(1)} с на город`);
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(res));
}

// замеры одного города
// at — собрать места бед (для tests/mapshot.js MARK=1): [x, y, вид]
function measure(R, G, at) {
  const { RN, RE } = R, urb = e => !e.rural && !e.mountain, ring = e => e.kind === 'ring', mark = (k, x, y) => { if (at) at.push([x, y, k]); };
  const m = { edges: 0, len: 0, sharp: 0, close: 0, short: 0, dead: 0, stubs: 0, cross: 0, wet: 0, bld: 0, tight: 0, frag: 0 };
  const E = RE.filter(urb); m.edges = E.length; m.len = E.reduce((s, e) => s + e.len, 0);
  const urbNode = n => n.ed.some(urb);
  // направление улицы от узла — по точке в 24 ед. от него (не по первому сегменту сплайна)
  const dirAt = (e, n) => { const k = Math.min(24, e.len / 2), p = n === e.a ? G.edgePos(e, k) : G.edgePos(e, e.len - k); return Math.atan2(p.y - n.y, p.x - n.x); };
  for (const n of RN) {
    if (n.ed.length < 2 || !urbNode(n)) continue;
    const d = n.ed.map(e => ({ e, a: dirAt(e, n) })).sort((p, q) => p.a - q.a);
    let bad = false;
    for (let i = 0; i < d.length; i++) {
      const p = d[i], q = d[(i + 1) % d.length]; if (ring(p.e) && ring(q.e)) continue; if (!urb(p.e) && !urb(q.e)) continue;
      let g = q.a - p.a; if (i === d.length - 1) g += Math.PI * 2; if (d.length === 2) g = Math.min(g, Math.PI * 2 - g);
      if (g < Math.PI / 6) bad = true;
    }
    if (bad) { m.sharp++; mark('sharp', n.x, n.y); }
  }
  const UN = RN.filter(urbNode);
  for (let i = 0; i < UN.length; i++) for (let j = i + 1; j < UN.length; j++) { const a = UN[i], b = UN[j]; if (a.round && b.round) continue; if (Math.hypot(a.x - b.x, a.y - b.y) < 30) { m.close++; mark('close', (a.x + b.x) / 2, (a.y + b.y) / 2); } }
  for (const e of E) if (!ring(e) && e.len < 30) m.short++;
  for (const n of UN) if (n.ed.length === 1 && !n.exit && !n.culDS) { m.dead++; if (n.ed[0].len < 100) m.stubs++; mark(n.ed[0].len < 100 ? 'stub' : 'dead', n.x, n.y); }
  // сетка корзин по отрезкам всех рёбер
  const C = 64, buck = new Map(), segs = [];
  for (const e of RE) for (let i = 1; i < e.pts.length; i++) {
    const a = e.pts[i - 1], b = e.pts[i], s = { e, i, a, b }; segs.push(s);
    for (let gx = Math.floor((Math.min(a[0], b[0]) - 40) / C); gx <= Math.floor((Math.max(a[0], b[0]) + 40) / C); gx++)
      for (let gy = Math.floor((Math.min(a[1], b[1]) - 40) / C); gy <= Math.floor((Math.max(a[1], b[1]) + 40) / C); gy++) { const k = gx * 10007 + gy; if (!buck.has(k)) buck.set(k, []); buck.get(k).push(s); }
  }
  const nearNode = (x, y, e, r) => [e.a, e.b].some(n => Math.hypot(n.x - x, n.y - y) < r);
  // пересечения без узла: каждая пара отрезков разных рёбер один раз
  const seen = new Set();
  for (const list of buck.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const s = list[i], t = list[j]; if (s.e === t.e) continue;
    const key = s.e.id < t.e.id ? s.e.id + ':' + s.i + ':' + t.e.id + ':' + t.i : t.e.id + ':' + t.i + ':' + s.e.id + ':' + s.i; if (seen.has(key)) continue; seen.add(key);
    const h = G.segX(s.a[0], s.a[1], s.b[0], s.b[1], t.a[0], t.a[1], t.b[0], t.b[1]); if (!h) continue;
    if (nearNode(h.x, h.y, s.e, 6) && nearNode(h.x, h.y, t.e, 6)) continue;
    m.cross++; mark('cross', h.x, h.y);
  }
  // вода и дома под осью улицы; впритык — по городским улицам
  const distSeg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2)); return Math.hypot(a[0] + dx * k - px, a[1] + dy * k - py); };
  for (const e of RE) for (let t = 2; t < e.len - 2; t += 4) {
    const p = G.edgePos(e, t);
    if (G.waterD(p.x, p.y) < -2) m.wet += 4;
    if (G.cellAt(p.x, p.y) === 3) m.bld += 4;
    if (!urb(e) || ring(e) || t < 30 || t > e.len - 30 || (t | 0) % 8 > 3) continue;
    const list = buck.get(Math.floor(p.x / C) * 10007 + Math.floor(p.y / C)) || []; let hit = false;
    for (const s of list) {
      const f = s.e; if (f === e || ring(f) && ring(e)) continue;
      const shared = [f.a, f.b].filter(n => n === e.a || n === e.b); if (shared.some(n => Math.hypot(n.x - p.x, n.y - p.y) < 70)) continue;
      if (distSeg(p.x, p.y, s.a, s.b) < e.hw + f.hw + 8) { hit = true; break; }
    }
    if (hit) { m.tight += 8; mark('tight', p.x, p.y); }
  }
  // связность: доля длины вне самого большого куска
  const comp = new Map(); let total = 0, best = 0;
  for (const n0 of RN) {
    if (comp.has(n0)) continue; let len = 0; const q = [n0]; comp.set(n0, 1);
    while (q.length) { const n = q.pop(); for (const e of n.ed) { const o = e.a === n ? e.b : e.a; if (e.a === n) len += e.len; else if (e.a === e.b) len += 0; if (!comp.has(o)) { comp.set(o, 1); q.push(o); } } }
    total += len; best = Math.max(best, len);
  }
  m.frag = total ? 1 - best / total : 0;
  return m;
}
