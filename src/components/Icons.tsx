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

export const CheckIcon = createIcon(() => (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M4.5 12.75l6 6 9-13.5"
  />
));

export const CopyIcon = createIcon(() => (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 17.25v-6.562c0-.609-.344-1.125-.844-1.406l-4.875-3.75a1.5 1.5 0 00-1.812 0l-4.875 3.75c-.5.281-.844.797-.844 1.406v6.562a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 7.5v6.562c0 .609-.344 1.125-.844 1.406l-4.875 3.75a1.5 1.5 0 01-1.812 0l-4.875-3.75c-.5-.281-.844-.797-.844-1.406V7.5a1.5 1.5 0 011.5-1.5h10.5a1.5 1.5 0 011.5 1.5z"
    />
  </>
));

export const TrashIcon = createIcon(() => (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </>
));
