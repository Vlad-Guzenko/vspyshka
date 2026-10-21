extends Camera3D
## Орбитальная камера: правая кнопка — вращать, колесо — приблизить, WASD — двигать, средняя кнопка — тащить.

var target := Vector3(0, 0, 0)
var yaw := -1.0
var pitch := 0.9
var dist := 420.0
var shake := 0.0
var _rotating := false
var _panning := false

func _ready() -> void:
	near = 0.5
	far = 4000.0
	fov = 42.0
	_apply()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_RIGHT:
			_rotating = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_MIDDLE:
			_panning = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			dist = clampf(dist * 0.85, 6.0, 900.0)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			dist = clampf(dist * 1.17, 6.0, 900.0)
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _rotating:
			yaw += mm.relative.x * 0.006
			pitch = clampf(pitch + mm.relative.y * 0.004, 0.08, 1.5)
		elif _panning:
			_pan(mm.relative.x, mm.relative.y)

func _pan(dx: float, dy: float) -> void:
	var s := dist / 700.0
	var fx := -cos(yaw)
	var fz := -sin(yaw)
	target.x += (-fz * -dx + fx * dy) * s
	target.z += (fx * -dx + fz * dy) * s

func _process(delta: float) -> void:
	var f := Input.get_axis("ui_down", "ui_up")
	var r := Input.get_axis("ui_left", "ui_right")
	if Input.is_key_pressed(KEY_W): f = 1.0
	if Input.is_key_pressed(KEY_S): f = -1.0
	if Input.is_key_pressed(KEY_D): r = 1.0
	if Input.is_key_pressed(KEY_A): r = -1.0
	if f != 0.0 or r != 0.0:
		var s := dist * delta * 0.9
		var fx := -cos(yaw)
		var fz := -sin(yaw)
		target.x += (fx * f - fz * r) * s
		target.z += (fz * f + fx * r) * s
	target.x = clampf(target.x, -400.0, 400.0)
	target.z = clampf(target.z, -300.0, 300.0)
	shake = maxf(0.0, shake - delta * 6.0)
	_apply()

func _apply() -> void:
	var cp := cos(pitch)
	var off := Vector3(dist * cp * cos(yaw), dist * sin(pitch), dist * cp * sin(yaw))
	var jitter := Vector3(randf_range(-shake, shake), randf_range(-shake, shake), 0) if shake > 0.0 else Vector3.ZERO
	position = target + off + jitter
	position.y = maxf(position.y, 1.5)
	look_at(target + Vector3(0, 1, 0), Vector3.UP)

## Точка на земле под курсором (y = 0)
func ground_at(screen: Vector2) -> Vector3:
	var from := project_ray_origin(screen)
	var dir := project_ray_normal(screen)
	if absf(dir.y) < 1e-4:
		return Vector3.INF
	var t := -from.y / dir.y
	if t < 0.0:
		return Vector3.INF
	return from + dir * t
