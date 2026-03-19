import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';

const IDX = { L_SHOULDER: 11, R_SHOULDER: 12, L_HIP: 23, R_HIP: 24 } as const;
const VIS_MIN = 0.75;
const BOUNDS = { lo: 0.05, hi: 0.95 } as const;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function getPoseLandmarkerImage(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

/** Average luma of image (0–255). */
export async function getImageAverageBrightness(
  imageDataUrl: string
): Promise<number> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageDataUrl;
  await img.decode().catch(() => {
    throw new Error('Could not load image');
  });
  const w = Math.min(img.naturalWidth, 256);
  const h = Math.min(img.naturalHeight, 256);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 128;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  const n = w * h;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return sum / n;
}

const PERSON_NOT_VISIBLE =
  'Could not detect a person in this photo. Please upload a clear full-body or upper-body photo with good lighting.';

export async function validatePersonPoseFromDataUrl(
  imageDataUrl: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  console.log("Validation started");
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageDataUrl;
  try {
    await img.decode();
  } catch {
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  // Load image into a hidden canvas for IMAGE-mode detection
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let landmarker: PoseLandmarker;
  try {
    landmarker = await getPoseLandmarkerImage();
  } catch {
    return { ok: false, message: 'Pose model failed to load. Please try again.' };
  }

  let result;
  try {
    result = landmarker.detect(canvas);
  } catch {
    console.log("Validation result: FAIL");
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  console.log("Landmarks detected:", result.landmarks.length);
  if (result.landmarks.length > 0) {
    console.log("Landmark 11 visibility:", result.landmarks[0][11]?.visibility);
    console.log("Landmark 12 visibility:", result.landmarks[0][12]?.visibility);
  }

  // Strict: reject if no pose detected
  if (!result.landmarks || result.landmarks.length === 0) {
    console.log("Validation result: FAIL");
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  if (!result.worldLandmarks || result.worldLandmarks.length === 0) {
    console.log("Validation result: FAIL");
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  const lm = result.landmarks?.[0];
  if (!lm || lm.length < 25) {
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  const need = [IDX.L_SHOULDER, IDX.R_SHOULDER, IDX.L_HIP, IDX.R_HIP];
  for (const i of need) {
    const p = lm[i];
    if (!p) {
      console.log("Validation result: FAIL");
      return { ok: false, message: 'Person not clearly visible.' };
    }
    const vis = p.visibility ?? 0;
    if (vis <= VIS_MIN) {
      console.log("Validation result: FAIL");
      return { ok: false, message: 'Person not clearly visible.' };
    }
    if (
      p.x < BOUNDS.lo ||
      p.x > BOUNDS.hi ||
      p.y < BOUNDS.lo ||
      p.y > BOUNDS.hi
    ) {
      console.log("Validation result: FAIL");
      return { ok: false, message: PERSON_NOT_VISIBLE };
    }
  }

  // Check 1 — Shoulder width ratio (real person check)
  const lSho = lm[11];
  const rSho = lm[12];
  const shoulderWidth = Math.abs(rSho.x - lSho.x);

  // Real person shoulder width should be 0.15 to 0.55 of image width
  // Too narrow = not a person, too wide = too close/distorted
  if (shoulderWidth < 0.15 || shoulderWidth > 0.55) {
    console.log("Validation result: FAIL");
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  // Check 2 — Torso height ratio
  const lHip = lm[23];
  const torsoHeight = Math.abs(lHip.y - lSho.y);

  // Torso should be at least 15% of image height
  if (torsoHeight < 0.15) {
    console.log("Validation result: FAIL");
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  console.log("Validation result: PASS");
  return { ok: true };
}
