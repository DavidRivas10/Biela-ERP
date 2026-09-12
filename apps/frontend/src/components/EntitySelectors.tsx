import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { catalogApi } from "../api/catalog-api";
import { inventoryApi } from "../api/inventory-api";
import { vehiclesApi } from "../api/vehicles-api";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { queryKeys } from "../query/query-keys";
import { useAutoSelectSoleOption } from "../hooks/use-auto-select-sole-option";
import type { Location, PaginationMeta, Product, Vehicle } from "../types/erp";
import { locationPhysicalHint } from "../utils/formatters";
import { Field } from "./Field";
import { Pagination } from "./Pagination";

const SELECTOR_PAGE_SIZE = 10;

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

/** A short line under the search box so a query never looks like it did nothing. */
function SearchStatus({
  term,
  noun,
  searching,
  total,
}: {
  term: string;
  noun: string;
  searching: boolean;
  total: number;
}) {
  if (!term) {
    return (
      <p className="entity-selector__status">
        Escribí el código o el nombre, o elegí de la lista.
      </p>
    );
  }
  if (searching) {
    return <p className="entity-selector__status">Buscando…</p>;
  }
  if (total === 0) {
    return (
      <p className="entity-selector__status entity-selector__status--empty">
        No se encontró {noun} con «{term}». Revisá el código.
      </p>
    );
  }
  return (
    <p className="entity-selector__status">
      {total} {total === 1 ? "coincidencia" : "coincidencias"}. Elegila abajo.
    </p>
  );
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
  const results = list.data?.data ?? [];
  const rows = withSelected(results, selected.data);

  // Typing an exact code is enough — select that product automatically.
  useEffect(() => {
    if (!debouncedSearch || list.isFetching) return;
    const exact = results.find(
      (row) => row.code.toLowerCase() === debouncedSearch.toLowerCase(),
    );
    if (exact && exact.id !== value) onChange(exact.id, exact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, list.isFetching, value]);

  const chosen = rows.find((row) => row.id === value);

  return (
    <div className="entity-selector">
      <Field
        label={`Buscar ${label.toLowerCase()} por código o nombre`}
        htmlFor={`${id}-search`}
      >
        <input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          placeholder="Ej.: FILT-001 o «filtro de aceite»"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </Field>
      <SearchStatus
        term={debouncedSearch}
        noun="ningún producto"
        searching={list.isFetching}
        total={list.data?.meta.total ?? results.length}
      />
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
      {chosen ? (
        <p className="entity-selector__chosen">
          Elegido: <strong>{chosen.code}</strong> · {chosen.name}
        </p>
      ) : null}
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
  const results = list.data?.data ?? [];
  const rows = withSelected(results, selected.data);

  // Typing an exact location code is enough — select it automatically.
  useEffect(() => {
    if (!debouncedSearch || list.isFetching) return;
    const exact = results.find(
      (row) => row.code.toLowerCase() === debouncedSearch.toLowerCase(),
    );
    if (exact && exact.id !== value) onChange(exact.id, exact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, list.isFetching, value]);

  // Only one location exists at all (a one-counter shop) — don't make
  // anyone choose from a list of one.
  useAutoSelectSoleOption({
    value,
    searchTerm: debouncedSearch,
    loading: list.isFetching,
    total: list.data?.meta.total,
    rows: results,
    onSelect: (row) => onChange(row.id, row),
  });

  const chosen = rows.find((row) => row.id === value);

  return (
    <div className="entity-selector">
      <Field
        label={`Buscar ${label.toLowerCase()} por código o nombre`}
        htmlFor={`${id}-search`}
      >
        <input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          placeholder="Ej.: BOD-01 o «bodega»"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </Field>
      <SearchStatus
        term={debouncedSearch}
        noun="ninguna ubicación"
        searching={list.isFetching}
        total={list.data?.meta.total ?? results.length}
      />
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
          {rows.map((row) => {
            const hint = locationPhysicalHint(row);
            return (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
                {hint ? ` — ${hint}` : ""}
              </option>
            );
          })}
        </select>
      </Field>
      {chosen ? (
        <p className="entity-selector__chosen">
          Elegida: <strong>{chosen.code}</strong> · {chosen.name}
          {locationPhysicalHint(chosen) ? ` — ${locationPhysicalHint(chosen)}` : ""}
        </p>
      ) : null}
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
