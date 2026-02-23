import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const DURATION_MS = 400;
const COMPLETE_DELAY_MS = 200;

export function LoadingBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    setProgress(0);

    const startTimer = requestAnimationFrame(() => {
      setProgress(40);
    });

    const completeTimer = setTimeout(() => {
      setProgress(100);
    }, DURATION_MS);

    const hideTimer = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, DURATION_MS + COMPLETE_DELAY_MS);

    return () => {
      cancelAnimationFrame(startTimer);
      clearTimeout(completeTimer);
      clearTimeout(hideTimer);
    };
  }, [location.pathname, location.key]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed left-0 top-0 z-[9999] h-[3px] w-full overflow-hidden bg-transparent"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      <div
        className="h-full bg-primary ease-out"
        style={{
          width: `${progress}%`,
          transition: `width ${progress === 100 ? '150ms' : '300ms'} ease-out`,
        }}
      />
    </div>
  );
}
