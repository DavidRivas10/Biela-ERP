import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { purchasingApi } from "../api/purchasing-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LocationSelector } from "../components/EntitySelectors";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { queryKeys } from "../query/query-keys";
import {
  invalidateCommercialSummary,
  invalidateInventoryIntegration,
} from "../query/invalidation";
import type { PurchaseItem } from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import { formatDateTime } from "../utils/formatters";

async function invalidateInventory(client: ReturnType<typeof useQueryClient>) {
  await invalidateInventoryIntegration(client);
}

export function PurchaseReceiptCreatePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [locationId, setLocationId] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const purchase = useQuery({
    queryKey: queryKeys.purchase(id),
    queryFn: () => purchasingApi.purchase(id),
  });
  const create = useMutation({
    mutationFn: () =>
      purchasingApi.createReceipt(id, {
        destinationLocationId: locationId,
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        notes: notes || undefined,
        items: Object.entries(quantities)
          .filter(([, value]) => Number(value) > 0)
          .map(([purchaseItemId, value]) => ({
            purchaseItemId,
            quantityReceived: Number(value),
          })),
      }),
    onSuccess: async (receipt) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.purchase(id) }),
        client.invalidateQueries({ queryKey: queryKeys.receiptsRoot }),
      ]);
      void navigate(`/app/purchasing/receipts/${receipt.id}`, {
        replace: true,
      });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  const eligible = (purchase.data?.items ?? []).filter(
    (item) => item.remainingReceivableQuantity > 0,
  );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Recepción"
        title={`Recibir compra #${purchase.data?.number ?? "…"}`}
        description="Crear el borrador no cambia Inventario. La entrada ocurre únicamente al publicar."
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={create.error ? apiErrorMessage(create.error) : null}
        />
        <div className="form-grid">
          <LocationSelector
            id="receipt-location"
            label="Ubicación destino"
            required
            value={locationId}
            onChange={setLocationId}
          />
          <Field label="Fecha/hora recibida" htmlFor="receipt-date">
            <input
              id="receipt-date"
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </Field>
          <Field label="Notas" htmlFor="receipt-notes">
            <textarea
              id="receipt-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        <PurchaseQuantityTable
          items={eligible}
          quantities={quantities}
          setQuantity={(itemId, value) =>
            setQuantities((current) => ({ ...current, [itemId]: value }))
          }
          mode="receive"
        />
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={
              !eligible.length ||
              !Object.values(quantities).some((value) => Number(value) > 0)
            }
          >
            Crear borrador
          </Button>
        </div>
      </form>
    </div>
  );
}

export function PurchaseReceiptDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({
    queryKey: queryKeys.receipt(id),
    queryFn: () => purchasingApi.receipt(id),
  });
  const post = useMutation({
    mutationFn: () => purchasingApi.postReceipt(id),
    onSuccess: async (receipt) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.receipt(id) }),
        client.invalidateQueries({ queryKey: queryKeys.receiptsRoot }),
        client.invalidateQueries({
          queryKey: queryKeys.purchase(receipt.purchaseId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.purchasesRoot }),
        client.invalidateQueries({ queryKey: queryKeys.payablesRoot }),
        client.invalidateQueries({ queryKey: queryKeys.supplierAccountsRoot }),
        invalidateCommercialSummary(client),
        invalidateInventory(client),
      ]);
      setConfirm(false);
    },
  });
  if (detail.isLoading) return <div className="panel">Cargando recepción…</div>;
  if (!detail.data || detail.error)
    return (
      <FormFeedback
        error={
          detail.error
            ? apiErrorMessage(detail.error)
            : "Recepción no encontrada."
        }
      />
    );
  const row = detail.data;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Recepción de compra"
        title={`Recepción #${row.number}`}
        description={`Compra #${row.purchase.number} · ${row.destinationLocation.code}`}
        actions={
          row.status === "DRAFT" && hasPermission("purchases.receive") ? (
            <Button onClick={() => setConfirm(true)}>Publicar recepción</Button>
          ) : undefined
        }
      />
      <FormFeedback
        success={post.isSuccess ? "Recepción registrada correctamente." : null}
        error={post.error ? apiErrorMessage(post.error) : null}
      />
      <section className="panel detail-card">
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>
              <CommercialStatusBadge status={row.status} />
            </dd>
          </div>
          <div>
            <dt>Ubicación destino</dt>
            <dd>
              {row.destinationLocation.code} · {row.destinationLocation.name}
            </dd>
          </div>
          <div>
            <dt>Fecha recibida</dt>
            <dd>{formatDateTime(row.receivedAt)}</dd>
          </div>
          <div>
            <dt>Notas</dt>
            <dd>{row.notes || "—"}</dd>
          </div>
        </dl>
      </section>
      <DocumentItems
        rows={row.items.map((item) => ({
          id: item.id,
          code: item.purchaseItem.product.code,
          name: item.purchaseItem.product.name,
          quantity: item.quantityReceived,
          location: row.destinationLocation.code,
        }))}
      />
      <Link
        className="button button--ghost"
        to={`/app/purchasing/purchases/${row.purchaseId}`}
      >
        Volver a la compra
      </Link>
      <ConfirmDialog
        open={confirm}
        title="Publicar recepción"
        description="El backend registrará Inventory IN para cada línea en una única transacción. El documento quedará inmutable."
        loading={post.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => post.mutate()}
      />
    </div>
  );
}

export function PurchaseReturnCreatePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<
    Record<string, { quantity: string; locationId: string }>
  >({});
  const purchase = useQuery({
    queryKey: queryKeys.purchase(id),
    queryFn: () => purchasingApi.purchase(id),
  });
  const create = useMutation({
    mutationFn: () =>
      purchasingApi.createReturn(id, {
        reason,
        items: Object.entries(lines)
          .filter(([, line]) => Number(line.quantity) > 0 && line.locationId)
          .map(([purchaseItemId, line]) => ({
            purchaseItemId,
            sourceLocationId: line.locationId,
            quantityReturned: Number(line.quantity),
          })),
      }),
    onSuccess: async (purchaseReturn) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.purchase(id) }),
        client.invalidateQueries({ queryKey: queryKeys.returnsRoot }),
      ]);
      void navigate(`/app/purchasing/returns/${purchaseReturn.id}`, {
        replace: true,
      });
    },
  });
  const eligible = (purchase.data?.items ?? []).filter(
    (item) => item.receivedQuantity - item.returnedQuantity > 0,
  );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Devolución"
        title={`Devolver compra #${purchase.data?.number ?? "…"}`}
        description="Crear el borrador no cambia Inventario ni registra dinero recibido del proveedor."
      />
      <form
        className="panel erp-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <FormFeedback
          error={create.error ? apiErrorMessage(create.error) : null}
        />
        <Field label="Motivo" htmlFor="return-reason" required>
          <textarea
            id="return-reason"
            required
            minLength={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="return-lines">
          {eligible.map((item) => {
            const current = lines[item.id] ?? { quantity: "", locationId: "" };
            const available = item.receivedQuantity - item.returnedQuantity;
            return (
              <section className="form-section" key={item.id}>
                <h2>
                  {item.product.code} · {item.product.name}
                </h2>
                <p>
                  Recibido {item.receivedQuantity} · devuelto{" "}
                  {item.returnedQuantity} · elegible {available}
                </p>
                <div className="form-grid">
                  <LocationSelector
                    id={`return-location-${item.id}`}
                    label="Ubicación origen"
                    required={Number(current.quantity) > 0}
                    value={current.locationId}
                    onChange={(locationId) =>
                      setLines((all) => ({
                        ...all,
                        [item.id]: { ...current, locationId },
                      }))
                    }
                  />
                  <Field
                    label="Cantidad a devolver"
                    htmlFor={`return-quantity-${item.id}`}
                  >
                    <input
                      id={`return-quantity-${item.id}`}
                      type="number"
                      min={0}
                      max={available}
                      step={1}
                      value={current.quantity}
                      onChange={(e) =>
                        setLines((all) => ({
                          ...all,
                          [item.id]: { ...current, quantity: e.target.value },
                        }))
                      }
                    />
                  </Field>
                </div>
              </section>
            );
          })}
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={
              !eligible.length ||
              !Object.values(lines).some(
                (line) => Number(line.quantity) > 0 && line.locationId,
              )
            }
          >
            Crear borrador
          </Button>
        </div>
      </form>
    </div>
  );
}

function PurchaseQuantityTable({
  items,
  quantities,
  setQuantity,
  mode,
}: {
  items: PurchaseItem[];
  quantities: Record<string, string>;
  setQuantity: (id: string, value: string) => void;
  mode: "receive";
}) {
  return (
    <div className="table-scroll" tabIndex={0}>
      <table className="erp-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Ordenado</th>
            <th>Recibido</th>
            <th>Restante</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.product.code}</strong>
                <small>{item.product.name}</small>
              </td>
              <td>{item.orderedQuantity}</td>
              <td>{item.receivedQuantity}</td>
              <td>{item.remainingReceivableQuantity}</td>
              <td>
                <input
                  aria-label={`${mode === "receive" ? "Recibir" : "Cantidad"} ${item.product.code}`}
                  type="number"
                  min={0}
                  max={item.remainingReceivableQuantity}
                  step={1}
                  value={quantities[item.id] ?? ""}
                  onChange={(e) => setQuantity(item.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentItems({
  rows,
}: {
  rows: Array<{
    id: string;
    code: string;
    name: string;
    quantity: number;
    location: string;
  }>;
}) {
  return (
    <section className="panel">
      <h2>Detalle</h2>
      <div className="table-scroll" tabIndex={0}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.code}</strong>
                  <small>{row.name}</small>
                </td>
                <td>{row.quantity}</td>
                <td>{row.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { invalidateInventory };
