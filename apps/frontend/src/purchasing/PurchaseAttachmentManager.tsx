import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { purchasingApi } from "../api/purchasing-api";
import { Button } from "../components/Button";
import { FormFeedback } from "../components/FormFeedback";
import { LoadingState } from "../components/LoadingState";
import { queryKeys } from "../query/query-keys";
import type { PurchaseAttachment } from "../types/purchasing";
import { apiErrorMessage } from "../utils/api-error";
import { formatDateTime } from "../utils/formatters";

const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * List + uploader for a purchase's supplier documents (invoice, remito…).
 * Files are stored by ms-autorepuesto and served through the Gateway behind the
 * bearer token, so viewing fetches the bytes and opens them in a new tab.
 */
export function PurchaseAttachmentManager({
  purchaseId,
  canEdit,
}: {
  purchaseId: string;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const attachments = useQuery({
    queryKey: queryKeys.purchaseAttachments(purchaseId),
    queryFn: () => purchasingApi.attachments(purchaseId),
  });
  const list: PurchaseAttachment[] = attachments.data ?? [];
  const atMax = list.length >= MAX_ATTACHMENTS;

  const upload = useMutation({
    mutationFn: (file: File) =>
      purchasingApi.uploadAttachment(purchaseId, file),
    onSuccess: (next) => {
      client.setQueryData(queryKeys.purchaseAttachments(purchaseId), next);
      setError(null);
    },
    onError: (mutationError) => setError(apiErrorMessage(mutationError)),
  });
  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      purchasingApi.deleteAttachment(purchaseId, attachmentId),
    onSuccess: (next) => {
      client.setQueryData(queryKeys.purchaseAttachments(purchaseId), next);
      setError(null);
    },
    onError: (mutationError) => setError(apiErrorMessage(mutationError)),
  });

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("El archivo supera los 10 MB.");
      return;
    }
    upload.mutate(file);
  }

  async function view(attachment: PurchaseAttachment) {
    const tab = window.open("", "_blank");
    try {
      const blob = await purchasingApi.attachmentBlob(purchaseId, attachment.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (viewError) {
      tab?.close();
      setError(apiErrorMessage(viewError));
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Documentos del proveedor</h2>
          <p>
            Factura, remisión u otros archivos de esta compra (imágenes o PDF,
            máx. 10 MB, hasta {MAX_ATTACHMENTS}).
          </p>
        </div>
        {canEdit && !atMax ? (
          <label className="button button--secondary">
            {upload.isPending ? "Subiendo…" : "Adjuntar archivo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              hidden
              disabled={upload.isPending}
              onChange={pickFile}
            />
          </label>
        ) : null}
      </div>
      {error ? <FormFeedback error={error} /> : null}
      {attachments.isLoading ? (
        <LoadingState label="Cargando documentos" />
      ) : null}
      {attachments.error ? (
        <FormFeedback error={apiErrorMessage(attachments.error)} />
      ) : null}
      {!attachments.isLoading && !attachments.error && list.length === 0 ? (
        <p className="muted">Esta compra todavía no tiene documentos adjuntos.</p>
      ) : null}
      {list.length > 0 ? (
        <ul className="attachment-list">
          {list.map((attachment) => (
            <li key={attachment.id}>
              <span className="attachment-list__name">
                {attachment.originalName}
                <small>
                  {sizeLabel(attachment.sizeBytes)} ·{" "}
                  {formatDateTime(attachment.createdAt)}
                </small>
              </span>
              <span className="row-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void view(attachment)}
                >
                  Ver
                </Button>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(attachment.id)}
                  >
                    Quitar
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
