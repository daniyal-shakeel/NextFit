import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { getMediapipeVisionWasmRoot } from '@/lib/mediapipeVisionWasm';

const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function getPoseLandmarkerImage(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(getMediapipeVisionWasmRoot());
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

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

  if (!result.landmarks || result.landmarks.length === 0) {
    console.log("Validation result: FAIL — no pose found");
    return { ok: false, message: PERSON_NOT_VISIBLE };
  }

  console.log("Validation result: PASS");
  return { ok: true };
}
