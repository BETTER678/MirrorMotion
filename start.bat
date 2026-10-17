@echo off
setlocal

title MotionMirror Launcher
color 0D

cd /d "%~dp0"

echo.
echo  ============================================
echo   MotionMirror — Real-Time Avatar Mirroring
echo  ============================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found.
    echo Run: python -m venv .venv
    echo Then: .venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/2] Starting Pose WebSocket Server...
start "MotionMirror Pose Server" cmd /k ".venv\Scripts\python.exe motion_server.py"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend (Vite)...
start "MotionMirror Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1"

timeout /t 3 /nobreak >nul

echo.
echo  Opening browser...
start "" http://localhost:5173

echo.
echo  Both servers are running in separate windows.
echo  - Webcam server: ws://localhost:8765
echo  - Frontend:      http://localhost:5173
echo.
echo  Press any key to close this launcher (servers keep running).
pause >nul
