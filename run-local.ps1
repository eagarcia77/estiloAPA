$ErrorActionPreference = 'Stop'
$Port = 8000
Set-Location $PSScriptRoot

Write-Host 'APA7 Module Formatter v2.0'
Write-Host "Iniciando servidor local en http://localhost:$Port ..."

$python = $null
foreach ($candidate in @('py', 'python', 'python3')) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $python = $candidate
        break
    }
}

if (-not $python) {
    Write-Host 'No se encontró Python en el PATH.' -ForegroundColor Red
    Write-Host 'Instale Python 3 o ejecute la aplicación mediante GitHub Pages.'
    exit 1
}

Start-Process "http://localhost:$Port"
if ($python -eq 'py') {
    & py -m http.server $Port
} else {
    & $python -m http.server $Port
}
