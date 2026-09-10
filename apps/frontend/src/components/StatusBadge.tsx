import { Badge } from "./Badge";

/**
 * Active/inactive state for a catalog record. "Inactivo" means the record stays
 * in history but is hidden from the pickers used to sell, buy or count — the
 * `title` says so on hover, and screens repeat it in context.
 */
export function StatusBadge({
  active,
  activeLabel = "Activo",
  inactiveLabel = "Inactivo",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      title={
        active
          ? "Disponible para usar en ventas, compras e inventario"
          : "Sigue en el historial, pero no aparece al vender, comprar ni contar inventario"
      }
    >
      <Badge tone={active ? "success" : "neutral"}>
        {active ? activeLabel : inactiveLabel}
      </Badge>
    </span>
  );
}
