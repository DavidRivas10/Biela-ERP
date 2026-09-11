import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { inventoryApi, type LocationInput } from "../api/inventory-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { useUrlFilters } from "../hooks/use-url-filters";
import { queryKeys } from "../query/query-keys";
import { invalidateLocationReferenceIntegration } from "../query/invalidation";
import type { Location } from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";
import { locationPhysicalHint } from "../utils/formatters";

type LocationEditor = LocationInput & { id?: string };
const emptyLocation: LocationEditor = {
  code: "",
  name: "",
  description: "",
  zone: "",
  aisle: "",
  rack: "",
  shelf: "",
  bin: "",
  active: true,
};
export function LocationsPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const [editor, setEditor] = useState<LocationEditor | null>(null);
  const [target, setTarget] = useState<Location | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const params = {
    page: filters.page,
    limit: filters.limit,
    search: filters.values.search,
    code: filters.values.code,
    active: filters.values.active,
  };
  const list = useQuery({
    queryKey: queryKeys.locations(params),
    queryFn: () => inventoryApi.locations(params),
  });
  const invalidate = () => invalidateLocationReferenceIntegration(client);
  const save = useMutation({
    mutationFn: (value: LocationEditor) => {
      const body = Object.fromEntries(
        Object.entries(value).filter(
          ([key, fieldValue]) =>
            key !== "id" && (Boolean(value.id) || fieldValue !== ""),
        ),
      ) as unknown as LocationInput;
      return value.id
        ? inventoryApi.updateLocation(value.id, body)
        : inventoryApi.createLocation(body);
    },
    onSuccess: async (_, value) => {
      await invalidate();
      setSuccess(`Ubicación ${value.id ? "actualizada" : "creada"}.`);
      setEditor(null);
    },
  });
  const lifecycle = useMutation({
    mutationFn: (row: Location) =>
      inventoryApi.setLocationActive(row.id, !row.active),
    onSuccess: async (_, row) => {
      await invalidate();
      setSuccess(`Ubicación ${row.active ? "desactivada" : "activada"}.`);
      setTarget(null);
    },
  });
  const canUpdate = hasPermission("locations.update");
  const columns: ErpColumn<Location>[] = [
    {
      key: "code",
      header: "Código",
      cell: (row) => (
        <Link className="table-link" to={`/app/inventory?locationId=${row.id}`}>
          {row.code}
        </Link>
      ),
    },
    { key: "name", header: "Nombre", cell: (row) => row.name },
    {
      key: "physical",
      header: "Pasillo / estante / nivel",
      cell: (row) => locationPhysicalHint(row) ?? "—",
    },
    {
      key: "products",
      header: "Productos aquí",
      cell: (row) =>
        row._count?.inventories === undefined ? (
          "—"
        ) : row._count.inventories === 0 ? (
          <span className="muted">Vacía</span>
        ) : (
          `${row._count.inventories} ${
            row._count.inventories === 1 ? "producto" : "productos"
          }`
        ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
    ...(canUpdate
      ? [
          {
            key: "actions",
            header: "Acciones",
            cell: (row: Location) => (
              <div className="row-actions">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEditor({
                      id: row.id,
                      code: row.code,
                      name: row.name,
                      description: row.description ?? "",
                      zone: row.zone ?? "",
                      aisle: row.aisle ?? "",
                      rack: row.rack ?? "",
                      shelf: row.shelf ?? "",
                      bin: row.bin ?? "",
                      active: row.active,
                    })
                  }
                >
                  Editar
                </Button>
                <Button variant="ghost" onClick={() => setTarget(row)}>
                  {row.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (editor) save.mutate(editor);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Mantenimientos"
        title="Ubicaciones"
        description="El lugar físico de tu bodega o mostrador donde está guardada una pieza. Le ponés un código corto (BOD-01, MOS-01) y lo usás en el inventario para saber dónde buscarla."
        actions={
          hasPermission("locations.create") && !editor ? (
            <Button onClick={() => setEditor(emptyLocation)}>
              Nueva ubicación
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      <form
        className="panel filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          filters.update({ search });
        }}
      >
        <Field label="Buscar por código o nombre" htmlFor="location-search">
          <input
            id="location-search"
            placeholder="Ej.: BOD-01 o «bodega principal»"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Estado" htmlFor="location-active-filter">
          <select
            id="location-active-filter"
            value={filters.values.active ?? ""}
            onChange={(e) => filters.update({ active: e.target.value })}
          >
            <option value="">Activas e inactivas</option>
            <option value="true">Solo activas</option>
            <option value="false">Solo inactivas (ocultas)</option>
          </select>
        </Field>
        <div className="filter-actions">
          <Button type="submit">Buscar</Button>
          {filters.values.search || filters.values.active ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                filters.clear();
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </form>
      {editor ? (
        <form className="panel erp-form" onSubmit={submit}>
          <h2>{editor.id ? "Editar" : "Crear"} ubicación</h2>
          <FormFeedback
            error={save.error ? apiErrorMessage(save.error) : null}
          />
          <div className="form-grid">
            <Field
              label="Código"
              htmlFor="location-code"
              required
              hint="Identificador corto que vas a elegir en el inventario y los movimientos. Ej.: BOD-01, MOS-01."
            >
              <input
                id="location-code"
                required
                minLength={2}
                maxLength={60}
                value={editor.code}
                onChange={(e) => setEditor({ ...editor, code: e.target.value })}
              />
            </Field>
            <Field
              label="Nombre"
              htmlFor="location-name"
              required
              hint="Nombre en palabras, como lo llamás vos. Ej.: «Bodega principal», «Mostrador»."
            >
              <input
                id="location-name"
                required
                minLength={2}
                maxLength={120}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </Field>
            <Field
              label="Pasillo (rótulo)"
              htmlFor="location-aisle"
              hint="Como lo tienes rotulado, por ejemplo «Pasillo de filtros»."
            >
              <input
                id="location-aisle"
                maxLength={40}
                value={editor.aisle}
                onChange={(e) =>
                  setEditor({ ...editor, aisle: e.target.value })
                }
              />
            </Field>
            <Field
              label="Estante (rótulo)"
              htmlFor="location-shelf"
              hint="El estante dentro del pasillo, con tu propia etiqueta."
            >
              <input
                id="location-shelf"
                maxLength={40}
                value={editor.shelf}
                onChange={(e) =>
                  setEditor({ ...editor, shelf: e.target.value })
                }
              />
            </Field>
            <Field
              label="Nivel / posición (opcional)"
              htmlFor="location-bin"
              hint="Si el estante tiene niveles o casilleros, cuál es. Ej.: «Nivel 2», «Casillero B»."
            >
              <input
                id="location-bin"
                maxLength={40}
                value={editor.bin}
                onChange={(e) => setEditor({ ...editor, bin: e.target.value })}
              />
            </Field>
            <Field label="Descripción" htmlFor="location-description">
              <textarea
                id="location-description"
                maxLength={500}
                value={editor.description}
                onChange={(e) =>
                  setEditor({ ...editor, description: e.target.value })
                }
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
              Ubicación activa
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
            <Button type="submit" loading={save.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyState={
            filters.values.search || filters.values.active ? (
              <EmptyState
                tone="search"
                title="Ninguna ubicación coincide"
                action={
                  <Button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      filters.clear();
                    }}
                  >
                    Ver todas las ubicaciones
                  </Button>
                }
              >
                {filters.values.search
                  ? `No hay ninguna ubicación con «${filters.values.search}».`
                  : "No hay ubicaciones con ese estado."}
              </EmptyState>
            ) : (
              <EmptyState
                title="Todavía no hay ubicaciones"
                action={
                  hasPermission("locations.create") ? (
                    <Button onClick={() => setEditor(emptyLocation)}>
                      Crear la primera ubicación
                    </Button>
                  ) : undefined
                }
              >
                Creá al menos una (por ejemplo <strong>BOD-01</strong> = bodega
                principal) para poder registrar inventario y hacer ventas.
              </EmptyState>
            )
          }
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
      <ConfirmDialog
        open={Boolean(target)}
        title={`${target?.active ? "Desactivar" : "Activar"} ubicación`}
        description="El historial de inventario se conservará. Una ubicación inactiva no acepta nuevas operaciones."
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
