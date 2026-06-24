@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo    Acumen Night Bot - Setup
echo ====================================
echo.
echo Creating virtual environment...
python -m venv .venv
echo Installing requirements...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Done! Now copy .env.example to a file named .env and put your keys in it.
echo Then run start.bat
echo.
pause
