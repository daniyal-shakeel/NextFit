# NextFit AI Service - Windows
$ErrorActionPreference = "Stop"

$VENV_DIR = Join-Path $PSScriptRoot "venv"

if (-not (Test-Path $VENV_DIR)) {
    Write-Host "Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

& "$VENV_DIR\Scripts\Activate.ps1"

Write-Host "Starting NextFit AI Service..."
Write-Host "Virtual environment: $env:VIRTUAL_ENV"
$deviceInfo = python -c "import torch; print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
Write-Host "Device: $deviceInfo"

$skipModel = python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('SKIP_MODEL_LOAD', 'false'))"
if ($skipModel -eq "true") {
    Write-Host "Model loading: SKIPPED - set SKIP_MODEL_LOAD=false on Modal.com" -ForegroundColor Yellow
} else {
    Write-Host "Model loading: ENABLED - downloading if not cached" -ForegroundColor Green
}
Write-Host ""

python main.py
