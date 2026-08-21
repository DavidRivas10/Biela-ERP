import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { customersApi } from "../api/customers-api";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { queryKeys } from "../query/query-keys";
import type { Customer } from "../types/sales";
import { Field } from "./Field";
import { Pagination } from "./Pagination";

export function CustomerSelector({
  id,
  label,
  value,
  onChange,
  required,
  emptyLabel = "Venta de mostrador",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, customer?: Customer) => void;
  required?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const params = { page, limit: 20, active: true, search: debounced || undefined };
  const list = useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => customersApi.list(params),
  });
  const inPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.customer(value),
    queryFn: () => customersApi.detail(value),
    enabled: Boolean(value) && !inPage,
  });
  const rows = selected.data && !inPage
    ? [selected.data, ...(list.data?.data ?? [])]
    : (list.data?.data ?? []);

  return (
    <div className="entity-selector">
      <Field
        label={`Buscar ${label.toLowerCase()}`}
        htmlFor={`${id}-search`}
        hint="Búsqueda paginada del servidor por código, nombre o razón social."
      >
        <input
          id={`${id}-search`}
          type="search"
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
            const next = event.target.value;
            onChange(next, rows.find((row) => row.id === next));
          }}
        >
          <option value="">{emptyLabel}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}{row.businessName ? ` · ${row.businessName}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <div className="entity-selector__pagination">
        <Pagination
          meta={list.data?.meta}
          onPageChange={setPage}
          ariaLabel={`Paginación de ${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}
