import { useEffect, useRef, useState } from "react";
import type { DecodeHintType } from "@zxing/library";
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

/** `focusMode` is a real constraint but missing from the DOM typings. */
type FocusConstraint = MediaTrackConstraintSet & { focusMode?: string };

/**
 * Seconds of unsuccessful scanning before we tell the user something is wrong.
 * ZXing never times out on its own, so without this the modal would look frozen.
 */
const STRUGGLE_AFTER_MS = 7000;

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
 *
 * Decoding a thin 1D barcode from a live phone stream needs pixels on the
 * bars: we ask for a 1080p stream and continuous autofocus, restrict the
 * decoder to the formats found on parts packaging, and let it retry quickly.
 * Manual entry is always available so a stubborn code is never a dead end.
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
  const [struggling, setStruggling] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let struggleTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      setPhase("starting");
      setMessage("");
      setStruggling(false);
      setManualCode("");
      try {
        const [{ BrowserMultiFormatReader, BarcodeFormat }, zxingLib] =
          await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
        if (cancelled || !videoRef.current) return;
        const DHT = zxingLib.DecodeHintType;

        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DHT.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        hints.set(DHT.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 150,
          delayBetweenScanSuccess: 500,
        });

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: "continuous" } as FocusConstraint],
          },
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
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

        // Continuous autofocus is often ignored inside getUserMedia and has to
        // be re-applied on the live track. Best effort — not every device has it.
        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.()[0];
        if (track) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as FocusConstraint],
            });
          } catch {
            // focusMode unsupported on this camera — ignore.
          }
        }

        struggleTimer = setTimeout(() => {
          if (!cancelled) setStruggling(true);
        }, STRUGGLE_AFTER_MS);
      } catch (error) {
        if (cancelled) return;
        setPhase("error");
        setMessage(cameraErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
      if (struggleTimer) clearTimeout(struggleTimer);
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    controlsRef.current?.stop();
    controlsRef.current = null;
    onScan(code);
    onClose();
  };

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
            Apunta la cámara al código y acércate hasta que llene el recuadro.
            Se detecta solo.
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
        {struggling && phase === "scanning" ? (
          <p className="scanner-dialog__struggle" role="status">
            Todavía no se detecta ningún código. Acerca o aleja el teléfono
            despacio hasta que el código llene el recuadro, evita reflejos y
            busca buena luz. Si aun así no lee, escribe el código abajo.
          </p>
        ) : null}
        {/* Not a <form>: this modal is often rendered inside another form. */}
        <div className="scanner-dialog__manual">
          <label htmlFor="scanner-manual-code">
            {phase === "error"
              ? "Escribe el código del producto"
              : "¿No lee? Escribe el código del producto"}
          </label>
          <div className="scanner-dialog__manual-row">
            <input
              id="scanner-manual-code"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitManual();
                }
              }}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Código del producto"
            />
            <Button
              type="button"
              variant="primary"
              disabled={!manualCode.trim()}
              onClick={submitManual}
            >
              Usar código
            </Button>
          </div>
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
