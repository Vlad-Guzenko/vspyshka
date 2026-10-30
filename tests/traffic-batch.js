// Пакетный замер трафика: tests/traffic.test.js по многим планировкам и сидам параллельно, сводка доли стоящих машин и причин.
// node tests/traffic-batch.js [сидов на планировку] [секунд] [планировки через запятую]
// Печатает по планировке долю стоящих с третьей минуты, долю стоящих у стоп-линии на зелёный и общий список причин
const { execFile } = require('child_process'), path = require('path'), os = require('os');
const seeds = +process.argv[2] || 4, secs = +process.argv[3] || 240;
const lays = (process.argv[4] || 'grid,organic,ring,radial,diag,winding,old,park,mega,suburb,industry').split(',');
const jobs = []; for (const l of lays) for (let s = 1; s <= seeds; s++) jobs.push([l, s]);
const res = [], par = Math.max(2, os.cpus().length - 2); let next = 0, done = 0;
function run() {
  if (next >= jobs.length) return; const [l, s] = jobs[next++];
  execFile('node', [path.join(__dirname, 'traffic.test.js'), l, secs, '', '', s], { env: { ...process.env, JSON: 1 }, maxBuffer: 1 << 24 }, (err, out) => {
    const line = (out || '').split('\n').find(x => x.startsWith('JSON ')); if (line) res.push(JSON.parse(line.slice(5))); else console.log('сбой', l, s, err && err.message.slice(0, 300));
    if (++done === jobs.length) report(); else run();
  });
}
for (let i = 0; i < par; i++) run();
function report() {
  const all = { n: 0, s: 0, g: 0, why: {}, gw: {} };
  for (const l of lays) {
    const a = { n: 0, s: 0, g: 0, why: {} };
    for (const r of res.filter(r => r.layout === l)) for (const m of r.mins.slice(2)) { a.n += m.n; a.s += m.s; a.g += m.g; for (const k in m.why) a.why[k] = (a.why[k] || 0) + m.why[k]; for (const k in m.gw) all.gw[k] = (all.gw[k] || 0) + m.gw[k]; }
    for (const k of ['n', 's', 'g']) all[k] += a[k]; for (const k in a.why) all.why[k] = (all.why[k] || 0) + a.why[k];
    console.log(l.padEnd(9), 'стоят', (a.s / a.n).toFixed(3), 'на зелёный', (a.g / a.n).toFixed(3));
  }
  console.log('ВСЕГО    стоят', (all.s / all.n).toFixed(3), 'на зелёный', (all.g / all.n).toFixed(3));
  console.log(Object.entries(all.why).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => k + ' ' + (v / all.n * 100).toFixed(1)).join('  '), '(% от всех машин)');
  console.log('на зелёный:', Object.entries(all.gw).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + (v / all.n * 100).toFixed(2)).join('  '));
}
