import { useState } from 'react';

const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000';

export function useTryOnApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const tryOn = async (personImageBase64: string, garmentImageBase64: string) => {
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    try {
      const response = await fetch(`${AI_API_URL}/api/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_image: personImageBase64,
          garment_image: garmentImageBase64,
          category: 'upper_body',
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setResultImage(`data:image/png;base64,${data.result_image}`);
      setProcessingTime(data.processing_time);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Try-on failed');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResultImage(null);
    setError(null);
    setProcessingTime(null);
  };

  return { tryOn, isLoading, resultImage, error, processingTime, reset };
}
