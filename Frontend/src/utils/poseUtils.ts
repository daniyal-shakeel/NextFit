export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type FrameStatus = 'ready' | 'too_close' | 'too_far' | 'out_of_frame';

/**
 * Get real-time frame status for user feedback.
 * Returns specific guidance: ready, too close, too far, or out of frame.
 * Checks distance FIRST so "too close" / "too far" show even when near frame edges.
 */
export function getFrameStatus(landmarks: NormalizedLandmark[] | null): FrameStatus {
  if (!landmarks?.length) return 'out_of_frame';

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 'out_of_frame';
  if (leftShoulder.visibility !== undefined && leftShoulder.visibility < 0.4) return 'out_of_frame';
  if (rightShoulder.visibility !== undefined && rightShoulder.visibility < 0.4) return 'out_of_frame';

  // Use abs for shoulderDist — front camera can mirror, making it negative
  const shoulderDist = Math.abs(rightShoulder.x - leftShoulder.x);
  const torsoHeight = Math.abs(leftHip.y - leftShoulder.y);

  // Check distance FIRST — show too_close/too_far even when body is near edges
  if (shoulderDist > 0.55) return 'too_close';
  // Only "too far" when body is barely visible (very small in frame)
  if (shoulderDist < 0.05 || torsoHeight < 0.05) return 'too_far';

  // Then check bounds — if way outside frame, still out_of_frame
  const inBounds = (lm: NormalizedLandmark) =>
    lm.x >= 0.05 && lm.x <= 0.95 && lm.y >= 0.05 && lm.y <= 0.95;
  if (!inBounds(leftShoulder) || !inBounds(rightShoulder) || !inBounds(leftHip) || !inBounds(rightHip)) {
    return 'out_of_frame';
  }

  return 'ready';
}

/**
 * Check if user is in frame with sufficient pose visibility.
 */
export function isInFrame(landmarks: NormalizedLandmark[] | null): boolean {
  return getFrameStatus(landmarks) === 'ready';
}

/**
 * Convert normalized landmark (0-1) to pixel coordinates.
 */
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
