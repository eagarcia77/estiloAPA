@echo off
setlocal
set PORT=8000
cd /d "%~dp0"

echo APA7 Module Formatter v2.0
echo Iniciando servidor local en http://localhost:%PORT% ...

where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  python -m http.server %PORT%
  goto :eof
)

where python3 >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  python3 -m http.server %PORT%
  goto :eof
)

echo.
echo No se encontro Python en el PATH.
echo Instale Python 3 o ejecute la aplicacion mediante GitHub Pages.
pause
