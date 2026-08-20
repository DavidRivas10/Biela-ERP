import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { compatibilityApi } from "../api/compatibility-api";
import { vehiclesApi } from "../api/vehicles-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  ProductSelector,
  VehicleSelector,
} from "../components/EntitySelectors";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import type { Compatibility } from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";

export function CompatibilityPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const filters = useUrlFilters();
  const canManage = hasPermission("compatibilities.manage");
  const params = {
    page: filters.page,
    limit: filters.limit,
    productId: filters.values.productId,
    vehicleId: filters.values.vehicleId,
    active: filters.values.active,
  };
  const list = useQuery({
    queryKey: queryKeys.compatibilities(params),
    queryFn: () => compatibilityApi.list(params),
  });
  const [vehicleBrandId, setVehicleBrandId] = useState("");
  const [vehicleModelId, setVehicleModelId] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleEngine, setVehicleEngine] = useState("");
  const vehicleBrands = useQuery({
    queryKey: queryKeys.vehicleBrands,
    queryFn: vehiclesApi.brands,
    enabled: canManage,
  });
  const vehicleModels = useQuery({
    queryKey: queryKeys.vehicleModels(vehicleBrandId),
    queryFn: () => vehiclesApi.models(vehicleBrandId),
    enabled: canManage && Boolean(vehicleBrandId),
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    productId: filters.values.productId ?? "",
    vehicleId: filters.values.vehicleId ?? "",
    notes: "",
  });
  const [target, setTarget] = useState<Compatibility | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.compatibilitiesRoot }),
      client.invalidateQueries({ queryKey: queryKeys.searchRoot }),
    ]);
  const create = useMutation({
    mutationFn: () =>
      compatibilityApi.create({ ...form, notes: form.notes || undefined }),
    onSuccess: async () => {
      await invalidate();
      setCreating(false);
      setForm({ productId: "", vehicleId: "", notes: "" });
      setSuccess("Compatibilidad creada correctamente.");
    },
  });
  const lifecycle = useMutation({
    mutationFn: (row: Compatibility) =>
      compatibilityApi.update(row.id, { active: !row.active }),
    onSuccess: async (_, row) => {
      await invalidate();
      setSuccess(`Compatibilidad ${row.active ? "desactivada" : "activada"}.`);
      setTarget(null);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  const columns: ErpColumn<Compatibility>[] = [
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
      key: "vehicle",
      header: "Vehículo",
      cell: (row) => (
        <Link className="table-link" to={`/app/vehicles/${row.vehicleId}`}>
          <strong>
            {row.vehicle.model.brand.name} {row.vehicle.model.name}
          </strong>
          <small>
            {row.vehicle.year} · {row.vehicle.engine}
          </small>
        </Link>
      ),
    },
    { key: "notes", header: "Notas", cell: (row) => row.notes || "—" },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: Compatibility) => (
              <Button variant="ghost" onClick={() => setTarget(row)}>
                {row.active ? "Desactivar" : "Activar"}
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vehículos"
        title="Compatibilidad producto ↔ vehículo"
        description="Cada relación es explícita; la interfaz no infiere aplicaciones."
        actions={
          canManage && !creating ? (
            <Button onClick={() => setCreating(true)}>
              Nueva compatibilidad
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      {creating ? (
        <form className="panel erp-form" onSubmit={submit}>
          <h2>Crear compatibilidad</h2>
          <p>
            Los selectores consultan resultados activos y acotados. El servidor
            rechazará una relación duplicada.
          </p>
          <FormFeedback
            error={create.error ? apiErrorMessage(create.error) : null}
          />
          <div className="form-grid">
            <ProductSelector
              id="compat-product"
              label="Producto"
              required
              value={form.productId}
              onChange={(productId) => setForm({ ...form, productId })}
            />
            <Field
              label="Marca vehicular"
              htmlFor="compat-vehicle-brand"
              required
            >
              <select
                id="compat-vehicle-brand"
                required
                value={vehicleBrandId}
                onChange={(e) => {
                  setVehicleBrandId(e.target.value);
                  setVehicleModelId("");
                  setVehicleYear("");
                  setVehicleEngine("");
                  setForm({ ...form, vehicleId: "" });
                }}
              >
                <option value="">Seleccionar</option>
                {vehicleBrands.data
                  ?.filter((row) => row.active)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Modelo vehicular" htmlFor="compat-vehicle-model">
              <select
                id="compat-vehicle-model"
                value={vehicleModelId}
                onChange={(e) => {
                  setVehicleModelId(e.target.value);
                  setForm({ ...form, vehicleId: "" });
                }}
              >
                <option value="">Todos los modelos de la marca</option>
                {vehicleModels.data
                  ?.filter((row) => row.active)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Año vehicular" htmlFor="compat-vehicle-year">
              <input
                id="compat-vehicle-year"
                type="number"
                min={1886}
                max={2100}
                value={vehicleYear}
                onChange={(event) => {
                  setVehicleYear(event.target.value);
                  setForm({ ...form, vehicleId: "" });
                }}
              />
            </Field>
            <Field
              label="Motor contiene"
              htmlFor="compat-vehicle-engine"
              hint="Filtro aplicado por el servidor."
            >
              <input
                id="compat-vehicle-engine"
                value={vehicleEngine}
                onChange={(event) => {
                  setVehicleEngine(event.target.value);
                  setForm({ ...form, vehicleId: "" });
                }}
              />
            </Field>
            <VehicleSelector
              id="compat-vehicle"
              label="Vehículo"
              required
              enabled={Boolean(vehicleBrandId)}
              value={form.vehicleId}
              filters={{
                brandId: vehicleBrandId,
                modelId: vehicleModelId,
                year: vehicleYear,
                engine: vehicleEngine,
              }}
              onChange={(vehicleId) => setForm({ ...form, vehicleId })}
            />
            <Field label="Notas" htmlFor="compat-notes">
              <textarea
                id="compat-notes"
                maxLength={500}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              Crear relación
            </Button>
          </div>
        </form>
      ) : null}
      <section className="panel filter-bar">
        <Field label="Producto exacto" htmlFor="compat-product-filter">
          <input
            id="compat-product-filter"
            placeholder="UUID"
            value={filters.values.productId ?? ""}
            onChange={(e) => filters.update({ productId: e.target.value })}
          />
        </Field>
        <Field label="Vehículo exacto" htmlFor="compat-vehicle-filter">
          <input
            id="compat-vehicle-filter"
            placeholder="UUID"
            value={filters.values.vehicleId ?? ""}
            onChange={(e) => filters.update({ vehicleId: e.target.value })}
          />
        </Field>
        <Field label="Estado" htmlFor="compat-active-filter">
          <select
            id="compat-active-filter"
            value={filters.values.active ?? ""}
            onChange={(e) => filters.update({ active: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
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
          emptyTitle="Sin compatibilidades"
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
      <ConfirmDialog
        open={Boolean(target)}
        title={`${target?.active ? "Desactivar" : "Activar"} compatibilidad`}
        description="La relación conservará su historial y podrá volver a activarse."
        dangerous={target?.active}
        loading={lifecycle.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target) lifecycle.mutate(target);
        }}
      />
    </div>
  );
}
