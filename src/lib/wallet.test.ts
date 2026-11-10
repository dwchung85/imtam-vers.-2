import { describe, it, expect } from "vitest";
import { isValidTopupAmount, isValidWithdrawAmount } from "./wallet";

describe("선불 충전 금액", () => {
  it("만원 단위만 허용", () => {
    expect(isValidTopupAmount(10000)).toBe(true);
    expect(isValidTopupAmount(50000)).toBe(true);
    expect(isValidTopupAmount(15000)).toBe(false);
    expect(isValidTopupAmount(5000)).toBe(false);
    expect(isValidTopupAmount(0)).toBe(false);
  });
});

describe("잔액 환급·출금", () => {
  it("잔액 이하만 출금 가능", () => {
    expect(isValidWithdrawAmount(30000, 30000)).toBe(true);
    expect(isValidWithdrawAmount(30001, 30000)).toBe(false);
    expect(isValidWithdrawAmount(0, 30000)).toBe(false);
  });
});
