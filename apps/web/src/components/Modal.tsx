import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ onClose, children }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
}
