import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  catalogApi,
  type AttributeDefinitionInput,
  type CatalogInput,
} from "../api/catalog-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ErpTable, type ErpColumn } from "../components/ErpTable";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { queryKeys } from "../query/query-keys";
import { invalidateProductReferenceIntegration } from "../query/invalidation";
import type {
  CatalogRecord,
  ProductAttributeDefinition,
  ProductBrand,
  ProductCategory,
} from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";

type Editor = {
  id?: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
};
const blankEditor: Editor = {
  code: "",
  name: "",
  description: "",
  active: true,
};

function CatalogPage<T extends CatalogRecord>({
  kind,
  title,
  description,
  createLabel,
  emptyDescription,
  usageColumns = [],
  queryKey,
  queryFn,
  createFn,
  updateFn,
  hasDescription = false,
}: {
  kind: string;
  title: string;
  description: string;
  /** Specific button/heading verb, e.g. "Nueva categoría". */
  createLabel: string;
  /** Shown when the list is empty (no filters exist on these screens). */
  emptyDescription: string;
  /** Columns that show how much each record is used elsewhere. */
  usageColumns?: ErpColumn<T>[];
  queryKey: readonly unknown[];
  queryFn: () => Promise<T[]>;
  createFn: (input: CatalogInput) => Promise<T>;
  updateFn: (id: string, input: Partial<CatalogInput>) => Promise<T>;
  hasDescription?: boolean;
}) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission("products.create");
  const canUpdate = hasPermission("products.update");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({ queryKey, queryFn });
  const mutation = useMutation({
    mutationFn: async (value: Editor) => {
      const input = {
        code: value.code,
        name: value.name,
        ...(hasDescription
          ? {
              description:
                value.id || value.description ? value.description : undefined,
            }
          : {}),
        active: value.active,
      };
      return value.id ? updateFn(value.id, input) : createFn(input);
    },
    onSuccess: async (_, value) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        invalidateProductReferenceIntegration(queryClient),
      ]);
      setSuccess(
        `${kind} ${value.id ? (kind === "Categoría" ? "actualizada" : "actualizado") : kind === "Categoría" ? "creada" : "creado"} correctamente.`,
      );
      setEditor(null);
    },
  });
  const columns: ErpColumn<T>[] = [
    { key: "code", header: "Código", cell: (row) => <code>{row.code}</code> },
    { key: "name", header: "Nombre", cell: (row) => row.name },
    ...(hasDescription
      ? [
          {
            key: "description",
            header: "Descripción",
            cell: (row: T) => row.description || "—",
          },
        ]
      : []),
    ...usageColumns,
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
            cell: (row: T) => (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSuccess(null);
                  setEditor({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    description: row.description ?? "",
                    active: row.active,
                  });
                }}
              >
                Editar
              </Button>
            ),
          },
        ]
      : []),
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (editor) mutation.mutate(editor);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Mantenimientos"
        title={title}
        description={description}
        actions={
          canCreate && !editor ? (
            <Button
              onClick={() => {
                setSuccess(null);
                setEditor(blankEditor);
              }}
            >
              {createLabel}
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      {editor ? (
        <form className="panel erp-form" onSubmit={submit}>
          <div className="form-heading">
            <div>
              <h2>
                {editor.id ? "Editar" : "Crear"} {kind.toLowerCase()}
              </h2>
              <p>Los códigos se normalizan y validan en el servidor.</p>
            </div>
          </div>
          <FormFeedback
            error={mutation.error ? apiErrorMessage(mutation.error) : null}
          />
          <div className="form-grid">
            <Field label="Código" htmlFor={`${kind}-code`} required>
              <input
                id={`${kind}-code`}
                required
                minLength={2}
                maxLength={60}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={editor.code}
                onChange={(e) => setEditor({ ...editor, code: e.target.value })}
              />
            </Field>
            <Field label="Nombre" htmlFor={`${kind}-name`} required>
              <input
                id={`${kind}-name`}
                required
                minLength={2}
                maxLength={120}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </Field>
            {hasDescription ? (
              <Field label="Descripción" htmlFor={`${kind}-description`}>
                <textarea
                  id={`${kind}-description`}
                  maxLength={500}
                  value={editor.description}
                  onChange={(e) =>
                    setEditor({ ...editor, description: e.target.value })
                  }
                />
              </Field>
            ) : null}
            <label className="check-field">
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(e) =>
                  setEditor({ ...editor, active: e.target.checked })
                }
              />{" "}
              Activo
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
            <Button type="submit" loading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={query.data}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          error={query.error ? apiErrorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
          emptyTitle={`Todavía no hay ${title.toLowerCase()}`}
          emptyDescription={emptyDescription}
        />
      </section>
    </div>
  );
}

function UsageCount({ value, one, many }: {
  value: number | undefined;
  one: string;
  many: string;
}) {
  if (value === undefined) return <>—</>;
  if (value === 0) return <span className="muted">Sin uso</span>;
  return (
    <>
      {value} {value === 1 ? one : many}
    </>
  );
}

const VALUE_TYPE_LABELS: Record<
  ProductAttributeDefinition["valueType"],
  string
> = {
  STRING: "Texto",
  NUMBER: "Número",
  BOOLEAN: "Sí / No",
};

export function ProductCategoriesPage() {
  return (
    <CatalogPage<ProductCategory>
      kind="Categoría"
      title="Categorías de producto"
      description="Los grupos con los que ordenás el catálogo (Filtros, Frenos, Lubricantes). Se eligen al crear un producto y agrupan sus atributos técnicos."
      createLabel="Nueva categoría"
      emptyDescription="Creá las categorías con las que trabajás antes de dar de alta productos. Aparecerán en la lista al crear cada producto."
      usageColumns={[
        {
          key: "products",
          header: "Productos",
          cell: (row) => (
            <UsageCount
              value={row._count?.products}
              one="producto"
              many="productos"
            />
          ),
        },
        {
          key: "attributes",
          header: "Atributos",
          cell: (row) => (
            <UsageCount
              value={row._count?.attributeDefinitions}
              one="atributo"
              many="atributos"
            />
          ),
        },
      ]}
      queryKey={queryKeys.productCategories}
      queryFn={catalogApi.categories}
      createFn={catalogApi.createCategory}
      updateFn={catalogApi.updateCategory}
      hasDescription
    />
  );
}

export function ProductBrandsPage() {
  return (
    <CatalogPage<ProductBrand>
      kind="Marca"
      title="Marcas de producto"
      description="El fabricante de la pieza (Bosch, NGK, Monroe). Se elige al crear un producto. No son marcas de carro."
      createLabel="Nueva marca"
      emptyDescription="Creá las marcas de las piezas que vendés. Aparecerán en la lista al crear cada producto y en el filtro de productos."
      usageColumns={[
        {
          key: "products",
          header: "Productos",
          cell: (row) => (
            <UsageCount
              value={row._count?.products}
              one="producto"
              many="productos"
            />
          ),
        },
      ]}
      queryKey={queryKeys.productBrands}
      queryFn={catalogApi.brands}
      createFn={catalogApi.createBrand}
      updateFn={catalogApi.updateBrand}
    />
  );
}

type AttributeEditor = AttributeDefinitionInput & { id?: string };
export function ProductAttributesPage() {
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: catalogApi.categories,
  });
  const definitions = useQuery({
    queryKey: queryKeys.productAttributes(),
    queryFn: () => catalogApi.attributes(),
  });
  const [editor, setEditor] = useState<AttributeEditor | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: AttributeEditor) =>
      value.id
        ? catalogApi.updateAttribute(value.id, value)
        : catalogApi.createAttribute(value),
    onSuccess: async (_, value) => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["catalog", "product-attributes"],
        }),
        invalidateProductReferenceIntegration(client),
      ]);
      setSuccess(
        `Atributo ${value.id ? "actualizado" : "creado"} correctamente.`,
      );
      setEditor(null);
    },
  });
  const canCreate = hasPermission("products.create");
  const canUpdate = hasPermission("products.update");
  const columns: ErpColumn<ProductAttributeDefinition>[] = [
    { key: "category", header: "Categoría", cell: (row) => row.category.name },
    { key: "code", header: "Código", cell: (row) => <code>{row.code}</code> },
    { key: "name", header: "Nombre", cell: (row) => row.name },
    {
      key: "type",
      header: "Tipo de dato",
      cell: (row) =>
        `${VALUE_TYPE_LABELS[row.valueType]}${row.unit ? ` · ${row.unit}` : ""}`,
    },
    {
      key: "required",
      header: "Obligatorio",
      cell: (row) => (row.required ? "Sí" : "No"),
    },
    {
      key: "usage",
      header: "En uso",
      cell: (row) => (
        <UsageCount
          value={row._count?.values}
          one="producto"
          many="productos"
        />
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
            cell: (row: ProductAttributeDefinition) => (
              <Button
                variant="ghost"
                onClick={() =>
                  setEditor({
                    id: row.id,
                    categoryId: row.categoryId,
                    code: row.code,
                    name: row.name,
                    valueType: row.valueType,
                    unit: row.unit ?? "",
                    required: row.required,
                    active: row.active,
                  })
                }
              >
                Editar
              </Button>
            ),
          },
        ]
      : []),
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (editor) mutation.mutate(editor);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Mantenimientos"
        title="Atributos de producto"
        description="Las características técnicas de cada categoría (diámetro, rosca, viscosidad). Aparecen como campos para llenar al crear un producto de esa categoría."
        actions={
          canCreate && !editor ? (
            <Button
              onClick={() =>
                setEditor({
                  categoryId: "",
                  code: "",
                  name: "",
                  valueType: "STRING",
                  unit: "",
                  required: false,
                  active: true,
                })
              }
            >
              Nuevo atributo
            </Button>
          ) : undefined
        }
      />
      <FormFeedback success={success} />
      {editor ? (
        <form className="panel erp-form" onSubmit={submit}>
          <h2>{editor.id ? "Editar" : "Crear"} atributo</h2>
          <FormFeedback
            error={mutation.error ? apiErrorMessage(mutation.error) : null}
          />
          <div className="form-grid">
            <Field label="Categoría" htmlFor="attribute-category" required>
              <select
                id="attribute-category"
                required
                value={editor.categoryId}
                onChange={(e) =>
                  setEditor({ ...editor, categoryId: e.target.value })
                }
              >
                <option value="">Seleccionar</option>
                {categories.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Código" htmlFor="attribute-code" required>
              <input
                id="attribute-code"
                required
                minLength={2}
                maxLength={60}
                value={editor.code}
                onChange={(e) => setEditor({ ...editor, code: e.target.value })}
              />
            </Field>
            <Field label="Nombre" htmlFor="attribute-name" required>
              <input
                id="attribute-name"
                required
                minLength={2}
                maxLength={120}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </Field>
            <Field label="Tipo de valor" htmlFor="attribute-type" required>
              <select
                id="attribute-type"
                value={editor.valueType}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    valueType: e.target.value as AttributeEditor["valueType"],
                  })
                }
              >
                <option value="STRING">Texto</option>
                <option value="NUMBER">Número</option>
                <option value="BOOLEAN">Sí / No</option>
              </select>
            </Field>
            <Field label="Unidad" htmlFor="attribute-unit">
              <input
                id="attribute-unit"
                maxLength={30}
                value={editor.unit}
                onChange={(e) => setEditor({ ...editor, unit: e.target.value })}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={editor.required}
                onChange={(e) =>
                  setEditor({ ...editor, required: e.target.checked })
                }
              />{" "}
              Requerido
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(e) =>
                  setEditor({ ...editor, active: e.target.checked })
                }
              />{" "}
              Activo
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
            <Button type="submit" loading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
      <section className="panel">
        <ErpTable
          columns={columns}
          rows={definitions.data}
          rowKey={(row) => row.id}
          loading={definitions.isLoading}
          error={
            definitions.error ? apiErrorMessage(definitions.error) : undefined
          }
          onRetry={() => void definitions.refetch()}
          emptyTitle="Todavía no hay atributos"
          emptyDescription="Definí primero una categoría, luego agregá sus atributos técnicos. Se pedirán al crear productos de esa categoría."
        />
      </section>
    </div>
  );
}
