import { useState } from 'react';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useTryOnApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [preprocessedImage, setPreprocessedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const tryOn = async (
    personImageBase64: string,
    garmentImageBase64: string,
    category = 'upper_body'
  ) => {
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    setPreprocessedImage(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_image: personImageBase64,
          garment_image: garmentImageBase64,
          category,
        }),
      });

      if (response.status === 504) {
        setError('Request timed out');
        return;
      }
      if (response.status === 503) {
        setError('AI service is warming up, please try again');
        return;
      }
      if (response.status === 400) {
        const j = await response.json().catch(() => ({}));
        setError(
          typeof j.message === 'string' ? j.message : 'Invalid request'
        );
        return;
      }
      if (response.status === 502) {
        const j = await response.json().catch(() => ({}));
        setError(
          typeof j.detail === 'string'
            ? j.detail
            : 'AI service error. Please try again.'
        );
        return;
      }
      if (!response.ok) {
        setError(`Request failed (${response.status})`);
        return;
      }

      const data = await response.json();
      setResultImage(`data:image/png;base64,${data.result_image}`);
      if (data.preprocessed_image) {
        setPreprocessedImage(`data:image/png;base64,${data.preprocessed_image}`);
      }
      setProcessingTime(data.processing_time);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Try-on failed');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResultImage(null);
    setPreprocessedImage(null);
    setError(null);
    setProcessingTime(null);
  };

  return { tryOn, isLoading, resultImage, preprocessedImage, error, processingTime, reset };
}
