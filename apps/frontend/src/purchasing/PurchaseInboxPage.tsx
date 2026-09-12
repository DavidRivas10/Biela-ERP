import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { purchasingApi } from "../api/purchasing-api";
import { purchasingFinanceApi } from "../api/purchasing-finance-api";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { queryKeys } from "../query/query-keys";
import type { PayableDocument, Purchase } from "../types/purchasing";
import { formatMoney } from "../utils/formatters";
import { PurchaseChain } from "./PurchaseChain";

function PurchaseRow({
  purchase,
  action,
}: {
  purchase: Purchase;
  action: ReactNode;
}) {
  return (
    <li>
      <div>
        <strong>Compra #{purchase.number}</strong>
        <small>
          {purchase.supplier.businessName} ·{" "}
          {purchase.supplierDocumentNumber
            ? `Factura ${purchase.supplierDocumentNumber}`
            : "sin número de factura"}{" "}
          · {formatMoney(purchase.total)}
        </small>
      </div>
      {action}
    </li>
  );
}

export function PurchaseInboxPage() {
  const { hasPermission } = useAuth();
  const canReceive = hasPermission("purchases.receive");
  const canPay = hasPermission("purchases.pay");
  const canReadPayables = hasPermission("commercial-payables.read");

  const purchases = useQuery({
    queryKey: queryKeys.purchases({ inbox: true, page: 1, limit: 50 }),
    queryFn: () => purchasingApi.purchases({ page: 1, limit: 50 }),
  });
  const payables = useQuery({
    queryKey: queryKeys.payables({ inbox: true, page: 1, limit: 10 }),
    queryFn: () => purchasingFinanceApi.payables({ page: 1, limit: 10 }),
    enabled: canReadPayables,
  });

  const rows = purchases.data?.data ?? [];
  const toConfirm = rows.filter((p) => p.status === "DRAFT");
  const toReceive = rows.filter(
    (p) => p.status === "CONFIRMED" || p.status === "PARTIALLY_RECEIVED",
  );
  const toPay = (payables.data?.data ?? []).filter(
    (doc: PayableDocument) => doc.outstandingAmount !== "0.00",
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comprar"
        title="Recepción de facturas"
        description="Lo que tenés pendiente con las facturas de proveedores, en orden: confirmar las nuevas, recibir la mercadería que llegó y pagar lo que se debe."
        actions={
          hasPermission("purchases.create") ? (
            <Link
              className="button button--primary"
              to="/app/purchasing/purchases/new"
            >
              Registrar una factura
            </Link>
          ) : undefined
        }
      />
      <PurchaseChain />

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Por confirmar</h2>
            <p>Facturas registradas que todavía no revisaste y confirmaste.</p>
          </div>
        </div>
        {purchases.isLoading ? (
          <LoadingState label="Buscando facturas" />
        ) : toConfirm.length === 0 ? (
          <EmptyState title="Nada por confirmar">
            Cuando registres una factura nueva, aparecerá acá para revisarla.
          </EmptyState>
        ) : (
          <ul className="pos-list">
            {toConfirm.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                action={
                  <Link
                    className="button button--primary"
                    to={`/app/purchasing/purchases/${purchase.id}`}
                  >
                    Revisar y confirmar
                  </Link>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Esperando mercadería</h2>
            <p>
              Compras confirmadas a las que les falta recibir productos.
            </p>
          </div>
        </div>
        {purchases.isLoading ? (
          <LoadingState label="Buscando compras" />
        ) : toReceive.length === 0 ? (
          <EmptyState title="Nada esperando mercadería">
            Las compras confirmadas ya tienen toda su mercadería recibida.
          </EmptyState>
        ) : (
          <ul className="pos-list">
            {toReceive.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                action={
                  canReceive ? (
                    <Link
                      className="button button--primary"
                      to={`/app/purchasing/purchases/${purchase.id}/receipts`}
                    >
                      Recibir mercadería
                    </Link>
                  ) : (
                    <Link
                      className="button button--secondary"
                      to={`/app/purchasing/purchases/${purchase.id}`}
                    >
                      Ver compra
                    </Link>
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>

      {canReadPayables ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Por pagar</h2>
              <p>Lo que le debés a proveedores por compras confirmadas.</p>
            </div>
            <Link
              className="button button--ghost"
              to="/app/commercial/payables"
            >
              Ver todas
            </Link>
          </div>
          {payables.isLoading ? (
            <LoadingState label="Buscando cuentas por pagar" />
          ) : toPay.length === 0 ? (
            <EmptyState title="No debés nada a proveedores">
              Todas las compras confirmadas están pagadas.
            </EmptyState>
          ) : (
            <ul className="pos-list">
              {toPay.map((doc) => (
                <li key={doc.id}>
                  <div>
                    <strong>
                      Compra #{doc.number}
                      {doc.overdue ? (
                        <Badge tone="danger">Vencida</Badge>
                      ) : null}
                    </strong>
                    <small>
                      {doc.supplier.businessName} · debe{" "}
                      {formatMoney(doc.outstandingAmount)}
                    </small>
                  </div>
                  {canPay ? (
                    <Link
                      className="button button--primary"
                      to={`/app/purchasing/purchases/${doc.id}/payments`}
                    >
                      Pagar
                    </Link>
                  ) : (
                    <Link
                      className="button button--secondary"
                      to={`/app/purchasing/purchases/${doc.id}`}
                    >
                      Ver compra
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
