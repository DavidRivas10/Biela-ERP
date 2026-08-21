import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErpTable } from "./ErpTable";
import { Pagination } from "./Pagination";

describe("reusable ERP components", () => {
  it("renders accessible table semantics and preserves row order", () => {
    render(
      <ErpTable
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (row: { id: string; name: string }) => row.name,
          },
        ]}
        rows={[
          { id: "2", name: "Segundo" },
          { id: "1", name: "Primero" },
        ]}
        rowKey={(row) => row.id}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Segundo");
    expect(rows[2]).toHaveTextContent("Primero");
    expect(
      screen.getByRole("columnheader", { name: "Nombre" }),
    ).toBeInTheDocument();
  });

  it("renders loading, empty, and error states", () => {
    const { rerender } = render(
      <ErpTable columns={[]} rows={[]} rowKey={() => "key"} loading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando registros");
    rerender(<ErpTable columns={[]} rows={[]} rowKey={() => "key"} />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    rerender(
      <ErpTable
        columns={[]}
        rows={[]}
        rowKey={() => "key"}
        error="Fallo controlado"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Fallo controlado");
  });

  it("supports pagination boundaries", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        meta={{ page: 2, limit: 20, total: 60, pages: 3 }}
        onPageChange={onPageChange}
        ariaLabel="Paginación de productos"
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Paginación de productos" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("uses an alert dialog and allows cancellation with Escape", () => {
    const cancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Confirmar transferencia"
        description="Modifica existencias"
        onConfirm={vi.fn()}
        onCancel={cancel}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
