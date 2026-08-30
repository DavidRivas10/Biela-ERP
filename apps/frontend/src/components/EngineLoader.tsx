interface EngineLoaderProps {
  /** Width in pixels. Height follows the 8:5 viewBox. */
  width?: number;
  className?: string;
  label?: string;
}

/**
 * Animated "engine turning over" loader: three pistons pumping in their
 * cylinder sleeves above a crankshaft, staggered like an inline engine.
 * Motion is CSS-driven and is disabled by the global reduced-motion rule.
 */
export function EngineLoader({
  width = 96,
  className,
  label = "Cargando",
}: EngineLoaderProps) {
  return (
    <span
      className={`engine-loader ${className ?? ""}`.trim()}
      role="status"
      aria-live="polite"
    >
      <svg
        width={width}
        height={(width * 5) / 8}
        viewBox="0 0 80 50"
        fill="none"
        aria-hidden="true"
      >
        {/* cylinder sleeves */}
        {[6, 31, 56].map((x) => (
          <rect
            key={x}
            x={x}
            y={3}
            width={18}
            height={30}
            rx={3}
            stroke="currentColor"
            strokeWidth={2}
            opacity={0.35}
          />
        ))}
        {/* pistons (per-cylinder stagger comes from global.css) */}
        {["a", "b", "c"].map((cyl, index) => (
          <rect
            key={cyl}
            className={`engine-loader__piston engine-loader__piston--${cyl}`}
            x={[6, 31, 56][index] + 2}
            y={6}
            width={14}
            height={12}
            rx={2.5}
            fill="currentColor"
          />
        ))}
        {/* crankcase / crankshaft */}
        <rect
          x={2}
          y={36}
          width={76}
          height={11}
          rx={4}
          stroke="currentColor"
          strokeWidth={2}
          opacity={0.5}
        />
        <circle
          className="engine-loader__crank"
          cx={40}
          cy={41.5}
          r={4}
          fill="currentColor"
        />
      </svg>
      <span className="engine-loader__label">{label}</span>
    </span>
  );
}
