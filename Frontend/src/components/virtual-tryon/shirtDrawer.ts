import type { NormalizedLandmark } from '@/utils/poseUtils';

const LERP_SPEED = 0.25;

function flipX(lm: NormalizedLandmark): NormalizedLandmark {
  return { ...lm, x: 1 - lm.x };
}

export interface ShirtSmoothState {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Padding to expand shirt for full coverage (neck, sleeves, bottom) */
const COVERAGE_PAD_X = 0.05; // fraction of canvas width each side
const COVERAGE_PAD_Y_TOP = 0.04; // fraction for neck
const COVERAGE_PAD_Y_BOTTOM = 0.06; // fraction for hem

/**
 * Compute shirt bounds - LOCKED to subject landmarks.
 * - Shoulders + elbows define width: when arm moves up/out, shirt sleeve follows
 * - Neck: collar raised to fully cover neck (closer to nose)
 * - Bottom: extends past hips for full torso coverage
 */
function computeShirtBounds(
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  mirrored: boolean
): { x: number; y: number; w: number; h: number } | null {
  const px = (lm: NormalizedLandmark) => ({
    x: lm.x * canvasWidth,
    y: lm.y * canvasHeight,
  });

  const nose = mirrored ? flipX(landmarks[0]) : landmarks[0];
  const lSho = mirrored ? flipX(landmarks[11]) : landmarks[11];
  const rSho = mirrored ? flipX(landmarks[12]) : landmarks[12];
  const lElb = mirrored ? flipX(landmarks[13]) : landmarks[13];
  const rElb = mirrored ? flipX(landmarks[14]) : landmarks[14];
  const lWri = landmarks[15] ? (mirrored ? flipX(landmarks[15]) : landmarks[15]) : null;
  const rWri = landmarks[16] ? (mirrored ? flipX(landmarks[16]) : landmarks[16]) : null;
  const lHip = mirrored ? flipX(landmarks[23]) : landmarks[23];
  const rHip = mirrored ? flipX(landmarks[24]) : landmarks[24];

  if (!lSho || !rSho || !lHip || !rHip) return null;

  const lShoPx = px(lSho);
  const rShoPx = px(rSho);
  const lHipPx = px(lHip);
  const rHipPx = px(rHip);
  const nosePx = nose ? px(nose) : null;

  // Arm extent: shirt width follows BOTH arms (when either arm moves up/out, sleeve follows)
  const armPts = [lShoPx.x, rShoPx.x];
  if (lElb) armPts.push(px(lElb).x);
  if (rElb) armPts.push(px(rElb).x);
  if (lWri) armPts.push(px(lWri).x);
  if (rWri) armPts.push(px(rWri).x);
  const leftExtent = Math.min(...armPts);
  const rightExtent = Math.max(...armPts);
  const armSpan = rightExtent - leftExtent;
  const shoulderWidth = Math.abs(rShoPx.x - lShoPx.x);
  const shirtW = Math.max(shoulderWidth * 1.5, armSpan * 1.15);

  const shoulderMidX = (lShoPx.x + rShoPx.x) / 2;
  const shirtX = shoulderMidX - shirtW / 2;

  const torsoHeight = lHipPx.y - lShoPx.y;
  // Collar higher (0.2 = 80% toward nose) to fully cover neck
  const collarY = nosePx
    ? nosePx.y + (lShoPx.y - nosePx.y) * 0.2
    : lShoPx.y - torsoHeight * 0.15;

  const hipMidY = (lHipPx.y + rHipPx.y) / 2;
  const bottomY = hipMidY + torsoHeight * 0.2;
  const shirtH = bottomY - collarY;

  const padX = canvasWidth * COVERAGE_PAD_X;
  const padYTop = canvasHeight * COVERAGE_PAD_Y_TOP;
  const padYBottom = canvasHeight * COVERAGE_PAD_Y_BOTTOM;

  return {
    x: shirtX - padX,
    y: collarY - padYTop,
    w: shirtW + padX * 2,
    h: shirtH + padYTop + padYBottom,
  };
}

function applySmooth(
  smoothState: ShirtSmoothState,
  target: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  const s = smoothState;
  if (s.w === 0 && target.w > 0) {
    s.x = target.x;
    s.y = target.y;
    s.w = target.w;
    s.h = target.h;
    return { ...s };
  }
  s.x = s.x + (target.x - s.x) * LERP_SPEED;
  s.y = s.y + (target.y - s.y) * LERP_SPEED;
  s.w = s.w + (target.w - s.w) * LERP_SPEED;
  s.h = s.h + (target.h - s.h) * LERP_SPEED;
  return { x: s.x, y: s.y, w: s.w, h: s.h };
}

/**
 * Draw landmark dots on canvas for visual feedback.
 */
export function drawLandmarkDots(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  mirrored: boolean
): void {
  const dots: { idx: number; label: string; color: string }[] = [
    { idx: 0, label: 'nose', color: '#fbbf24' },
    { idx: 11, label: 'lSho', color: '#ef4444' },
    { idx: 12, label: 'rSho', color: '#ef4444' },
    { idx: 13, label: 'lElb', color: '#22c55e' },
    { idx: 14, label: 'rElb', color: '#22c55e' },
    { idx: 23, label: 'lHip', color: '#3b82f6' },
    { idx: 24, label: 'rHip', color: '#3b82f6' },
  ];

  dots.forEach(({ idx, label, color }) => {
    const lm = landmarks[idx];
    if (!lm) return;
    const l = mirrored ? flipX(lm) : lm;
    const px = l.x * canvasWidth;
    const py = l.y * canvasHeight;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = '10px sans-serif';
    ctx.fillText(label, px + 6, py + 4);
  });
}

/**
 * Draw shirt with layered compositing.
 * Shirt fully covers torso. Only arms/hands/face/hair drawn on top.
 */
export function drawShirtComposite(
  ctx: CanvasRenderingContext2D,
  offscreenCtx: CanvasRenderingContext2D,
  shirtImage: HTMLImageElement | SVGImageElement,
  landmarks: NormalizedLandmark[],
  segmentationMask: Uint8Array | null,
  maskWidth: number,
  maskHeight: number,
  cleanFrame: ImageData,
  canvasWidth: number,
  canvasHeight: number,
  mirrored: boolean = true,
  maskUpdatedThisFrame: boolean = true,
  smoothState?: ShirtSmoothState,
  showLandmarkDots: boolean = true
): void {
  const bounds = computeShirtBounds(landmarks, canvasWidth, canvasHeight, mirrored);
  if (!bounds) return;

  const draw = smoothState ? applySmooth(smoothState, bounds) : bounds;

  offscreenCtx.canvas.width = canvasWidth;
  offscreenCtx.canvas.height = canvasHeight;
  offscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  offscreenCtx.drawImage(shirtImage, draw.x, draw.y, draw.w, draw.h);

  ctx.drawImage(offscreenCtx.canvas, 0, 0);

  if (maskUpdatedThisFrame && segmentationMask && maskWidth > 0 && maskHeight > 0) {
    const currentFrame = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const w = canvasWidth;
    const h = canvasHeight;
    const shirtX = draw.x;
    const shirtY = draw.y;
    const shirtW = draw.w;
    const shirtH = draw.h;

    // Mask region slightly larger than shirt to ensure no body shows at edges
    const maskPad = 12;
    const maskLeft = shirtX - maskPad;
    const maskTop = shirtY - maskPad;
    const maskRight = shirtX + shirtW + maskPad;
    const maskBottom = shirtY + shirtH + maskPad;

    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        const maskX = Math.min(
          mirrored ? Math.floor((1 - cx / w) * maskWidth) : Math.floor((cx / w) * maskWidth),
          maskWidth - 1
        );
        const maskY = Math.min(Math.floor((cy / h) * maskHeight), maskHeight - 1);
        const maskIdx = maskY * maskWidth + maskX;
        const category = segmentationMask[maskIdx] ?? 0;

        const idx = (cy * w + cx) * 4;

        const inTorsoRegion =
          cx >= maskLeft && cx <= maskRight &&
          cy >= maskTop && cy <= maskBottom;

        if (category !== 0) {
          if (inTorsoRegion && (category === 2 || category === 4)) {
            continue;
          }
          currentFrame.data[idx] = cleanFrame.data[idx];
          currentFrame.data[idx + 1] = cleanFrame.data[idx + 1];
          currentFrame.data[idx + 2] = cleanFrame.data[idx + 2];
          currentFrame.data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(currentFrame, 0, 0);
  }

  if (showLandmarkDots && landmarks.length > 0) {
    drawLandmarkDots(ctx, landmarks, canvasWidth, canvasHeight, mirrored);
  }
}

/**
 * Flat overlay (fallback when segmentation unavailable).
 */
export function drawShirt(
  ctx: CanvasRenderingContext2D,
  shirtImage: HTMLImageElement | SVGImageElement,
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  mirrored: boolean = true,
  smoothState?: ShirtSmoothState,
  showLandmarkDots: boolean = true
): void {
  const bounds = computeShirtBounds(landmarks, canvasWidth, canvasHeight, mirrored);
  if (!bounds) return;

  const draw = smoothState ? applySmooth(smoothState, bounds) : bounds;

  ctx.drawImage(shirtImage, draw.x, draw.y, draw.w, draw.h);

  if (showLandmarkDots && landmarks.length > 0) {
    drawLandmarkDots(ctx, landmarks, canvasWidth, canvasHeight, mirrored);
  }
}
