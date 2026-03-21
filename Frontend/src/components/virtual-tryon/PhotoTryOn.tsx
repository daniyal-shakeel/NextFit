import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Upload, CheckCircle2, XCircle, AlertTriangle, Maximize2 } from 'lucide-react';
import { useTryOnApi } from '@/hooks/useTryOnApi';
import {
  getImageAverageBrightness,
  validatePersonPoseFromDataUrl,
} from '@/lib/personTryOnValidation';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import PhotoGuidancePanel from './PhotoGuidancePanel';

const SERVER_SIZE = 1024;
const MIN_SIZE = 512;

function resizeImageDataUrl(
  dataUrl: string,
  targetW: number,
  targetH: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

interface Props {
  selectedProduct: Product | null;
}

export default function PhotoTryOn({ selectedProduct }: Props) {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [needsResize, setNeedsResize] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationOk, setValidationOk] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lightingWarning, setLightingWarning] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tryOn, isLoading, resultImage, error, processingTime, reset } =
    useTryOnApi();

  const runValidation = useCallback(async (dataUrl: string) => {
    setIsValidating(true);
    setValidationError(null);
    setValidationOk(false);
    setLightingWarning(null);

    try {
      const avg = await getImageAverageBrightness(dataUrl);
      if (avg < 40 || avg > 230) {
        setLightingWarning('Poor lighting detected');
      } else if (avg < 50 || avg > 220) {
        setLightingWarning(
          'Photo lighting may affect results. For best results use good natural lighting.'
        );
      }
    } catch {
      setLightingWarning(null);
    }

    const pose = await validatePersonPoseFromDataUrl(dataUrl);
    setIsValidating(false);
    if (!pose.ok) {
      setPersonImage(null);
      setValidationError(
        'No person detected. Please upload a clear front-facing photo of a person showing upper body.'
      );
      setValidationOk(false);
      return;
    }
    setValidationOk(true);
  }, []);

  const acceptImage = useCallback(
    (dataUrl: string, w: number, h: number) => {
      setPersonImage(dataUrl);
      setImageDims({ w, h });
      setSizeWarning(null);
      setNeedsResize(false);

      const tooSmall = w < MIN_SIZE || h < MIN_SIZE;
      const belowOptimal = w < SERVER_SIZE || h < SERVER_SIZE;

      if (tooSmall) {
        setNeedsResize(true);
        setSizeWarning(
          `Image is ${w}\u00d7${h}px \u2014 below the ${MIN_SIZE}px minimum. Resize to get usable results.`
        );
      } else if (belowOptimal) {
        setNeedsResize(true);
        setSizeWarning(
          `Image is ${w}\u00d7${h}px. Resize to ${SERVER_SIZE}\u00d7${SERVER_SIZE} for best results.`
        );
      }

      void runValidation(dataUrl);
    },
    [runValidation],
  );

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => acceptImage(dataUrl, img.width, img.height);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [acceptImage]);

  const handleResize = useCallback(async () => {
    if (!personImage) return;
    setIsResizing(true);
    try {
      const resized = await resizeImageDataUrl(personImage, SERVER_SIZE, SERVER_SIZE);
      acceptImage(resized, SERVER_SIZE, SERVER_SIZE);
    } catch {
      setValidationError('Failed to resize image.');
    } finally {
      setIsResizing(false);
    }
  }, [personImage, acceptImage]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const handleTryOn = async () => {
    if (!personImage || !selectedProduct?.image || !validationOk) return;
    try {
      const res = await fetch(selectedProduct.image);
      const blob = await res.blob();
      const garmentB64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Failed to read garment image'));
        r.readAsDataURL(blob);
      });
      await tryOn(personImage, garmentB64, 'upper_body');
    } catch (err) {
      console.error('Try-on error:', err);
    }
  };

  const handleReset = () => {
    reset();
    setPersonImage(null);
    setImageDims(null);
    setNeedsResize(false);
    setValidationOk(false);
    setValidationError(null);
    setLightingWarning(null);
    setSizeWarning(null);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {!resultImage && (
        <>
          <PhotoGuidancePanel />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                fileInputRef.current?.click();
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="w-full min-h-[220px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors p-4"
          >
            {personImage ? (
              <img
                src={personImage}
                alt="Your photo"
                className="max-h-56 w-full object-contain rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-10 w-10" />
                <p className="text-sm">Drag & drop, click, or paste (Ctrl+V) to upload your photo</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />

          {lightingWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{lightingWarning}</span>
            </div>
          )}

          {sizeWarning && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{sizeWarning}</span>
              </div>
              {needsResize && personImage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 border-amber-500/40 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
                  onClick={handleResize}
                  disabled={isResizing}
                >
                  {isResizing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                  Resize to {SERVER_SIZE}×{SERVER_SIZE}
                </Button>
              )}
            </div>
          )}

          {personImage && imageDims && (
            <p className="text-xs text-muted-foreground">
              Current size: {imageDims.w}×{imageDims.h}px
              {imageDims.w >= SERVER_SIZE && imageDims.h >= SERVER_SIZE && ' ✓'}
            </p>
          )}

          {personImage && (
            <div className="flex items-center gap-2 text-sm">
              {isValidating && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Checking person…</span>
                </>
              )}
              {!isValidating && validationOk && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-green-700 dark:text-green-400">
                    ✓ Valid — person detected
                  </span>
                </>
              )}
              {!isValidating && validationError && (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">✗ Could not validate</span>
                </>
              )}
            </div>
          )}

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          {selectedProduct && (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
              <img
                src={selectedProduct.image}
                alt=""
                className="h-16 w-16 rounded-md object-cover"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Product</p>
                <p className="font-medium truncate">{selectedProduct.name}</p>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleTryOn}
            disabled={
              !personImage ||
              !selectedProduct ||
              isLoading ||
              isValidating ||
              !validationOk
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Generate Try-On'
            )}
          </Button>
          {isLoading && (
            <p className="text-xs text-center text-muted-foreground">
              Processing… this may take 30–60 seconds
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </>
      )}

      {resultImage && (
        <div className="flex flex-col gap-3 w-full">
          <img
            src={resultImage}
            alt="Try-on result"
            className="w-full rounded-xl shadow-lg border border-border"
          />
          {processingTime != null && (
            <p className="text-sm text-muted-foreground text-center">
              Processing time: {processingTime}s
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              Try Another
            </Button>
            <Button
              className="flex-1"
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
            >
              Save Photo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
