import { useCallback, useEffect, useRef, useState } from "react";
import { catalogApi } from "../api/catalog-api";
import type { Product } from "../types/erp";

export interface ScanFeedback {
  tone: "ok" | "error";
  text: string;
}

/**
 * Turns a scanned/typed barcode into an active product and hands it to
 * `onProduct` (which typically adds or fills a document line). Exposes inline
 * feedback for the last scan so the operator gets confirmation without leaving
 * the keyboard. The returned `handleScan` is synchronous so it can be passed
 * straight to `useKeyboardWedge` and `BarcodeScanButton`.
 */
export function useScanToProduct(onProduct: (product: Product) => void) {
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const onProductRef = useRef(onProduct);
  useEffect(() => {
    onProductRef.current = onProduct;
  });

  const handleScan = useCallback((code: string) => {
    const term = code.trim();
    if (!term) return;
    setBusy(true);
    void catalogApi
      .findProductByCode(term)
      .then((product) => {
        if (product) {
          onProductRef.current(product);
          setFeedback({
            tone: "ok",
            text: `Agregado: ${product.code} · ${product.name}`,
          });
        } else {
          setFeedback({
            tone: "error",
            text: `Ningún producto activo con el código «${term}»`,
          });
        }
      })
      .catch(() => {
        setFeedback({
          tone: "error",
          text: `No se pudo buscar el código «${term}»`,
        });
      })
      .finally(() => setBusy(false));
  }, []);

  return { handleScan, feedback, busy };
}
