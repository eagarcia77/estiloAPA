@echo off
setlocal
set PORT=8000
cd /d "%~dp0"

echo APA7 Academic Formatter v3.4.8
echo Iniciando servidor local en http://localhost:%PORT% ...
echo Mantenga esta ventana abierta mientras utiliza la aplicacion.
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  py -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where python3 >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  python3 -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

echo.
echo No se encontro Python 3 en el PATH.
echo Consulte INSTALACION_SERVIDOR_LOCAL.md para usar Python, XAMPP/Apache o IIS.
pause
