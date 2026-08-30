import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

interface BarcodeCameraModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

type Phase = "starting" | "scanning" | "error";

interface ScannerControls {
  stop: () => void;
}

function cameraErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "No se concedió permiso para usar la cámara. Actívalo en el navegador e inténtalo de nuevo.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No se encontró ninguna cámara en este dispositivo.";
  }
  if (name === "NotReadableError") {
    return "La cámara está siendo usada por otra aplicación.";
  }
  return "No se pudo iniciar la cámara. Puedes escribir el código a mano o usar un lector físico.";
}

/**
 * Modal that reads one barcode from the device camera (phone or webcam) and
 * reports its text through `onScan`. The camera is only requested after the
 * user opens this modal, and the stream is fully stopped on close. The
 * decoding library is loaded on demand so it never ships in the initial bundle.
 */
export function BarcodeCameraModal({
  open,
  onClose,
  onScan,
  title = "Escanear código de barras",
}: BarcodeCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      setPhase("starting");
      setMessage("");
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            const text = result.getText().trim();
            if (!text) return;
            controlsRef.current?.stop();
            controlsRef.current = null;
            onScanRef.current(text);
            onCloseRef.current();
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setPhase("scanning");
      } catch (error) {
        if (cancelled) return;
        setPhase("error");
        setMessage(cameraErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="confirm-dialog scanner-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <h2>{title}</h2>
        {phase === "error" ? (
          <p className="scanner-dialog__error">{message}</p>
        ) : (
          <p className="muted">
            Apunta la cámara al código de barras del producto. Se detecta solo.
          </p>
        )}
        <div className="scanner-dialog__viewport" hidden={phase === "error"}>
          <video
            ref={videoRef}
            className="scanner-dialog__video"
            muted
            playsInline
          />
          <span className="scanner-dialog__reticle" aria-hidden="true" />
          {phase === "starting" ? (
            <span className="scanner-dialog__hint">Iniciando cámara…</span>
          ) : null}
        </div>
        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </section>
    </div>
  );
}
