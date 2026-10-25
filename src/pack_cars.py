# Упаковка моделей машин: FBX из assets/cars/ складываются в cars.js (base64), как модели людей в people.js.
# Модели — «Free Low Poly Vehicles Pack» от Rgsdev (CC0), https://opengameart.org/content/free-low-poly-vehicles-pack
#   python pack_cars.py
import base64, os, sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "cars")

cars = {}
for f in sorted(os.listdir(SRC)):
    name, ext = os.path.splitext(f)
    if ext.lower() != ".fbx":
        continue
    with open(os.path.join(SRC, f), "rb") as fh:
        cars[name] = base64.b64encode(fh.read()).decode("ascii")

# грузовики и краны со стройки Majadroid (CC0), https://opengameart.org/content/3d-house-construction-site-lowpoly-cc0 —
# в подпапке site, имена с приставкой S_; цвета у них — из палитры Imphenzia по UV, палитра идёт отдельной картинкой
SITE = os.path.join(SRC, "site")
pal = ""
if os.path.isdir(SITE):
    for f in sorted(os.listdir(SITE)):
        name, ext = os.path.splitext(f)
        with open(os.path.join(SITE, f), "rb") as fh:
            data = fh.read()
        if ext.lower() == ".fbx":
            cars["S_" + name.replace("-", "_")] = base64.b64encode(data).decode("ascii")
        elif ext.lower() == ".png":
            pal = "data:image/png;base64," + base64.b64encode(data).decode("ascii")

out = "window.CAR_FBX={" + ",".join(f'"{k}":"{v}"' for k, v in cars.items()) + "};\n" + (f'window.CAR_PAL="{pal}";\n' if pal else "")
with open(os.path.join(ROOT, "cars.js"), "w", encoding="ascii") as fh:
    fh.write(out)
print("cars.js:", ", ".join(cars), f"— {len(out) // 1024} КБ")
