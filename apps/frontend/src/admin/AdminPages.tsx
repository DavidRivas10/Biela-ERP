import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { rolesApi, usersApi, type RoleInput, type UserInput } from "../api/admin-api";
import { useAuth } from "../auth/AuthContext";
import { PERMISSION_CATALOG, permissionsByDomain } from "../auth/permission-catalog";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { RoleSelector } from "../components/CashAdminSelectors";
import { ConfirmDialog } from "../components/ConfirmDialog";
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
  return roles.length ? <div className="badge-row">{roles.map((role) => <Badge key={role.id}>{role.name}</Badge>)}</div> : <span>Sin roles</span>;
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const filters = useUrlFilters();
  const [search, setSearch] = useState(filters.values.search ?? "");
  const params = { page: filters.page, limit: filters.limit, search: filters.values.search };
  const list = useQuery({ queryKey: queryKeys.users(params), queryFn: () => usersApi.list(params) });
  const columns: ErpColumn<User>[] = [
    { key: "user", header: "Usuario", cell: (row) => <Link className="table-link" to={`/app/admin/users/${row.id}`}><strong>{row.firstName} {row.lastName}</strong><small>{row.email}</small></Link> },
    { key: "roles", header: "Roles", cell: (row) => <RoleBadges roles={row.roles} /> },
    { key: "active", header: "Estado", cell: (row) => <StatusBadge active={row.active} /> },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Administración" title="Usuarios" description="Identidades y asignaciones de roles administradas por el servicio de usuarios." actions={hasPermission("users.create") ? <Link className="button button--primary" to="/app/admin/users/new">Nuevo usuario</Link> : undefined} />
    <form className="panel filter-bar" onSubmit={(event) => { event.preventDefault(); filters.update({ search }); }}><Field label="Buscar" htmlFor="user-search" hint="Nombre o correo; búsqueda paginada del servidor."><input id="user-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></Field><div className="filter-actions"><Button type="submit">Buscar</Button><Button type="button" variant="ghost" onClick={() => { setSearch(""); filters.clear(); }}>Limpiar</Button></div></form>
    <section className="panel"><ErpTable columns={columns} rows={list.data?.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No se encontraron usuarios" /><Pagination meta={list.data?.meta} onPageChange={(page) => filters.update({ page }, false)} /></section>
  </div>;
}

const emptyUser: UserInput = { email: "", firstName: "", lastName: "", password: "", roleIds: [] };
export function UserFormPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: queryKeys.user(id ?? "new"), queryFn: () => usersApi.detail(id!), enabled: Boolean(id) });
  if (id && detail.isLoading) return <div className="panel">Cargando usuario…</div>;
  if (id && detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <UserEditor id={id} initial={detail.data} />;
}

function UserEditor({ id, initial }: { id?: string; initial?: User }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<UserInput>(() => initial ? { email: initial.email, firstName: initial.firstName, lastName: initial.lastName, roleIds: initial.roles.map((role) => role.id) } : emptyUser);
  const mutation = useMutation({ mutationFn: (body: UserInput) => id ? usersApi.update(id, body) : usersApi.create(body as UserInput & { password: string }), onSuccess: async (row) => { setForm((current) => ({ ...current, password: "" })); client.setQueryData(queryKeys.user(row.id), row); await client.invalidateQueries({ queryKey: queryKeys.usersRoot }); void navigate(`/app/admin/users/${row.id}`, { replace: true }); } });
  function submit(event: FormEvent) { event.preventDefault(); const body: UserInput = { email: form.email, firstName: form.firstName, lastName: form.lastName, roleIds: form.roleIds ?? [] }; if (!id) body.password = form.password; mutation.mutate(body); }
  return <div className="page-stack"><PageHeader eyebrow="Administración" title={id ? "Editar usuario" : "Nuevo usuario"} description="La contraseña inicial nunca se almacena en el navegador ni vuelve a mostrarse." />
    <form className="panel erp-form" onSubmit={submit}><FormFeedback error={mutation.error ? apiErrorMessage(mutation.error) : null} /><div className="form-grid"><Field label="Nombre" htmlFor="user-first" required><input id="user-first" required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></Field><Field label="Apellido" htmlFor="user-last" required><input id="user-last" required maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></Field><Field label="Correo" htmlFor="user-email" required><input id="user-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>{!id ? <Field label="Contraseña inicial" htmlFor="user-password" required hint="Entre 12 y 128 caracteres."><input id="user-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password ?? ""} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field> : null}</div><RoleSelector selected={form.roleIds ?? []} onChange={(roleIds) => setForm({ ...form, roleIds })} /><div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>Guardar usuario</Button></div></form>
  </div>;
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({ queryKey: queryKeys.user(id), queryFn: () => usersApi.detail(id) });
  const lifecycle = useMutation({ mutationFn: (active: boolean) => usersApi.setActive(id, active), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: queryKeys.user(id) }), client.invalidateQueries({ queryKey: queryKeys.usersRoot })]); setConfirm(false); } });
  if (detail.isLoading) return <div className="panel">Cargando usuario…</div>;
  if (detail.error || !detail.data) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const row = detail.data;
  const effective = [...new Set(row.roles.flatMap((role) => role.permissions))].sort();
  const canLifecycle = row.active ? hasPermission("users.deactivate") : hasPermission("users.activate");
  return <div className="page-stack"><PageHeader eyebrow="Administración" title={`${row.firstName} ${row.lastName}`} description={row.email} actions={<>{hasPermission("users.update") ? <Link className="button button--secondary" to={`/app/admin/users/${id}/edit`}>Editar</Link> : null}{canLifecycle ? <Button variant={row.active ? "danger" : "primary"} onClick={() => setConfirm(true)}>{row.active ? "Desactivar" : "Activar"}</Button> : null}</>} />
    <section className="panel detail-grid"><div className="detail-card"><h2>Identidad</h2><dl><div><dt>Correo</dt><dd>{row.email}</dd></div><div><dt>Estado</dt><dd><StatusBadge active={row.active} /></dd></div><div><dt>Roles</dt><dd><RoleBadges roles={row.roles} /></dd></div></dl></div><div className="detail-card"><h2>Permisos efectivos</h2><div className="permission-groups">{Object.entries(permissionsByDomain(effective)).map(([domain, permissions]) => <div key={domain}><strong>{domain}</strong><div className="badge-row">{permissions.map((permission) => <Badge key={permission}>{permission}</Badge>)}</div></div>)}</div></div></section>
    <ConfirmDialog open={confirm} title={`${row.active ? "Desactivar" : "Activar"} usuario`} description="El backend aplicará el cambio de acceso. No se elimina identidad ni historial." dangerous={row.active} loading={lifecycle.isPending} onCancel={() => setConfirm(false)} onConfirm={() => lifecycle.mutate(!row.active)} />
  </div>;
}

export function RolesPage() {
  const { hasPermission } = useAuth();
  const list = useQuery({ queryKey: queryKeys.rolesRoot, queryFn: rolesApi.list });
  const columns: ErpColumn<Role>[] = [
    { key: "role", header: "Rol", cell: (row) => <Link className="table-link" to={`/app/admin/roles/${row.id}`}><strong>{row.name}</strong><small>{row.description}</small></Link> },
    { key: "permissions", header: "Permisos", cell: (row) => `${row.permissions.length} permisos` },
    { key: "active", header: "Estado", cell: (row) => <StatusBadge active={row.active} /> },
  ];
  return <div className="page-stack"><PageHeader eyebrow="Administración" title="Roles" description="Catálogo controlado de permisos exactos emitidos por el backend." actions={hasPermission("roles.manage") ? <Link className="button button--primary" to="/app/admin/roles/new">Nuevo rol</Link> : undefined} /><section className="panel"><ErpTable columns={columns} rows={list.data} rowKey={(row) => row.id} loading={list.isLoading} error={list.error ? apiErrorMessage(list.error) : undefined} onRetry={() => void list.refetch()} emptyTitle="No hay roles" /></section></div>;
}

export function RoleDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const detail = useQuery({ queryKey: queryKeys.role(id), queryFn: () => rolesApi.detail(id) });
  if (detail.isLoading) return <div className="panel">Cargando rol…</div>;
  if (detail.error || !detail.data) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const row = detail.data;
  return <div className="page-stack"><PageHeader eyebrow="Administración" title={row.name} description={row.description} actions={hasPermission("roles.manage") ? <Link className="button button--secondary" to={`/app/admin/roles/${id}/edit`}>Editar</Link> : undefined} /><section className="panel"><div className="section-heading"><div><h2>Permisos exactos</h2><p>Los códigos se envían sin traducción al servicio de usuarios.</p></div><StatusBadge active={row.active} /></div><div className="permission-groups">{Object.entries(permissionsByDomain(row.permissions)).map(([domain, permissions]) => <div key={domain}><strong>{domain}</strong><div className="badge-row">{permissions.map((permission) => <Badge key={permission}>{permission}</Badge>)}</div></div>)}</div></section></div>;
}

export function RoleFormPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: queryKeys.role(id ?? "new"), queryFn: () => rolesApi.detail(id!), enabled: Boolean(id) });
  if (id && detail.isLoading) return <div className="panel">Cargando rol…</div>;
  if (id && detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  return <RoleEditor id={id} initial={detail.data} />;
}

function RoleEditor({ id, initial }: { id?: string; initial?: Role }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<RoleInput>(() => initial ? { name: initial.name, description: initial.description, permissions: initial.permissions, active: initial.active } : { name: "", description: "", permissions: [], active: true });
  const mutation = useMutation({ mutationFn: (body: RoleInput) => id ? rolesApi.update(id, body) : rolesApi.create(body), onSuccess: async (row) => { client.setQueryData(queryKeys.role(row.id), row); await Promise.all([client.invalidateQueries({ queryKey: queryKeys.rolesRoot }), invalidateUserRoleIntegration(client)]); void navigate(`/app/admin/roles/${row.id}`, { replace: true }); } });
  return <div className="page-stack"><PageHeader eyebrow="Administración" title={id ? "Editar rol" : "Nuevo rol"} description="Solo se aceptan los códigos de permiso existentes en el backend." /><form className="panel erp-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(form); }}><FormFeedback error={mutation.error ? apiErrorMessage(mutation.error) : null} /><div className="form-grid"><Field label="Nombre" htmlFor="role-name" required hint="Minúsculas, números y guiones."><input id="role-name" required minLength={2} maxLength={60} pattern="[a-z0-9-]+" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Descripción" htmlFor="role-description" required><textarea id="role-description" required minLength={1} maxLength={200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Rol activo</label></div><fieldset className="form-section"><legend>Permisos</legend><div className="permission-groups">{Object.entries(permissionsByDomain(PERMISSION_CATALOG)).map(([domain, permissions]) => <div key={domain}><strong>{domain}</strong><div className="permission-grid">{permissions.map((permission) => <label className="check-field" key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} onChange={(event) => setForm({ ...form, permissions: event.target.checked ? [...form.permissions, permission] : form.permissions.filter((item) => item !== permission) })} />{permission}</label>)}</div></div>)}</div></fieldset><div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>Guardar rol</Button></div></form></div>;
}
