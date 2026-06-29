import { useState } from 'react';
import { Booking } from '../types';
import { Calendar, Receipt, CheckCircle, Clock, AlertCircle, Star, Award } from 'lucide-react';

interface GuestDashboardProps {
  bookings: Booking[];
  currentUserId: string;
  onCancelBooking: (bookingId: string) => void;
  onSubmitReview: (bookingId: string, rating: number) => void;
}

export default function GuestDashboard({ bookings, currentUserId, onCancelBooking, onSubmitReview }: GuestDashboardProps) {
  // Filter bookings belonging to current user
  const guestBookings = bookings.filter((b) => b.guestId === currentUserId);
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [hoverRatings, setHoverRatings] = useState<Record<string, number>>({});

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
    <div className="space-y-6 animate-fadeIn pb-10">

      {guestBookings.length === 0 ? (
        <div className="text-center py-16 bg-white border border-neutral-200 rounded-3xl flex flex-col items-center justify-center p-6">
          <Calendar className="w-12 h-12 text-blue-500/40 mb-2" />
          <h3 className="font-bold text-neutral-800 text-base">신청 완료된 현장 임장 및 홈투어 예약이 없습니다.</h3>
          <p className="text-neutral-400 text-xs mt-1 max-w-xs leading-relaxed font-semibold">
            매물 탐색 목록에서 관심이 가는 하이엔드 오두막 상가, 리노베이션 주택을 찾아 오픈하우스 임장을 제안하고 예약해보세요!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {guestBookings.map((booking) => {
            const isPending = booking.status === 'pending';
            const isConfirmed = booking.status === 'confirmed';
            const isCancelled = booking.status === 'cancelled';
            const isCompleted = booking.status === 'completed';

            const baseTicketTotal = (booking.housePricePerVisit || 0) * (booking.totalVisitors || 1);
            const extraFees = booking.totalPrice - baseTicketTotal;

            const draft = draftRatings[booking.id] ?? 0;
            const hover = hoverRatings[booking.id] ?? 0;
            const display = hover || draft || booking.rating || 0;
            const alreadyReviewed = typeof booking.rating === 'number';

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Title and image block */}
                  <div className="flex gap-4">
                    <img
                      src={booking.houseImage}
                      alt={booking.houseTitle}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 bg-neutral-100 border border-neutral-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-11 flex-wrap">
                        {isConfirmed && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>투어 가이드 확정</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <Clock className="w-3 h-3 animate-pulse text-blue-600" />
                            <span>파트너 승인 대기중</span>
                          </span>
                        )}
                        {isCancelled && (
                          <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            <span>임장 거절·취소됨</span>
                          </span>
                        )}
                        {isCompleted && (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <Award className="w-3 h-3 text-indigo-600" />
                            <span>임장 가이드 완료</span>
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-neutral-850 text-sm md:text-base leading-snug truncate mt-1.5" title={booking.houseTitle}>
                        {booking.houseTitle}
                      </h4>
                    </div>
                  </div>

                  {/* Date information and location */}
                  <div className="bg-blue-55/10 rounded-xl p-3 text-xs text-neutral-600 space-y-1.5 font-semibold border border-blue-100 bg-blue-50/20">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">지정 구정일</span>
                      <span className="text-neutral-800 font-bold">{booking.visitDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">임장 및 면담 시간대</span>
                      <span className="text-neutral-800 font-bold">{booking.visitTimeSlot}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">동행 실사단</span>
                      <span className="text-neutral-800 font-bold">{booking.totalVisitors}명 (신청인 포함)</span>
                    </div>
                  </div>

                  {/* Payment Receipt breakdown toggle style */}
                  <div className="border-t border-neutral-100 pt-3.5 space-y-1.5">
                    <div className="flex items-center text-xs font-bold text-neutral-500 mb-1">
                      <Receipt className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      <span>임장 가이드 & 청구 영수증 상세</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 font-semibold">
                      <span>오픈하우스 입장 개방료 (₩{booking.housePricePerVisit?.toLocaleString()} × {booking.totalVisitors}인)</span>
                      <span>₩{baseTicketTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 font-semibold">
                      <span>다과류 완비 및 중개 수수료</span>
                      <span>₩{extraFees.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-neutral-900 font-bold border-t border-dashed border-neutral-200 pt-2 font-mono">
                      <span>최종 정산 합계액</span>
                      <span className="text-blue-600 font-black">₩{booking.totalPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Star rating block for completed tours */}
                  {isCompleted && (
                    <div className="border-t border-neutral-100 pt-3.5">
                      <div className="flex items-center text-xs font-bold text-neutral-500 mb-2">
                        <Star className="w-3.5 h-3.5 mr-1 text-amber-500" />
                        <span>{alreadyReviewed ? '내가 남긴 임장 가이드 평점' : '임장 가이드 별점 평가'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const filled = star <= display;
                          return (
                            <button
                              key={star}
                              type="button"
                              disabled={alreadyReviewed}
                              onClick={() => {
                                if (alreadyReviewed) return;
                                setDraftRatings((prev) => ({ ...prev, [booking.id]: star }));
                              }}
                              onMouseEnter={() => {
                                if (alreadyReviewed) return;
                                setHoverRatings((prev) => ({ ...prev, [booking.id]: star }));
                              }}
                              onMouseLeave={() => {
                                if (alreadyReviewed) return;
                                setHoverRatings((prev) => ({ ...prev, [booking.id]: 0 }));
                              }}
                              className={`p-0.5 transition-transform ${alreadyReviewed ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                              aria-label={`${star}점`}
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  filled ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
                                }`}
                              />
                            </button>
                          );
                        })}
                        <span className="text-xs font-bold text-neutral-600 ml-2">
                          {display ? `${display}.0 / 5.0` : '별점을 선택하세요'}
                        </span>
                      </div>
                      {!alreadyReviewed && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={!draft}
                            onClick={() => {
                              if (!draft) return;
                              onSubmitReview(booking.id, draft);
                            }}
                            className="text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            별점 평가 등록
                          </button>
                        </div>
                      )}
                      {alreadyReviewed && (
                        <p className="text-[11px] text-neutral-400 mt-2 font-semibold">
                          평가가 등록되었습니다. 매물 평점에 반영됩니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Cancel button */}
                {!isCancelled && !isCompleted && (
                  <div className="mt-4 pt-3.5 border-t border-neutral-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (confirm('정말로 이 스페이스 임장 투어 일정을 철회 신청합니까?')) {
                          onCancelBooking(booking.id);
                        }
                      }}
                      className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      실사 일정 취소(철회) 요청
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
