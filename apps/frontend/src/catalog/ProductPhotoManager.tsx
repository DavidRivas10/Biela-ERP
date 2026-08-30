import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { catalogApi } from "../api/catalog-api";
import { AuthImage } from "../components/AuthImage";
import { Button } from "../components/Button";
import { FormFeedback } from "../components/FormFeedback";
import { LoadingState } from "../components/LoadingState";
import { queryKeys } from "../query/query-keys";
import type { ProductPhoto } from "../types/erp";
import { apiErrorMessage } from "../utils/api-error";

const MAX_PHOTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Gallery + uploader for a product's photos (max 5). Reads and writes only the
 * Gateway `/api/products/:id/photos` contract. Photos are infrastructure for a
 * future AI assistant; nothing about them is calculated in the browser.
 */
export function ProductPhotoManager({
  productId,
  canEdit,
}: {
  productId: string;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const photos = useQuery({
    queryKey: queryKeys.productPhotos(productId),
    queryFn: () => catalogApi.productPhotos(productId),
  });
  const list: ProductPhoto[] = photos.data ?? [];
  const atMax = list.length >= MAX_PHOTOS;

  const upload = useMutation({
    mutationFn: (file: File) => catalogApi.uploadProductPhoto(productId, file),
    onSuccess: (next) => {
      client.setQueryData(queryKeys.productPhotos(productId), next);
      setError(null);
    },
    onError: (mutationError) => setError(apiErrorMessage(mutationError)),
  });
  const remove = useMutation({
    mutationFn: (photoId: string) =>
      catalogApi.deleteProductPhoto(productId, photoId),
    onSuccess: (next) => {
      client.setQueryData(queryKeys.productPhotos(productId), next);
      setError(null);
    },
    onError: (mutationError) => setError(apiErrorMessage(mutationError)),
  });

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("La imagen supera los 5 MB. Elige una más liviana.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Fotos del producto</h2>
          <p>
            Hasta {MAX_PHOTOS} imágenes (JPG, PNG o WebP, máx. 5 MB). Quedan
            listas como base para un futuro asistente de IA.
          </p>
        </div>
        {canEdit && !atMax ? (
          <label className="button button--secondary">
            {upload.isPending ? "Subiendo…" : "Agregar foto"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              hidden
              disabled={upload.isPending}
              onChange={pickFile}
            />
          </label>
        ) : null}
      </div>
      {error ? <FormFeedback error={error} /> : null}
      {photos.isLoading ? <LoadingState label="Cargando fotos" /> : null}
      {photos.error ? (
        <FormFeedback error={apiErrorMessage(photos.error)} />
      ) : null}
      {!photos.isLoading && !photos.error && list.length === 0 ? (
        <p className="muted">Este producto todavía no tiene fotos.</p>
      ) : null}
      {list.length > 0 ? (
        <div className="photo-grid">
          {list.map((photo) => (
            <figure className="photo-tile" key={photo.id}>
              <AuthImage
                productId={productId}
                photoId={photo.id}
                alt={photo.originalName}
                className="photo-tile__img"
              />
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(photo.id)}
                >
                  Quitar
                </Button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
      {canEdit && atMax ? (
        <p className="muted">Alcanzaste el máximo de {MAX_PHOTOS} fotos.</p>
      ) : null}
    </section>
  );
}
