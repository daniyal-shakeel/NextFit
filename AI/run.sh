VENV_DIR="$(pwd)/venv"
ENV=${1:-Development}
if [ "$ENV" = "Production" ]; then
    DOTENV_FILE=".env.production"
else
    ENV="Development"
    DOTENV_FILE=".env.development"
fi

export NEXTFIT_DOTENV_FILE="$(pwd)/$DOTENV_FILE"

if [ ! -f "$NEXTFIT_DOTENV_FILE" ]; then
    echo "Error: $DOTENV_FILE not found"
    exit 1
fi

source "$VENV_DIR/bin/activate"

echo "Starting NextFit AI Service..."
echo "Environment: $ENV ($DOTENV_FILE)"
echo "Virtual environment: $VIRTUAL_ENV"
echo "Device: $(python3 -c 'import torch; print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU only")')"
echo ""

python3 main.py

