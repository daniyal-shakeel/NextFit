import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';

const examples = [
  {
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
    good: true,
    label: 'Front facing, arms relaxed \u2713',
  },
  {
    src: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300',
    good: true,
    label: 'Clear upper body visible \u2713',
  },
  {
    src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300',
    good: false,
    label: 'Side angle \u2014 avoid \u2717',
  },
  {
    src: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
    good: false,
    label: 'Crossed arms \u2014 avoid \u2717',
  },
] as const;

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
          <div className="grid grid-cols-2 gap-3">
            {examples.map((ex) => (
              <div key={ex.src} className="relative rounded-lg overflow-hidden">
                <img
                  src={ex.src}
                  alt={ex.label}
                  loading="lazy"
                  className="w-full aspect-[3/4] object-cover"
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center ${
                    ex.good
                      ? 'bg-green-500/25'
                      : 'bg-red-500/25'
                  }`}
                >
                  {ex.good ? (
                    <Check className="h-10 w-10 text-green-500 drop-shadow-md" strokeWidth={3} />
                  ) : (
                    <X className="h-10 w-10 text-red-500 drop-shadow-md" strokeWidth={3} />
                  )}
                </div>
                <p className="text-xs text-center py-1.5 bg-background/80 font-medium">
                  {ex.label}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            For best results: Stand facing camera | Good lighting | Arms slightly apart | Full upper body visible
          </p>
        </div>
      )}
    </div>
  );
}
