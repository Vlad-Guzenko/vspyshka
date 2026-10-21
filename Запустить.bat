@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Браузер не даёт странице читать звуки с диска напрямую, поэтому игра запускается через маленький локальный сервер.
where python >nul 2>nul
if errorlevel 1 (
  echo Не найден Python. Установите его с https://www.python.org/downloads/ и запустите этот файл снова.
  echo Без сервера можно открыть index.html напрямую, но тогда будут только синтезированные звуки.
  pause
  exit /b 1
)
echo Игра откроется в браузере: http://localhost:8765/
echo Чтобы остановить, закройте это окно.
start "" http://localhost:8765/index.html
python -m http.server 8765
