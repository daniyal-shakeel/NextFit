
set -e

echo "=== NextFit AI Try-On Setup ==="

# Check Python 3.10
python3 --version || { echo "Python3 not found"; exit 1; }

VENV_DIR="$(pwd)/venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment at $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
echo "Virtual environment active: $VIRTUAL_ENV"

pip install --upgrade pip
pip install -r requirements.txt --upgrade

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from template"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start server: bash run.sh"
echo "Health check:    curl http://localhost:8000/health"

