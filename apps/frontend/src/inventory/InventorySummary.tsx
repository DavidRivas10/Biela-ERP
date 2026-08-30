import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../api/inventory-api";
import { LoadingState } from "../components/LoadingState";
import { queryKeys } from "../query/query-keys";

/**
 * Quick read of how stock is distributed across product categories: total units
 * and a ranked bar per category. Every number comes from the backend aggregate;
 * the browser only draws the bars.
 */
export function InventorySummary() {
  const summary = useQuery({
    queryKey: queryKeys.inventorySummary,
    queryFn: inventoryApi.summary,
    staleTime: 60_000,
  });

  if (summary.isLoading) {
    return (
      <section className="panel">
        <LoadingState label="Resumiendo existencias" />
      </section>
    );
  }
  if (summary.isError || !summary.data) return null;

  const { categories, totalQuantity } = summary.data;
  const withStock = categories.filter((category) => category.totalQuantity > 0);
  const max = Math.max(1, ...withStock.map((c) => c.totalQuantity));

  return (
    <section className="panel stock-summary" aria-label="Existencia total por categoría">
      <div className="section-heading">
        <div>
          <h2>Existencia por categoría</h2>
          <p>
            Total en bodega:{" "}
            <strong>{totalQuantity.toLocaleString("es")} unidades</strong>
          </p>
        </div>
      </div>
      {withStock.length === 0 ? (
        <p className="muted">Todavía no hay existencias registradas.</p>
      ) : (
        <ul className="stock-bars">
          {withStock.map((category) => (
            <li
              key={category.categoryId}
              title={`${category.categoryName}: ${category.totalQuantity} unidades en ${category.inStockProductCount} de ${category.productCount} productos`}
            >
              <span className="stock-bars__label">{category.categoryName}</span>
              <span className="stock-bars__track">
                <span
                  className="stock-bars__fill"
                  style={{
                    width: `${Math.max(4, (category.totalQuantity / max) * 100)}%`,
                  }}
                />
              </span>
              <span className="stock-bars__value">
                {category.totalQuantity.toLocaleString("es")}
                <small>
                  {category.inStockProductCount}/{category.productCount} productos
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
