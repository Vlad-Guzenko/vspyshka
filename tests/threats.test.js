// внешние угрозы: орда с окраин доходит до въезда, штаб ставит рубеж и отбивает её; беженцы проходят пост на въезде;
// ультиматум: внешнее оцепление закрывает выезды. node tests/threats.test.js [планировка]
const fs = require('fs'), path = require('path');
const src = ['sim1.js', 'roads.js', 'layout.js', 'layout2.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const stub = fs.readFileSync(path.join(__dirname, 'sim.test.js'), 'utf8').match(/const stub=`([\s\S]*?)`;/)[1].replace('console.log("BANNER",t)', '') + ';function slowMo(){}';
const body = `
settings.fast = true; const _g = genCity; genCity = () => _g(process.argv[2] || 'grid'); newCitySim(500); genCity = _g;
for (const a of agents) { a.bitten = false; a.incT = 0; }
const ev = [], seen = new Map(), mark = (k, t) => { if (!seen.has(k)) { seen.set(k, simT); ev.push((simT | 0) + 's ' + t); } };
console.log(layoutKey, 'въездов', entries.length, '| часть', !!special.base);
// орда и беженцы — сразу, а не через 5–10 минут
threat.hordeT = 1; threat.refT = 20;
let maxHorde = 0, armyAtLine = 0, refIn = 0, detained = 0, checked = 0;
for (let i = 0; i < 20 * 600; i++) {
  step(.05);
  const h = threat.hordes[0];
  if (h) { mark('horde', 'орда объявлена: ' + h.n + ', рубеж ' + (h.line ? 'поставлен (' + h.line.cells.length + ' блоков)' : 'нет'));
    const en = entries[h.en]; let near = 0; for (const a of agents) if (a.state === 'alive' && a.role === 'zombie' && a.horde === h.id && Math.hypot(a.x - en.x, a.y - en.y) < 250) near++;
    maxHorde = Math.max(maxHorde, near); if (near > 5) mark('arrive', 'орда у въезда: ' + near);
    let soldiers = 0; for (const a of agents) if (a.state === 'alive' && a.role === 'army' && Math.hypot(a.x - en.x, a.y - en.y) < 120) soldiers++; armyAtLine = Math.max(armyAtLine, soldiers); if (soldiers >= 3) mark('line', 'на рубеже солдат: ' + soldiers);
    if (h.done) mark('hdone', 'орда закончилась, рубеж снят: ' + !h.line);
  }
  const col = threat.cols[0];
  if (col) { mark('ref', 'беженцы: ' + col.policy + ', машин ' + col.cars + ', пеших ' + col.people);
    if (col.cp && col.cp.checked > 0) mark('refcheck', 'пост на въезде проверил: ' + col.cp.checked);
    refIn = agents.filter(a => a.state === 'alive' && a.role === 'civ' && !a.refCol && a.id > 600 && cityK(a.x, a.y) > .5).length; detained = Math.max(detained, col.cp ? col.cp.detained : 0); checked = col.cp ? col.cp.checked : 0; }
  // ультиматум — после подхода орды: федеральные посты у краёв карты стреляют и сбивают орду с пути
  if (i === 20 * 420) { hq.known = 200; }
  if (threat.fed) mark('fed', 'внешнее оцепление: блоков ' + threat.fed.blocks.length + ', до зачистки ' + Math.round(threat.fed.deadline - simT) + ' с');
}
for (const e of ev) console.log(e);
// армия должна стоять на рубеже раньше, чем подойдёт орда — для этого и предупреждение
const early = seen.has('line') && (!seen.has('arrive') || seen.get('line') <= seen.get('arrive'));
// орда либо дошла до рубежа, либо её уничтожили ещё в поле (армия и полиция перехватывают её до въезда)
const h0 = threat.hordes[0], destroyed = !!h0 && (h0.done || (h0.alive || 0) <= h0.n * .3);
const ok = seen.has('horde') && seen.has('line') && early && (seen.has('arrive') || destroyed) && seen.has('ref') && seen.has('fed');
console.log('у въезда до', maxHorde, 'зомби орды', destroyed ? '(орда уничтожена)' : '(орда жива)', '| солдат на рубеже до', armyAtLine, early ? '(раньше орды)' : '(ПОЗЖЕ орды)', '| досмотрено на въезде', checked, ', задержано', detained, ok ? 'OK' : 'FAIL');
process.exitCode = ok ? 0 : 1;
`;
new Function('process', stub + src + body)(process);
