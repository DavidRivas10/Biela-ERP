import { useEffect, useState } from "react";
import { catalogApi } from "../api/catalog-api";

/**
 * Renders a product photo that is served behind the bearer token, which a plain
 * `<img src>` cannot send. Fetches the bytes as a Blob, shows them through an
 * object URL, and revokes the URL on unmount or when the photo changes.
 */
export function AuthImage({
  productId,
  photoId,
  alt,
  className,
}: {
  productId: string;
  photoId: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    // Clear the previous image immediately when the target photo changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setFailed(false);
    catalogApi
      .productPhotoBlob(productId, photoId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId, photoId]);

  if (failed) {
    return (
      <span className={`auth-image auth-image--failed ${className ?? ""}`.trim()}>
        No se pudo cargar
      </span>
    );
  }
  if (!url) {
    return (
      <span
        className={`auth-image auth-image--loading ${className ?? ""}`.trim()}
        aria-label={`Cargando ${alt}`}
      />
    );
  }
  return <img className={className} src={url} alt={alt} />;
}
