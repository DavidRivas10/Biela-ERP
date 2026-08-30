import { useState } from "react";
import { BarcodeCameraModal } from "./BarcodeCameraModal";
import { Button } from "./Button";

interface BarcodeScanButtonProps {
  onScan: (code: string) => void;
  label?: string;
  title?: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}

/**
 * Button that opens the camera barcode scanner and forwards the decoded code.
 * Pair it with `useKeyboardWedge` on the same screen so a physical USB or
 * Bluetooth scanner works too, with no extra UI.
 */
export function BarcodeScanButton({
  onScan,
  label = "Escanear con cámara",
  title,
  variant = "secondary",
  disabled = false,
}: BarcodeScanButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">▚</span> {label}
      </Button>
      <BarcodeCameraModal
        open={open}
        title={title}
        onClose={() => setOpen(false)}
        onScan={onScan}
      />
    </>
  );
}
