# First-time / rebuild venv with Python 3.12 + RetinaFace (recommended).
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pipelineApi = Join-Path $here 'pipeline_api'
$venvDir = Join-Path $here '.venv'
$venvPy = Join-Path $venvDir 'Scripts\python.exe'

function Find-Python312 {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    $exe = (& py -3.12 -c "import sys; print(sys.executable)" 2>$null)
    if ($exe) { return $exe.Trim() }
  }
  $p = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
  if (Test-Path $p) { return $p }
  $p = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.12-64\python.exe'
  if (Test-Path $p) { return $p }
  return $null
}

$py = Find-Python312
if (-not $py) {
  Write-Host 'Python 3.12 not found. Run:  py install 3.12'
  Write-Host 'Or install from https://www.python.org/downloads/'
  exit 1
}

Write-Host "Using Python 3.12: $py"
if (Test-Path $venvDir) {
  Write-Host 'Removing old .venv...'
  Remove-Item -Recurse -Force $venvDir
}

& $py -m venv $venvDir
& $venvPy -m pip install --upgrade pip
Write-Host 'Installing core packages (torch, opencv)...'
& $venvPy -m pip install -r (Join-Path $here 'requirements.txt')
Write-Host 'Installing RetinaFace + TensorFlow (may take several minutes)...'
& $venvPy -m pip install -r (Join-Path $here 'requirements-retina.txt')
& $venvPy -m pip install -r (Join-Path $pipelineApi 'requirements.txt')

Write-Host 'Verifying (imports pipeline + RetinaFace)...'
$env:PYTHONPATH = Join-Path $here 'inference_code'
Push-Location $pipelineApi
& $venvPy -c @"
import cv2, torch
from retinaface import RetinaFace
import main
from detect_faces import _USE_RETINA
print('OK Python 3.12')
print('  cv2', cv2.__version__)
print('  torch', torch.__version__)
print('  RetinaFace enabled:', _USE_RETINA)
"@
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location
Write-Host ''
Write-Host 'Done. Run .\start.ps1 from the repo root.'
