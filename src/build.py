# Сборка игры: склеивает исходники из src/ в один index.html в корне папки.
#   python build.py          — index.html для игры
#   python build.py --debug  — ещё и debug.html с объектом window.__v для проверок из консоли
#   python build.py --artifact — artifact.html без <!doctype>/<head> (для публикации как Artifact)
import os, sys, subprocess
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PARTS = ['sim1.js', 'roads.js', 'layout.js', 'traffic.js', 'terrain.js', 'sim2.js', 'sim3.js', 'sim4.js', 'sim5.js', 'sim6.js', 'sim7.js', 'sim8.js', 'sim9.js', 'sim10.js', 'sim11.js', 'sim12.js', 'sim13.js', 'sim14.js', 'sim15.js', 'sim16.js', 'sim17.js', 'sim18.js', 'sim19.js', 'sim20.js', 'campaign.js',
         'render1.js', 'merge.js', 'render2.js', 'render3.js', 'render4.js', 'water.js', 'scream.js', 'render5.js', 'render6.js', 'render7.js', 'render8.js', 'render9.js', 'render10.js', 'render11.js', 'render12.js', 'render13.js', 'render14.js', 'render15.js', 'render16.js', 'render17.js',
         'gfx.js', 'people3d.js', 'samples.js', 'boom.js', 'audio.js', 'audio2.js', 'fps.js', 'drive.js', 'editor.js', 'save.js', 'ui2.js', 'ui3.js', 'ui4.js', 'ui5.js', 'ui6.js', 'ui7.js', 'ui8.js', 'ui.js']
DEBUG = ('window.__v = { camS, camC, camera, R3, scene, settings, world, get agents() { return agents; }, get cars() { return cars; }, get props() { return props; }, get threat() { return threat; }, get entries() { return entries; }, get special() { return special; }, '
         'get buildings() { return buildings; }, get blocks() { return blocks; }, gY, waterD, waterAt, riverD, TH, grid, get RN() { return RN; }, get RE() { return RE; }, get RL() { return RL; }, get rounds() { return rounds; }, get bridges() { return bridges; }, get hasHills() { return hasHills; }, perfStats, get camps() { return camps; }, get towers() { return towers; }, get selected() { return selected; }, get tanks() { return tanks; }, get waters() { return waters; }, get research() { return research; }, '
         'stepN: n => { for (let i = 0; i < n; i++) step(.05); }, useToolAt: (k, x, y) => { tool = k; useTool({}, x, y); }, get traps() { return traps; }, get gens() { return gens; }, get cps() { return cps; }, get factions() { return factions; }, get hq() { return hq; }, paintBarricade, addWire, elecMask, '
         'addTank, spawnService, deliverMachine, collapse, damageBuilding, launchNuke, planQuarantine, serializeGame, loadGame, layout: () => layoutKey, get paused() { return paused; }, get speed() { return speed; }, get slowMoT() { return slowMoT; }, get simT() { return simT; }, get alert() { return alert; }, get wallJobs() { return wallJobs; }, get machines() { return machines; }, get squads() { return squads; }, setPaused, standDown, frame, newCity, get fps() { return fps; }, get drive() { return drive; }, get camp() { return camp; }, campNextDay, campEndEarly, stepN2: n => { for (let i = 0; i < n; i++) step(.05); }, RT, DET, groundDet, REAL };\n')

def read(name):
    with open(os.path.join(HERE, name), encoding='utf8') as f:
        return f.read()

head = read('head.html')
js = ''.join(read(p) + '\n' for p in PARTS)
DOC = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'

def write(name, text):
    with open(os.path.join(ROOT, name), 'w', encoding='utf8') as f:
        f.write(text)
    print('собрано:', name, f'{len(text) // 1024} КБ')

write('index.html', DOC + head + js + '})();\n</script>\n</html>\n')
if '--debug' in sys.argv:
    write('debug.html', DOC + head + js + DEBUG + '})();\n</script>\n</html>\n')
if '--artifact' in sys.argv:
    write('artifact.html', head + js + '})();\n</script>\n')
# проверка синтаксиса, если установлен Node.js
try:
    tmp = os.path.join(HERE, '.check.js')
    with open(tmp, 'w', encoding='utf8') as f:
        f.write('(() => {\n' + js + '})();\n')
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.remove(tmp)
    print('синтаксис:', 'в порядке' if r.returncode == 0 else r.stderr[:2000])
except FileNotFoundError:
    print('Node.js не найден — синтаксис не проверялся')
