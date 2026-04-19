import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';

const RECOMMENDED_IMAGE = '/assets/photo-guideline-recommended.png';
const UNRECOMMENDED_IMAGE = '/assets/photo-guideline-unrecommended.png';

export default function PhotoGuidancePanel() {
  const [open, setOpen] = useState(true);

  return (
    <div className="w-full rounded-xl border border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span>Photo Guidelines</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div>
              <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 dark:bg-zinc-900 shadow-sm">
                <img
                  src={RECOMMENDED_IMAGE}
                  alt="Recommended: front-facing, clear upper body, neutral background"
                  loading="lazy"
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 pointer-events-none">
                  <Check className="h-9 w-9 text-green-600 dark:text-green-400 drop-shadow-md" strokeWidth={3} />
                </div>
              </div>
              <p className="text-xs text-center py-2 font-medium text-foreground">
                Recommended example
              </p>
            </div>
            <div>
              <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 dark:bg-zinc-900 shadow-sm">
                <img
                  src={UNRECOMMENDED_IMAGE}
                  alt="Avoid: crossed arms or pose that hides the torso"
                  loading="lazy"
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 pointer-events-none">
                  <X className="h-9 w-9 text-red-600 dark:text-red-400 drop-shadow-md" strokeWidth={3} />
                </div>
              </div>
              <p className="text-xs text-center py-2 font-medium text-foreground">
                Not recommended — arms crossed / torso obscured
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            For best results: Stand facing camera | Good lighting | Arms slightly apart | Full upper body visible
          </p>
        </div>
      )}
    </div>
  );
}
