import { useCallback, useMemo, useState } from "react";
import { BarcodeScanButton } from "../components/BarcodeScanButton";
import { Button } from "../components/Button";
import { LocationSelector, ProductSelector } from "../components/EntitySelectors";
import { Field } from "../components/Field";
import { useFocusFieldById } from "../hooks/use-focus-field";
import { useKeyboardWedge } from "../hooks/use-keyboard-wedge";
import { useScanToProduct } from "../hooks/use-scan-to-product";
import type { Product } from "../types/erp";
import type { Sale } from "../types/sales";
import { formatMoney } from "../utils/formatters";

export type Line = {
  key: number;
  productId: string;
  /** Snapshot of the product's code/name, so each table row can show it
   * without a per-line search widget once the product is already chosen. */
  productCode: string;
  productName: string;
  sourceLocationId: string;
  /** Display label ("BOD-01 · Bodega principal") for the collapsed summary. */
  sourceLocationLabel: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
};

export const newLine = (
  key: number,
  sourceLocationId = "",
  sourceLocationLabel = "",
): Line => ({
  key,
  productId: "",
  productCode: "",
  productName: "",
  sourceLocationId,
  sourceLocationLabel,
  quantity: "1",
  unitPrice: "",
  discountAmount: "0.00",
  taxAmount: "0.00",
});

/** Line total: quantity × unit price, minus the discount, plus the tax. */
export function lineTotal(
  line: Pick<Line, "quantity" | "unitPrice" | "discountAmount" | "taxAmount">,
): number {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Number(line.discountAmount) || 0;
  const tax = Number(line.taxAmount) || 0;
  return qty * price - discount + tax;
}

export function linesTotal(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

/**
 * Most sales pull every line from the same shelf. Default a new line to
 * whichever location the last one used, so "Ubicación origen" is rarely
 * something the vendor has to touch while scanning.
 */
function lastUsedLocation(
  lines: Line[],
): Pick<Line, "sourceLocationId" | "sourceLocationLabel"> {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].sourceLocationId)
      return {
        sourceLocationId: lines[i].sourceLocationId,
        sourceLocationLabel: lines[i].sourceLocationLabel,
      };
  }
  return { sourceLocationId: "", sourceLocationLabel: "" };
}

export function hasMoneyAdjustment(line: Line): boolean {
  const isZero = (value: string) => !value || Number(value) === 0;
  return !isZero(line.discountAmount) || !isZero(line.taxAmount);
}

/** Rebuilds the editable line rows from an existing Sale's items, for
 * resuming a DRAFT. */
export function hydrateLines(sale?: Sale): Line[] {
  if (!sale) return [];
  return (sale.items ?? []).map((item, index) => ({
    key: index + 1,
    productId: item.productId,
    productCode: item.product.code,
    productName: item.product.name,
    sourceLocationId: item.sourceLocationId,
    sourceLocationLabel: item.sourceLocation
      ? `${item.sourceLocation.code} · ${item.sourceLocation.name}`
      : "",
    quantity: String(item.quantity),
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
    taxAmount: item.taxAmount,
  }));
}

/**
 * Owns the product-line table's state for one independent sale draft: adding
 * a scanned/picked product, bumping quantity on a repeat scan, editing a
 * line, and the "same product+location can't repeat" guard. `idPrefix` keeps
 * DOM ids unique when several of these panels are mounted side by side (the
 * three-column Ventas workspace).
 *
 * `scannerEnabled` gates the physical USB/Bluetooth keyboard-wedge listener,
 * which is a global `window` keydown listener — with three independent
 * panels mounted at once, only the panel the vendor is actually working in
 * should react to a physical scan, or one scan would add the same product to
 * all three drafts at once.
 */
export function useSaleLineItems(
  idPrefix: string,
  initial: Sale | undefined,
  scannerEnabled: boolean,
) {
  const [lines, setLines] = useState<Line[]>(() => hydrateLines(initial));
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  useFocusFieldById(focusTarget);

  const updateLine = useCallback(
    (key: number, changes: Partial<Line>) =>
      setLines((current) =>
        current.map((line) =>
          line.key === key ? { ...line, ...changes } : line,
        ),
      ),
    [],
  );

  const removeLine = useCallback(
    (key: number) =>
      setLines((current) => current.filter((line) => line.key !== key)),
    [],
  );

  const addScannedProduct = useCallback(
    (product: Product) => {
      let targetKey = 0;
      setLines((current) => {
        const price = product.defaultSalePrice ?? "";
        // Scanning (or picking) the same product again just bumps its
        // quantity by one instead of adding a second row for it — the
        // table stays one row per product, the way a vendor scanning
        // several units of the same part expects.
        const existingIndex = current.findIndex(
          (line) => line.productId === product.id,
        );
        if (existingIndex >= 0) {
          targetKey = current[existingIndex].key;
          return current.map((line, index) =>
            index === existingIndex
              ? {
                  ...line,
                  quantity: String((Number(line.quantity) || 0) + 1),
                }
              : line,
          );
        }
        const nextKey = current.length
          ? Math.max(...current.map((line) => line.key)) + 1
          : 1;
        targetKey = nextKey;
        const location = lastUsedLocation(current);
        return [
          ...current,
          {
            ...newLine(
              nextKey,
              location.sourceLocationId,
              location.sourceLocationLabel,
            ),
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            unitPrice: price,
          },
        ];
      });
      setFocusTarget(`${idPrefix}-qty-${targetKey}`);
    },
    [idPrefix],
  );

  const { handleScan, feedback: scanFeedback } =
    useScanToProduct(addScannedProduct);
  useKeyboardWedge(handleScan, { enabled: scannerEnabled });

  const duplicate = useMemo(() => {
    const keys = lines
      .filter((line) => line.productId && line.sourceLocationId)
      .map((line) => `${line.productId}:${line.sourceLocationId}`);
    return new Set(keys).size !== keys.length;
  }, [lines]);

  return {
    lines,
    setLines,
    updateLine,
    removeLine,
    addScannedProduct,
    handleScan,
    scanFeedback,
    duplicate,
  };
}

/**
 * The product table itself: one row per line, growing with each scan, with
 * the running total in the footer. A known product never asks again for its
 * location (carried over, collapsed) — only quantity and, if it needs
 * adjusting, price are front and center.
 */
export function ProductLinesEditor({
  idPrefix,
  lines,
  updateLine,
  onRemove,
  onAddProduct,
  handleScan,
  scanFeedback,
  scanTitle,
  priceLabel = "Precio unitario",
}: {
  idPrefix: string;
  lines: Line[];
  updateLine: (key: number, changes: Partial<Line>) => void;
  onRemove: (key: number) => void;
  onAddProduct: (product: Product) => void;
  handleScan: (code: string) => void;
  scanFeedback: { tone: string; text: string } | null;
  scanTitle: string;
  priceLabel?: string;
}) {
  return (
    <>
      <div className="scan-row">
        <BarcodeScanButton
          label="Escanear producto"
          title={scanTitle}
          onScan={handleScan}
        />
        {scanFeedback ? (
          <span
            className={`scan-row__feedback scan-row__feedback--${scanFeedback.tone}`}
          >
            {scanFeedback.text}
          </span>
        ) : null}
      </div>
      {lines.length ? (
        <div className="table-wrap line-items-table-wrap">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>{priceLabel}</th>
                <th>Total</th>
                <th aria-label="Quitar" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td className="line-product">
                    <strong>{line.productCode}</strong>
                    <small>{line.productName}</small>
                    <details
                      className="line-location"
                      open={!line.sourceLocationId}
                    >
                      <summary>
                        {line.sourceLocationLabel ||
                          (line.sourceLocationId
                            ? "Ubicación elegida"
                            : "Elegí la ubicación")}
                      </summary>
                      <LocationSelector
                        id={`${idPrefix}-location-${line.key}`}
                        label="Ubicación origen"
                        required
                        value={line.sourceLocationId}
                        onChange={(sourceLocationId, item) =>
                          updateLine(line.key, {
                            sourceLocationId,
                            sourceLocationLabel: item
                              ? `${item.code} · ${item.name}`
                              : "",
                          })
                        }
                      />
                    </details>
                  </td>
                  <td>
                    <Field
                      label="Cantidad"
                      htmlFor={`${idPrefix}-qty-${line.key}`}
                      required
                    >
                      <input
                        id={`${idPrefix}-qty-${line.key}`}
                        className="line-qty-input"
                        required
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: e.target.value })
                        }
                      />
                    </Field>
                  </td>
                  <td>
                    <Field
                      label={priceLabel}
                      htmlFor={`${idPrefix}-price-${line.key}`}
                      required
                    >
                      <input
                        id={`${idPrefix}-price-${line.key}`}
                        className="line-price-input"
                        required
                        inputMode="decimal"
                        pattern="\d+(\.\d{1,4})?"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.key, { unitPrice: e.target.value })
                        }
                      />
                    </Field>
                    <details
                      className="line-more"
                      open={hasMoneyAdjustment(line)}
                    >
                      <summary>Descuento / impuesto</summary>
                      <div className="line-more__fields">
                        <Field
                          label="Descuento"
                          htmlFor={`${idPrefix}-discount-${line.key}`}
                        >
                          <input
                            id={`${idPrefix}-discount-${line.key}`}
                            inputMode="decimal"
                            pattern="\d+(\.\d{1,2})?"
                            value={line.discountAmount}
                            onChange={(e) =>
                              updateLine(line.key, {
                                discountAmount: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field
                          label="Impuesto"
                          htmlFor={`${idPrefix}-tax-${line.key}`}
                        >
                          <input
                            id={`${idPrefix}-tax-${line.key}`}
                            inputMode="decimal"
                            pattern="\d+(\.\d{1,2})?"
                            value={line.taxAmount}
                            onChange={(e) =>
                              updateLine(line.key, { taxAmount: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    </details>
                  </td>
                  <td className="line-total">
                    {formatMoney(lineTotal(line).toFixed(4))}
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant="danger"
                      className="line-remove"
                      onClick={() => onRemove(line.key)}
                    >
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="line-total">
                  {formatMoney(linesTotal(lines).toFixed(4))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="line-empty">Todavía no agregaste ningún producto.</p>
      )}
      <div className="line-add">
        <ProductSelector
          id={`${idPrefix}-add-product`}
          label="Agregar producto"
          value=""
          onChange={(_productId, item?: Product) => {
            if (item) onAddProduct(item);
          }}
        />
      </div>
    </>
  );
}
