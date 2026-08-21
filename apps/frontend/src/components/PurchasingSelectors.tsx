import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { purchasingFinanceApi } from "../api/purchasing-finance-api";
import { suppliersApi } from "../api/suppliers-api";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { queryKeys } from "../query/query-keys";
import type { CashSession, PaymentMethod, Supplier } from "../types/purchasing";
import { Field } from "./Field";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 20;

function includeSelected<T extends { id: string }>(rows: T[], selected?: T) {
  return selected && !rows.some((row) => row.id === selected.id)
    ? [selected, ...rows]
    : rows;
}

type SelectorProps<T> = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, item?: T) => void;
  required?: boolean;
  enabled?: boolean;
  emptyLabel?: string;
};

export function SupplierSelector({
  id,
  label,
  value,
  onChange,
  required,
  enabled = true,
  emptyLabel = "Seleccionar",
}: SelectorProps<Supplier>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const params = {
    page,
    limit: PAGE_SIZE,
    active: true,
    search: debounced || undefined,
  };
  const list = useQuery({
    queryKey: queryKeys.suppliers(params),
    queryFn: () => suppliersApi.list(params),
    enabled,
  });
  const inPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.supplier(value),
    queryFn: () => suppliersApi.detail(value),
    enabled: enabled && Boolean(value) && !inPage,
  });
  const rows = includeSelected(list.data?.data ?? [], selected.data);
  return (
    <div className="entity-selector">
      <Field
        label={`Buscar ${label.toLowerCase()}`}
        htmlFor={`${id}-search`}
        hint="Búsqueda paginada del servidor por código o razón social."
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
            onChange(
              next,
              rows.find((row) => row.id === next),
            );
          }}
        >
          <option value="">{emptyLabel}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.businessName}
            </option>
          ))}
        </select>
      </Field>
      <div className="entity-selector__pagination">
        <Pagination meta={list.data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
}

export function PaymentMethodSelector({
  id,
  label,
  value,
  onChange,
  required,
  enabled = true,
}: SelectorProps<PaymentMethod>) {
  const [page, setPage] = useState(1);
  const params = { page, limit: PAGE_SIZE, active: true };
  const list = useQuery({
    queryKey: queryKeys.paymentMethods(params),
    queryFn: () => purchasingFinanceApi.paymentMethods(params),
    enabled,
  });
  const inPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.paymentMethod(value),
    queryFn: () => purchasingFinanceApi.paymentMethod(value),
    enabled: enabled && Boolean(value) && !inPage,
  });
  const rows = includeSelected(list.data?.data ?? [], selected.data);
  return (
    <div className="entity-selector">
      <Field label={label} htmlFor={id} required={required}>
        <select
          id={id}
          required={required}
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            onChange(
              next,
              rows.find((row) => row.id === next),
            );
          }}
        >
          <option value="">Seleccionar</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.kind}
            </option>
          ))}
        </select>
      </Field>
      <div className="entity-selector__pagination">
        <Pagination meta={list.data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
}

export function OpenCashSessionSelector({
  id,
  label,
  value,
  onChange,
  required,
  enabled = true,
}: SelectorProps<CashSession>) {
  const [page, setPage] = useState(1);
  const params = { page, limit: PAGE_SIZE, status: "OPEN" };
  const list = useQuery({
    queryKey: queryKeys.cashSessions(params),
    queryFn: () => purchasingFinanceApi.cashSessions(params),
    enabled,
  });
  const inPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.cashSession(value),
    queryFn: () => purchasingFinanceApi.cashSession(value),
    enabled: enabled && Boolean(value) && !inPage,
  });
  const rows = includeSelected(list.data?.data ?? [], selected.data);
  return (
    <div className="entity-selector">
      <Field label={label} htmlFor={id} required={required}>
        <select
          id={id}
          required={required}
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            onChange(
              next,
              rows.find((row) => row.id === next),
            );
          }}
        >
          <option value="">Seleccionar sesión OPEN</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.cashRegister.code} · {row.cashRegister.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="entity-selector__pagination">
        <Pagination meta={list.data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
}
