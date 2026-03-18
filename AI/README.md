# NextFit AI Try-On Service

## Important — Virtual Environment

All dependencies run inside an isolated venv inside `NextFit/AI/venv/`.
Nothing is installed globally.

## First Time Setup

**Linux / Mac / WSL:**
```bash
cd NextFit/AI/
bash setup.sh
```

**Windows (PowerShell):**
```powershell
cd NextFit\AI
.\setup.ps1
```

## Run Server (Every Time)

**Linux / Mac / WSL:**
```bash
cd NextFit/AI/
bash run.sh
```

**Windows (PowerShell):**
```powershell
cd NextFit\AI
.\run.ps1
```

## Manual (if needed)

```bash
source venv/bin/activate
python main.py
deactivate  # when done
```

## CatVTON

The service uses [CatVTON](https://github.com/Zheng-Chong/CatVTON) for virtual try-on. `setup.sh` clones the repo into `NextFit/AI/CatVTON/`. **The CatVTON repo is required** — if missing, the service will raise: `CatVTON repo not found. Run setup.sh first.`

## Vast.ai Deploy

1. Rent RTX 3060 instance — Ubuntu 22 + CUDA template
2. SSH into instance
3. `git clone <your-repo>`
4. `cd NextFit/AI`
5. `bash setup.sh`
6. `bash run.sh`
7. In Vast.ai dashboard → expose port 8000
8. Copy public URL → set as `VITE_AI_API_URL` in `Frontend/.env`

## GCP Deploy

Same steps — expose port 8000, use external IP as `VITE_AI_API_URL`.

## Environment Variables

See `.env.example`
