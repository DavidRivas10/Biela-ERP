import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { compatibilityApi } from "../api/compatibility-api";
import { vehiclesApi, type VehicleInput } from "../api/vehicles-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import { invalidateVehicleReferenceIntegration } from "../query/invalidation";
import type {
  NestedCompatibility,
  Product,
  Vehicle,
  VehicleBrand,
  VehicleModel,
} from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";

type BasicEditor = { id?: string; code: string; name: string; active: boolean };
export function VehicleBrandsPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.vehicleBrands,
    queryFn: vehiclesApi.brands,
  });
  const [editor, setEditor] = useState<BasicEditor | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: BasicEditor) =>
      value.id
        ? vehiclesApi.updateBrand(value.id, value)
        : vehiclesApi.createBrand(value),
    onSuccess: async (_, value) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.vehicleBrands }),
        invalidateVehicleReferenceIntegration(client),
      ]);
      setSuccess(`Marca ${value.id ? "actualizada" : "creada"}.`);
      setEditor(null);
    },
  });
  const columns: ErpColumn<VehicleBrand>[] = [
    { key: "code", header: "Código", cell: (row) => <code>{row.code}</code> },
    { key: "name", header: "Nombre", cell: (row) => row.name },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    ...(hasPermission("vehicles.update")
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: VehicleBrand) => (
              <Button
                variant="ghost"
                onClick={() =>
                  setEditor({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    active: row.active,
                  })
                }
              >
                Editar
              </Button>
            ),
          },
        ]
      : []),
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (editor) mutation.mutate(editor);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vehículos"
        title="Marcas de vehículos"
        description="Fabricantes para la jerarquía de aplicaciones vehiculares."
        actions={
          hasPermission("vehicles.create") && !editor ? (
            <Button
              onClick={() => setEditor({ code: "", name: "", active: true })}
            >
              Nueva marca
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      {editor ? (
        <form className="panel erp-form" onSubmit={submit}>
          <h2>{editor.id ? "Editar" : "Crear"} marca</h2>
          <FormFeedback
            error={mutation.error ? apiErrorMessage(mutation.error) : null}
          />
          <div className="form-grid">
            <Field label="Código" htmlFor="vehicle-brand-code" required>
              <input
                id="vehicle-brand-code"
                required
                minLength={2}
                maxLength={60}
                value={editor.code}
                onChange={(e) => setEditor({ ...editor, code: e.target.value })}
              />
            </Field>
            <Field label="Nombre" htmlFor="vehicle-brand-name" required>
              <input
                id="vehicle-brand-name"
                required
                minLength={2}
                maxLength={120}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(e) =>
                  setEditor({ ...editor, active: e.target.checked })
                }
              />{" "}
              Activa
            </label>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditor(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={query.data}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          error={query.error ? apiErrorMessage(query.error) : undefined}
        />
      </section>
    </div>
  );
}

type ModelEditor = {
  id?: string;
  brandId: string;
  code: string;
  name: string;
  active: boolean;
};
export function VehicleModelsPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const filters = useUrlFilters();
  const brands = useQuery({
    queryKey: queryKeys.vehicleBrands,
    queryFn: vehiclesApi.brands,
  });
  const models = useQuery({
    queryKey: queryKeys.vehicleModels(filters.values.brandId),
    queryFn: () => vehiclesApi.models(filters.values.brandId),
  });
  const [editor, setEditor] = useState<ModelEditor | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: ModelEditor) =>
      value.id
        ? vehiclesApi.updateModel(value.id, value)
        : vehiclesApi.createModel(value),
    onSuccess: async (_, value) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.vehicleModelsRoot }),
        invalidateVehicleReferenceIntegration(client),
      ]);
      setSuccess(`Modelo ${value.id ? "actualizado" : "creado"}.`);
      setEditor(null);
    },
  });
  const columns: ErpColumn<VehicleModel>[] = [
    { key: "brand", header: "Marca", cell: (row) => row.brand.name },
    { key: "code", header: "Código", cell: (row) => <code>{row.code}</code> },
    { key: "name", header: "Modelo", cell: (row) => row.name },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    ...(hasPermission("vehicles.update")
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: VehicleModel) => (
              <Button
                variant="ghost"
                onClick={() =>
                  setEditor({
                    id: row.id,
                    brandId: row.brandId,
                    code: row.code,
                    name: row.name,
                    active: row.active,
                  })
                }
              >
                Editar
              </Button>
            ),
          },
        ]
      : []),
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (editor) mutation.mutate(editor);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vehículos"
        title="Modelos de vehículos"
        description="Modelos asociados a una marca específica."
        actions={
          hasPermission("vehicles.create") && !editor ? (
            <Button
              onClick={() =>
                setEditor({ brandId: "", code: "", name: "", active: true })
              }
            >
              Nuevo modelo
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      <section className="panel filter-bar">
        <Field label="Marca" htmlFor="model-brand-filter">
          <select
            id="model-brand-filter"
            value={filters.values.brandId ?? ""}
            onChange={(e) => filters.update({ brandId: e.target.value })}
          >
            <option value="">Todas</option>
            {brands.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
      </section>
      {editor ? (
        <form className="panel erp-form" onSubmit={submit}>
          <h2>{editor.id ? "Editar" : "Crear"} modelo</h2>
          <FormFeedback
            error={mutation.error ? apiErrorMessage(mutation.error) : null}
          />
          <div className="form-grid">
            <Field label="Marca" htmlFor="model-brand" required>
              <select
                id="model-brand"
                required
                value={editor.brandId}
                onChange={(e) =>
                  setEditor({ ...editor, brandId: e.target.value })
                }
              >
                <option value="">Seleccionar</option>
                {brands.data
                  ?.filter((row) => row.active || row.id === editor.brandId)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Código" htmlFor="model-code" required>
              <input
                id="model-code"
                required
                minLength={2}
                maxLength={60}
                value={editor.code}
                onChange={(e) => setEditor({ ...editor, code: e.target.value })}
              />
            </Field>
            <Field label="Nombre" htmlFor="model-name" required>
              <input
                id="model-name"
                required
                minLength={2}
                maxLength={120}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(e) =>
                  setEditor({ ...editor, active: e.target.checked })
                }
              />{" "}
              Activo
            </label>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditor(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={models.data}
          rowKey={(row) => row.id}
          loading={models.isLoading}
          error={models.error ? apiErrorMessage(models.error) : undefined}
        />
      </section>
    </div>
  );
}

export function VehiclesPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const queryParams = {
    page: filters.page,
    limit: filters.limit,
    brandId: filters.values.brandId,
    modelId: filters.values.modelId,
    year: filters.values.year,
    engine: filters.values.engine,
    active: filters.values.active,
  };
  const vehicles = useQuery({
    queryKey: queryKeys.vehicles(queryParams),
    queryFn: () => vehiclesApi.vehicles(queryParams),
  });
  const brands = useQuery({
    queryKey: queryKeys.vehicleBrands,
    queryFn: vehiclesApi.brands,
  });
  const models = useQuery({
    queryKey: queryKeys.vehicleModels(filters.values.brandId),
    queryFn: () => vehiclesApi.models(filters.values.brandId),
  });
  const columns: ErpColumn<Vehicle>[] = [
    {
      key: "vehicle",
      header: "Vehículo",
      cell: (row) => (
        <Link className="table-link" to={`/app/vehicles/${row.id}`}>
          {row.model.brand.name} {row.model.name}
        </Link>
      ),
    },
    { key: "year", header: "Año", cell: (row) => row.year },
    { key: "engine", header: "Motor", cell: (row) => row.engine },
    {
      key: "detail",
      header: "Generación / versión",
      cell: (row) =>
        [row.generation, row.trim].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      header: "Acciones",
      cell: (row) => (
        <div className="row-actions">
          <Link className="button button--ghost" to={`/app/vehicles/${row.id}`}>
            Ver
          </Link>
          {hasPermission("vehicles.update") ? (
            <Link
              className="button button--ghost"
              to={`/app/vehicles/${row.id}/edit`}
            >
              Editar
            </Link>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vehículos"
        title="Vehículos"
        description="Variantes determinísticas por modelo, año y motor."
        actions={
          hasPermission("vehicles.create") ? (
            <Link className="button button--primary" to="/app/vehicles/new">
              Nuevo vehículo
            </Link>
          ) : undefined
        }
      />
      <section className="panel filter-bar">
        <Field label="Marca" htmlFor="vehicle-brand-filter">
          <select
            id="vehicle-brand-filter"
            value={filters.values.brandId ?? ""}
            onChange={(e) =>
              filters.update({ brandId: e.target.value, modelId: undefined })
            }
          >
            <option value="">Todas</option>
            {brands.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modelo" htmlFor="vehicle-model-filter">
          <select
            id="vehicle-model-filter"
            value={filters.values.modelId ?? ""}
            onChange={(e) => filters.update({ modelId: e.target.value })}
          >
            <option value="">Todos</option>
            {models.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Año" htmlFor="vehicle-year-filter">
          <input
            id="vehicle-year-filter"
            type="number"
            min={1886}
            max={2100}
            value={filters.values.year ?? ""}
            onChange={(e) => filters.update({ year: e.target.value })}
          />
        </Field>
        <Field label="Motor" htmlFor="vehicle-engine-filter">
          <input
            id="vehicle-engine-filter"
            value={filters.values.engine ?? ""}
            onChange={(e) => filters.update({ engine: e.target.value })}
          />
        </Field>
        <Field label="Estado" htmlFor="vehicle-active-filter">
          <select
            id="vehicle-active-filter"
            value={filters.values.active ?? ""}
            onChange={(e) => filters.update({ active: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
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
          rows={vehicles.data?.data}
          rowKey={(row) => row.id}
          loading={vehicles.isLoading}
          error={vehicles.error ? apiErrorMessage(vehicles.error) : undefined}
          onRetry={() => void vehicles.refetch()}
          emptyTitle="No se encontraron vehículos"
        />
        <Pagination
          meta={vehicles.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}

type VehicleFormState = {
  brandId: string;
  modelId: string;
  year: string;
  engine: string;
  generation: string;
  trim: string;
  active: boolean;
};
const blankVehicle: VehicleFormState = {
  brandId: "",
  modelId: "",
  year: "",
  engine: "",
  generation: "",
  trim: "",
  active: true,
};
export function VehicleFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState(blankVehicle);
  const vehicle = useQuery({
    queryKey: queryKeys.vehicle(id ?? ""),
    queryFn: () => vehiclesApi.vehicle(id!),
    enabled: editing,
  });
  const brands = useQuery({
    queryKey: queryKeys.vehicleBrands,
    queryFn: vehiclesApi.brands,
  });
  const models = useQuery({
    queryKey: queryKeys.vehicleModels(form.brandId),
    queryFn: () => vehiclesApi.models(form.brandId),
    enabled: Boolean(form.brandId),
  });
  useEffect(() => {
    if (!vehicle.data) return;
    // Hydrate the controlled editor exactly when the asynchronous record arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      brandId: vehicle.data.model.brandId,
      modelId: vehicle.data.modelId,
      year: String(vehicle.data.year),
      engine: vehicle.data.engine,
      generation: vehicle.data.generation ?? "",
      trim: vehicle.data.trim ?? "",
      active: vehicle.data.active,
    });
  }, [vehicle.data]);
  const mutation = useMutation({
    mutationFn: (body: VehicleInput) =>
      editing
        ? vehiclesApi.updateVehicle(id!, body)
        : vehiclesApi.createVehicle(body),
    onSuccess: async (saved) => {
      await invalidateVehicleReferenceIntegration(client);
      void navigate(`/app/vehicles/${saved.id}`, { replace: true });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      modelId: form.modelId,
      year: Number(form.year),
      engine: form.engine,
      ...(form.generation || editing ? { generation: form.generation } : {}),
      ...(form.trim || editing ? { trim: form.trim } : {}),
      active: form.active,
    });
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vehículos"
        title={editing ? "Editar vehículo" : "Nuevo vehículo"}
        description="El año permitido por contrato está entre 1886 y 2100."
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={
            mutation.error
              ? apiErrorMessage(mutation.error)
              : vehicle.error
                ? apiErrorMessage(vehicle.error)
                : null
          }
        />
        <div className="form-grid">
          <Field label="Marca" htmlFor="vehicle-brand" required>
            <select
              id="vehicle-brand"
              required
              value={form.brandId}
              onChange={(e) =>
                setForm({ ...form, brandId: e.target.value, modelId: "" })
              }
            >
              <option value="">Seleccionar</option>
              {brands.data
                ?.filter((row) => row.active || row.id === form.brandId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Modelo" htmlFor="vehicle-model" required>
            <select
              id="vehicle-model"
              required
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
            >
              <option value="">Seleccionar</option>
              {models.data
                ?.filter((row) => row.active || row.id === form.modelId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Año" htmlFor="vehicle-year" required>
            <input
              id="vehicle-year"
              required
              type="number"
              min={1886}
              max={2100}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
          <Field label="Motor" htmlFor="vehicle-engine" required>
            <input
              id="vehicle-engine"
              required
              minLength={1}
              maxLength={80}
              value={form.engine}
              onChange={(e) => setForm({ ...form, engine: e.target.value })}
            />
          </Field>
          <Field label="Generación" htmlFor="vehicle-generation">
            <input
              id="vehicle-generation"
              maxLength={80}
              value={form.generation}
              onChange={(e) => setForm({ ...form, generation: e.target.value })}
            />
          </Field>
          <Field label="Versión" htmlFor="vehicle-trim">
            <input
              id="vehicle-trim"
              maxLength={80}
              value={form.trim}
              onChange={(e) => setForm({ ...form, trim: e.target.value })}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Vehículo activo
          </label>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar vehículo
          </Button>
        </div>
      </form>
    </div>
  );
}

export function VehicleDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const productsParams = { page: productsPage, limit: 20 };
  const vehicle = useQuery({
    queryKey: queryKeys.vehicle(id),
    queryFn: () => vehiclesApi.vehicle(id),
  });
  const compatible = useQuery({
    queryKey: queryKeys.vehicleProducts(id, productsParams),
    queryFn: () => compatibilityApi.vehicleProducts(id, productsParams),
    enabled: hasPermission("compatibilities.read"),
  });
  const lifecycle = useMutation({
    mutationFn: () => vehiclesApi.setVehicleActive(id, !vehicle.data?.active),
    onSuccess: async () => {
      await invalidateVehicleReferenceIntegration(client);
      setConfirm(false);
    },
  });
  if (vehicle.isLoading) return <div className="panel">Cargando vehículo…</div>;
  if (!vehicle.data || vehicle.error)
    return (
      <div className="panel">
        <FormFeedback
          error={
            vehicle.error
              ? apiErrorMessage(vehicle.error)
              : "Vehículo no encontrado."
          }
        />
      </div>
    );
  const row = vehicle.data;
  const productColumns: ErpColumn<
    Product & { compatibility: NestedCompatibility }
  >[] = [
    {
      key: "code",
      header: "Código",
      cell: (item) => (
        <Link className="table-link" to={`/app/catalog/products/${item.id}`}>
          {item.code}
        </Link>
      ),
    },
    { key: "name", header: "Producto", cell: (item) => item.name },
    {
      key: "notes",
      header: "Notas",
      cell: (item) => item.compatibility.notes || "—",
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vehículo"
        title={`${row.model.brand.name} ${row.model.name} · ${row.year}`}
        description={`Motor ${row.engine}`}
        actions={
          hasPermission("vehicles.update") ? (
            <div className="row-actions">
              <Link
                className="button button--secondary"
                to={`/app/vehicles/${id}/edit`}
              >
                Editar
              </Link>
              <Button
                variant={row.active ? "danger" : "primary"}
                onClick={() => setConfirm(true)}
              >
                {row.active ? "Desactivar" : "Activar"}
              </Button>
            </div>
          ) : undefined
        }
      />
      <section className="panel detail-card">
        <h2>Variante vehicular</h2>
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>
              <StatusBadge active={row.active} />
            </dd>
          </div>
          <div>
            <dt>Marca</dt>
            <dd>{row.model.brand.name}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{row.model.name}</dd>
          </div>
          <div>
            <dt>Año</dt>
            <dd>{row.year}</dd>
          </div>
          <div>
            <dt>Motor</dt>
            <dd>{row.engine}</dd>
          </div>
          <div>
            <dt>Generación</dt>
            <dd>{row.generation || "—"}</dd>
          </div>
          <div>
            <dt>Versión</dt>
            <dd>{row.trim || "—"}</dd>
          </div>
        </dl>
      </section>
      {hasPermission("compatibilities.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Productos compatibles</h2>
              <p>Relaciones explícitas activas.</p>
            </div>
            <Link
              className="button button--ghost"
              to={`/app/compatibility?vehicleId=${id}`}
            >
              Administrar
            </Link>
          </div>
          <ErpTable
            columns={productColumns}
            rows={compatible.data?.data}
            rowKey={(item) => item.id}
            loading={compatible.isLoading}
            error={
              compatible.error ? apiErrorMessage(compatible.error) : undefined
            }
          />
          <Pagination
            meta={compatible.data?.meta}
            onPageChange={setProductsPage}
          />
        </section>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={`${row.active ? "Desactivar" : "Activar"} vehículo`}
        description={`La variante quedará ${row.active ? "inactiva para nuevas relaciones" : "activa"}; su historial se conserva.`}
        dangerous={row.active}
        confirmLabel={row.active ? "Desactivar" : "Activar"}
        loading={lifecycle.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => lifecycle.mutate()}
      />
    </div>
  );
}
