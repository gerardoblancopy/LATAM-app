@echo off
echo Starting Ameba Power System App...

REM Use FULL PATH to python in amebamaps environment to avoid activation issues
set PYTHON_EXE="C:\Users\migue\anaconda3\envs\amebamaps\python.exe"

echo.
echo Launching BACKEND (FastAPI + Gurobi)...
echo Using Python at: %PYTHON_EXE%

start "Ameba Backend" cmd /k "cd backend && %PYTHON_EXE% main.py || echo FAILED to start backend!"

echo.
echo Launching FRONTEND (React)...
start "Ameba Frontend" cmd /k "cd frontend && npm run dev || echo FAILED to start frontend!"

echo.
echo App should be running at:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8888
echo.
pause
