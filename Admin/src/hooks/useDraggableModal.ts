import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type DragStart = { startX: number; startY: number; startOffsetX: number; startOffsetY: number };

export function useDraggableModal() {
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<DragStart | null>(null);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      setDragOffset({
        x: start.startOffsetX + (e.clientX - start.startX),
        y: start.startOffsetY + (e.clientY - start.startY),
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      const start = dragStartRef.current;
      if (!start || !e.touches[0]) return;
      setDragOffset({
        x: start.startOffsetX + (e.touches[0].clientX - start.startX),
        y: start.startOffsetY + (e.touches[0].clientY - start.startY),
      });
    };
    const onUp = () => {
      dragStartRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

  const reset = () => setDragOffset({ x: 0, y: 0 });

  const handleProps = {
    role: "button" as const,
    tabIndex: 0,
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: dragOffset.x,
        startOffsetY: dragOffset.y,
      };
      setIsDragging(true);
    },
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      dragStartRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startOffsetX: dragOffset.x,
        startOffsetY: dragOffset.y,
      };
      setIsDragging(true);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") e.preventDefault();
    },
    "aria-label": "Drag to move dialog",
  };

  return {
    dragOffset,
    setDragOffset,
    reset,
    handleProps,
    dialogStyle: { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` },
  };
}

