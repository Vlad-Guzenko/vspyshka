extends Node3D
## Прототип «Вспышки» на Godot 4: город из кварталов, жители, зомби, полиция, взрывы.
## Всё создаётся кодом, чтобы сцену не нужно было собирать руками.

const CameraScript := preload("res://scripts/camera.gd")

var sim: Sim
var cam  # Camera3D со скриптом camera.gd; без типа, чтобы обращаться к его полям
var sun: DirectionalLight3D
var people_mmi: MultiMeshInstance3D
var people_mm: MultiMesh
var tracer_mesh: ImmediateMesh
var tracers: Array = []   # [Vector3 a, Vector3 b, float life]
var booms: Array = []     # [MeshInstance3D, OmniLight3D, float t]
var tool := "watch"
var speed := 1.0
var paused := false
var acc := 0.0
var ui_counts: Label
var ui_log: Label
var ui_tip: Label
var tool_buttons: Dictionary = {}

const TOOLS := {
	"watch": "Наблюдать",
	"zombie": "Зомби",
	"horde": "Орда",
	"infect": "Заразить",
	"police": "Полиция",
	"boom": "Взрыв",
}
const TIPS := {
	"watch": "Правая кнопка — вращать камеру, колесо — приблизить, WASD — двигать.",
	"zombie": "Клик по земле ставит зомби.",
	"horde": "Клик по земле ставит сразу 20 зомби.",
	"infect": "Клик рядом с человеком — он укушен и обратится через полминуты.",
	"police": "Клик — патруль из трёх полицейских с пистолетами.",
	"boom": "Клик — взрыв: люди разлетаются, стекло звенит.",
}

func _ready() -> void:
	randomize()
	_make_environment()
	_make_camera()
	sim = Sim.new()
	_build_city()
	_spawn_people(800)
	_make_people_mesh()
	_make_tracers()
	_make_ui()
	sim.log_event("Нулевой пациент где-то в городе. Он ещё не знает, что заражён")
	var p0 := randi_range(0, sim.n - 1)
	sim.bitten[p0] = 20.0

# ---------- окружение, свет, камера ----------
func _make_environment() -> void:
	var env := Environment.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.31, 0.53, 0.78)
	sky_mat.sky_horizon_color = Color(0.84, 0.88, 0.91)
	sky_mat.ground_bottom_color = Color(0.25, 0.3, 0.2)
	sky_mat.ground_horizon_color = Color(0.7, 0.72, 0.66)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_sky_contribution = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	env.ssao_enabled = true
	env.ssao_radius = 2.0
	env.ssao_intensity = 1.5
	env.glow_enabled = true
	env.glow_intensity = 0.35
	env.glow_bloom = 0.05
	env.fog_enabled = true
	env.fog_light_color = Color(0.75, 0.8, 0.86)
	env.fog_density = 0.0008
	env.fog_sky_affect = 0.2
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.94, 0.85)
	sun.light_energy = 1.6
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 500.0
	sun.directional_shadow_blend_splits = true
	sun.rotation_degrees = Vector3(-52, 35, 0)
	add_child(sun)

func _make_camera() -> void:
	cam = Camera3D.new()
	cam.set_script(CameraScript)
	add_child(cam)
	cam.current = true

# ---------- город ----------
func _box(size: Vector3, color: Color, pos: Vector3, parent: Node3D = self) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.9
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	return mi

func _build_city() -> void:
	# земля: асфальт
	var ground := _box(Vector3(Sim.W + 1600, 0.5, Sim.H + 1600), Color(0.24, 0.26, 0.27), Vector3(0, -0.25, 0))
	# окрестности: травяное кольцо
	var grass := _box(Vector3(Sim.W + 1600, 0.4, Sim.H + 1600), Color(0.3, 0.38, 0.22), Vector3(0, -0.5, 0))
	grass.position.y = -0.45
	# кварталы: сетка улиц со случайным шагом, проспекты шире
	var xs: Array[float] = [-Sim.W / 2]
	while xs[-1] < Sim.W / 2 - 60:
		xs.append(xs[-1] + randf_range(44, 58))
	xs.append(Sim.W / 2)
	var ys: Array[float] = [-Sim.H / 2]
	while ys[-1] < Sim.H / 2 - 50:
		ys.append(ys[-1] + randf_range(38, 48))
	ys.append(Sim.H / 2)
	var bld_tf: Array[Transform3D] = []
	var bld_col: Array[Color] = []
	var tree_tf: Array[Transform3D] = []
	var slab_tf: Array[Transform3D] = []
	var slab_col: Array[Color] = []
	for i in range(xs.size() - 1):
		for j in range(ys.size() - 1):
			var hw := 5.0
			var x0 := xs[i] + hw
			var x1 := xs[i + 1] - hw
			var y0 := ys[j] + hw
			var y1 := ys[j + 1] - hw
			if x1 - x0 < 14 or y1 - y0 < 14:
				continue
			var cx := (x0 + x1) / 2
			var cy := (y0 + y1) / 2
			var r := sqrt(pow(cx / (Sim.W / 2), 2) + pow(cy / (Sim.H / 2), 2))
			var kind := "towers" if r < 0.35 else ("houses" if r < 0.8 else "suburb")
			if randf() < 0.1:
				kind = "park"
			# тротуар-плита квартала
			slab_tf.append(Transform3D(Basis().scaled(Vector3(x1 - x0, 0.3, y1 - y0)), Vector3(cx, 0.15, cy)))
			slab_col.append(Color(0.3, 0.45, 0.25) if kind == "park" else Color(0.56, 0.56, 0.54))
			if kind == "park":
				for t in range(int((x1 - x0) * (y1 - y0) / 90.0)):
					var tx := randf_range(x0 + 2, x1 - 2)
					var ty := randf_range(y0 + 2, y1 - 2)
					var s := randf_range(2.2, 4.0)
					tree_tf.append(Transform3D(Basis().scaled(Vector3(s, s * 1.3, s)), Vector3(tx, s * 1.1, ty)))
					sim.fill_blocked(tx - 0.8, ty - 0.8, tx + 0.8, ty + 0.8, 1)
				continue
			if kind == "towers":
				var nb := 1 if randf() < 0.4 else 2
				var vert := (x1 - x0) > (y1 - y0)
				for p in range(nb):
					var span := ((x1 - x0) if vert else (y1 - y0)) / nb
					var a := (x0 if vert else y0) + p * span
					var inset := randf_range(2.0, 4.0)
					var bx0 := (a + inset) if vert else (x0 + inset)
					var bx1 := (a + span - inset) if vert else (x1 - inset)
					var by0 := (y0 + inset) if vert else (a + inset)
					var by1 := (y1 - inset) if vert else (a + span - inset)
					var h := randf_range(36, 100)
					_add_building(bld_tf, bld_col, bx0, by0, bx1, by1, h, Color.from_hsv(randf_range(0.5, 0.62), 0.35, randf_range(0.45, 0.75)))
			elif kind == "houses":
				var vert := (x1 - x0) > (y1 - y0)
				var nb := randi_range(2, 4)
				var span := ((x1 - x0) if vert else (y1 - y0)) / nb
				for p in range(nb):
					var a := (x0 if vert else y0) + p * span
					var bx0 := (a + 1.5) if vert else (x0 + 2)
					var bx1 := (a + span - 1.5) if vert else (x1 - 2)
					var by0 := (y0 + 2) if vert else (a + 1.5)
					var by1 := (y1 - 2) if vert else (a + span - 1.5)
					if bx1 - bx0 < 5 or by1 - by0 < 5:
						continue
					_add_building(bld_tf, bld_col, bx0, by0, bx1, by1, randf_range(9, 30), Color.from_hsv(randf_range(0.02, 0.12), randf_range(0.2, 0.5), randf_range(0.55, 0.85)))
			else:
				var nx := maxi(1, int((x1 - x0) / 11))
				var ny := maxi(1, int((y1 - y0) / 11))
				for a in range(nx):
					for b in range(ny):
						if randf() < 0.15:
							continue
						var lx := x0 + (x1 - x0) * (a + 0.5) / nx
						var ly := y0 + (y1 - y0) * (b + 0.5) / ny
						_add_building(bld_tf, bld_col, lx - 3.2, ly - 2.8, lx + 3.2, ly + 2.8, randf_range(4, 7), Color.from_hsv(randf_range(0.05, 0.15), 0.3, randf_range(0.7, 0.95)))
						if randf() < 0.5:
							var s := randf_range(1.6, 2.6)
							var tx := lx + randf_range(-4.5, 4.5)
							var ty := ly + randf_range(3.5, 5.0)
							tree_tf.append(Transform3D(Basis().scaled(Vector3(s, s * 1.3, s)), Vector3(tx, s * 1.1, ty)))
	_add_multimesh(BoxMesh.new(), bld_tf, bld_col, true)
	_add_multimesh(BoxMesh.new(), slab_tf, slab_col, false)
	var sph := SphereMesh.new()
	sph.radius = 1.0
	sph.height = 2.0
	var tcol: Array[Color] = []
	for t in tree_tf:
		tcol.append(Color.from_hsv(randf_range(0.22, 0.3), randf_range(0.5, 0.7), randf_range(0.3, 0.5)))
	_add_multimesh(sph, tree_tf, tcol, true)

func _add_building(tf: Array[Transform3D], cols: Array[Color], x0: float, y0: float, x1: float, y1: float, h: float, c: Color) -> void:
	tf.append(Transform3D(Basis().scaled(Vector3(x1 - x0, h, y1 - y0)), Vector3((x0 + x1) / 2, h / 2, (y0 + y1) / 2)))
	cols.append(c)
	sim.fill_blocked(x0, y0, x1, y1, 1)

func _add_multimesh(mesh: Mesh, tf: Array[Transform3D], cols: Array[Color], shadows: bool) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = tf.size()
	for i in range(tf.size()):
		mm.set_instance_transform(i, tf[i])
		mm.set_instance_color(i, cols[i])
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.85
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)
	return mmi

# ---------- люди ----------
func _spawn_people(count: int) -> void:
	for i in range(count):
		var p := sim.random_free()
		sim.add_agent(Sim.POLICE if randf() < 0.03 else Sim.CIV, p.x, p.y)

func _make_people_mesh() -> void:
	people_mm = MultiMesh.new()
	people_mm.transform_format = MultiMesh.TRANSFORM_3D
	people_mm.use_colors = true
	var cap := CapsuleMesh.new()
	cap.radius = 0.32
	cap.height = 1.75
	people_mm.mesh = cap
	people_mm.instance_count = 4000
	people_mm.visible_instance_count = 0
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.8
	people_mmi = MultiMeshInstance3D.new()
	people_mmi.multimesh = people_mm
	people_mmi.material_override = mat
	add_child(people_mmi)

func _update_people() -> void:
	if sim.n > people_mm.instance_count:
		people_mm.instance_count = sim.n + 1000
	var k := 0
	for i in range(sim.n):
		var basis := Basis()
		var y := 0.9 + sim.fly_z[i]
		if sim.state[i] == Sim.DEAD:
			basis = Basis(Vector3(0, 0, 1), PI / 2).rotated(Vector3.UP, sim.dir[i])
			y = 0.32 + sim.fly_z[i]
		else:
			basis = Basis(Vector3.UP, -sim.dir[i])
			if sim.role[i] == Sim.ZOMBIE:
				basis = basis * Basis(Vector3(0, 0, 1), -0.3)
		var c := sim.col[i]
		if sim.state[i] == Sim.DEAD:
			c = c.darkened(0.45)
		elif sim.bitten[i] > 0.0:
			c = c.lerp(Color(0.85, 0.8, 0.4), 0.5)
		people_mm.set_instance_transform(k, Transform3D(basis, Vector3(sim.px[i], y, sim.py[i])))
		people_mm.set_instance_color(k, c)
		k += 1
	people_mm.visible_instance_count = k

# ---------- выстрелы и взрывы ----------
func _make_tracers() -> void:
	tracer_mesh = ImmediateMesh.new()
	var mi := MeshInstance3D.new()
	mi.mesh = tracer_mesh
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.85, 0.4)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.8, 0.3)
	mat.emission_energy_multiplier = 4.0
	mi.material_override = mat
	add_child(mi)

func _update_tracers(dt: float) -> void:
	for s in sim.shots:
		tracers.append([Vector3(s.x, 1.3, s.y), Vector3(s.z, 1.0, s.w), 0.08])
	sim.shots.clear()
	tracer_mesh.clear_surfaces()
	var keep: Array = []
	if tracers.size() > 0:
		tracer_mesh.surface_begin(Mesh.PRIMITIVE_LINES)
		for t in tracers:
			t[2] -= dt
			if t[2] <= 0.0:
				continue
			tracer_mesh.surface_add_vertex(t[0])
			tracer_mesh.surface_add_vertex(t[1])
			keep.append(t)
		tracer_mesh.surface_end()
	tracers = keep

func explode_at(p: Vector3, r: float) -> void:
	sim.explode(p.x, p.z, r)
	var ball := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	ball.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.6, 0.2)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.5, 0.15)
	mat.emission_energy_multiplier = 6.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ball.material_override = mat
	ball.position = p + Vector3(0, 2, 0)
	add_child(ball)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.6, 0.3)
	light.light_energy = 20.0
	light.omni_range = r * 3.0
	light.position = p + Vector3(0, 5, 0)
	add_child(light)
	booms.append([ball, light, 0.0, r])
	cam.shake = 1.2

func _update_booms(dt: float) -> void:
	var keep: Array = []
	for b in booms:
		b[2] += dt
		var t: float = b[2]
		var ball: MeshInstance3D = b[0]
		var light: OmniLight3D = b[1]
		var r: float = b[3]
		var k := clampf(t / 0.9, 0.0, 1.0)
		ball.scale = Vector3.ONE * (r * (0.3 + 1.2 * sqrt(k)))
		(ball.material_override as StandardMaterial3D).albedo_color.a = 1.0 - k
		light.light_energy = 20.0 * (1.0 - k)
		if k >= 1.0:
			ball.queue_free()
			light.queue_free()
		else:
			keep.append(b)
	booms = keep

# ---------- интерфейс ----------
func _make_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	var panel := PanelContainer.new()
	panel.position = Vector2(12, 12)
	root.add_child(panel)
	var vb := VBoxContainer.new()
	panel.add_child(vb)
	var title := Label.new()
	title.text = "ВСПЫШКА — прототип на Godot"
	title.add_theme_font_size_override("font_size", 18)
	vb.add_child(title)
	ui_counts = Label.new()
	vb.add_child(ui_counts)
	var hb := HBoxContainer.new()
	vb.add_child(hb)
	for k in TOOLS:
		var b := Button.new()
		b.text = TOOLS[k]
		b.toggle_mode = true
		b.button_pressed = k == tool
		b.pressed.connect(_set_tool.bind(k))
		hb.add_child(b)
		tool_buttons[k] = b
	var hb2 := HBoxContainer.new()
	vb.add_child(hb2)
	var pause_btn := Button.new()
	pause_btn.text = "Пауза"
	pause_btn.pressed.connect(func(): paused = not paused; pause_btn.text = "Продолжить" if paused else "Пауза")
	hb2.add_child(pause_btn)
	var speed_btn := Button.new()
	speed_btn.text = "Скорость ×1"
	speed_btn.pressed.connect(func(): speed = 2.0 if speed == 1.0 else (4.0 if speed == 2.0 else 1.0); speed_btn.text = "Скорость ×%d" % int(speed))
	hb2.add_child(speed_btn)
	var new_btn := Button.new()
	new_btn.text = "Новый город"
	new_btn.pressed.connect(func(): get_tree().reload_current_scene())
	hb2.add_child(new_btn)
	ui_tip = Label.new()
	ui_tip.text = TIPS[tool]
	ui_tip.modulate = Color(0.75, 0.8, 0.78)
	vb.add_child(ui_tip)
	var log_panel := PanelContainer.new()
	log_panel.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	log_panel.position = Vector2(12, 0)
	log_panel.anchor_top = 1.0
	log_panel.anchor_bottom = 1.0
	log_panel.offset_top = -230
	log_panel.offset_bottom = -12
	log_panel.custom_minimum_size = Vector2(420, 0)
	root.add_child(log_panel)
	ui_log = Label.new()
	ui_log.add_theme_font_size_override("font_size", 13)
	log_panel.add_child(ui_log)

func _set_tool(k: String) -> void:
	tool = k
	ui_tip.text = TIPS[k]
	for key in tool_buttons:
		tool_buttons[key].button_pressed = key == k

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed and tool != "watch":
			var p: Vector3 = cam.ground_at(mb.position)
			if p == Vector3.INF:
				return
			_use_tool(p)
	if event is InputEventKey and event.pressed:
		var ke := event as InputEventKey
		if ke.keycode == KEY_SPACE:
			paused = not paused
		if ke.keycode == KEY_ESCAPE:
			_set_tool("watch")

func _use_tool(p: Vector3) -> void:
	match tool:
		"zombie":
			var i := sim.add_agent(Sim.CIV, p.x, p.z)
			sim.turn(i)
		"horde":
			for k in range(20):
				var i := sim.add_agent(Sim.CIV, p.x + randf_range(-6, 6), p.z + randf_range(-6, 6))
				sim.turn(i)
			sim.log_event("Орда зомби")
		"infect":
			var best := -1
			var bd := 4.0
			for i in range(sim.n):
				if sim.state[i] != Sim.ALIVE or sim.role[i] == Sim.ZOMBIE:
					continue
				var d := Vector2(sim.px[i] - p.x, sim.py[i] - p.z).length()
				if d < bd:
					bd = d
					best = i
			if best >= 0:
				sim.bitten[best] = 30.0
				sim.log_event("Заражён ещё один человек")
		"police":
			for k in range(3):
				sim.add_agent(Sim.POLICE, p.x + randf_range(-3, 3), p.z + randf_range(-3, 3))
			sim.log_event("Прибыл полицейский патруль")
		"boom":
			explode_at(p, 14.0)

func _process(dt: float) -> void:
	if not paused:
		acc += dt * speed
		var steps := 0
		while acc >= 1.0 / 30.0 and steps < 8:
			sim.step(1.0 / 30.0)
			acc -= 1.0 / 30.0
			steps += 1
	_update_people()
	_update_tracers(dt)
	_update_booms(dt)
	var c := sim.counts()
	ui_counts.text = "Здоровы %d · Укушены %d · Зомби %d · Погибли %d · укусов %d · зомби уничтожено %d · %d к/с" % [c.H, c.I, c.Z, c.D, sim.bites, sim.zkills, Engine.get_frames_per_second()]
	ui_log.text = "\n".join(sim.events)
