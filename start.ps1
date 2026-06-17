# Launches pipeline API (8000), PostgreSQL if possible, Spring Boot (8080), Vite (5173).
# From repo root:  .\start.ps1
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

function Test-PythonExe([string]$exePath) {
  if (-not (Test-Path -LiteralPath $exePath)) { return $false }
  try {
    $null = & $exePath -c "import sys" 2>&1
    return ($LASTEXITCODE -eq 0)
  }
  catch { return $false }
}

function Resolve-PythonExe {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    foreach ($ver in @('3.12', '3.11', '3.13', '3.10', '3.14')) {
      try {
        $fromPy = & py "-$ver" -c "import sys; print(sys.executable)" 2>&1
        if ($fromPy -and (Test-Path -LiteralPath $fromPy.Trim())) {
          $p = $fromPy.Trim()
          if (Test-PythonExe $p) { return $p }
        }
      }
      catch { }
    }
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.12-64\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python314\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.14-64\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Python\bin\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python310\python.exe')
  )
  foreach ($p in $candidates) {
    if (Test-PythonExe $p) { return $p }
  }

  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -notmatch 'WindowsApps') {
    if (Test-PythonExe $cmd.Source) { return $cmd.Source }
  }
  return $null
}

function Ensure-SengroupDatabase {
  $psqlPaths = @(
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\17\bin\psql.exe'),
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\16\bin\psql.exe'),
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\15\bin\psql.exe')
  )
  $psql = $psqlPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $psql) { return }

  $prev = $env:PGPASSWORD
  $env:PGPASSWORD = 'postgres'
  try {
    $exists = & $psql -U postgres -h localhost -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = 'sengroup'" 2>$null
    if (-not ($exists -match '1')) {
      & $psql -U postgres -h localhost -p 5432 -c 'CREATE DATABASE sengroup;' 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Host 'Created PostgreSQL database: sengroup'
      }
    }
  }
  catch { }
  finally {
    if ($null -eq $prev) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    else { $env:PGPASSWORD = $prev }
  }
}

Write-Host "Capstone launcher (repo: $root)"

$pg = Get-Service -ErrorAction SilentlyContinue |
  Where-Object {
    ($_.Name -match 'postgres' -or $_.DisplayName -match 'PostgreSQL') -and
    $_.Status -ne 'Running'
  } |
  Select-Object -First 1

if ($pg) {
  try {
    Start-Service -Name $pg.Name -ErrorAction Stop
    Write-Host "Started service: $($pg.Name)"
    Start-Sleep -Seconds 2
    Ensure-SengroupDatabase
  }
  catch {
    Write-Host "Could not start PostgreSQL service automatically. Start Postgres yourself (localhost:5432, database sengroup)."
  }
}
else {
  $any = Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'postgres' -or $_.DisplayName -match 'PostgreSQL' }
  if ($any | Where-Object { $_.Status -eq 'Running' }) {
    Write-Host "PostgreSQL service already running."
    Ensure-SengroupDatabase
  }
  else {
    Write-Host "No stopped PostgreSQL Windows service found. Ensure Postgres is running (jdbc:postgresql://localhost:5432/sengroup)."
  }
}

$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$aiPkg = Join-Path $root 'AI_BACKEND_INTEGRATION_PACKAGE\AI_BACKEND_INTEGRATION_PACKAGE'
$pipelineApi = Join-Path $aiPkg 'pipeline_api'

if (-not (Test-Path $backend)) {
  Write-Host "ERROR: backend folder not found at $backend"
  exit 1
}
if (-not (Test-Path $frontend)) {
  Write-Host "ERROR: frontend folder not found at $frontend"
  exit 1
}
if (-not (Test-Path $pipelineApi)) {
  Write-Host "ERROR: pipeline_api not found at $pipelineApi"
  exit 1
}

$pythonExe = Resolve-PythonExe
$venv = Join-Path $aiPkg '.venv'
$venvPython = Join-Path $venv 'Scripts\python.exe'
$inferenceCode = Join-Path $aiPkg 'inference_code'

if (-not $pythonExe) {
  Write-Host ""
  Write-Host "WARNING: Python was not found. Pipeline API (port 8000) will NOT start."
  Write-Host "Install Python 3.12:  py install 3.12   (or https://www.python.org/downloads/)"
  Write-Host "Or use the Microsoft Store / Local Python install, then run .\start.ps1 again."
  Write-Host ""
}
else {
  Write-Host "Using Python: $pythonExe"
  if (-not $env:GEMINI_API_KEY) {
    Write-Host ""
    Write-Host "WARNING: GEMINI_API_KEY is not set. Stage 3 (Gemini) will not work until you set it:"
    Write-Host '  $env:GEMINI_API_KEY = "your_key_here"'
    Write-Host "Then re-run .\start.ps1, or set it in the pipeline window before analysis."
    Write-Host ""
  }
  $pyEsc = $pythonExe.Replace("'", "''")
  $geminiEsc = if ($env:GEMINI_API_KEY) { $env:GEMINI_API_KEY.Replace("'", "''") } else { '' }
  $pipelineCmd = @"
Set-Location -LiteralPath '$pipelineApi'
`$py = '$pyEsc'
`$venvPy = '$venvPython'
if (-not (Test-Path -LiteralPath `$venvPy)) {
  Write-Host 'Creating Python venv (first time only, may take several minutes)...'
  Set-Location -LiteralPath '$aiPkg'
  & `$py -m venv .venv
  if (-not (Test-Path -LiteralPath `$venvPy)) {
    Write-Host 'ERROR: venv failed. Run manually:'
    Write-Host "  `$py -m venv `"$aiPkg\.venv`""
    exit 1
  }
}
Write-Host 'Installing Python packages (first time only, can take 10-20 min)...'
& `$venvPy -m pip install --upgrade pip
& `$venvPy -m pip install -r '$aiPkg\requirements.txt'
`$maj = & `$venvPy -c 'import sys; print(sys.version_info.major)'
`$min = & `$venvPy -c 'import sys; print(sys.version_info.minor)'
if ([int]`$maj -eq 3 -and [int]`$min -lt 13) {
  Write-Host 'Installing RetinaFace + TensorFlow (Python 3.10-3.12)...'
  & `$venvPy -m pip install -r '$aiPkg\requirements-retina.txt'
} else {
  Write-Host 'Python 3.13+ (incl. 3.14): OpenCV face detection (no TensorFlow/RetinaFace).'
}
& `$venvPy -m pip install -r '$pipelineApi\requirements.txt'
`$env:PYTHONPATH = '$inferenceCode'
`$check = & `$venvPy -c 'import cv2, torch; import main' 2>&1
if (`$LASTEXITCODE -ne 0) {
  Write-Host 'ERROR: pipeline failed to start (broken Python packages).'
  Write-Host 'Run: AI_BACKEND_INTEGRATION_PACKAGE\AI_BACKEND_INTEGRATION_PACKAGE\install_pipeline.ps1'
  Write-Host `$check
  exit 1
}
Write-Host 'Pipeline API http://127.0.0.1:8000/api/v1 (first request loads models - wait)'
if ('$geminiEsc' -ne '') {
  `$env:GEMINI_API_KEY = '$geminiEsc'
  Write-Host 'Stage 3: GEMINI_API_KEY passed from launcher.'
}
if (-not `$env:GEMINI_API_KEY) {
  Write-Host 'WARNING: GEMINI_API_KEY not set — Stage 3 will fail until you run:'
  Write-Host '  `$env:GEMINI_API_KEY = "your_key_here"'
}
& `$venvPy -m uvicorn main:app --host 127.0.0.1 --port 8000
"@
  Start-Process -FilePath powershell.exe -ArgumentList @(
    '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $pipelineCmd
  ) -WorkingDirectory $pipelineApi
  Start-Sleep -Seconds 3
}

$backendCmd = "Set-Location -LiteralPath '$backend'; Write-Host 'Backend http://127.0.0.1:8080'; mvn spring-boot:run"
Start-Process -FilePath powershell.exe -ArgumentList @(
  '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd
) -WorkingDirectory $backend

Start-Sleep -Seconds 2

$frontendCmd = "Set-Location -LiteralPath '$frontend'; if (-not (Test-Path node_modules)) { npm install }; Write-Host 'UI http://localhost:5173'; npm run dev"
Start-Process -FilePath powershell.exe -ArgumentList @(
  '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd
) -WorkingDirectory $frontend

Write-Host ''
if ($pythonExe) {
  Write-Host 'Opened three windows: Pipeline API (8000), Spring Boot (8080), Vite (5173).'
}
else {
  Write-Host 'Opened two windows: Spring Boot (8080), Vite (5173). Start Python pipeline separately if needed.'
}
Write-Host 'Open http://localhost:5173 - upload a group photo and start analysis.'
