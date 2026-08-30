import { describe, expect, it } from "vitest";
import {
  PERMISSION_CATALOG,
  PERMISSION_LABELS,
  domainLabel,
  permissionDescription,
  permissionLabel,
  permissionsByDomain,
} from "./permission-catalog";

describe("permission catalog copy", () => {
  it("has a Spanish label and description for every catalog permission", () => {
    for (const code of PERMISSION_CATALOG) {
      const copy = PERMISSION_LABELS[code];
      expect(copy, `missing copy for ${code}`).toBeDefined();
      expect(copy.label.length).toBeGreaterThan(2);
      expect(copy.description.length).toBeGreaterThan(10);
    }
  });

  it("does not invent copy for codes outside the catalog", () => {
    const catalog = new Set<string>(PERMISSION_CATALOG);
    for (const code of Object.keys(PERMISSION_LABELS)) {
      expect(catalog.has(code), `stale copy for ${code}`).toBe(true);
    }
  });

  it("resolves a readable name for every domain the catalog produces", () => {
    for (const domain of Object.keys(permissionsByDomain(PERMISSION_CATALOG))) {
      expect(domainLabel(domain)).not.toBe(domain);
    }
  });

  it("falls back to the raw code when copy is absent", () => {
    expect(permissionLabel("unknown.permission")).toBe("unknown.permission");
    expect(permissionDescription("unknown.permission")).toBeUndefined();
    expect(domainLabel("unknown")).toBe("unknown");
  });
});
