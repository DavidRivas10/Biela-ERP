import type { ReactNode } from "react";

/**
 * Plain-language explanation shown at the top of a screen or beside a form
 * section. Meant for a non-technical operator: what this screen is for and how
 * it connects to the rest of the ERP. Purely informational, no actions.
 */
export function HelpNote({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="help-note" role="note">
      <span className="help-note__icon" aria-hidden="true">
        i
      </span>
      <div className="help-note__body">
        {title ? <strong>{title}</strong> : null}
        <p>{children}</p>
      </div>
    </aside>
  );
}
