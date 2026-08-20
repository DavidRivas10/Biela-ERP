import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { catalogApi } from "../api/catalog-api";
import { searchApi } from "../api/search-api";
import { vehiclesApi } from "../api/vehicles-api";
import { Button } from "../components/Button";
import { VehicleSelector } from "../components/EntitySelectors";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useUrlFilters } from "../hooks/use-url-filters";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { queryKeys } from "../query/query-keys";
import type { SearchProduct } from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";

export function SearchPage() {
  const filters = useUrlFilters(20);
  const [draft, setDraft] = useState({
    q: filters.values.q ?? "",
    engine: filters.values.engine ?? "",
    generation: filters.values.generation ?? "",
    trim: filters.values.trim ?? "",
  });
  const debouncedQuery = useDebouncedValue(draft.q.trim(), 350);
  useEffect(() => {
    if (debouncedQuery !== (filters.values.q ?? ""))
      filters.update({ q: debouncedQuery || undefined });
  }, [debouncedQuery, filters]);
  const params = {
    page: filters.page,
    limit: filters.limit,
    q: filters.values.q,
    categoryId: filters.values.categoryId,
    brandId: filters.values.brandId,
    active: filters.values.active,
    inStock: filters.values.inStock,
    vehicleId: filters.values.vehicleId,
    vehicleBrandId: filters.values.vehicleBrandId,
    vehicleModelId: filters.values.vehicleModelId,
    year: filters.values.year,
    engine: filters.values.engine,
    generation: filters.values.generation,
    trim: filters.values.trim,
  };
  const hasCriteria = Object.values(params).some(
    (value, index) => index > 1 && value !== undefined && value !== "",
  );
  const results = useQuery({
    queryKey: queryKeys.search(params),
    queryFn: () => searchApi.products(params),
    enabled: hasCriteria,
  });
  const categories = useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: catalogApi.categories,
  });
  const productBrands = useQuery({
    queryKey: queryKeys.productBrands,
    queryFn: catalogApi.brands,
  });
  const vehicleBrands = useQuery({
    queryKey: queryKeys.vehicleBrands,
    queryFn: vehiclesApi.brands,
  });
  const models = useQuery({
    queryKey: queryKeys.vehicleModels(filters.values.vehicleBrandId),
    queryFn: () => vehiclesApi.models(filters.values.vehicleBrandId),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    filters.update(draft);
  }
  const columns: ErpColumn<SearchProduct>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (row) => (
        <Link className="table-link" to={`/app/catalog/products/${row.id}`}>
          <strong>{row.code}</strong>
          <small>{row.name}</small>
        </Link>
      ),
    },
    {
      key: "catalog",
      header: "Catálogo",
      cell: (row) => (
        <>
          <span>{row.category.name}</span>
          <small>{row.brand.name}</small>
        </>
      ),
    },
    {
      key: "attributes",
      header: "Atributos",
      cell: (row) =>
        row.attributes.length ? (
          <small>
            {row.attributes
              .map(
                (value) =>
                  `${value.definition.name}: ${value.value}${value.definition.unit ? ` ${value.definition.unit}` : ""}`,
              )
              .join(" · ")}
          </small>
        ) : (
          "—"
        ),
    },
    {
      key: "stock",
      header: "Existencia total",
      cell: (row) => (
        <>
          <strong>{row.totalStock}</strong>
          {row.inventories.length ? (
            <small>
              {row.inventories
                .map((item) => `${item.location.code}: ${item.quantity}`)
                .join(" · ")}
            </small>
          ) : null}
        </>
      ),
    },
    {
      key: "matches",
      header: "Coincidencias vehiculares",
      cell: (row) =>
        row.matchingVehicles.length ? (
          <small>
            {row.matchingVehicles
              .map(
                (vehicle) =>
                  `${vehicle.model.brand.name} ${vehicle.model.name} ${vehicle.year} ${vehicle.engine}`,
              )
              .join(" · ")}
          </small>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Almacén"
        title="Búsqueda de productos"
        description="Resultados determinísticos del servidor: código exacto primero y orden estable, sin reordenamiento cliente."
      />
      <form
        className="panel erp-form search-form"
        onSubmit={submit}
        aria-label="Búsqueda determinística de productos"
      >
        <div className="search-primary">
          <Field label="Código o nombre" htmlFor="search-q">
            <input
              id="search-q"
              autoComplete="off"
              placeholder="Ej. BP-TOY-001"
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            />
          </Field>
          <Button type="submit">Buscar</Button>
        </div>
        <details
          className="filter-details"
          open={Object.keys(filters.values).some(
            (key) => !["q", "page", "limit"].includes(key),
          )}
        >
          <summary>Filtros avanzados</summary>
          <div className="form-grid">
            <Field label="Categoría" htmlFor="search-category">
              <select
                id="search-category"
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
            <Field label="Marca de producto" htmlFor="search-product-brand">
              <select
                id="search-product-brand"
                value={filters.values.brandId ?? ""}
                onChange={(e) => filters.update({ brandId: e.target.value })}
              >
                <option value="">Todas</option>
                {productBrands.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado" htmlFor="search-active">
              <select
                id="search-active"
                value={filters.values.active ?? ""}
                onChange={(e) => filters.update({ active: e.target.value })}
              >
                <option value="">Activos (predeterminado)</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </Field>
            <Field label="Existencia" htmlFor="search-stock">
              <select
                id="search-stock"
                value={filters.values.inStock ?? ""}
                onChange={(e) => filters.update({ inStock: e.target.value })}
              >
                <option value="">Todas</option>
                <option value="true">Con existencia</option>
                <option value="false">Sin existencia</option>
              </select>
            </Field>
            <Field label="Marca vehicular" htmlFor="search-vehicle-brand">
              <select
                id="search-vehicle-brand"
                value={filters.values.vehicleBrandId ?? ""}
                onChange={(e) =>
                  filters.update({
                    vehicleBrandId: e.target.value,
                    vehicleModelId: undefined,
                    vehicleId: undefined,
                  })
                }
              >
                <option value="">Todas</option>
                {vehicleBrands.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Modelo vehicular" htmlFor="search-vehicle-model">
              <select
                id="search-vehicle-model"
                value={filters.values.vehicleModelId ?? ""}
                onChange={(e) =>
                  filters.update({
                    vehicleModelId: e.target.value,
                    vehicleId: undefined,
                  })
                }
              >
                <option value="">Todos</option>
                {models.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <VehicleSelector
              id="search-vehicle"
              label="Vehículo exacto"
              value={filters.values.vehicleId ?? ""}
              emptyLabel="Cualquiera compatible"
              filters={{
                brandId: filters.values.vehicleBrandId,
                modelId: filters.values.vehicleModelId,
                year: filters.values.year,
                engine: filters.values.engine,
              }}
              onChange={(vehicleId) => filters.update({ vehicleId })}
            />
            <Field label="Año" htmlFor="search-year">
              <input
                id="search-year"
                type="number"
                min={1886}
                max={2100}
                value={filters.values.year ?? ""}
                onChange={(e) => filters.update({ year: e.target.value })}
              />
            </Field>
            <Field label="Motor contiene" htmlFor="search-engine">
              <input
                id="search-engine"
                value={draft.engine}
                onChange={(e) => setDraft({ ...draft, engine: e.target.value })}
              />
            </Field>
            <Field label="Generación contiene" htmlFor="search-generation">
              <input
                id="search-generation"
                value={draft.generation}
                onChange={(e) =>
                  setDraft({ ...draft, generation: e.target.value })
                }
              />
            </Field>
            <Field label="Versión contiene" htmlFor="search-trim">
              <input
                id="search-trim"
                value={draft.trim}
                onChange={(e) => setDraft({ ...draft, trim: e.target.value })}
              />
            </Field>
          </div>
          <div className="form-actions">
            <Button type="submit">Aplicar filtros</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft({ q: "", engine: "", generation: "", trim: "" });
                filters.clear();
              }}
            >
              Limpiar todo
            </Button>
          </div>
        </details>
      </form>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Resultados</h2>
            <p>
              {results.data
                ? `${results.data.meta.total} productos encontrados`
                : hasCriteria
                  ? "Consultando catálogo…"
                  : "Ingresa un término o selecciona un filtro."}
            </p>
          </div>
        </div>
        <ErpTable
          columns={columns}
          rows={results.data?.data}
          rowKey={(row) => row.id}
          loading={results.isLoading}
          error={results.error ? apiErrorMessage(results.error) : undefined}
          onRetry={() => void results.refetch()}
          emptyTitle={
            hasCriteria ? "No encontramos productos" : "Inicia una búsqueda"
          }
          emptyDescription={
            hasCriteria
              ? "Prueba con otro código, nombre o combinación de vehículo. La búsqueda solo utiliza datos y compatibilidades explícitas."
              : "Busca por código o nombre, o abre los filtros avanzados para consultar el catálogo."
          }
        />
        <Pagination
          meta={results.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}
