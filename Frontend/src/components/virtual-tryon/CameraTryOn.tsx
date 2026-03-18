import { useRef, useEffect, useCallback, useState } from 'react';
import { useCameraStream } from '@/hooks/useCameraStream';
import { usePoseLandmarker } from '@/hooks/usePoseLandmarker';
import { useSegmentation } from '@/hooks/useSegmentation';
import { getFrameStatus, isInFrame } from '@/utils/poseUtils';
import { drawShirtComposite, drawShirt, type ShirtSmoothState } from './shirtDrawer';
import { FrameGuide } from './FrameGuide';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

const DEV_SHIRT_URL = '/assets/dev-shirt.svg';
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 360;

interface CameraTryOnProps {
  selectedProduct: Product | null;
}

export function CameraTryOn({ selectedProduct }: CameraTryOnProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shirtImageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { videoRef, startCamera, stopCamera, error: cameraError, isActive } = useCameraStream();
  const { landmarks, isModelLoaded, modelError } = usePoseLandmarker(videoRef, isActive);
  const {
    segmentationMask,
    maskWidth,
    maskHeight,
    isLoaded: isSegmentationLoaded,
    maskUpdatedRef,
  } = useSegmentation(videoRef, isActive);
  const [videoReady, setVideoReady] = useState(false);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const shirtSmoothRef = useRef<ShirtSmoothState>({ x: 0, y: 0, w: 0, h: 0 });
  if (!offscreenCtxRef.current) {
    const off = document.createElement('canvas');
    offscreenCtxRef.current = off.getContext('2d', { willReadFrequently: true });
  }

  const frameStatus = getFrameStatus(landmarks);
  const inFrame = isInFrame(landmarks);

  useEffect(() => {
    const imageUrl = selectedProduct?.image || DEV_SHIRT_URL;
    const img = new Image();
    img.width = 500;
    img.height = 600;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      shirtImageRef.current = img;
    };
    img.onerror = () => {
      shirtImageRef.current = null;
      const fallback = new Image();
      fallback.width = 500;
      fallback.height = 600;
      fallback.onload = () => { shirtImageRef.current = fallback; };
      fallback.src = DEV_SHIRT_URL;
    };
    img.src = imageUrl;
    return () => {
      shirtImageRef.current = null;
    };
  }, [selectedProduct?.image]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const el = containerRef.current as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      // Fullscreen not supported or denied
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadedData = () => setVideoReady(video.readyState >= 2);
    video.addEventListener('loadeddata', onLoadedData);
    if (video.readyState >= 2) setVideoReady(true);
    return () => video.removeEventListener('loadeddata', onLoadedData);
  }, [isActive]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const offscreenCtx = offscreenCtxRef.current;
    if (!canvas || !video || !video.srcObject || !offscreenCtx) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const cleanFrame = ctx.getImageData(0, 0, w, h);

    if (inFrame && landmarks && shirtImageRef.current?.complete && shirtImageRef.current.naturalWidth > 0) {
      if (isSegmentationLoaded && segmentationMask && maskWidth > 0 && maskHeight > 0) {
        const maskUpdated = maskUpdatedRef.current;
        drawShirtComposite(
          ctx,
          offscreenCtx,
          shirtImageRef.current,
          landmarks,
          segmentationMask,
          maskWidth,
          maskHeight,
          cleanFrame,
          w,
          h,
          true,
          maskUpdated,
          shirtSmoothRef.current,
          true
        );
        if (maskUpdated) maskUpdatedRef.current = false;
      } else {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
        drawShirt(ctx, shirtImageRef.current, landmarks, w, h, true, shirtSmoothRef.current, true);
        ctx.restore();
      }
    }
  }, [inFrame, landmarks, isSegmentationLoaded, segmentationMask, maskWidth, maskHeight]);

  useEffect(() => {
    if (!isActive || !videoReady) return;
    let animFrameId: number;
    let loopActive = true;

    const loop = () => {
      if (!loopActive) return;
      drawFrame();
      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    const handleVisibility = () => {
      if (document.hidden) {
        loopActive = false;
      } else {
        loopActive = true;
        animFrameId = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      loopActive = false;
      cancelAnimationFrame(animFrameId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isActive, videoReady, drawFrame]);

  return (
    <div className="space-y-4">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {!isActive && (
        <div className="aspect-video bg-foreground/5 rounded-lg flex flex-col items-center justify-center border border-border">
          <Camera className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mb-4" />
          <p className="text-base md:text-lg font-medium">Enable Camera</p>
          <p className="text-xs md:text-sm text-muted-foreground mb-4">
            Allow camera access to use live AR try-on
          </p>
          <Button onClick={startCamera} size="lg">
            <Camera className="h-4 w-4 mr-2" />
            Start Camera
          </Button>
        </div>
      )}

      {isActive && cameraError && (
        <div className="aspect-video bg-destructive/10 rounded-lg flex flex-col items-center justify-center border border-destructive">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-base font-medium text-destructive">Camera Error</p>
          <p className="text-sm text-muted-foreground mb-4">{cameraError}</p>
          <Button variant="outline" onClick={stopCamera}>
            Stop Camera
          </Button>
        </div>
      )}

      {isActive && !cameraError && modelError && !isModelLoaded && (
        <div className="aspect-video bg-destructive/10 rounded-lg flex flex-col items-center justify-center border border-destructive">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-base font-medium text-destructive">Model Error</p>
          <p className="text-sm text-muted-foreground mb-4 text-center px-4">{modelError}</p>
          <Button variant="outline" onClick={stopCamera}>
            Stop Camera
          </Button>
        </div>
      )}

      {isActive && !cameraError && !modelError && (
        <div
          ref={containerRef}
          className={`relative overflow-hidden border border-border bg-black ${
            isFullscreen ? 'aspect-auto w-full h-full min-h-screen' : 'aspect-video rounded-lg'
          }`}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain"
          />
          {!isModelLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Loading pose model...</p>
            </div>
          )}
          {isModelLoaded && <FrameGuide status={frameStatus} />}
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/80 hover:bg-background shadow-md"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Minimize' : 'Maximize'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {isActive && !cameraError && (
        <Button variant="outline" onClick={stopCamera} className="w-full">
          Stop Camera
        </Button>
      )}
    </div>
  );
}
