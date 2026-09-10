import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  rolesApi,
  usersApi,
  type RoleInput,
  type UserInput,
} from "../api/admin-api";
import { useAuth } from "../auth/AuthContext";
import {
  PERMISSION_CATALOG,
  domainLabel,
  permissionDescription,
  permissionLabel,
  permissionsByDomain,
} from "../auth/permission-catalog";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { RoleSelector } from "../components/CashAdminSelectors";
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
import { invalidateUserRoleIntegration } from "../query/invalidation";
import type { Role, User } from "../types/admin";
import { apiErrorMessage } from "../utils/api-error";

function RoleBadges({ roles }: { roles: User["roles"] }) {
  if (!roles.length) return <span className="muted">Sin rol asignado</span>;
  return (
    <div className="badge-row">
      {roles.map((role) => (
        <Badge key={role.id}>{role.name}</Badge>
      ))}
    </div>
  );
}

/**
 * Read-only permission list grouped by business area. Spanish name + short
 * explanation, with the exact backend code kept visible but subordinate.
 */
function PermissionSummary({ permissions }: { permissions: string[] }) {
  const groups = Object.entries(
    permissionsByDomain([...permissions].sort()),
  );
  if (!groups.length) {
    return <p className="muted">Este rol todavía no incluye ningún permiso.</p>;
  }
  return (
    <div className="permission-groups">
      {groups.map(([domain, codes]) => (
        <div key={domain}>
          <strong>{domainLabel(domain)}</strong>
          <ul className="permission-readout">
            {codes.map((code) => (
              <li key={code}>
                <span className="permission-readout__name">
                  {permissionLabel(code)}
                  <code className="permission-readout__code">{code}</code>
                </span>
                {permissionDescription(code) ? (
                  <span className="permission-readout__hint">
                    {permissionDescription(code)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ============================ Usuarios ============================ */

export function UsersPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const params = {
    page: filters.page,
    limit: filters.limit,
    search: filters.values.search,
  };
  const list = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => usersApi.list(params),
  });
  const columns: ErpColumn<User>[] = [
    {
      key: "user",
      header: "Persona",
      cell: (row) => (
        <Link className="table-link" to={`/app/admin/users/${row.id}`}>
          <strong>
            {row.firstName} {row.lastName}
          </strong>
          <small>{row.email}</small>
        </Link>
      ),
    },
    {
      key: "roles",
      header: "Qué puede hacer (roles)",
      cell: (row) => <RoleBadges roles={row.roles} />,
    },
    {
      key: "active",
      header: "Acceso",
      cell: (row) => (
        <StatusBadge
          active={row.active}
          activeLabel="Puede entrar"
          inactiveLabel="Sin acceso"
        />
      ),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Las personas que pueden entrar al sistema y qué puede hacer cada una según los roles que le asignes."
        actions={
          hasPermission("users.create") ? (
            <Link
              className="button button--primary"
              to="/app/admin/users/new"
            >
              Nuevo usuario
            </Link>
          ) : undefined
        }
      />
      <form
        className="panel filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          filters.update({ search });
        }}
      >
        <Field label="Buscar por nombre o correo" htmlFor="user-search">
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <div className="filter-actions">
          <Button type="submit">Buscar</Button>
          {filters.values.search ? (
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
          ) : null}
        </div>
      </form>
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyState={
            <EmptyState
              title={
                filters.values.search
                  ? "Ninguna persona coincide"
                  : "Todavía no hay usuarios"
              }
              action={
                hasPermission("users.create") ? (
                  <Link
                    className="button button--primary"
                    to="/app/admin/users/new"
                  >
                    Crear un usuario
                  </Link>
                ) : undefined
              }
            >
              {filters.values.search
                ? `No hay ninguna persona con «${filters.values.search}».`
                : "Creá un usuario para cada persona que va a usar el sistema, y asignale un rol."}
            </EmptyState>
          }
        />
        <Pagination
          meta={list.data?.meta}
          onPageChange={(page) => filters.update({ page }, false)}
        />
      </section>
    </div>
  );
}

const emptyUser: UserInput = {
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  roleIds: [],
};

export function UserFormPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: queryKeys.user(id ?? "new"),
    queryFn: () => usersApi.detail(id!),
    enabled: Boolean(id),
  });
  if (id && detail.isLoading)
    return <div className="panel">Cargando usuario…</div>;
  if (id && detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <UserEditor id={id} initial={detail.data} />;
}

function UserEditor({ id, initial }: { id?: string; initial?: User }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<UserInput>(() =>
    initial
      ? {
          email: initial.email,
          firstName: initial.firstName,
          lastName: initial.lastName,
          roleIds: initial.roles.map((role) => role.id),
        }
      : emptyUser,
  );
  const mutation = useMutation({
    mutationFn: (body: UserInput) =>
      id
        ? usersApi.update(id, body)
        : usersApi.create(body as UserInput & { password: string }),
    onSuccess: async (row) => {
      setForm((current) => ({ ...current, password: "" }));
      client.setQueryData(queryKeys.user(row.id), row);
      await client.invalidateQueries({ queryKey: queryKeys.usersRoot });
      void navigate(`/app/admin/users/${row.id}`, { replace: true });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const body: UserInput = {
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      roleIds: form.roleIds ?? [],
    };
    if (!id) body.password = form.password;
    mutation.mutate(body);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administración"
        title={id ? "Editar usuario" : "Nuevo usuario"}
        description={
          id
            ? "Cambiá los datos de esta persona o los roles que tiene."
            : "Registrá a una persona para que pueda entrar al sistema. La contraseña inicial se la das una sola vez: no se guarda ni se vuelve a mostrar."
        }
      />
      <form className="panel erp-form" onSubmit={submit}>
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />

        <fieldset className="form-section">
          <legend>Datos de la persona</legend>
          <div className="form-grid">
            <Field label="Nombre" htmlFor="user-first" required>
              <input
                id="user-first"
                required
                maxLength={80}
                value={form.firstName}
                onChange={(event) =>
                  setForm({ ...form, firstName: event.target.value })
                }
              />
            </Field>
            <Field label="Apellido" htmlFor="user-last" required>
              <input
                id="user-last"
                required
                maxLength={80}
                value={form.lastName}
                onChange={(event) =>
                  setForm({ ...form, lastName: event.target.value })
                }
              />
            </Field>
            <Field label="Correo" htmlFor="user-email" required>
              <input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </Field>
            {!id ? (
              <Field
                label="Contraseña inicial"
                htmlFor="user-password"
                required
                hint="Entre 12 y 128 caracteres. Se la entregás a la persona; después la cambia."
              >
                <input
                  id="user-password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.password ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                />
              </Field>
            ) : null}
          </div>
        </fieldset>

        <RoleSelector
          selected={form.roleIds ?? []}
          onChange={(roleIds) => setForm({ ...form, roleIds })}
        />

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar usuario
          </Button>
        </div>
      </form>
    </div>
  );
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const detail = useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => usersApi.detail(id),
  });
  const lifecycle = useMutation({
    mutationFn: (active: boolean) => usersApi.setActive(id, active),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.user(id) }),
        client.invalidateQueries({ queryKey: queryKeys.usersRoot }),
      ]);
      setConfirm(false);
    },
  });
  const reset = useMutation({
    mutationFn: () => usersApi.resetPassword(id),
    onSuccess: (data) => {
      setResetConfirm(false);
      setCopied(false);
      setTempPassword(data.temporaryPassword);
    },
  });
  if (detail.isLoading) return <div className="panel">Cargando usuario…</div>;
  if (detail.error || !detail.data)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const row = detail.data;
  const fullName = `${row.firstName} ${row.lastName}`;
  const effective = [
    ...new Set(row.roles.flatMap((role) => role.permissions)),
  ].sort();
  const canLifecycle = row.active
    ? hasPermission("users.deactivate")
    : hasPermission("users.activate");
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administración"
        title={fullName}
        description={row.email}
        actions={
          <>
            {hasPermission("users.update") ? (
              <Link
                className="button button--secondary"
                to={`/app/admin/users/${id}/edit`}
              >
                Editar
              </Link>
            ) : null}
            {hasPermission("users.update") ? (
              <Button
                variant="secondary"
                onClick={() => setResetConfirm(true)}
              >
                Restablecer contraseña
              </Button>
            ) : null}
            {canLifecycle ? (
              <Button
                variant={row.active ? "danger" : "primary"}
                onClick={() => setConfirm(true)}
              >
                {row.active ? "Quitar acceso" : "Dar acceso"}
              </Button>
            ) : null}
          </>
        }
      />
      {reset.error ? (
        <FormFeedback error={apiErrorMessage(reset.error)} />
      ) : null}
      <section className="panel detail-grid">
        <div className="detail-card">
          <h2>Datos</h2>
          <dl>
            <div>
              <dt>Correo</dt>
              <dd>{row.email}</dd>
            </div>
            <div>
              <dt>Acceso</dt>
              <dd>
                <StatusBadge
                  active={row.active}
                  activeLabel="Puede entrar"
                  inactiveLabel="Sin acceso"
                />
              </dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd>
                <RoleBadges roles={row.roles} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="detail-card">
          <h2>Qué puede hacer</h2>
          <p className="muted">
            Todo lo que esta persona puede hacer, sumando sus roles.
          </p>
          <PermissionSummary permissions={effective} />
        </div>
      </section>
      <ConfirmDialog
        open={confirm}
        title={`${row.active ? "Quitar el acceso a" : "Dar acceso a"} ${fullName}`}
        description={
          row.active
            ? "La persona ya no va a poder entrar. No se borra su identidad ni su historial; podés devolverle el acceso cuando quieras."
            : "La persona va a poder volver a entrar con su contraseña."
        }
        dangerous={row.active}
        loading={lifecycle.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => lifecycle.mutate(!row.active)}
      />
      <ConfirmDialog
        open={resetConfirm}
        title="Restablecer contraseña"
        description={`Se genera una contraseña temporal nueva para ${fullName}. La contraseña actual deja de funcionar y tenés que entregarle la nueva.`}
        confirmLabel="Generar contraseña temporal"
        dangerous
        loading={reset.isPending}
        onCancel={() => setResetConfirm(false)}
        onConfirm={() => reset.mutate()}
      />
      {tempPassword ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTempPassword(null);
              setCopied(false);
            }
          }}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Contraseña temporal generada"
          >
            <h2>Contraseña temporal generada</h2>
            <p>
              Para <strong>{fullName}</strong>. Copiala ahora:{" "}
              <strong>no se vuelve a mostrar</strong>.
            </p>
            <div className="temp-password">
              <code>{tempPassword}</code>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(tempPassword)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Copiada ✓" : "Copiar"}
              </Button>
            </div>
            <p className="muted">
              Entregásela en persona o por WhatsApp y pedile que la cambie al
              entrar (Editar usuario). Si esta persona ya no trabaja acá, mejor
              quitale el acceso.
            </p>
            <div className="dialog-actions">
              <Button
                type="button"
                onClick={() => {
                  setTempPassword(null);
                  setCopied(false);
                }}
              >
                Listo
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

/* ============================== Roles ============================== */

export function RolesPage() {
  const { hasPermission } = useAuth();
  const list = useQuery({
    queryKey: queryKeys.rolesRoot,
    queryFn: rolesApi.list,
  });
  const columns: ErpColumn<Role>[] = [
    {
      key: "role",
      header: "Rol",
      cell: (row) => (
        <Link className="table-link" to={`/app/admin/roles/${row.id}`}>
          <strong>{row.name}</strong>
          <small>{row.description}</small>
        </Link>
      ),
    },
    {
      key: "permissions",
      header: "Permisos",
      cell: (row) =>
        `${row.permissions.length} de ${PERMISSION_CATALOG.length}`,
    },
    {
      key: "active",
      header: "Estado",
      cell: (row) => <StatusBadge active={row.active} />,
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administración"
        title="Roles"
        description="Un rol es un conjunto de permisos con nombre (cajero, comprador, administrador…). Se lo asignás a cada usuario para decidir qué puede hacer."
        actions={
          hasPermission("roles.manage") ? (
            <Link
              className="button button--primary"
              to="/app/admin/roles/new"
            >
              Nuevo rol
            </Link>
          ) : undefined
        }
      />
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={list.data}
          rowKey={(row) => row.id}
          loading={list.isLoading}
          error={list.error ? apiErrorMessage(list.error) : undefined}
          onRetry={() => void list.refetch()}
          emptyState={
            <EmptyState
              title="Todavía no hay roles"
              action={
                hasPermission("roles.manage") ? (
                  <Link
                    className="button button--primary"
                    to="/app/admin/roles/new"
                  >
                    Crear un rol
                  </Link>
                ) : undefined
              }
            >
              Creá roles como «cajero» o «comprador» con los permisos de cada
              puesto, y después asignáselos a los usuarios.
            </EmptyState>
          }
        />
      </section>
    </div>
  );
}

export function RoleDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const detail = useQuery({
    queryKey: queryKeys.role(id),
    queryFn: () => rolesApi.detail(id),
  });
  if (detail.isLoading) return <div className="panel">Cargando rol…</div>;
  if (detail.error || !detail.data)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const row = detail.data;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administración"
        title={row.name}
        description={row.description}
        actions={
          hasPermission("roles.manage") ? (
            <Link
              className="button button--secondary"
              to={`/app/admin/roles/${id}/edit`}
            >
              Editar
            </Link>
          ) : undefined
        }
      />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Qué puede hacer alguien con este rol</h2>
            <p>
              {row.permissions.length}{" "}
              {row.permissions.length === 1 ? "permiso" : "permisos"},
              agrupados por área.
            </p>
          </div>
          <StatusBadge active={row.active} />
        </div>
        <PermissionSummary permissions={row.permissions} />
      </section>
    </div>
  );
}

export function RoleFormPage() {
  const { id } = useParams();
  const detail = useQuery({
    queryKey: queryKeys.role(id ?? "new"),
    queryFn: () => rolesApi.detail(id!),
    enabled: Boolean(id),
  });
  if (id && detail.isLoading) return <div className="panel">Cargando rol…</div>;
  if (id && detail.error)
    return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <RoleEditor id={id} initial={detail.data} />;
}

function RoleEditor({ id, initial }: { id?: string; initial?: Role }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<RoleInput>(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description,
          permissions: initial.permissions,
          active: initial.active,
        }
      : { name: "", description: "", permissions: [], active: true },
  );
  const mutation = useMutation({
    mutationFn: (body: RoleInput) =>
      id ? rolesApi.update(id, body) : rolesApi.create(body),
    onSuccess: async (row) => {
      client.setQueryData(queryKeys.role(row.id), row);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.rolesRoot }),
        invalidateUserRoleIntegration(client),
      ]);
      void navigate(`/app/admin/roles/${row.id}`, { replace: true });
    },
  });
  const groupedCatalog = useMemo(
    () => Object.entries(permissionsByDomain(PERMISSION_CATALOG)),
    [],
  );
  function toggle(permission: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      permissions: checked
        ? [...current.permissions, permission]
        : current.permissions.filter((item) => item !== permission),
    }));
  }
  function toggleGroup(permissions: readonly string[], allChecked: boolean) {
    setForm((current) => ({
      ...current,
      permissions: allChecked
        ? current.permissions.filter((item) => !permissions.includes(item))
        : [...new Set([...current.permissions, ...permissions])],
    }));
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administración"
        title={id ? "Editar rol" : "Nuevo rol"}
        description="Un rol es un conjunto de permisos con nombre. Marcá lo que va a poder hacer quien tenga este rol."
      />
      <form
        className="panel erp-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(form);
        }}
      >
        <FormFeedback
          error={mutation.error ? apiErrorMessage(mutation.error) : null}
        />

        <fieldset className="form-section">
          <legend>Datos del rol</legend>
          <div className="form-grid">
            <Field
              label="Nombre"
              htmlFor="role-name"
              required
              hint="En minúsculas, sin espacios. Ej.: cajero, comprador."
            >
              <input
                id="role-name"
                required
                minLength={2}
                maxLength={60}
                pattern="[a-z0-9-]+"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>
            <Field
              label="Para qué es"
              htmlFor="role-description"
              required
            >
              <textarea
                id="role-description"
                required
                minLength={1}
                maxLength={200}
                placeholder="Ej.: Cobra en el mostrador y maneja la caja."
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm({ ...form, active: event.target.checked })
                }
              />{" "}
              Rol activo (se puede asignar a usuarios)
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>
            Permisos · {form.permissions.length} de{" "}
            {PERMISSION_CATALOG.length} marcados
          </legend>
          <p className="muted">
            Marcá lo que este rol puede hacer. Usá «Marcar todos» por área para
            ir rápido.
          </p>
          <div className="permission-groups">
            {groupedCatalog.map(([domain, permissions]) => {
              const allChecked = permissions.every((permission) =>
                form.permissions.includes(permission),
              );
              return (
                <div key={domain}>
                  <div className="permission-group__head">
                    <strong>{domainLabel(domain)}</strong>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => toggleGroup(permissions, allChecked)}
                    >
                      {allChecked ? "Quitar todos" : "Marcar todos"}
                    </button>
                  </div>
                  <div className="permission-options">
                    {permissions.map((permission) => (
                      <label
                        className="permission-option"
                        key={permission}
                        title={permission}
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(permission)}
                          onChange={(event) =>
                            toggle(permission, event.target.checked)
                          }
                        />
                        <span className="permission-option__text">
                          <span className="permission-option__name">
                            {permissionLabel(permission)}
                          </span>
                          {permissionDescription(permission) ? (
                            <span className="permission-option__hint">
                              {permissionDescription(permission)}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar rol
          </Button>
        </div>
      </form>
    </div>
  );
}
