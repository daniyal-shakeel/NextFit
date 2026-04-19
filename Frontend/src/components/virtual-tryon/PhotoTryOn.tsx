import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  X,
  ZoomIn,
  AlertTriangle,
  Maximize2,
  RefreshCw,
  Lock,
} from 'lucide-react';
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

type LightboxState = { src: string; alt: string } | null;

function ExpandableResultImage({
  src,
  alt,
  imgClassName,
  frameClassName = 'rounded-xl shadow border border-border overflow-hidden',
  onOpen,
}: {
  src: string;
  alt: string;
  imgClassName: string;
  frameClassName?: string;
  onOpen: () => void;
}) {
  return (
    <div className={`relative group ${frameClassName}`}>
      <button
        type="button"
        onClick={onOpen}
        className="relative w-full border-0 bg-transparent p-0 cursor-zoom-in text-left ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View larger: ${alt}`}
      >
        <img src={src} alt={alt} className={imgClassName} />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15"
          aria-hidden
        >
          <ZoomIn
            className="h-9 w-9 text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-90"
            strokeWidth={1.5}
          />
        </div>
      </button>
    </div>
  );
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
  const garmentFileInputRef = useRef<HTMLInputElement>(null);
  const [hasCompletedTryOn, setHasCompletedTryOn] = useState(false);
  const [garmentOverrideDataUrl, setGarmentOverrideDataUrl] = useState<string | null>(null);
  const [garmentChangeMode, setGarmentChangeMode] = useState(false);
  const [cancelledNotice, setCancelledNotice] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const {
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
  } = useTryOnApi();

  useEffect(() => {
    if (resultImage) {
      setHasCompletedTryOn(true);
      setGarmentOverrideDataUrl(null);
      setGarmentChangeMode(false);
    }
  }, [resultImage]);

  useEffect(() => {
    if (!cancelledNotice) return;
    const t = window.setTimeout(() => {
      setCancelledNotice(null);
      reset();
      setHasCompletedTryOn(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [cancelledNotice, reset]);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox]);

  const handleCancelTryOn = () => {
    cancel();
    setCancelledNotice('Processing cancelled');
  };

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
      if (hasCompletedTryOn) return;
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
  }, [handleFile, hasCompletedTryOn]);

  const handleTryOn = async () => {
    if (!personImage || !selectedProduct?.image || !validationOk) return;
    setCancelledNotice(null);
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

  const handleTryAgain = async () => {
    if (!personImage || !selectedProduct?.image || !validationOk) return;
    setCancelledNotice(null);
    setGarmentOverrideDataUrl(null);
    setGarmentChangeMode(false);
    reset();
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

  const handleGarmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setGarmentOverrideDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onGarmentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!garmentChangeMode) return;
    const file = e.dataTransfer.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setGarmentOverrideDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerateWithNewGarment = async () => {
    if (!personImage || !garmentOverrideDataUrl || !validationOk) return;
    setCancelledNotice(null);
    reset();
    try {
      await tryOn(personImage, garmentOverrideDataUrl, 'upper_body');
    } catch (err) {
      console.error('Try-on error:', err);
    }
  };

  const handleChangeGarmentAndRetry = () => {
    setGarmentChangeMode(true);
  };

  const handleReset = () => {
    reset();
    setHasCompletedTryOn(false);
    setGarmentOverrideDataUrl(null);
    setGarmentChangeMode(false);
    setPersonImage(null);
    setImageDims(null);
    setNeedsResize(false);
    setValidationOk(false);
    setValidationError(null);
    setLightingWarning(null);
    setSizeWarning(null);
  };

  const lightboxPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {lightbox && (
              <motion.div
                key="tryon-lightbox"
                role="dialog"
                aria-modal="true"
                aria-label={lightbox.alt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 dark:bg-black/60 p-4"
                onClick={() => setLightbox(null)}
              >
                <button
                  type="button"
                  className="absolute right-4 top-4 z-[101] rounded-full bg-background/95 p-2 text-foreground shadow-md ring-1 ring-border transition-colors hover:bg-accent dark:border dark:border-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(null);
                  }}
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
                <img
                  src={lightbox.src}
                  alt={lightbox.alt}
                  className="max-h-[90vh] max-w-[90vw] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-4 w-full">
      {!hasCompletedTryOn && (
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
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
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
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                <span>Processing... this may take 30-60 seconds</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleCancelTryOn}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </>
      )}

      {hasCompletedTryOn && personImage && (
        <div className="flex flex-col gap-4 w-full">
          {isLoading && !resultImage && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 py-4 px-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                <span>Processing... this may take 30-60 seconds</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleCancelTryOn}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-4 w-full">
            <div className="flex flex-col gap-2 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Your photo</p>
              <div className="relative rounded-xl border border-border overflow-hidden bg-background">
                <img
                  src={personImage}
                  alt="Your photo"
                  className="w-full max-h-56 object-contain"
                />
                <div
                  className="absolute top-2 right-2 rounded-full bg-background/95 p-1.5 shadow border border-border"
                  title="Subject locked"
                >
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">Subject locked</p>
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Garment</p>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div className="relative h-28 w-28 shrink-0 rounded-lg border border-border overflow-hidden bg-background">
                  <img
                    src={garmentOverrideDataUrl ?? selectedProduct?.image ?? ''}
                    alt="Garment"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={() => garmentFileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    Change
                  </Button>
                  <input
                    ref={garmentFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGarmentFileChange}
                  />
                  {garmentChangeMode && (
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ')
                          garmentFileInputRef.current?.click();
                      }}
                      onClick={() => garmentFileInputRef.current?.click()}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={onGarmentDrop}
                      className="min-h-[96px] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 p-3 text-xs text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-6 w-6 shrink-0" />
                      <span className="text-center">
                        Drop a garment image here or click to upload
                      </span>
                    </div>
                  )}
                  {garmentOverrideDataUrl && (
                    <Button
                      className="w-full sm:w-auto"
                      size="lg"
                      onClick={handleGenerateWithNewGarment}
                      disabled={isLoading || !validationOk}
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
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {preprocessedPerson && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-center text-foreground">Person Input</p>
                <ExpandableResultImage
                  src={preprocessedPerson}
                  alt="Person after preprocessing"
                  imgClassName="w-full"
                  onOpen={() =>
                    setLightbox({
                      src: preprocessedPerson,
                      alt: 'Person after preprocessing',
                    })
                  }
                />
                <p className="text-xs text-muted-foreground text-center">After preprocessing</p>
              </div>
            )}
            {preprocessedGarment && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-center text-foreground">Garment Input</p>
                <ExpandableResultImage
                  src={preprocessedGarment}
                  alt="Garment after preprocessing"
                  imgClassName="w-full"
                  onOpen={() =>
                    setLightbox({
                      src: preprocessedGarment,
                      alt: 'Garment after preprocessing',
                    })
                  }
                />
                <p className="text-xs text-muted-foreground text-center">After preprocessing</p>
              </div>
            )}
            {rawResult && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-muted-foreground text-center">
                  Raw AI Output
                </p>
                <ExpandableResultImage
                  src={rawResult}
                  alt="Raw AI output"
                  imgClassName="w-full"
                  onOpen={() =>
                    setLightbox({ src: rawResult, alt: 'Raw AI output' })
                  }
                />
                <p className="text-xs text-muted-foreground text-center">Before enhancement</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-center text-foreground">Final Result</p>
              {resultImage && (
                <ExpandableResultImage
                  src={resultImage}
                  alt="Final result"
                  imgClassName="w-full"
                  frameClassName="rounded-xl shadow-lg border border-border overflow-hidden"
                  onOpen={() =>
                    setLightbox({ src: resultImage, alt: 'Final result' })
                  }
                />
              )}
              <p className="text-xs text-muted-foreground text-center">After enhancement</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-1 w-full">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  disabled={!resultImage}
                  onClick={async () => {
                    if (!resultImage) return;
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
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={handleTryAgain}
              disabled={isLoading || !selectedProduct?.image || !validationOk}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={handleChangeGarmentAndRetry}
              disabled={isLoading}
            >
              Change Garment &amp; Retry
            </Button>
          </div>

          {processingTime != null && (
            <p className="text-sm text-muted-foreground text-center">
              Processing time: {processingTime}s
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={handleReset}>
            Try Another
          </Button>
        </div>
      )}

      {cancelledNotice && (
        <p className="text-sm text-center text-muted-foreground">{cancelledNotice}</p>
      )}

      {lightboxPortal}
    </div>
  );
}
