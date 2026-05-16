import { useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

export function useTryOnApi() {
  const abortRef = useRef<AbortController | null>(null);
  
  const isLoading = useStore((s) => s.isTryOnLoading);
  const resultImage = useStore((s) => s.tryOnResultImage);
  const preprocessedPerson = useStore((s) => s.tryOnPreprocessedPerson);
  const preprocessedGarment = useStore((s) => s.tryOnPreprocessedGarment);
  const rawResult = useStore((s) => s.tryOnRawResult);
  const error = useStore((s) => s.tryOnError);
  const processingTime = useStore((s) => s.tryOnProcessingTime);

  const setTryOnLoading = useStore((s) => s.setTryOnLoading);
  const setTryOnResults = useStore((s) => s.setTryOnResults);
  const resetTryOn = useStore((s) => s.resetTryOn);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const tryOn = async (
    personImageBase64: string,
    garmentImageBase64: string,
    category = 'upper_body'
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTryOnLoading(true);
    setTryOnResults({
      error: null,
      resultImage: null,
      preprocessedPerson: null,
      preprocessedGarment: null,
      rawResult: null,
    });

    try {
      const response = await fetch(`${BACKEND_URL}/tryon`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_image: personImageBase64,
          garment_image: garmentImageBase64,
          category,
        }),
        signal: controller.signal,
      });

      if (response.status === 504) {
        setTryOnResults({ error: 'Request timed out' });
        return;
      }
      if (response.status === 503) {
        setTryOnResults({ error: 'AI service is warming up, please try again' });
        return;
      }
      if (response.status === 400) {
        const j = await response.json().catch(() => ({}));
        setTryOnResults({
          error: typeof j.message === 'string' ? j.message : 'Invalid request'
        });
        return;
      }
      if (response.status === 502) {
        const j = await response.json().catch(() => ({}));
        setTryOnResults({
          error: typeof j.detail === 'string'
            ? j.detail
            : 'AI service error. Please try again.'
        });
        return;
      }

      if (!response.ok) {
        const j = await response.json().catch(() => ({}));
        setTryOnResults({
          error: typeof j.message === 'string' ? j.message : `Request failed (${response.status})`
        });
        return;
      }

      const data = await response.json();
      const newResult = `data:image/png;base64,${data.result_image}`;

      let newPerson = null;
      if (data.preprocessed_person) {
        newPerson = `data:image/png;base64,${data.preprocessed_person}`;
      } else if (data.preprocessed_image) {
        newPerson = `data:image/png;base64,${data.preprocessed_image}`;
      }

      let newGarment = null;
      if (data.preprocessed_garment) {
        newGarment = `data:image/png;base64,${data.preprocessed_garment}`;
      }

      let newRaw = null;
      if (data.raw_result) {
        newRaw = `data:image/png;base64,${data.raw_result}`;
      } else if (data.raw_model_image) {
        newRaw = `data:image/png;base64,${data.raw_model_image}`;
      }

      setTryOnResults({
        resultImage: newResult,
        preprocessedPerson: newPerson,
        preprocessedGarment: newGarment,
        rawResult: newRaw,
        processingTime: data.processing_time,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        return;
      }
      setTryOnResults({ error: err instanceof Error ? err.message : 'Try-on failed' });
    } finally {
      setTryOnLoading(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const reset = useCallback(() => {
    resetTryOn();
  }, [resetTryOn]);

  return {
    tryOn,
    cancel,
    isLoading,
    resultImage,
    preprocessedPerson,
    preprocessedGarment,
    rawResult,
    error,
    processingTime,
    reset,
  };
}
