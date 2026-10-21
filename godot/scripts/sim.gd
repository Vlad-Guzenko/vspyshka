extends RefCounted
class_name Sim
## Симуляция города: жители, зомби, полиция. Координаты в метрах, город 600 × 400, центр в (0, 0).
## Данные лежат в плоских массивах: так GDScript работает заметно быстрее, чем с объектами.

const W := 600.0
const H := 400.0
const CS := 2.0                      # клетка сетки проходимости, м
const GW := int(W / CS)
const GH := int(H / CS)
const HC := 10.0                     # ячейка пространственного хеша, м

enum { CIV, POLICE, ZOMBIE }
enum { ALIVE, DEAD }

var n := 0
var px := PackedFloat32Array()
var py := PackedFloat32Array()
var vx := PackedFloat32Array()
var vy := PackedFloat32Array()
var dir := PackedFloat32Array()
var role := PackedInt32Array()
var state := PackedInt32Array()
var hp := PackedFloat32Array()
var bitten := PackedFloat32Array()  # > 0: секунд до обращения
var panic := PackedFloat32Array()
var dead_t := PackedFloat32Array()  # сколько лежит
var wake_at := PackedFloat32Array() # когда встанет (-1 — не встанет)
var cd := PackedFloat32Array()
var wander_t := PackedFloat32Array()
var wx := PackedFloat32Array()
var wy := PackedFloat32Array()
var fly_z := PackedFloat32Array()   # высота тела в полёте после взрыва
var fly_vz := PackedFloat32Array()
var col := PackedColorArray()
var ammo := PackedInt32Array()

var blocked := PackedByteArray()    # 1 — здание
var hash_head := PackedInt32Array()
var hash_next := PackedInt32Array()

var sim_t := 0.0
var bites := 0
var deaths := 0
var zkills := 0
var events: Array[String] = []

func _init() -> void:
	blocked.resize(GW * GH)
	hash_head.resize(int(W / HC) * int(H / HC))

func log_event(text: String) -> void:
	events.push_front("%02d:%02d  %s" % [int(sim_t) / 60, int(sim_t) % 60, text])
	if events.size() > 12:
		events.pop_back()

func cell_blocked(x: float, y: float) -> bool:
	if x < -W / 2 + 1 or y < -H / 2 + 1 or x > W / 2 - 1 or y > H / 2 - 1:
		return true
	var gx := int((x + W / 2) / CS)
	var gy := int((y + H / 2) / CS)
	return blocked[gy * GW + gx] == 1

func fill_blocked(x0: float, y0: float, x1: float, y1: float, v: int) -> void:
	var gx0 := clampi(int((x0 + W / 2) / CS), 0, GW - 1)
	var gx1 := clampi(int((x1 + W / 2) / CS), 0, GW - 1)
	var gy0 := clampi(int((y0 + H / 2) / CS), 0, GH - 1)
	var gy1 := clampi(int((y1 + H / 2) / CS), 0, GH - 1)
	for gy in range(gy0, gy1 + 1):
		for gx in range(gx0, gx1 + 1):
			blocked[gy * GW + gx] = v

func add_agent(r: int, x: float, y: float) -> int:
	var i := n
	n += 1
	px.append(x); py.append(y); vx.append(0.0); vy.append(0.0); dir.append(randf() * TAU)
	role.append(r); state.append(ALIVE); hp.append(100.0); bitten.append(0.0); panic.append(0.0)
	dead_t.append(0.0); wake_at.append(-1.0); cd.append(randf()); wander_t.append(0.0); wx.append(0.0); wy.append(0.0)
	fly_z.append(0.0); fly_vz.append(0.0); ammo.append(45 if r == POLICE else 0)
	var c: Color
	if r == POLICE:
		c = Color(0.12, 0.24, 0.47)
	else:
		c = Color.from_hsv(randf(), randf_range(0.35, 0.7), randf_range(0.45, 0.9))
	col.append(c)
	return i

func random_free() -> Vector2:
	for k in range(300):
		var x := randf_range(-W / 2 + 4, W / 2 - 4)
		var y := randf_range(-H / 2 + 4, H / 2 - 4)
		if not cell_blocked(x, y):
			return Vector2(x, y)
	return Vector2.ZERO

func turn(i: int) -> void:
	role[i] = ZOMBIE
	state[i] = ALIVE
	hp[i] = 100.0
	bitten[i] = 0.0
	panic[i] = 0.0
	col[i] = Color(0.45, 0.62, 0.38)
	if zkills == 0 and deaths <= 1:
		log_event("Первый зомби восстал")

func kill(i: int, by_zombie: bool) -> void:
	if state[i] != ALIVE:
		return
	state[i] = DEAD
	dead_t[i] = 0.0
	wake_at[i] = randf_range(8.0, 16.0) if (by_zombie or bitten[i] > 0.0) else -1.0
	if role[i] == ZOMBIE:
		zkills += 1
		wake_at[i] = -1.0
	else:
		deaths += 1
		if deaths == 1:
			log_event("Первая смерть")

func explode(x: float, y: float, r: float) -> void:
	for i in range(n):
		var dx := px[i] - x
		var dy := py[i] - y
		var d := sqrt(dx * dx + dy * dy)
		if d > r:
			continue
		var k := 1.0 - d / r
		if state[i] == ALIVE:
			kill(i, false)
			wake_at[i] = -1.0
		var a := atan2(dy, dx) + randf_range(-0.3, 0.3)
		vx[i] = cos(a) * (8.0 + 20.0 * k)
		vy[i] = sin(a) * (8.0 + 20.0 * k)
		fly_vz[i] = 4.0 + 12.0 * k
		fly_z[i] = maxf(fly_z[i], 0.05)
	log_event("Взрыв")

func _rebuild_hash() -> void:
	hash_head.fill(-1)
	if hash_next.size() < n:
		hash_next.resize(n * 2)
	var hw := int(W / HC)
	var hh := int(H / HC)
	for i in range(n):
		var gx := clampi(int((px[i] + W / 2) / HC), 0, hw - 1)
		var gy := clampi(int((py[i] + H / 2) / HC), 0, hh - 1)
		var c := gy * hw + gx
		hash_next[i] = hash_head[c]
		hash_head[c] = i

## Ближайший живой агент нужной роли в радиусе; want_zombie — ищем зомби, иначе людей
func _nearest(i: int, radius: float, want_zombie: bool) -> int:
	var best := -1
	var bd := radius
	var hw := int(W / HC)
	var hh := int(H / HC)
	var gx0 := clampi(int((px[i] - radius + W / 2) / HC), 0, hw - 1)
	var gx1 := clampi(int((px[i] + radius + W / 2) / HC), 0, hw - 1)
	var gy0 := clampi(int((py[i] - radius + H / 2) / HC), 0, hh - 1)
	var gy1 := clampi(int((py[i] + radius + H / 2) / HC), 0, hh - 1)
	for gy in range(gy0, gy1 + 1):
		for gx in range(gx0, gx1 + 1):
			var j := hash_head[gy * hw + gx]
			while j >= 0:
				if j != i and state[j] == ALIVE and ((role[j] == ZOMBIE) == want_zombie):
					var dx := px[j] - px[i]
					var dy := py[j] - py[i]
					var d := sqrt(dx * dx + dy * dy)
					if d < bd:
						bd = d
						best = j
				j = hash_next[j]
	return best

func _wander(i: int, dt: float) -> Vector2:
	wander_t[i] -= dt
	var ahead := cell_blocked(px[i] + wx[i] * 3.0, py[i] + wy[i] * 3.0)
	if wander_t[i] <= 0.0 or ahead or (wx[i] == 0.0 and wy[i] == 0.0):
		var opts: Array[Vector2] = []
		for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
			if not cell_blocked(px[i] + d.x * 4.0, py[i] + d.y * 4.0):
				opts.append(d)
		var ch: Vector2 = opts.pick_random() if opts.size() > 0 else Vector2(randf_range(-1, 1), randf_range(-1, 1))
		wx[i] = ch.x
		wy[i] = ch.y
		wander_t[i] = randf_range(2.0, 7.0)
	return Vector2(wx[i], wy[i])

func step(dt: float) -> void:
	sim_t += dt
	_rebuild_hash()
	for i in range(n):
		# тело после взрыва летит по дуге
		if fly_z[i] > 0.0 or fly_vz[i] != 0.0:
			fly_vz[i] -= 9.8 * dt
			fly_z[i] += fly_vz[i] * dt
			px[i] += vx[i] * dt
			py[i] += vy[i] * dt
			if fly_z[i] <= 0.0:
				fly_z[i] = 0.0
				fly_vz[i] = 0.0
				vx[i] *= 0.3
				vy[i] *= 0.3
			continue
		if state[i] == DEAD:
			dead_t[i] += dt
			if wake_at[i] > 0.0 and dead_t[i] > wake_at[i]:
				turn(i)
			continue
		cd[i] -= dt
		panic[i] = maxf(0.0, panic[i] - dt * 0.05)
		var mv := Vector2.ZERO
		var sp := 0.0
		if role[i] == ZOMBIE:
			var t := _nearest(i, 38.0, false)
			if t >= 0:
				var dx := px[t] - px[i]
				var dy := py[t] - py[i]
				var d := sqrt(dx * dx + dy * dy)
				if d < 1.3:
					if cd[i] <= 0.0:
						cd[i] = randf_range(0.9, 1.4)
						hp[t] -= randf_range(18, 35)
						panic[t] = 1.0
						if bitten[t] <= 0.0:
							bitten[t] = randf_range(14.0, 26.0)
							bites += 1
							if bites == 1:
								log_event("Первый укус")
						if hp[t] <= 0.0:
							kill(t, true)
				else:
					mv = Vector2(dx, dy) / d
					sp = 2.0 if d > 4.0 else 3.2
			else:
				mv = _wander(i, dt)
				sp = 0.9
		else:
			var z := _nearest(i, 28.0 if panic[i] > 0.3 or role[i] == POLICE else 6.0, true)
			if z >= 0:
				panic[i] = 1.0
				var dx := px[z] - px[i]
				var dy := py[z] - py[i]
				var d := sqrt(dx * dx + dy * dy)
				if role[i] == POLICE and ammo[i] > 0 and d < 30.0:
					dir[i] = atan2(dy, dx)
					if cd[i] <= 0.0:
						cd[i] = randf_range(0.5, 0.8)
						ammo[i] -= 1
						if randf() < 0.55 * (1.0 - d / 60.0):
							hp[z] -= 60.0 if randf() < 0.2 else 34.0
							if hp[z] <= 0.0:
								kill(z, false)
								if zkills == 1:
									log_event("Первый зомби уничтожен")
						shots.append(Vector4(px[i], py[i], px[z], py[z]))
					if d > 9.0:
						mv = Vector2.ZERO
						sp = 0.0
					else:
						mv = Vector2(-dx, -dy) / d
						sp = 4.0
				else:
					mv = Vector2(-dx, -dy) / d
					sp = 4.5
			else:
				mv = _wander(i, dt)
				sp = 3.2 if panic[i] > 0.3 else 1.3
			if bitten[i] > 0.0:
				bitten[i] -= dt
				if bitten[i] <= 0.0:
					kill(i, true)
					wake_at[i] = 3.0
					continue
			if hp[i] < 100.0:
				hp[i] += dt * 0.4
		# движение с расталкиванием и стенами
		var tx := mv.x * sp
		var ty := mv.y * sp
		var k := minf(1.0, dt * (3.0 if role[i] == ZOMBIE else 6.0))
		vx[i] += (tx - vx[i]) * k
		vy[i] += (ty - vy[i]) * k
		var nx := px[i] + vx[i] * dt
		var ny := py[i] + vy[i] * dt
		if not cell_blocked(nx, py[i]):
			px[i] = nx
		else:
			vx[i] *= -0.2
			wander_t[i] = 0.0
		if not cell_blocked(px[i], ny):
			py[i] = ny
		else:
			vy[i] *= -0.2
			wander_t[i] = 0.0
		var spd := sqrt(vx[i] * vx[i] + vy[i] * vy[i])
		if spd > 0.3 and not (role[i] == POLICE and panic[i] > 0.3):
			var want := atan2(vy[i], vx[i])
			var dd := wrapf(want - dir[i], -PI, PI)
			dir[i] += dd * minf(1.0, dt * 8.0)

var shots: Array[Vector4] = []   # выстрелы за этот шаг: x0, y0, x1, y1

func counts() -> Dictionary:
	var h := 0
	var inf := 0
	var z := 0
	for i in range(n):
		if state[i] != ALIVE:
			continue
		if role[i] == ZOMBIE:
			z += 1
		elif bitten[i] > 0.0:
			inf += 1
		else:
			h += 1
	return {"H": h, "I": inf, "Z": z, "D": deaths}
