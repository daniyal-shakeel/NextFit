# NextFit AI Try-On Service

## Important — Virtual Environment

All dependencies run inside an isolated venv inside `NextFit/AI/venv/`.
Nothing is installed globally.

## First Time Setup

Install Python deps from `requirements.txt` inside the venv:

```powershell
cd NextFit\AI
python -m pip install -r requirements.txt
```

The legacy `setup.ps1` / `setup.sh` scripts exist but are no longer required for the current (diffusers-only) pipeline.

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

## Model

This service uses the standard HuggingFace `diffusers` inpainting pipeline:

- Model ID: `stabilityai/stable-diffusion-2-inpainting`
- Pipeline: `StableDiffusionInpaintPipeline`

No third-party repos are cloned and no external code is vendored.

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

## Modal Deploy

From repo root:

```powershell
cd C:\MEGA\University\smester 7\FYP\NextFit\AI
modal deploy modal_app.py
```

## Environment Variables

See `.env.example`
