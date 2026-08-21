$ErrorActionPreference = 'Stop'
$Port = 8000
Set-Location $PSScriptRoot

Write-Host 'APA7 Academic Formatter v3.4.8'
Write-Host "Iniciando servidor local en http://localhost:$Port/ ..."
Write-Host 'Mantenga esta ventana abierta mientras utiliza la aplicación.'
Write-Host ''

$python = $null
foreach ($candidate in @('py', 'python', 'python3')) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $python = $candidate
        break
    }
}

if (-not $python) {
    Write-Host 'No se encontró Python 3 en el PATH.' -ForegroundColor Red
    Write-Host 'Consulte INSTALACION_SERVIDOR_LOCAL.md para usar Python, XAMPP/Apache o IIS.'
    exit 1
}

Start-Process "http://localhost:$Port/"
if ($python -eq 'py') {
    & py -m http.server $Port --bind 127.0.0.1
} else {
    & $python -m http.server $Port --bind 127.0.0.1
}
