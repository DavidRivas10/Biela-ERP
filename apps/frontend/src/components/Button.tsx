import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      loading = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref,
  ) {
    return (
      <button
        className={`button button--${variant} ${className}`.trim()}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading ? (
          <span className="button__spinner" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  },
);
