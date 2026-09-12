import { useState } from "react";
import { Field } from "../components/Field";
import {
  OpenCashSessionSelector,
  PaymentMethodSelector,
} from "../components/PurchasingSelectors";
import type { PaymentMethod } from "../types/purchasing";
import { formatMoney } from "../utils/formatters";

/**
 * The one place that owns "how do we collect/refund money for a sale":
 * method, amount, and — for cash — the open session and tendered amount for
 * change. Used both by Venta rápida's one-step "Cobrar y confirmar" and by
 * the standalone payments/refunds screen, so there is exactly one amount
 * field to prefill and exactly one auto-select behavior to get right instead
 * of two forms that can quietly drift apart.
 *
 * The amount defaults to `suggestedAmount` (the sale's total, or its
 * outstanding balance) and stays in sync with it — unless the operator types
 * a different number, in which case we stop overwriting their edit. Adjusted
 * during render (React's documented pattern for state derived from a
 * changing value) rather than in an effect, so it never lags a render
 * behind.
 */
export function useSalePaymentFields(suggestedAmount: string) {
  const [methodId, setMethodId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>();
  const [amount, setAmount] = useState(suggestedAmount);
  const [autoAmount, setAutoAmount] = useState(suggestedAmount);
  const [cashSessionId, setCashSessionId] = useState("");
  const [tenderedAmount, setTenderedAmount] = useState("");

  if (suggestedAmount !== autoAmount) {
    setAutoAmount(suggestedAmount);
    if (amount === autoAmount) setAmount(suggestedAmount);
  }

  function selectMethod(value: string, selected?: PaymentMethod) {
    setMethodId(value);
    setMethod(selected);
    setCashSessionId("");
    setTenderedAmount("");
  }

  /** Clears the whole fieldset after a successful operation. The amount
   * field re-syncs to whatever `suggestedAmount` becomes next render (e.g.
   * the sale's new outstanding balance) via the effect above. */
  function reset() {
    setMethodId("");
    setMethod(undefined);
    setAmount("");
    setAutoAmount("");
    setCashSessionId("");
    setTenderedAmount("");
  }

  return {
    methodId,
    method,
    amount,
    setAmount,
    cashSessionId,
    setCashSessionId,
    tenderedAmount,
    setTenderedAmount,
    selectMethod,
    reset,
  };
}

export type SalePaymentFieldsState = ReturnType<typeof useSalePaymentFields>;

export function SalePaymentFieldset({
  idPrefix,
  fields,
  amountHint,
  showTendered = true,
  methodEnabled = true,
  cashEnabled = true,
}: {
  idPrefix: string;
  fields: SalePaymentFieldsState;
  /** Shown under the amount field, e.g. "No mayor a L 85.00". Omit for the
   * default "se precarga con el total" hint used by a brand-new sale. */
  amountHint?: string;
  /** Payments compute change from a tendered amount; refunds don't. */
  showTendered?: boolean;
  methodEnabled?: boolean;
  cashEnabled?: boolean;
}) {
  return (
    <>
      <PaymentMethodSelector
        id={`${idPrefix}-method`}
        label="Método de pago"
        required
        enabled={methodEnabled}
        value={fields.methodId}
        onChange={fields.selectMethod}
      />
      <Field
        label="Monto"
        htmlFor={`${idPrefix}-amount`}
        required
        hint={
          amountHint ?? "Se precarga con el total; cambialo si cobrás distinto."
        }
      >
        <input
          id={`${idPrefix}-amount`}
          required
          inputMode="decimal"
          pattern="\d+(\.\d{1,2})?"
          value={fields.amount}
          onChange={(e) => fields.setAmount(e.target.value)}
        />
      </Field>
      {fields.method?.kind === "CASH" ? (
        <>
          <OpenCashSessionSelector
            id={`${idPrefix}-session`}
            label="Sesión de caja ABIERTA"
            required
            enabled={cashEnabled}
            value={fields.cashSessionId}
            onChange={fields.setCashSessionId}
          />
          {showTendered ? (
            <Field
              label="Monto recibido"
              htmlFor={`${idPrefix}-tendered`}
              hint="El sistema calcula y devuelve el cambio."
            >
              <input
                id={`${idPrefix}-tendered`}
                inputMode="decimal"
                pattern="\d+(\.\d{1,2})?"
                value={fields.tenderedAmount}
                onChange={(e) => fields.setTenderedAmount(e.target.value)}
              />
            </Field>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function amountNotAboveHint(maximum: string): string {
  return `No mayor a ${formatMoney(maximum)}`;
}
