import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./timestamps";

describe("formatTimestamp", () => {
  it("includes the date and clock in UTC", () => {
    expect(formatTimestamp(new Date("2026-08-28T14:35:42Z"))).toBe("2026-08-28 14:35 UTC");
  });

  it("normalizes timestamps with an offset", () => {
    expect(formatTimestamp(new Date("2026-08-28T16:35:00+02:00"))).toBe(
      "2026-08-28 14:35 UTC",
    );
  });
});
