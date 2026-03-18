#!/bin/bash
set -e

echo "=== NextFit AI Try-On Setup ==="

# Check Python
python3 --version || { echo "Python3 not found"; exit 1; }

VENV_DIR="$(pwd)/venv"

# Create venv if not exists
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment at $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
fi

# Activate venv
source "$VENV_DIR/bin/activate"
echo "Virtual environment active: $VIRTUAL_ENV"

# Install deps inside venv only — no global installs
pip install --upgrade pip
pip install -r requirements.txt

# Clone CatVTON repo (required)
if [ ! -d "CatVTON" ]; then
  echo "Cloning CatVTON repo..."
  git clone https://github.com/Zheng-Chong/CatVTON.git
fi

# Install CatVTON requirements (ensures all deps for cloned repo)
if [ -f "CatVTON/requirements.txt" ]; then
  pip install -r CatVTON/requirements.txt
fi

# Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from template — edit CORS_ORIGIN if needed"
fi

# Model cache dir
mkdir -p models

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start server: bash run.sh"
echo "Health check:    curl http://localhost:8000/health"
