# Упаковка текстур: jpg из assets/textures/ складываются в textures.js (base64), как модели людей в people.js.
# Так страница берёт их и с диска, без сервера: картинки из data-URL браузер отдаёт в WebGL без ограничений.
#   python pack_textures.py
import base64, os, sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "textures")

tex = {}
for f in sorted(os.listdir(SRC)):
    name, ext = os.path.splitext(f)
    if ext.lower() != ".jpg" or "_" not in name:
        continue
    key, kind = name.rsplit("_", 1)
    with open(os.path.join(SRC, f), "rb") as fh:
        tex.setdefault(key, {})[kind] = "data:image/jpeg;base64," + base64.b64encode(fh.read()).decode("ascii")

out = "window.REAL_TEX={" + ",".join(f'"{k}":{{' + ",".join(f'"{kind}":"{v[kind]}"' for kind in sorted(v)) + "}" for k, v in sorted(tex.items())) + "};\n"
with open(os.path.join(ROOT, "textures.js"), "w", encoding="ascii") as fh:
    fh.write(out)
print("textures.js:", ", ".join(sorted(tex)), f"— {len(out) // 1024} КБ")
