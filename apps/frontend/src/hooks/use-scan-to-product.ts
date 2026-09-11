import { useCallback, useEffect, useRef, useState } from "react";
import { catalogApi } from "../api/catalog-api";
import type { Product } from "../types/erp";

export interface ScanFeedback {
  tone: "ok" | "new" | "error";
  text: string;
  /** The scanned code, only set when `tone` is "new" — for a "create it" link. */
  code?: string;
}

/**
 * Turns a scanned/typed barcode into an active product and hands it to
 * `onProduct` (which typically adds or fills a document line). Exposes inline
 * feedback for the last scan so the operator gets confirmation without leaving
 * the keyboard. The returned `handleScan` is synchronous so it can be passed
 * straight to `useKeyboardWedge` and `BarcodeScanButton`.
 *
 * `allowNew` distinguishes the two places this is used: registering a
 * purchase invoice can legitimately meet a part never carried before (the
 * screen should say so and offer to register it), while a sale can only ever
 * reference something already in the catalog — an unrecognized code there is
 * just an error, not "a new product".
 */
export function useScanToProduct(
  onProduct: (product: Product) => void,
  options: { allowNew?: boolean } = {},
) {
  const { allowNew = false } = options;
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const onProductRef = useRef(onProduct);
  useEffect(() => {
    onProductRef.current = onProduct;
  });

  const handleScan = useCallback(
    (code: string) => {
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
              text: `Reconocido: ${product.code} · ${product.name}`,
            });
          } else if (allowNew) {
            setFeedback({
              tone: "new",
              text: `Producto nuevo: «${term}» no está en el catálogo todavía.`,
              code: term,
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
    },
    [allowNew],
  );

  return { handleScan, feedback, busy };
}
