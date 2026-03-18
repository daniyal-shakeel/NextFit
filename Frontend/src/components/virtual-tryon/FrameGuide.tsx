import type { FrameStatus } from '@/utils/poseUtils';

interface FrameGuideProps {
  status: FrameStatus;
}

const STATUS_MESSAGES: Record<FrameStatus, string> = {
  ready: 'Ready ✓',
  too_close: 'Move back — you\'re too close',
  too_far: 'Move closer — you\'re too far',
  out_of_frame: 'Move into frame',
};

export function FrameGuide({ status }: FrameGuideProps) {
  const inFrame = status === 'ready';
  return (
    <div
      className="absolute inset-0 pointer-events-none rounded-lg transition-all duration-300"
      style={{
        border: `2px solid ${inFrame ? '#00ff00' : '#ef4444'}`,
        boxShadow: inFrame
          ? '0 0 20px rgba(0, 255, 0, 0.4)'
          : '0 0 20px rgba(239, 68, 68, 0.4)',
      }}
    >
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300"
        style={{
          backgroundColor: inFrame ? 'rgba(0, 255, 0, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: inFrame ? '#00ff00' : '#ef4444',
        }}
      >
        {STATUS_MESSAGES[status]}
      </div>
    </div>
  );
}
