import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted dark:bg-gray-700",
        "before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/25 before:dark:via-gray-600 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
