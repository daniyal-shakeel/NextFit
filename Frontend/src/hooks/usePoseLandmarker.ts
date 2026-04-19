import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@/utils/poseUtils';
import { getMediapipeVisionWasmRoot } from '@/lib/mediapipeVisionWasm';

const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export function usePoseLandmarker(videoRef: RefObject<HTMLVideoElement | null>, isActive: boolean) {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const frameCountRef = useRef(0);
  const cachedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(getMediapipeVisionWasmRoot());
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (!cancelled) {
          poseLandmarkerRef.current = landmarker;
          setIsModelLoaded(true);
          setModelError(null);
        } else {
          landmarker.close?.();
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : err != null
                  ? String(err)
                  : 'Failed to load pose model';
          setModelError(message || 'Failed to load pose model');
          setIsModelLoaded(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close?.();
        poseLandmarkerRef.current = null;
      }
    };
  }, []);

  const detect = useCallback(() => {
    const video = videoRef.current;
    if (!video || !poseLandmarkerRef.current || !isActive) return;
    if (video.readyState < 2) return;
    const timestamp = performance.now();
    if (lastVideoTimeRef.current === video.currentTime) return;
    lastVideoTimeRef.current = video.currentTime;

    frameCountRef.current++;
    if (frameCountRef.current % 2 === 0) {
      try {
        const result = poseLandmarkerRef.current.detectForVideo(video, timestamp);
        const lm = result.landmarks?.[0] ?? null;
        cachedLandmarksRef.current = lm;
        setLandmarks(lm);
      } catch {
        cachedLandmarksRef.current = null;
        setLandmarks(null);
      }
    }
  }, [videoRef, isActive]);

  useEffect(() => {
    if (!isActive || !isModelLoaded) return;
    const loop = () => {
      detect();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, isModelLoaded, detect]);

  return { landmarks, isModelLoaded, modelError };
}
