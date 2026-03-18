import { useState, useRef } from 'react';
import { useTryOnApi } from '@/hooks/useTryOnApi';
import type { Product } from '@/lib/types';

interface Props {
  selectedProduct: Product | null;
}

export default function PhotoTryOn({ selectedProduct }: Props) {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tryOn, isLoading, resultImage, error, processingTime, reset } = useTryOnApi();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPersonImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleTryOn = async () => {
    if (!personImage || !selectedProduct?.image) return;
    try {
      const res = await fetch(selectedProduct.image);
      const blob = await res.blob();
      const garmentB64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Failed to read garment image'));
        r.readAsDataURL(blob);
      });
      await tryOn(personImage, garmentB64);
    } catch (err) {
      console.error('Try-on error:', err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {!resultImage && (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-64 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            {personImage ? (
              <img src={personImage} alt="Your photo" className="h-full object-contain rounded-xl" />
            ) : (
              <p className="text-muted-foreground">Tap to upload your photo</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          {selectedProduct && (
            <p className="text-sm text-muted-foreground">
              Selected: <strong>{selectedProduct.name}</strong>
            </p>
          )}
          <button
            onClick={handleTryOn}
            disabled={!personImage || !selectedProduct || isLoading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
          >
            {isLoading ? 'Processing... (~15 sec)' : 'AI Try On'}
          </button>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </>
      )}

      {resultImage && (
        <div className="flex flex-col items-center gap-3 w-full">
          <img src={resultImage} alt="Try-on result" className="w-full rounded-xl shadow-lg" />
          {processingTime != null && (
            <p className="text-xs text-muted-foreground">Generated in {processingTime}s</p>
          )}
          <div className="flex gap-3 w-full">
            <button
              onClick={reset}
              className="flex-1 py-3 border border-border rounded-xl font-semibold"
            >
              Try Another
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(resultImage);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'nextfit-tryon.png';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  const a = document.createElement('a');
                  a.href = resultImage;
                  a.download = 'nextfit-tryon.png';
                  a.click();
                }
              }}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold"
            >
              Save Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
