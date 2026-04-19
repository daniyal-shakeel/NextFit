param(
    [Parameter(Position = 0)]
    [ValidateSet('Development', 'Production')]
    [string]$Environment = 'Development'
)

$ErrorActionPreference = "Stop"

$envFileName = if ($Environment -eq 'Production') { '.env.production' } else { '.env.development' }
$DOTENV_PATH = Join-Path $PSScriptRoot $envFileName

if (-not (Test-Path $DOTENV_PATH)) {
    Write-Host "Env file not found: $DOTENV_PATH" -ForegroundColor Red
    exit 1
}

$env:NEXTFIT_DOTENV_FILE = $DOTENV_PATH
Write-Host "Env file loaded: $DOTENV_PATH" -ForegroundColor Cyan

$VENV_DIR = Join-Path $PSScriptRoot "venv"

if (-not (Test-Path $VENV_DIR)) {
    Write-Host "Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

& "$VENV_DIR\Scripts\Activate.ps1"

Write-Host "Starting NextFit AI Service..."
Write-Host "Environment: $Environment ($envFileName)"
Write-Host "Virtual environment: $env:VIRTUAL_ENV"
$deviceInfo = python -c "import torch; print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
Write-Host "Device: $deviceInfo"

$skipModel = python -c "from dotenv import load_dotenv; import os; load_dotenv(os.environ.get('NEXTFIT_DOTENV_FILE') or '.env'); print(os.getenv('SKIP_MODEL_LOAD', 'false'))"
if ($skipModel -eq "true") {
    Write-Host "Model loading: SKIPPED - set SKIP_MODEL_LOAD=false on Modal.com" -ForegroundColor Yellow
} else {
    Write-Host "Model loading: ENABLED - downloading if not cached" -ForegroundColor Green
}
Write-Host ""

python main.py
