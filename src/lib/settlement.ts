// 투어 완료 시 정산 비율: 호스트 80%, IMTAM 20%
export const HOST_PAYOUT_RATE = 0.8;

export function computeSettlement(amount: number): { hostAmount: number; platformAmount: number } {
  const hostAmount = Math.floor(amount * HOST_PAYOUT_RATE);
  return { hostAmount, platformAmount: amount - hostAmount };
}

// 결제 금액은 항상 서버가 매물 가격 × 인원으로 계산 (클라이언트 값 신뢰 안 함)
export function computeTourAmount(pricePerVisit: number, visitors: number): number {
  return pricePerVisit * visitors;
}
