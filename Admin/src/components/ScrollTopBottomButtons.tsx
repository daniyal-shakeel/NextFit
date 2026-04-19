import { ChevronDown, ChevronUp } from "lucide-react";

export function ScrollTopBottomButtons() {
  return (
    <div
      className="fixed bottom-4 right-4 z-30 flex flex-col gap-2 sm:bottom-6 sm:right-6"
      role="navigation"
      aria-label="Scroll to top or bottom"
    >
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        title="Go to top"
        aria-label="Go to top"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/95 text-foreground shadow-md backdrop-blur transition-colors hover:bg-accent hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronUp className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() =>
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          })
        }
        title="Go to bottom"
        aria-label="Go to bottom"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/95 text-foreground shadow-md backdrop-blur transition-colors hover:bg-accent hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
