import { Alert } from "./Alert";

export function FormFeedback({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error)
    return (
      <Alert tone="error" title="No se pudo completar la operación">
        {error}
      </Alert>
    );
  if (success)
    return (
      <Alert tone="info" title="Operación completada">
        {success}
      </Alert>
    );
  return null;
}
