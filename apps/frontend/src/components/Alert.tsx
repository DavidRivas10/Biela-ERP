import type { ReactNode } from "react";

export function Alert({
  tone = "error",
  title,
  children,
}: {
  tone?: "error" | "warning" | "info";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`alert alert--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      {children ? <div className="alert__body">{children}</div> : null}
    </div>
  );
}
