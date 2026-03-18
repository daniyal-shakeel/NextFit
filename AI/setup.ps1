# NextFit AI Try-On Setup (Windows)
$ErrorActionPreference = "Stop"

if ($MyInvocation.ScriptName -like "*tempCodeRunnerFile*") {
    Write-Host "ERROR: Run this script from terminal, not Code Runner." -ForegroundColor Red
    Write-Host "Open terminal and run: .\setup.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host '=== NextFit AI Try-On Setup ===' -ForegroundColor Cyan

# Ensure script runs from its own directory (so relative paths work)
Set-Location $PSScriptRoot

# Check Python 3.10
try {
    $py310 = py -3.10 -c 'import sys; print(sys.version)' 2>$null
    if (-not $py310) { throw 'Python 3.10 not found' }
    Write-Host "Using Python 3.10: $py310"
} catch {
    Write-Host 'Python 3.10 not found. Install Python 3.10 and add to PATH.' -ForegroundColor Red
    Write-Host 'Run: py -0 to list installed Python versions' -ForegroundColor Yellow
    exit 1
}

$VENV_DIR = Join-Path $PSScriptRoot "venv"

# Only create venv if it does not already exist
if (Test-Path $VENV_DIR) {
    Write-Host 'Virtual environment already exists - skipping creation' -ForegroundColor Yellow
} else {
    Write-Host "Creating virtual environment with Python 3.10 at $VENV_DIR..." -ForegroundColor Cyan
    py -3.10 -m venv $VENV_DIR
}

# Activate venv and install
& "$VENV_DIR\Scripts\Activate.ps1"
Write-Host "Virtual environment active: $env:VIRTUAL_ENV"

python -m pip install --upgrade pip
python -m pip install -r requirements.txt --upgrade

# Clone CatVTON repo (required)
if (-not (Test-Path "CatVTON")) {
    Write-Host 'Cloning CatVTON repo...'
    git clone https://github.com/Zheng-Chong/CatVTON.git
}

# Install CatVTON requirements (ensures all deps for cloned repo)
if (Test-Path "CatVTON\requirements.txt") {
    python -m pip install -r CatVTON\requirements.txt
}

# Create .env if not exists
if (-not (Test-Path ".env")) {
    Copy-Item .env.example .env
    Write-Host '.env created from template - edit CORS_ORIGIN if needed'
} else {
    Write-Host '.env already exists'
}

# Model cache dir
New-Item -ItemType Directory -Force -Path models | Out-Null

Write-Host ''
Write-Host '=== Setup Complete ===' -ForegroundColor Green
Write-Host ''
Write-Host 'To start server: .\run.ps1'
Write-Host 'Health check:    curl http://localhost:8000/health'
