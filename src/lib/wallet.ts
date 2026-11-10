// 선불 충전 규칙 (금액 단위: 원)
export const TOPUP_UNIT = 10000;
export const TOPUP_MAX = 1_000_000;

export function isValidTopupAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= TOPUP_UNIT && amount <= TOPUP_MAX && amount % TOPUP_UNIT === 0;
}

export function isValidWithdrawAmount(amount: number, balance: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= balance;
}
