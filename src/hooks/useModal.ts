import { useEffect } from "react";

/**
 * Hook for modal accessibility: handles Escape key to close and prevents
 * background scroll while the modal is open.
 *
 * @param isOpen - whether the modal is currently visible
 * @param onClose - callback to close the modal
 */
export function useModal(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    // Prevent background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);
}
