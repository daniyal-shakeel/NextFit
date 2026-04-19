import { useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { getMediapipeVisionWasmRoot } from '@/lib/mediapipeVisionWasm';
import { getFrameStatus, type FrameStatus, type NormalizedLandmark } from '@/utils/poseUtils';

export interface LiveTryOnCanvasProps {
  garmentImageUrl: string;
  isActive: boolean;
  onFrameStatus?: (status: FrameStatus) => void;
}

type SmoothRect = { x: number; y: number; w: number; h: number; init: boolean };

function getPoseModelUrl(): string {
  const raw = import.meta.env.BASE_URL;
  const base = raw.endsWith('/') ? raw : `${raw}/`;
  return new URL(`${base}models/pose_landmarker_lite.task`, window.location.origin).href;
}

export function LiveTryOnCanvas({ garmentImageUrl, isActive, onFrameStatus }: LiveTryOnCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const garmentImgRef = useRef<HTMLImageElement | null>(null);
  const smoothRef = useRef<SmoothRect>({ x: 0, y: 0, w: 0, h: 0, init: false });
  const lastLandmarksRef = useRef<{
    nose: { x: number; y: number };
    lShoulder: { x: number; y: number };
    rShoulder: { x: number; y: number };
    lHip: { x: number; y: number };
    rHip: { x: number; y: number };
  } | null>(null);
  const frameStatusRef = useRef<FrameStatus>('out_of_frame');
  const onFrameStatusRef = useRef(onFrameStatus);
  onFrameStatusRef.current = onFrameStatus;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { garmentImgRef.current = img; };
    img.onerror = () => { garmentImgRef.current = null; };
    img.src = garmentImageUrl;
    return () => { garmentImgRef.current = null; };
  }, [garmentImageUrl]);

  useEffect(() => {
    if (!isActive) {
      smoothRef.current = { x: 0, y: 0, w: 0, h: 0, init: false };
      lastLandmarksRef.current = null;
      frameStatusRef.current = 'out_of_frame';
      onFrameStatusRef.current?.('out_of_frame');
      return;
    }

    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let frameCount = 0;
    let cancelled = false;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    const vid = document.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', 'true');
    vid.autoplay = true;

    const resizeCanvas = () => {
      const w = Math.max(1, wrap.clientWidth || 1);
      const h = Math.max(1, wrap.clientHeight || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(wrap);

    const getLogicalSize = () => ({
      lw: Math.max(1, wrap.clientWidth || 1),
      lh: Math.max(1, wrap.clientHeight || 1),
    });

    const LERP = 0.2;

    const drawDots = (
      lw: number,
      lh: number,
      pts: NonNullable<typeof lastLandmarksRef.current>
    ) => {
      const dots = [
        { pt: pts.nose,      color: '#fbbf24', label: 'nose' },
        { pt: pts.lShoulder, color: '#ef4444', label: 'lSho' },
        { pt: pts.rShoulder, color: '#ef4444', label: 'rSho' },
        { pt: pts.lHip,      color: '#3b82f6', label: 'lHip' },
        { pt: pts.rHip,      color: '#3b82f6', label: 'rHip' },
      ];
      dots.forEach(({ pt, color, label }) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = '11px sans-serif';
        ctx.fillText(label, pt.x + 8, pt.y + 4);
      });
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      frameCount += 1;

      const { lw, lh } = getLogicalSize();
      if (canvas.width < 2 || canvas.height < 2) resizeCanvas();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-lw, 0);
      if (vid.readyState >= 2 && vid.videoWidth > 0) {
        ctx.drawImage(vid, 0, 0, lw, lh);
      } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, lw, lh);
      }
      ctx.restore();

      const lmRunner = landmarkerRef.current;
      if (lmRunner && vid.readyState >= 2 && frameCount % 2 === 0) {
        try {
          const result = lmRunner.detectForVideo(vid, performance.now());
          const lm = result.landmarks?.[0];
          if (lm?.length) {
            const status = getFrameStatus(lm as NormalizedLandmark[]);
            frameStatusRef.current = status;
            if (status === 'ready') {
              const toCanvas = (x: number, y: number) => ({
                x: (1 - x) * lw,
                y: y * lh,
              });
              lastLandmarksRef.current = {
                nose: toCanvas(lm[0].x, lm[0].y),
                lShoulder: toCanvas(lm[11].x, lm[11].y),
                rShoulder: toCanvas(lm[12].x, lm[12].y),
                lHip: toCanvas(lm[23].x, lm[23].y),
                rHip: toCanvas(lm[24].x, lm[24].y),
              };
            } else {
              lastLandmarksRef.current = null;
              smoothRef.current.init = false;
            }
          } else {
            frameStatusRef.current = 'out_of_frame';
            lastLandmarksRef.current = null;
            smoothRef.current.init = false;
          }
        } catch {
          frameStatusRef.current = 'out_of_frame';
          lastLandmarksRef.current = null;
          smoothRef.current.init = false;
        }
      }

      onFrameStatusRef.current?.(frameStatusRef.current);

      const pts = lastLandmarksRef.current;
      const gImg = garmentImgRef.current;

      if (pts && gImg && gImg.complete && gImg.naturalWidth > 0) {
        const shoulderMidX = (pts.lShoulder.x + pts.rShoulder.x) / 2;
        const shoulderMidY = (pts.lShoulder.y + pts.rShoulder.y) / 2;
        const hipMidY      = (pts.lHip.y + pts.rHip.y) / 2;

        const shoulderWidth = Math.abs(pts.rShoulder.x - pts.lShoulder.x);
        const torsoHeight   = Math.max(hipMidY - shoulderMidY, 1);

        const garmentWidth  = shoulderWidth * 2.1;
        const garmentHeight = torsoHeight * 1.35;

        const neckY = shoulderMidY - torsoHeight * 0.22;
        const neckX = shoulderMidX;

        const drawX = neckX - garmentWidth / 2;
        const drawY = neckY;

        const s = smoothRef.current;
        if (!s.init) {
          smoothRef.current = { x: drawX, y: drawY, w: garmentWidth, h: garmentHeight, init: true };
        } else {
          smoothRef.current = {
            x: s.x + (drawX - s.x) * LERP,
            y: s.y + (drawY - s.y) * LERP,
            w: s.w + (garmentWidth - s.w) * LERP,
            h: s.h + (garmentHeight - s.h) * LERP,
            init: true,
          };
        }

        const sm = smoothRef.current;
        ctx.drawImage(gImg, sm.x, sm.y, sm.w, sm.h);

        drawDots(lw, lh, pts);

      } else {
        smoothRef.current.init = false;
      }
    };

    rafId = requestAnimationFrame(tick);

    let landmarker: PoseLandmarker | null = null;

    void (async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
      } catch { return; }
      if (cancelled) return;

      vid.srcObject = streamRef.current;
      try { await vid.play(); } catch { return; }
      if (cancelled) return;

      try {
        const vision = await FilesetResolver.forVisionTasks(getMediapipeVisionWasmRoot());
        const modelPath = getPoseModelUrl();
        const common = {
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          runningMode: 'VIDEO' as const,
        };
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            ...common,
            baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
          });
        } catch {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            ...common,
            baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
          });
        }
      } catch { return; }
      if (cancelled) { landmarker?.close(); return; }
      landmarkerRef.current = landmarker;
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      vid.srcObject = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      landmarker?.close();
      lastLandmarksRef.current = null;
      smoothRef.current = { x: 0, y: 0, w: 0, h: 0, init: false };
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isActive]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}