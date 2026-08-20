import { describe, expect, it } from "vitest";
import {
  formatBusinessDate,
  formatCalendarDate,
  formatDateTime,
  formatMoney,
} from "./formatters";

describe("display formatters", () => {
  it("formats exact decimal strings without calculating with floating point", () => {
    expect(formatMoney("12345678901234567890.5")).toBe(
      "L 12,345,678,901,234,567,890.50",
    );
    expect(formatMoney("-2.00")).toBe("-L 2.00");
  });

  it("formats the backend business date in Tegucigalpa", () => {
    expect(formatBusinessDate("2026-08-19")).toMatch(/19/);
    expect(formatCalendarDate("2026-08-19T00:00:00.000Z")).toMatch(/19/);
    expect(formatDateTime("2026-08-19T18:30:00.000Z")).toMatch(/19/);
  });
});
