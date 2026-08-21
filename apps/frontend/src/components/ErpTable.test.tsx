import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErpTable } from "./ErpTable";

describe("ErpTable", () => {
  it("exposes its keyboard-scrollable container as a labelled region", () => {
    render(
      <ErpTable
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (row: { id: string; name: string }) => row.name,
          },
        ]}
        rows={[{ id: "1", name: "Registro" }]}
        rowKey={(row) => row.id}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Tabla desplazable",
    });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
