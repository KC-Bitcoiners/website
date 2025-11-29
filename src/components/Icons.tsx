import { ReactNode, FunctionComponent } from "react";

/** Utility for creating a reusable icon component */
function createIcon(
  paths: () => ReactNode,
): FunctionComponent<{ className?: string }> {
  return function Icon({ className }: { className?: string }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={className || "size-6"}
      >
        {paths()}
      </svg>
    );
  };
}

export const MarkerIcon = createIcon(() => (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
    />
  </>
));

export const ClockIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
  />
));

export const HamburgerIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
  />
));

export const CalendarIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0h18M12 12.75h.008v.008H12v-.008Z"
  />
));

export const PlusIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 4.5v15m7.5-7.5h-15"
  />
));

export const XIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M6 18L18 6M6 6l12 12"
  />
));

export const ChevronLeftIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M15.75 19.5L8.25 12l7.5-7.5"
  />
));

export const ChevronRightIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="m8.25 4.5 7.5 7.5-7.5 7.5"
  />
));
