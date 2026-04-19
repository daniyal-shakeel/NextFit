export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type FrameStatus = 'ready' | 'too_close' | 'too_far' | 'out_of_frame';

const REQUIRED_VISIBILITY = 0.75;
const X_MIN = 0.05;
const X_MAX = 0.95;
const Y_MIN = 0.02;
const Y_MAX = 0.97;
const SHOULDER_TOO_CLOSE = 0.65;
const SHOULDER_TOO_FAR = 0.18;
const MIN_TORSO_HEIGHT = 0.25;

export function getFrameStatus(landmarks: NormalizedLandmark[] | null): FrameStatus {
  if (!landmarks?.length) return 'out_of_frame';

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const required = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
  if (required.some((lm) => !lm)) return 'out_of_frame';

  for (const lm of required) {
    if ((lm!.visibility ?? 0) < REQUIRED_VISIBILITY) return 'out_of_frame';
  }

  for (const lm of required) {
    if (lm!.x < X_MIN || lm!.x > X_MAX || lm!.y < Y_MIN || lm!.y > Y_MAX) {
      return 'out_of_frame';
    }
  }

  const shoulderWidth = Math.abs(rightShoulder!.x - leftShoulder!.x);
  if (shoulderWidth > SHOULDER_TOO_CLOSE) return 'too_close';
  if (shoulderWidth < SHOULDER_TOO_FAR) return 'too_far';

  const torsoHeight = Math.abs(leftHip!.y - leftShoulder!.y);
  if (torsoHeight < MIN_TORSO_HEIGHT) return 'out_of_frame';

  const noseAboveShoulders = nose!.y < leftShoulder!.y && nose!.y < rightShoulder!.y;
  const shouldersAboveHips = leftShoulder!.y < leftHip!.y && rightShoulder!.y < rightHip!.y;
  const shoulderLevelDiff = Math.abs(leftShoulder!.y - rightShoulder!.y);
  const shoulderLevelOk = shoulderLevelDiff < 0.15;

  if (!noseAboveShoulders || !shouldersAboveHips || !shoulderLevelOk) {
    return 'out_of_frame';
  }

  if (nose!.y > 0.40) return 'too_close'
  
  if (leftHip!.y > 0.85 || rightHip!.y > 0.85) return 'out_of_frame'
  return 'ready';
}

export function isInFrame(landmarks: NormalizedLandmark[] | null): boolean {
  return getFrameStatus(landmarks) === 'ready';
}

export function landmarkToPixel(
  lm: NormalizedLandmark,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: lm.x * width,
    y: lm.y * height,
  };
}