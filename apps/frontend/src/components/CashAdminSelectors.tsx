import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cashApi } from "../api/cash-api";
import { rolesApi } from "../api/admin-api";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { queryKeys } from "../query/query-keys";
import type { CashRegister } from "../types/cash";
import { Field } from "./Field";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 20;

export function CashRegisterSelector({
  id,
  value,
  onChange,
  activeOnly = false,
  required,
  emptyLabel = "Todas",
}: {
  id: string;
  value: string;
  onChange: (id: string, register?: CashRegister) => void;
  activeOnly?: boolean;
  required?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const params = {
    page,
    limit: PAGE_SIZE,
    search: debounced || undefined,
    active: activeOnly ? true : undefined,
  };
  const list = useQuery({
    queryKey: queryKeys.cashRegisters(params),
    queryFn: () => cashApi.registers(params),
  });
  const inPage = list.data?.data.find((row) => row.id === value);
  const selected = useQuery({
    queryKey: queryKeys.cashRegister(value),
    queryFn: () => cashApi.register(value),
    enabled: Boolean(value) && !inPage,
  });
  const rows = selected.data && !inPage
    ? [selected.data, ...(list.data?.data ?? [])]
    : (list.data?.data ?? []);
  return (
    <div className="entity-selector">
      <Field
        label="Buscar caja"
        htmlFor={`${id}-search`}
        hint="Búsqueda y paginación del servidor; todas las cajas son alcanzables."
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
      <Field label="Caja" htmlFor={id} required={required}>
        <select
          id={id}
          value={value}
          required={required}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next, rows.find((row) => row.id === next));
          }}
        >
          <option value="">{emptyLabel}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}{row.active ? "" : " · Inactiva"}
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

export function RoleSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (roleIds: string[]) => void;
}) {
  const roles = useQuery({ queryKey: queryKeys.rolesRoot, queryFn: rolesApi.list });
  return (
    <fieldset className="form-section">
      <legend>Roles</legend>
      <p className="muted">Catálogo controlado por el servicio de usuarios.</p>
      <div className="permission-grid">
        {(roles.data ?? []).map((role) => (
          <label className="check-field" key={role.id}>
            <input
              type="checkbox"
              checked={selected.includes(role.id)}
              disabled={!role.active}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, role.id]
                    : selected.filter((id) => id !== role.id),
                )
              }
            />
            {role.name}{role.active ? "" : " (inactivo)"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
