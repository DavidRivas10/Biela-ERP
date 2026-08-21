import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { catalogApi, type ProductInput } from "../api/catalog-api";
import { compatibilityApi } from "../api/compatibility-api";
import { inventoryApi } from "../api/inventory-api";
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
import { invalidateProductReferenceIntegration } from "../query/invalidation";
import type {
  InventoryBalance,
  NestedCompatibility,
  Product,
  Vehicle,
} from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";
import { formatDateTime, formatMoney } from "../utils/formatters";

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const query = {
    page: filters.page,
    limit: filters.limit,
    search: filters.values.search,
    categoryId: filters.values.categoryId,
    brandId: filters.values.brandId,
    active: filters.values.active,
  };
  const products = useQuery({
    queryKey: queryKeys.products(query),
    queryFn: () => catalogApi.products(query),
  });
  const categories = useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: catalogApi.categories,
  });
  const brands = useQuery({
    queryKey: queryKeys.productBrands,
    queryFn: catalogApi.brands,
  });
  const columns: ErpColumn<Product>[] = [
    {
      key: "code",
      header: "Código",
      cell: (row) => (
        <Link className="table-link" to={`/app/catalog/products/${row.id}`}>
          {row.code}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Producto",
      cell: (row) => (
        <>
          <strong>{row.name}</strong>
          <small>{row.description || "Sin descripción"}</small>
        </>
      ),
    },
    { key: "category", header: "Categoría", cell: (row) => row.category.name },
    { key: "brand", header: "Marca", cell: (row) => row.brand.name },
    {
      key: "price",
      header: "Precio sugerido",
      cell: (row) =>
        row.defaultSalePrice ? formatMoney(row.defaultSalePrice) : "—",
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
          <Link
            className="button button--ghost"
            to={`/app/catalog/products/${row.id}`}
          >
            Ver
          </Link>
          {hasPermission("products.update") ? (
            <Link
              className="button button--ghost"
              to={`/app/catalog/products/${row.id}/edit`}
            >
              Editar
            </Link>
          ) : null}
        </div>
      ),
    },
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    filters.update({ search });
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        description="Datos maestros de producto; el inventario se administra por ubicación."
        actions={
          hasPermission("products.create") ? (
            <Link
              className="button button--primary"
              to="/app/catalog/products/new"
            >
              Nuevo producto
            </Link>
          ) : undefined
        }
      />
      <form
        className="panel filter-bar"
        onSubmit={submit}
        aria-label="Filtros de productos"
      >
        <Field label="Buscar" htmlFor="product-search">
          <input
            id="product-search"
            placeholder="Código, nombre o descripción"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Categoría" htmlFor="product-category-filter">
          <select
            id="product-category-filter"
            value={filters.values.categoryId ?? ""}
            onChange={(e) => filters.update({ categoryId: e.target.value })}
          >
            <option value="">Todas</option>
            {categories.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marca" htmlFor="product-brand-filter">
          <select
            id="product-brand-filter"
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
        <Field label="Estado" htmlFor="product-active-filter">
          <select
            id="product-active-filter"
            value={filters.values.active ?? ""}
            onChange={(e) => filters.update({ active: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </Field>
        <div className="filter-actions">
          <Button type="submit">Aplicar</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
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
          rows={products.data?.data}
          rowKey={(row) => row.id}
          loading={products.isLoading}
          error={products.error ? apiErrorMessage(products.error) : undefined}
          onRetry={() => void products.refetch()}
          emptyTitle="No se encontraron productos"
        />
        <Pagination
          meta={products.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}

interface ProductFormState {
  code: string;
  name: string;
  description: string;
  defaultSalePrice: string;
  categoryId: string;
  brandId: string;
  active: boolean;
  attributes: Record<string, string>;
}
const emptyProduct: ProductFormState = {
  code: "",
  name: "",
  description: "",
  defaultSalePrice: "",
  categoryId: "",
  brandId: "",
  active: true,
  attributes: {},
};

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const editing = Boolean(id);
  const [form, setForm] = useState<ProductFormState>(emptyProduct);
  const categories = useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: catalogApi.categories,
  });
  const brands = useQuery({
    queryKey: queryKeys.productBrands,
    queryFn: catalogApi.brands,
  });
  const product = useQuery({
    queryKey: queryKeys.product(id ?? ""),
    queryFn: () => catalogApi.product(id!),
    enabled: editing,
  });
  const definitions = useQuery({
    queryKey: queryKeys.productAttributes(form.categoryId || "all"),
    queryFn: () => catalogApi.attributes(form.categoryId),
    enabled: Boolean(form.categoryId),
  });
  useEffect(() => {
    if (!product.data) return;
    // Hydrate the controlled editor exactly when the asynchronous record arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      code: product.data.code,
      name: product.data.name,
      description: product.data.description ?? "",
      defaultSalePrice: product.data.defaultSalePrice ?? "",
      categoryId: product.data.categoryId,
      brandId: product.data.brandId,
      active: product.data.active,
      attributes: Object.fromEntries(
        product.data.attributes.map((value) => [
          value.definitionId,
          value.value,
        ]),
      ),
    });
  }, [product.data]);
  const mutation = useMutation({
    mutationFn: (body: ProductInput) =>
      editing
        ? catalogApi.updateProduct(id!, body)
        : catalogApi.createProduct(body),
    onSuccess: async (saved) => {
      await invalidateProductReferenceIntegration(client);
      void navigate(`/app/catalog/products/${saved.id}`, { replace: true });
    },
  });
  const visibleDefinitions =
    definitions.data?.filter(
      (definition) =>
        definition.active || form.attributes[definition.id] !== undefined,
    ) ?? [];
  function submit(event: FormEvent) {
    event.preventDefault();
    const body: ProductInput = {
      code: form.code,
      name: form.name,
      categoryId: form.categoryId,
      brandId: form.brandId,
      active: form.active,
      ...(form.description || editing ? { description: form.description } : {}),
      ...(form.defaultSalePrice || editing
        ? { defaultSalePrice: form.defaultSalePrice }
        : {}),
      attributes: visibleDefinitions
        .filter((definition) => form.attributes[definition.id]?.trim())
        .map((definition) => ({
          definitionId: definition.id,
          value: form.attributes[definition.id].trim(),
        })),
    };
    mutation.mutate(body);
  }
  if (editing && product.isLoading)
    return <div className="panel">Cargando producto…</div>;
  if (product.error)
    return (
      <div className="panel">
        <FormFeedback error={apiErrorMessage(product.error)} />
      </div>
    );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catálogo"
        title={editing ? "Editar producto" : "Nuevo producto"}
        description="El precio se envía como texto decimal exacto y no altera documentos históricos."
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />
        <div className="form-grid">
          <Field label="Código" htmlFor="product-code" required>
            <input
              id="product-code"
              required
              minLength={2}
              maxLength={80}
              pattern="[A-Za-z0-9][A-Za-z0-9._/-]*"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="Nombre" htmlFor="product-name" required>
            <input
              id="product-name"
              required
              minLength={2}
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Categoría" htmlFor="product-category" required>
            <select
              id="product-category"
              required
              value={form.categoryId}
              onChange={(e) =>
                setForm({ ...form, categoryId: e.target.value, attributes: {} })
              }
            >
              <option value="">Seleccionar</option>
              {categories.data
                ?.filter((row) => row.active || row.id === form.categoryId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Marca" htmlFor="product-brand" required>
            <select
              id="product-brand"
              required
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
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
          <Field
            label="Precio de venta sugerido"
            htmlFor="product-price"
            hint="Hasta 4 decimales. El contrato actual no acepta null para borrar un precio ya definido."
          >
            <input
              id="product-price"
              inputMode="decimal"
              pattern="\d+(\.\d{1,4})?"
              value={form.defaultSalePrice}
              onChange={(e) =>
                setForm({ ...form, defaultSalePrice: e.target.value })
              }
            />
          </Field>
          <Field label="Descripción" htmlFor="product-description">
            <textarea
              id="product-description"
              maxLength={1000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Producto activo
          </label>
        </div>
        {form.categoryId ? (
          <fieldset className="form-section">
            <legend>Atributos controlados</legend>
            {definitions.isLoading ? (
              <p>Cargando atributos…</p>
            ) : visibleDefinitions.length ? (
              <div className="form-grid">
                {visibleDefinitions.map((definition) => (
                  <Field
                    key={definition.id}
                    label={`${definition.name}${definition.unit ? ` (${definition.unit})` : ""}`}
                    htmlFor={`attribute-${definition.id}`}
                    required={definition.required}
                  >
                    {definition.valueType === "BOOLEAN" ? (
                      <select
                        id={`attribute-${definition.id}`}
                        required={definition.required}
                        value={form.attributes[definition.id] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            attributes: {
                              ...form.attributes,
                              [definition.id]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Seleccionar</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        id={`attribute-${definition.id}`}
                        type={
                          definition.valueType === "NUMBER" ? "number" : "text"
                        }
                        required={definition.required}
                        maxLength={250}
                        value={form.attributes[definition.id] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            attributes: {
                              ...form.attributes,
                              [definition.id]: e.target.value,
                            },
                          })
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
            ) : (
              <p>Esta categoría no tiene atributos activos.</p>
            )}
          </fieldset>
        ) : null}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar producto
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const inventoryParams = { page: inventoryPage, limit: 20 };
  const vehicleParams = { page: vehiclesPage, limit: 20 };
  const product = useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => catalogApi.product(id),
  });
  const inventory = useQuery({
    queryKey: queryKeys.productInventory(id, inventoryParams),
    queryFn: () => inventoryApi.productBalances(id, inventoryParams),
    enabled: hasPermission("inventory.read"),
  });
  const compatible = useQuery({
    queryKey: queryKeys.productVehicles(id, vehicleParams),
    queryFn: () => compatibilityApi.productVehicles(id, vehicleParams),
    enabled: hasPermission("compatibilities.read"),
  });
  const lifecycle = useMutation({
    mutationFn: () => catalogApi.setProductActive(id, !product.data?.active),
    onSuccess: async () => {
      await invalidateProductReferenceIntegration(client);
      setConfirm(false);
    },
  });
  if (product.isLoading) return <div className="panel">Cargando producto…</div>;
  if (!product.data || product.error)
    return (
      <div className="panel">
        <FormFeedback
          error={
            product.error
              ? apiErrorMessage(product.error)
              : "Producto no encontrado."
          }
        />
      </div>
    );
  const row = product.data;
  const inventoryColumns: ErpColumn<InventoryBalance>[] = [
    {
      key: "location",
      header: "Ubicación",
      cell: (item) => (
        <>
          <strong>{item.location.code}</strong>
          <small>{item.location.name}</small>
        </>
      ),
    },
    { key: "quantity", header: "Existencia", cell: (item) => item.quantity },
  ];
  const vehicleColumns: ErpColumn<
    Vehicle & { compatibility: NestedCompatibility }
  >[] = [
    {
      key: "vehicle",
      header: "Vehículo",
      cell: (item) => `${item.model.brand.name} ${item.model.name}`,
    },
    { key: "year", header: "Año", cell: (item) => item.year },
    { key: "engine", header: "Motor", cell: (item) => item.engine },
    {
      key: "notes",
      header: "Notas",
      cell: (item) => item.compatibility.notes || "—",
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Producto"
        title={`${row.code} · ${row.name}`}
        description={row.description || "Sin descripción"}
        actions={
          <div className="row-actions">
            {hasPermission("products.update") ? (
              <>
                <Link
                  className="button button--secondary"
                  to={`/app/catalog/products/${id}/edit`}
                >
                  Editar
                </Link>
                <Button
                  variant={row.active ? "danger" : "primary"}
                  onClick={() => setConfirm(true)}
                >
                  {row.active ? "Desactivar" : "Activar"}
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <section className="detail-grid">
        <article className="panel detail-card">
          <h2>Datos maestros</h2>
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>
                <StatusBadge active={row.active} />
              </dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{row.category.name}</dd>
            </div>
            <div>
              <dt>Marca</dt>
              <dd>{row.brand.name}</dd>
            </div>
            <div>
              <dt>Precio sugerido</dt>
              <dd>
                {row.defaultSalePrice
                  ? formatMoney(row.defaultSalePrice)
                  : "Sin definir"}
              </dd>
            </div>
            <div>
              <dt>Actualizado</dt>
              <dd>{formatDateTime(row.updatedAt)}</dd>
            </div>
          </dl>
        </article>
        <article className="panel detail-card">
          <h2>Atributos</h2>
          {row.attributes.length ? (
            <dl>
              {row.attributes.map((attribute) => (
                <div key={attribute.id}>
                  <dt>
                    {attribute.definition.name}
                    {attribute.definition.unit
                      ? ` (${attribute.definition.unit})`
                      : ""}
                  </dt>
                  <dd>{attribute.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Sin valores de atributos.</p>
          )}
        </article>
      </section>
      {hasPermission("inventory.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Inventario por ubicación</h2>
              <p>
                Existencia total:{" "}
                <strong>{inventory.data?.totalQuantity ?? "—"}</strong>
              </p>
            </div>
            <Link
              className="button button--ghost"
              to={`/app/inventory?productId=${id}`}
            >
              Abrir inventario
            </Link>
          </div>
          <ErpTable
            columns={inventoryColumns}
            rows={inventory.data?.data}
            rowKey={(item) => item.id}
            loading={inventory.isLoading}
            error={
              inventory.error ? apiErrorMessage(inventory.error) : undefined
            }
          />
          <Pagination
            meta={inventory.data?.meta}
            onPageChange={setInventoryPage}
          />
        </section>
      ) : null}
      {hasPermission("compatibilities.read") ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Vehículos compatibles</h2>
              <p>Relaciones explícitas activas.</p>
            </div>
            <Link
              className="button button--ghost"
              to={`/app/compatibility?productId=${id}`}
            >
              Administrar
            </Link>
          </div>
          <ErpTable
            columns={vehicleColumns}
            rows={compatible.data?.data}
            rowKey={(item) => item.id}
            loading={compatible.isLoading}
            error={
              compatible.error ? apiErrorMessage(compatible.error) : undefined
            }
          />
          <Pagination
            meta={compatible.data?.meta}
            onPageChange={setVehiclesPage}
          />
        </section>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={`${row.active ? "Desactivar" : "Activar"} producto`}
        description={`El producto ${row.code} quedará ${row.active ? "inactivo para nuevas operaciones" : "activo"}. El historial no se elimina.`}
        confirmLabel={row.active ? "Desactivar" : "Activar"}
        dangerous={row.active}
        loading={lifecycle.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => lifecycle.mutate()}
      />
    </div>
  );
}
