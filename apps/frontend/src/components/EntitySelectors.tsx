import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { catalogApi } from "../api/catalog-api";
import { inventoryApi } from "../api/inventory-api";
import { vehiclesApi } from "../api/vehicles-api";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { queryKeys } from "../query/query-keys";
import type { Location, PaginationMeta, Product, Vehicle } from "../types/erp";
import { Field } from "./Field";
import { Pagination } from "./Pagination";

const SELECTOR_PAGE_SIZE = 20;

type SelectorProps<T> = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, item?: T) => void;
  required?: boolean;
  emptyLabel?: string;
  enabled?: boolean;
};

function SelectorPagination({
  meta,
  onPageChange,
  label,
}: {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  label: string;
}) {
  return (
    <div className="entity-selector__pagination">
      <Pagination
        meta={meta}
        onPageChange={onPageChange}
        ariaLabel={`Paginación de ${label.toLowerCase()}`}
      />
    </div>
  );
}

function withSelected<T extends { id: string }>(rows: T[], selected?: T): T[] {
  if (!selected || rows.some((row) => row.id === selected.id)) return rows;
  return [selected, ...rows];
}

export function ProductSelector({
  id,
  label,
  value,
  onChange,
  required,
  emptyLabel = "Seleccionar",
  enabled = true,
}: SelectorProps<Product>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = {
    page,
    limit: SELECTOR_PAGE_SIZE,
    active: true,
    search: debouncedSearch || undefined,
  };
  const list = useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => catalogApi.products(params),
    enabled,
  });
  const selectedInPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.product(value),
    queryFn: () => catalogApi.product(value),
    enabled: enabled && Boolean(value) && !selectedInPage,
  });
  const rows = withSelected(list.data?.data ?? [], selected.data);

  return (
    <div className="entity-selector">
      <Field
        label={`Buscar ${label.toLowerCase()}`}
        htmlFor={`${id}-search`}
        hint="Búsqueda del servidor por código, nombre o descripción."
      >
        <input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </Field>
      <Field label={label} htmlFor={id} required={required}>
        <select
          id={id}
          required={required}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(
              nextValue,
              rows.find((row) => row.id === nextValue),
            );
          }}
        >
          <option value="">{emptyLabel}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </select>
      </Field>
      <SelectorPagination
        meta={list.data?.meta}
        onPageChange={setPage}
        label={label}
      />
    </div>
  );
}

export function LocationSelector({
  id,
  label,
  value,
  onChange,
  required,
  emptyLabel = "Seleccionar",
  enabled = true,
}: SelectorProps<Location>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = {
    page,
    limit: SELECTOR_PAGE_SIZE,
    active: true,
    search: debouncedSearch || undefined,
  };
  const list = useQuery({
    queryKey: queryKeys.locations(params),
    queryFn: () => inventoryApi.locations(params),
    enabled,
  });
  const selectedInPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: [queryKeys.locationsRoot, "detail", value],
    queryFn: () => inventoryApi.location(value),
    enabled: enabled && Boolean(value) && !selectedInPage,
  });
  const rows = withSelected(list.data?.data ?? [], selected.data);

  return (
    <div className="entity-selector">
      <Field
        label={`Buscar ${label.toLowerCase()}`}
        htmlFor={`${id}-search`}
        hint="Búsqueda del servidor por código, nombre, zona o descripción."
      >
        <input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </Field>
      <Field label={label} htmlFor={id} required={required}>
        <select
          id={id}
          required={required}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(
              nextValue,
              rows.find((row) => row.id === nextValue),
            );
          }}
        >
          <option value="">{emptyLabel}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </select>
      </Field>
      <SelectorPagination
        meta={list.data?.meta}
        onPageChange={setPage}
        label={label}
      />
    </div>
  );
}

export type VehicleSelectorFilters = {
  brandId?: string;
  modelId?: string;
  year?: string;
  engine?: string;
};

export function VehicleSelector({
  id,
  label,
  value,
  onChange,
  filters,
  required,
  emptyLabel = "Seleccionar entre resultados",
  enabled = true,
}: SelectorProps<Vehicle> & { filters: VehicleSelectorFilters }) {
  const signature = [
    filters.brandId,
    filters.modelId,
    filters.year,
    filters.engine,
  ].join("|");
  const [pagination, setPagination] = useState({ signature, page: 1 });
  const page = pagination.signature === signature ? pagination.page : 1;
  const params = {
    page,
    limit: SELECTOR_PAGE_SIZE,
    active: true,
    brandId: filters.brandId || undefined,
    modelId: filters.modelId || undefined,
    year: filters.year || undefined,
    engine: filters.engine?.trim() || undefined,
  };
  const list = useQuery({
    queryKey: queryKeys.vehicles(params),
    queryFn: () => vehiclesApi.vehicles(params),
    enabled,
  });
  const selectedInPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.vehicle(value),
    queryFn: () => vehiclesApi.vehicle(value),
    enabled: enabled && Boolean(value) && !selectedInPage,
  });
  const rows = withSelected(list.data?.data ?? [], selected.data);

  return (
    <div className="entity-selector">
      <Field label={label} htmlFor={id} required={required}>
        <select
          id={id}
          required={required}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(
              nextValue,
              rows.find((row) => row.id === nextValue),
            );
          }}
        >
          <option value="">{emptyLabel}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.model.brand.name} {row.model.name} · {row.year} ·{" "}
              {row.engine}
            </option>
          ))}
        </select>
      </Field>
      <SelectorPagination
        meta={list.data?.meta}
        label={label}
        onPageChange={(nextPage) =>
          setPagination({ signature, page: nextPage })
        }
      />
    </div>
  );
}
