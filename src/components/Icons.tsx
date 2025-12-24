import { ReactNode, FunctionComponent } from "react";

/** Utility for creating a reusable icon component with stroke */
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

/** Utility for creating a reusable filled icon component */
function createFillIcon(
  paths: () => ReactNode,
  viewBox: string = "0 0 24 24",
): FunctionComponent<{ className?: string }> {
  return function Icon({ className }: { className?: string }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        fill="currentColor"
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
  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

export const GitHubIcon = createFillIcon(
  () => (
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  ),
  "0 0 24 24"
);
