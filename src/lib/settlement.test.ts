import { describe, expect, it } from "vitest";
import { computeSettlement, computeTourAmount } from "./settlement";

describe("tour settlement", () => {
  it("pays the host 80% and keeps 20% for IMTAM", () => {
    expect(computeSettlement(30000)).toEqual({ hostAmount: 24000, platformAmount: 6000 });
  });

  it("never splits more than the collected amount", () => {
    const { hostAmount, platformAmount } = computeSettlement(30001);
    expect(hostAmount + platformAmount).toBe(30001);
  });

  it("charges 100% of tour cost per visitor up front", () => {
    expect(computeTourAmount(30000, 3)).toBe(90000);
  });
});
