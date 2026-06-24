@echo off
chcp 65001 >nul
cd /d "%~dp0"
call .venv\Scripts\activate.bat
echo ====================================
echo    Acumen Night Render - Web App
echo ====================================
echo.
echo Open your browser at:   http://localhost:8000
echo (Press Ctrl+C here to stop the app.)
echo.
python app.py
pause
