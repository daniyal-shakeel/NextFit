import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types';
import { useStore } from './store';
import Scene from './Scene';
import WebcamTracker from './WebcamTracker';

interface CameraTryOnProps {
  selectedProduct: Product | null;
  tabActive: boolean;
}

export function CameraTryOn({ selectedProduct, tabActive }: CameraTryOnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cameraDenied = useStore((state) => state.cameraDenied);
  const poseReady = useStore((state) => state.poseReady);
  const modelLoading = useStore((state) => state.modelLoading);
  const setCameraDenied = useStore((state) => state.setCameraDenied);
  const setCameraSessionActive = useStore((state) => state.setCameraSessionActive);

  useEffect(() => {
    if (!tabActive) {
      setSessionActive(false);
      setCameraSessionActive(false);
    }
  }, [tabActive, setCameraSessionActive]);

  useEffect(() => {
    setCameraSessionActive(sessionActive);
  }, [sessionActive, setCameraSessionActive]);

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
            The 3D garment is physically mapped to your body over the live preview. Camera stops when you leave this tab.
          </p>
          <Button
            onClick={() => {
              setCameraDenied(false);
              setSessionActive(true);
            }}
            size="lg"
            disabled={modelLoading}
          >
            <Camera className="h-4 w-4 mr-2" />
            {modelLoading ? 'Loading 3D Model...' : 'Start Camera'}
          </Button>
        </div>
      )}

      {sessionActive && cameraDenied && (
        <div className="aspect-video bg-destructive/10 rounded-lg flex flex-col items-center justify-center border border-destructive">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-base font-medium text-destructive">Camera Access Denied</p>
          <p className="text-sm text-muted-foreground mb-4 text-center px-4">Please allow camera access to use 3D Live Try-On.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSessionActive(false);
              setCameraDenied(false);
            }}
          >
            Close
          </Button>
        </div>
      )}

      {sessionActive && !cameraDenied && (
        <div
          ref={containerRef}
          className={`relative overflow-hidden border border-border bg-black ${
            isFullscreen ? 'aspect-auto w-full h-full min-h-screen' : 'aspect-video rounded-lg'
          }`}
          style={{ minHeight: isFullscreen ? undefined : 280 }}
        >
          {/* New Engine Components */}
          <WebcamTracker />
          <Scene />

          {(!poseReady || modelLoading) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">
                {!poseReady ? 'Starting AI tracking model...' : 'Loading 3D Garment...'}
              </p>
            </div>
          )}
          
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3 right-3 z-30 h-9 w-9 rounded-full bg-background/80 hover:bg-background shadow-md"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Minimize' : 'Maximize'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {sessionActive && !cameraDenied && (
        <Button
          variant="outline"
          onClick={() => {
            setSessionActive(false);
          }}
          className="w-full"
        >
          Stop camera
        </Button>
      )}
    </div>
  );
}
