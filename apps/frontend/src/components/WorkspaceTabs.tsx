import type { ReactNode } from "react";

export interface WorkspaceTabItem<K extends string = string> {
  key: K;
  label: string;
}

/**
 * Shared tab-bar pattern, first built for Ventas (SalesWorkspace) and reused
 * wherever a page needs several independent, full-width sections switched
 * by a tab bar instead of a mode selector or a cramped side-by-side layout.
 *
 * Pair with `TabPanel`: every panel a page renders should stay mounted the
 * whole time (only `TabPanel`'s `hidden` attribute changes), so a panel's
 * own state — filters, loaded rows, whatever — survives switching away and
 * back. `idPrefix` should be unique per page instance so two tab bars on
 * the same page never collide on DOM ids.
 */
export function TabBar<K extends string>({
  idPrefix,
  ariaLabel,
  tabs,
  activeKey,
  onChange,
}: {
  idPrefix: string;
  ariaLabel: string;
  tabs: WorkspaceTabItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="workspace-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.key}`}
          aria-selected={activeKey === tab.key}
          aria-controls={`${idPrefix}-panel-${tab.key}`}
          className="workspace-tab"
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** One tab's content — always mounted, hidden via attribute (not
 * conditional rendering) whenever it isn't the active tab. */
export function TabPanel<K extends string>({
  idPrefix,
  tabKey,
  activeKey,
  children,
}: {
  idPrefix: string;
  tabKey: K;
  activeKey: K;
  children: ReactNode;
}) {
  return (
    <section
      id={`${idPrefix}-panel-${tabKey}`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-tab-${tabKey}`}
      hidden={activeKey !== tabKey}
    >
      {children}
    </section>
  );
}
