import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { inventoryApi, type MovementInput } from "../api/inventory-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  LocationSelector,
  ProductSelector,
} from "../components/EntitySelectors";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type {
  InventoryBalance,
  InventoryMovement,
  InventoryMovementType,
  Location,
  Product,
} from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";
import { formatDateTime } from "../utils/formatters";

export function InventoryPage() {
  const filters = useUrlFilters();
  const params = {
    page: filters.page,
    limit: filters.limit,
    productId: filters.values.productId,
    locationId: filters.values.locationId,
    inStock: filters.values.inStock,
  };
  const list = useQuery({
    queryKey: queryKeys.inventory(params),
    queryFn: () => inventoryApi.balances(params),
  });
  const columns: ErpColumn<InventoryBalance>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (row) => (
        <Link
          className="table-link"
          to={`/app/catalog/products/${row.productId}`}
        >
          <strong>{row.product.code}</strong>
          <small>{row.product.name}</small>
        </Link>
      ),
    },
    {
      key: "location",
      header: "Ubicación",
      cell: (row) => (
        <>
          <strong>{row.location.code}</strong>
          <small>{row.location.name}</small>
        </>
      ),
    },
    {
      key: "quantity",
      header: "Existencia",
      cell: (row) => (
        <strong className={row.quantity === 0 ? "text-warning" : ""}>
          {row.quantity}
        </strong>
      ),
    },
    {
      key: "updated",
      header: "Actualizado",
      cell: (row) => formatDateTime(row.updatedAt),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Almacén"
        title="Inventario"
        description="Saldos autoritativos por producto y ubicación; no existe edición directa."
      />
      <section className="panel filter-bar">
        <ProductSelector
          id="inventory-product-filter"
          label="Producto"
          value={filters.values.productId ?? ""}
          emptyLabel="Todos"
          onChange={(productId) => filters.update({ productId })}
        />
        <LocationSelector
          id="inventory-location-filter"
          label="Ubicación"
          value={filters.values.locationId ?? ""}
          emptyLabel="Todas"
          onChange={(locationId) => filters.update({ locationId })}
        />
        <Field label="Existencia" htmlFor="inventory-stock-filter">
          <select
            id="inventory-stock-filter"
            value={filters.values.inStock ?? ""}
            onChange={(e) => filters.update({ inStock: e.target.value })}
          >
            <option value="">Todas</option>
            <option value="true">Con existencia</option>
            <option value="false">En cero</option>
          </select>
        </Field>
        <div className="filter-actions">
          <Button variant="ghost" onClick={filters.clear}>
            Limpiar
          </Button>
        </div>
      </section>
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyTitle="Sin saldos de inventario"
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}

type ManualMovement = {
  type: Exclude<InventoryMovementType, "TRANSFER">;
  productId: string;
  locationId: string;
  quantity: string;
  reason: string;
};
const blankMovement: ManualMovement = {
  type: "INITIAL",
  productId: "",
  locationId: "",
  quantity: "",
  reason: "",
};
const movementLabels: Record<InventoryMovementType, string> = {
  INITIAL: "Inicial",
  IN: "Entrada manual",
  OUT: "Salida manual",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Transferencia",
};

export function InventoryMovementsPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const filters = useUrlFilters();
  const [from, setFrom] = useState(filters.values.from ?? "");
  const [to, setTo] = useState(filters.values.to ?? "");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ManualMovement>(blankMovement);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedLocation, setSelectedLocation] = useState<Location>();
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const params = {
    page: filters.page,
    limit: filters.limit,
    productId: filters.values.productId,
    locationId: filters.values.locationId,
    type: filters.values.type,
    from: filters.values.from,
    to: filters.values.to,
  };
  const list = useQuery({
    queryKey: queryKeys.movements(params),
    queryFn: () => inventoryApi.movements(params),
  });
  const mutation = useMutation({
    mutationFn: (body: MovementInput) => inventoryApi.createMovement(body),
    onSuccess: async (row) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["inventory"] }),
        client.invalidateQueries({ queryKey: queryKeys.searchRoot }),
      ]);
      setSuccess(
        `${movementLabels[row.type]} registrado. El saldo mostrado se obtuvo del servidor.`,
      );
      setForm(blankMovement);
      setSelectedProduct(undefined);
      setSelectedLocation(undefined);
      setShowForm(false);
      setConfirm(false);
    },
  });
  const payload = (): MovementInput => ({
    type: form.type,
    productId: form.productId,
    quantity: Number(form.quantity),
    ...(form.type === "OUT"
      ? { sourceLocationId: form.locationId }
      : { destinationLocationId: form.locationId }),
    ...(form.reason ? { reason: form.reason } : {}),
  });
  function review(event: FormEvent) {
    event.preventDefault();
    setConfirm(true);
  }
  function applyDates(event: FormEvent) {
    event.preventDefault();
    filters.update({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    });
  }
  const columns: ErpColumn<InventoryMovement>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (row) => formatDateTime(row.createdAt),
    },
    { key: "type", header: "Tipo", cell: (row) => movementLabels[row.type] },
    {
      key: "product",
      header: "Producto",
      cell: (row) => (
        <>
          <strong>{row.product.code}</strong>
          <small>{row.product.name}</small>
        </>
      ),
    },
    {
      key: "route",
      header: "Origen → destino",
      cell: (row) =>
        `${row.sourceLocation?.code ?? "—"} → ${row.destinationLocation?.code ?? "—"}`,
    },
    {
      key: "quantity",
      header: "Cantidad / objetivo",
      cell: (row) => row.quantity,
    },
    {
      key: "balances",
      header: "Saldos",
      cell: (row) => (
        <small>
          {row.sourceQuantityBefore != null
            ? `Origen ${row.sourceQuantityBefore} → ${row.sourceQuantityAfter}`
            : ""}
          {row.destinationQuantityBefore != null
            ? `${row.sourceQuantityBefore != null ? " · " : ""}Destino ${row.destinationQuantityBefore} → ${row.destinationQuantityAfter}`
            : ""}
        </small>
      ),
    },
    {
      key: "reason",
      header: "Motivo / referencia",
      cell: (row) => <small>{row.reason || row.referenceType || "—"}</small>,
    },
    {
      key: "actor",
      header: "Actor",
      cell: (row) => <small>{row.actorId}</small>,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Almacén"
        title="Movimientos de inventario"
        description="Libro trazable de toda mutación de existencias."
        actions={
          hasPermission("inventory.adjust") && !showForm ? (
            <Button onClick={() => setShowForm(true)}>
              Nuevo movimiento manual
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      {showForm ? (
        <form className="panel erp-form" onSubmit={review}>
          <h2>Movimiento manual</h2>
          <p>
            INITIAL, IN y ADJUSTMENT usan ubicación destino; OUT usa ubicación
            origen. El backend valida el saldo.
          </p>
          <FormFeedback
            error={mutation.error ? apiErrorMessage(mutation.error) : null}
          />
          <div className="form-grid">
            <Field label="Tipo" htmlFor="movement-type" required>
              <select
                id="movement-type"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as ManualMovement["type"],
                  })
                }
              >
                <option value="INITIAL">Inicial</option>
                <option value="IN">Entrada manual</option>
                <option value="OUT">Salida manual</option>
                <option value="ADJUSTMENT">Ajuste a saldo objetivo</option>
              </select>
            </Field>
            <ProductSelector
              id="movement-product"
              label="Producto"
              required
              value={form.productId}
              onChange={(productId, product) => {
                setForm({ ...form, productId });
                setSelectedProduct(product);
              }}
            />
            <LocationSelector
              id="movement-location"
              label={
                form.type === "OUT" ? "Ubicación origen" : "Ubicación destino"
              }
              required
              value={form.locationId}
              onChange={(locationId, location) => {
                setForm({ ...form, locationId });
                setSelectedLocation(location);
              }}
            />
            <Field
              label={
                form.type === "ADJUSTMENT" ? "Nuevo saldo objetivo" : "Cantidad"
              }
              htmlFor="movement-quantity"
              required
              hint={
                form.type === "ADJUSTMENT"
                  ? "Puede ser cero."
                  : "Debe ser mayor que cero."
              }
            >
              <input
                id="movement-quantity"
                required
                type="number"
                min={form.type === "ADJUSTMENT" ? 0 : 1}
                step={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field
              label="Motivo"
              htmlFor="movement-reason"
              required={form.type === "ADJUSTMENT"}
            >
              <textarea
                id="movement-reason"
                required={form.type === "ADJUSTMENT"}
                maxLength={500}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Revisar movimiento</Button>
          </div>
        </form>
      ) : null}
      <form className="panel filter-bar" onSubmit={applyDates}>
        <ProductSelector
          id="movement-product-filter"
          label="Producto"
          value={filters.values.productId ?? ""}
          emptyLabel="Todos"
          onChange={(productId) => filters.update({ productId })}
        />
        <LocationSelector
          id="movement-location-filter"
          label="Ubicación"
          value={filters.values.locationId ?? ""}
          emptyLabel="Todas"
          onChange={(locationId) => filters.update({ locationId })}
        />
        <Field label="Tipo" htmlFor="movement-type-filter">
          <select
            id="movement-type-filter"
            value={filters.values.type ?? ""}
            onChange={(e) => filters.update({ type: e.target.value })}
          >
            <option value="">Todos</option>
            {Object.entries(movementLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Desde" htmlFor="movement-from">
          <input
            id="movement-from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Hasta" htmlFor="movement-to">
          <input
            id="movement-to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <div className="filter-actions">
          <Button type="submit">Aplicar fechas</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
              filters.clear();
            }}
          >
            Limpiar
          </Button>
        </div>
      </form>
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyTitle="Sin movimientos"
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
      <ConfirmDialog
        open={confirm}
        title={`Confirmar ${movementLabels[form.type].toLowerCase()}`}
        description={`${selectedProduct?.code ?? "Producto"} · ${form.quantity || 0} ${form.type === "ADJUSTMENT" ? "como nuevo saldo" : "unidades"} ${form.type === "OUT" ? "desde" : "en"} ${selectedLocation?.code ?? "ubicación"}. Esta operación modifica stock y quedará en el historial.`}
        dangerous={form.type === "OUT" || form.type === "ADJUSTMENT"}
        loading={mutation.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => mutation.mutate(payload())}
      />
    </div>
  );
}

type TransferForm = {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: string;
  reason: string;
};
const blankTransfer: TransferForm = {
  productId: "",
  sourceLocationId: "",
  destinationLocationId: "",
  quantity: "",
  reason: "",
};
export function InventoryTransfersPage() {
  const client = useQueryClient();
  const [form, setForm] = useState(blankTransfer);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [sourceLocation, setSourceLocation] = useState<Location>();
  const [destinationLocation, setDestinationLocation] = useState<Location>();
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const source = useQuery({
    queryKey: queryKeys.inventory({
      page: 1,
      limit: 1,
      productId: form.productId,
      locationId: form.sourceLocationId,
    }),
    queryFn: () =>
      inventoryApi.balances({
        page: 1,
        limit: 1,
        productId: form.productId,
        locationId: form.sourceLocationId,
      }),
    enabled: Boolean(form.productId && form.sourceLocationId),
  });
  const destination = useQuery({
    queryKey: queryKeys.inventory({
      page: 1,
      limit: 1,
      productId: form.productId,
      locationId: form.destinationLocationId,
    }),
    queryFn: () =>
      inventoryApi.balances({
        page: 1,
        limit: 1,
        productId: form.productId,
        locationId: form.destinationLocationId,
      }),
    enabled: Boolean(form.productId && form.destinationLocationId),
  });
  const mutation = useMutation({
    mutationFn: () =>
      inventoryApi.createMovement({
        type: "TRANSFER",
        productId: form.productId,
        sourceLocationId: form.sourceLocationId,
        destinationLocationId: form.destinationLocationId,
        quantity: Number(form.quantity),
        ...(form.reason ? { reason: form.reason } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["inventory"] }),
        client.invalidateQueries({ queryKey: queryKeys.searchRoot }),
      ]);
      setSuccess(
        "Transferencia completada atómicamente y registrada en el historial.",
      );
      setForm(blankTransfer);
      setSelectedProduct(undefined);
      setSourceLocation(undefined);
      setDestinationLocation(undefined);
      setConfirm(false);
    },
  });
  const sourceQty = source.data?.data[0]?.quantity ?? 0;
  const destinationQty = destination.data?.data[0]?.quantity ?? 0;
  const quantity = Number(form.quantity) || 0;
  function review(event: FormEvent) {
    event.preventDefault();
    setConfirm(true);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Almacén"
        title="Transferencias"
        description="Traslado atómico entre dos ubicaciones activas; sin actualizaciones optimistas."
      />
      <FormFeedback success={success} />
      <form className="panel erp-form" onSubmit={review}>
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />
        <div className="form-grid">
          <ProductSelector
            id="transfer-product"
            label="Producto"
            required
            value={form.productId}
            onChange={(productId, product) => {
              setForm({ ...form, productId });
              setSelectedProduct(product);
            }}
          />
          <LocationSelector
            id="transfer-source"
            label="Origen"
            required
            value={form.sourceLocationId}
            onChange={(sourceLocationId, location) => {
              setForm({ ...form, sourceLocationId });
              setSourceLocation(location);
            }}
          />
          <LocationSelector
            id="transfer-destination"
            label="Destino"
            required
            value={form.destinationLocationId}
            onChange={(destinationLocationId, location) => {
              setForm({ ...form, destinationLocationId });
              setDestinationLocation(location);
            }}
          />
          <Field label="Cantidad" htmlFor="transfer-quantity" required>
            <input
              id="transfer-quantity"
              required
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Motivo" htmlFor="transfer-reason">
            <textarea
              id="transfer-reason"
              maxLength={500}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
        </div>
        {form.productId &&
        form.sourceLocationId &&
        form.destinationLocationId ? (
          <section className="transfer-preview" aria-live="polite">
            <h2>Vista previa</h2>
            <div>
              <span>
                Origen actual <strong>{sourceQty}</strong>
              </span>
              <span>
                Destino actual <strong>{destinationQty}</strong>
              </span>
            </div>
            <p>
              El servidor bloqueará y validará ambos saldos al confirmar. El
              resultado se mostrará únicamente después de la transacción.
            </p>
          </section>
        ) : null}
        <div className="form-actions">
          <Button
            type="submit"
            disabled={form.sourceLocationId === form.destinationLocationId}
          >
            Revisar transferencia
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirm}
        title="Confirmar transferencia de inventario"
        description={`${selectedProduct?.code ?? "Producto"}: ${quantity} unidades de ${sourceLocation?.code ?? "origen"} a ${destinationLocation?.code ?? "destino"}. La operación es atómica y no se puede editar después.`}
        confirmLabel="Transferir"
        dangerous
        loading={mutation.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => mutation.mutate()}
      />
    </div>
  );
}
