import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveTryOnCanvas } from '@/components/LiveTryOn/LiveTryOnCanvas';
import { FrameGuide } from '@/components/LiveTryOn/FrameGuide';
import type { Product } from '@/lib/types';
import { getLiveTryOnGarmentImage } from '@/lib/liveTryOnProduct';
import type { FrameStatus } from '@/utils/poseUtils';

interface CameraTryOnProps {
  selectedProduct: Product | null;
  tabActive: boolean;
}

export function CameraTryOn({ selectedProduct, tabActive }: CameraTryOnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [frameStatus, setFrameStatus] = useState<FrameStatus>('out_of_frame');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!tabActive) {
      setSessionActive(false);
      setSessionError(null);
      setRuntimeReady(false);
      setFrameStatus('out_of_frame');
    }
  }, [tabActive]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement),
      );
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!sessionActive || sessionError) {
      setRuntimeReady(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) setRuntimeReady(true);
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [sessionActive, sessionError]);

  const garmentImageUrl = getLiveTryOnGarmentImage(selectedProduct);
  const streamActive = tabActive && sessionActive && !sessionError;

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const h = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
        await (h.requestFullscreen?.() ?? h.webkitRequestFullscreen?.());
      }
    } catch {
    }
  };

  return (
    <div className="space-y-4">
      {!sessionActive && (
        <div className="aspect-video bg-muted/50 rounded-lg flex flex-col items-center justify-center border border-border">
          <Camera className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mb-4" />
          <p className="text-base md:text-lg font-medium text-foreground">Enable camera</p>
          <p className="text-xs md:text-sm text-muted-foreground mb-4 px-4 text-center max-w-md">
            The garment is mapped to your upper body in 2D over the live preview. Camera stops when you leave this tab.
          </p>
          <Button
            onClick={() => {
              setSessionError(null);
              setRuntimeReady(false);
              setSessionActive(true);
            }}
            size="lg"
          >
            <Camera className="h-4 w-4 mr-2" />
            Start camera
          </Button>
        </div>
      )}

      {sessionActive && sessionError && (
        <div className="aspect-video bg-destructive/10 rounded-lg flex flex-col items-center justify-center border border-destructive">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-base font-medium text-destructive">Error</p>
          <p className="text-sm text-muted-foreground mb-4 text-center px-4">{sessionError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setSessionActive(false);
              setSessionError(null);
            }}
          >
            Close
          </Button>
        </div>
      )}

      {sessionActive && !sessionError && (
        <div
          ref={containerRef}
          className={`relative overflow-hidden border border-border bg-black ${
            isFullscreen ? 'aspect-auto w-full h-full min-h-screen' : 'aspect-video rounded-lg'
          }`}
          style={{ minHeight: isFullscreen ? undefined : 280 }}
        >
          <LiveTryOnCanvas
            garmentImageUrl={garmentImageUrl}
            isActive={streamActive}
            onFrameStatus={setFrameStatus}
          />
          {!runtimeReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Starting camera and pose model...</p>
            </div>
          )}
          {runtimeReady && <FrameGuide status={frameStatus} />}
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-background/80 hover:bg-background shadow-md"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Minimize' : 'Maximize'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {sessionActive && !sessionError && (
        <Button
          variant="outline"
          onClick={() => {
            setSessionActive(false);
            setRuntimeReady(false);
            setSessionError(null);
          }}
          className="w-full"
        >
          Stop camera
        </Button>
      )}
    </div>
  );
}
