interface BielaMarkProps {
  /** Pixel size of the square glyph. Defaults to 100% of the parent box. */
  size?: number | string;
  className?: string;
  /** Accessible title. Omit to keep the glyph purely decorative. */
  title?: string;
}

/**
 * BIELA brand glyph: a stylised connecting rod (the "biela" of an engine) —
 * a small end and a big end joined by the rod shank. Drawn with `currentColor`
 * so it inherits the surrounding text colour in any theme.
 */
export function BielaMark({ size = "100%", className, title }: BielaMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {/* small end (wrist-pin eye) */}
      <circle cx="16" cy="7" r="3.9" />
      {/* big end (crank-pin eye) */}
      <circle cx="16" cy="23.5" r="6.6" />
      <circle cx="16" cy="23.5" r="1.7" fill="currentColor" stroke="none" />
      {/* rod shank */}
      <path d="M13 20.4 14.7 10.6M19 20.4 17.3 10.6" />
    </svg>
  );
}
