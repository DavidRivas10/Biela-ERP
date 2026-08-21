import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { salesApi } from "../api/sales-api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { CommercialStatusBadge } from "../components/CommercialStatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LocationSelector } from "../components/EntitySelectors";
import { Field } from "../components/Field";
import { FormFeedback } from "../components/FormFeedback";
import { PageHeader } from "../components/PageHeader";
import { queryKeys } from "../query/query-keys";
import type { SaleItem } from "../types/sales";
import { apiErrorMessage } from "../utils/api-error";
import { formatMoney } from "../utils/formatters";

type ReturnLine = { selected: boolean; destinationLocationId: string; quantityReturned: string };

export function SaleReturnCreatePage() {
  const { id: saleId = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const sale = useQuery({ queryKey: queryKeys.sale(saleId), queryFn: () => salesApi.detail(saleId) });
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Record<string, ReturnLine>>({});
  const mutation = useMutation({ mutationFn: () => salesApi.createReturn(saleId, { reason, items: Object.entries(lines).filter(([, line]) => line.selected).map(([saleItemId, line]) => ({ saleItemId, destinationLocationId: line.destinationLocationId, quantityReturned: Number(line.quantityReturned) })) }), onSuccess: async (row) => { await Promise.all([client.invalidateQueries({ queryKey: queryKeys.saleReturnsRoot }), client.invalidateQueries({ queryKey: queryKeys.sale(saleId) })]); void navigate(`/app/sales/returns/${row.id}`, { replace: true }); } });
  const update = (item: SaleItem, changes: Partial<ReturnLine>) => setLines((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { selected: false, destinationLocationId: item.sourceLocationId, quantityReturned: "1" }), ...changes } }));
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }
  if (sale.isLoading) return <div className="panel">Cargando venta…</div>;
  if (!sale.data || sale.error) return <FormFeedback error={apiErrorMessage(sale.error)} />;
  if (sale.data.status !== "POSTED") return <FormFeedback error="Solo una venta POSTED admite devoluciones." />;
  const eligible = (sale.data.items ?? []).filter((item) => item.netQuantity > 0);
  return <div className="page-stack"><PageHeader eyebrow="Devoluciones de venta" title={`Nueva devolución · Venta #${sale.data.number}`} description="El borrador no repone inventario. El POST posterior ejecutará entradas atómicas." />
    <form className="panel erp-form" onSubmit={submit}><FormFeedback error={mutation.error ? apiErrorMessage(mutation.error) : null} /><Field label="Motivo" htmlFor="return-reason" required><textarea id="return-reason" required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <fieldset className="form-section"><legend>Líneas elegibles</legend>{eligible.length === 0 && <p>No quedan cantidades elegibles para devolver.</p>}{eligible.map((item) => { const line = lines[item.id] ?? { selected: false, destinationLocationId: item.sourceLocationId, quantityReturned: "1" }; return <div className="purchase-line" key={item.id}><label className="check-field"><input type="checkbox" checked={line.selected} onChange={(e) => update(item, { selected: e.target.checked })} />{item.product.code} · {item.product.name} (máx. {item.netQuantity})</label><LocationSelector id={`return-location-${item.id}`} label="Ubicación destino" required={line.selected} enabled={line.selected} value={line.destinationLocationId} onChange={(destinationLocationId) => update(item, { destinationLocationId })} /><Field label="Cantidad" htmlFor={`return-quantity-${item.id}`} required={line.selected}><input id={`return-quantity-${item.id}`} disabled={!line.selected} required={line.selected} type="number" min={1} max={item.netQuantity} value={line.quantityReturned} onChange={(e) => update(item, { quantityReturned: e.target.value })} /></Field></div>; })}</fieldset>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button><Button type="submit" loading={mutation.isPending} disabled={!eligible.some((item) => lines[item.id]?.selected)}>Crear borrador</Button></div></form>
  </div>;
}

export function SaleReturnDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({ queryKey: queryKeys.saleReturn(id), queryFn: () => salesApi.returnDetail(id) });
  const post = useMutation({ mutationFn: () => salesApi.postReturn(id), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: queryKeys.saleReturn(id) }), client.invalidateQueries({ queryKey: queryKeys.saleReturnsRoot }), client.invalidateQueries({ queryKey: queryKeys.salesRoot }), client.invalidateQueries({ queryKey: queryKeys.inventoryRoot }), client.invalidateQueries({ queryKey: queryKeys.movementsRoot }), client.invalidateQueries({ queryKey: queryKeys.receivablesRoot }), client.invalidateQueries({ queryKey: queryKeys.customerAccountsRoot })]); setConfirm(false); } });
  if (detail.isLoading) return <div className="panel">Cargando devolución…</div>;
  if (!detail.data || detail.error) return <FormFeedback error={apiErrorMessage(detail.error)} />;
  const row = detail.data;
  return <div className="page-stack"><PageHeader eyebrow="Devoluciones de venta" title={`Devolución #${row.number}`} description={`Venta #${row.sale.number} · ${row.reason}`} actions={<><CommercialStatusBadge status={row.status} /><Link className="button button--secondary" to={`/app/sales/${row.saleId}`}>Ver venta</Link>{row.status === "DRAFT" && hasPermission("sales.return") && <Button onClick={() => setConfirm(true)}>Postear devolución</Button>}{row.status === "POSTED" && (hasPermission("payments.read") || hasPermission("payments.create")) && <Link className="button button--secondary" to={`/app/sales/returns/${row.id}/refunds`}>Reembolsos</Link>}</>} />
    <section className="panel"><h2>Líneas devueltas</h2><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Destino</th><th>Valor línea original</th></tr></thead><tbody>{row.items.map((item) => <tr key={item.id}><td>{item.saleItem.product.code} · {item.saleItem.product.name}</td><td>{item.quantityReturned}</td><td>{item.destinationLocation.code} · {item.destinationLocation.name}</td><td>{formatMoney(item.saleItem.lineTotal)}</td></tr>)}</tbody></table></div></section>
    {row.refundSummary && <section className="panel metric-grid"><article className="metric-card"><span>Valor devolución</span><strong>{formatMoney(row.refundSummary.returnValue)}</strong></article><article className="metric-card"><span>Reembolsado</span><strong>{formatMoney(row.refundSummary.refundedAmount)}</strong></article><article className="metric-card"><span>Reembolsable</span><strong>{formatMoney(row.refundSummary.refundableAmount)}</strong></article></section>}
    {post.error && <FormFeedback error={apiErrorMessage(post.error)} />}
    <ConfirmDialog open={confirm} title="Postear devolución" description="Esta acción repondrá inventario en las ubicaciones indicadas y no es editable después." confirmLabel="Postear devolución" loading={post.isPending} onCancel={() => setConfirm(false)} onConfirm={() => post.mutate()} />
  </div>;
}
