import type { ReactNode } from "react";

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export const MicIcon = () => (
  <Svg size={24}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);
export const MicOffIcon = () => (
  <Svg size={24}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16" />
  </Svg>
);
export const StopIcon = () => (
  <Svg size={24}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </Svg>
);
export const SpeakerIcon = ({ on }: { on: boolean }) => (
  <Svg size={18}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    {on ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
  </Svg>
);
export const CheckSquareIcon = () => (
  <Svg size={14}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 12l3 3 5-6" />
  </Svg>
);
export const CalendarIcon = ({ size = 14 }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);
export const BellIcon = () => (
  <Svg size={14}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg size={14}>
    <path d="M5 12l5 5 9-10" />
  </Svg>
);
export const AlertIcon = () => (
  <Svg size={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.5" />
  </Svg>
);
export const Spinner = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin shrink-0">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
