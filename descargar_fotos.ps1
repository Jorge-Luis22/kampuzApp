# Descarga las fotos de perfil a public/fotos para que la app no dependa de Unsplash.
# Uso (dentro de la carpeta kampusApp):
#   powershell -ExecutionPolicy Bypass -File .\descargar_fotos.ps1

$ErrorActionPreference = "Stop"
$destino = Join-Path $PSScriptRoot "public\fotos"
New-Item -ItemType Directory -Force -Path $destino | Out-Null

$fotos = @{
  "luz.jpg"         = "photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=80&fm=jpg"
  "portada_luz.jpg" = "photo-1523240795612-9a054b0db644?w=1000&fit=crop&q=75&fm=jpg"
  "camila.jpg"      = "photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80&fm=jpg"
  "marcos.jpg"      = "photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80&fm=jpg"
  "valeria.jpg"     = "photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&q=80&fm=jpg"
  "diego.jpg"       = "photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80&fm=jpg"
  "andrea.jpg"      = "photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80&fm=jpg"
}

$ok = 0; $fallas = @()
foreach ($nombre in $fotos.Keys) {
  $url = "https://images.unsplash.com/" + $fotos[$nombre]
  $archivo = Join-Path $destino $nombre
  try {
    Invoke-WebRequest -Uri $url -OutFile $archivo -UseBasicParsing -TimeoutSec 30
    $kb = [math]::Round((Get-Item $archivo).Length / 1KB)
    Write-Host "OK  $nombre ($kb KB)" -ForegroundColor Green
    $ok++
  } catch {
    Write-Host "X   $nombre -> no se pudo descargar" -ForegroundColor Red
    $fallas += $nombre
  }
}

Write-Host ""
Write-Host "Descargadas: $ok de $($fotos.Count)"
if ($fallas.Count -gt 0) {
  Write-Host "Fallaron: $($fallas -join ', ')" -ForegroundColor Yellow
  Write-Host "Esas se veran como un recuadro con iniciales (no como imagen rota). Puedes poner cualquier foto con ese mismo nombre en public\fotos."
}
