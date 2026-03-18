#!/bin/bash
set -e

VENV_DIR="$(pwd)/venv"

# Check venv exists
if [ ! -d "$VENV_DIR" ]; then
  echo "Virtual environment not found. Run setup.sh first."
  exit 1
fi

# Activate venv
source "$VENV_DIR/bin/activate"

echo "Starting NextFit AI Service..."
echo "Virtual environment: $VIRTUAL_ENV"
echo "Device: $(python -c 'import torch; print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU only")')"
echo ""

# Start server
python main.py
