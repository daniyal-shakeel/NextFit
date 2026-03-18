import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

const SEGMENTATION_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export function useSegmentation(videoRef: RefObject<HTMLVideoElement | null>, isActive: boolean) {
  const [segmentationMask, setSegmentationMask] = useState<Uint8Array | null>(null);
  const [maskWidth, setMaskWidth] = useState(0);
  const [maskHeight, setMaskHeight] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const frameCountRef = useRef(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const maskUpdatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loadSegmentation = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: SEGMENTATION_MODEL },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
        if (!cancelled) {
          segmenterRef.current = segmenter;
          setIsLoaded(true);
          setError(null);
        } else {
          segmenter.close?.();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load segmentation model');
          setIsLoaded(false);
        }
      }
    };
    const t = setTimeout(loadSegmentation, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (segmenterRef.current) {
        segmenterRef.current.close?.();
        segmenterRef.current = null;
      }
    };
  }, []);

  const segment = useCallback(() => {
    const video = videoRef.current;
    if (!video || !segmenterRef.current || !isActive) return;
    if (video.readyState < 2) return;
    const timestamp = performance.now();
    if (lastVideoTimeRef.current === video.currentTime) return;
    lastVideoTimeRef.current = video.currentTime;

    frameCountRef.current++;
    if (frameCountRef.current % 3 !== 0) return;

    try {
      const result = segmenterRef.current.segmentForVideo(video, timestamp);
      const mask = result.categoryMask;
      if (mask?.hasUint8Array?.()) {
        const data = mask.getAsUint8Array();
        setMaskWidth(mask.width);
        setMaskHeight(mask.height);
        setSegmentationMask(data);
        maskUpdatedRef.current = true;
      } else {
        setSegmentationMask(null);
      }
    } catch {
      setSegmentationMask(null);
    }
  }, [videoRef, isActive]);

  useEffect(() => {
    if (!isActive || !isLoaded) return;
    const loop = () => {
      segment();
      requestAnimationFrame(loop);
    };
    const raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isActive, isLoaded, segment]);

  return {
    segmentationMask,
    maskWidth,
    maskHeight,
    isLoaded,
    error,
    maskUpdatedRef,
  };
}
