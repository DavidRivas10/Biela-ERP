import { useEffect, useRef } from "react";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  dangerous = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  dangerous?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="dialog-actions">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={dangerous ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
