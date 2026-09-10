import type { ReactNode } from "react";

/**
 * Shown in place of a list or result set. Two tones:
 * - `neutral`: nothing has been created yet.
 * - `search`: a query ran and matched nothing — say what was searched so the
 *   screen never looks broken.
 */
export function EmptyState({
  title,
  children,
  icon,
  action,
  tone = "neutral",
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "search";
}) {
  return (
    <div className={`empty-state empty-state--${tone}`}>
      {icon ? (
        <span className="empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <strong>{title}</strong>
      <p>{children}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
