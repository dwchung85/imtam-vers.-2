import React, { useState } from 'react';
import { House, Booking } from '../types';
import { X, Star, MapPin, Users, Calendar, ShieldCheck, Heart, Building, Clock, Coffee, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HouseDetailProps {
  house: House;
  onClose: () => void;
  onBook: (bookingData: Omit<Booking, 'id' | 'guestId' | 'guestName' | 'status' | 'createdAt'>) => void;
  currentUserRole: 'guest' | 'host';
  currentUserId: string;
}

const TIME_SLOTS = [
  '오전 10:00 ~ 12:00',
  '오후 02:00 ~ 04:00',
  '오후 04:00 ~ 06:00',
  '저녁 07:00 ~ 09:00'
];

export default function HouseDetail({ house, onClose, onBook, currentUserRole, currentUserId }: HouseDetailProps) {
  const today = new Date();
  const formatTodayString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Generate fallback available dates starting tomorrow (next 6 days) if host did not register any
  const getFallbackDates = () => {
    const dates = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const resolvedDates = house.availableDates && house.availableDates.length > 0 
    ? house.availableDates 
    : getFallbackDates();

  const resolvedTimeSlots = house.availableTimeSlots && house.availableTimeSlots.length > 0
    ? house.availableTimeSlots
    : TIME_SLOTS;

  const [visitDate, setVisitDate] = useState<string>(resolvedDates[0]);
  const [visitTimeSlot, setVisitTimeSlot] = useState<string>(resolvedTimeSlots[0]);
  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [hearted, setHearted] = useState<boolean>(false);
  const [successBooking, setSuccessBooking] = useState<boolean>(false);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);

  // Home tour math — 호스트가 등록한 입장 개방료 외 추가 비용은 부과하지 않음
  const rawPrice = house.pricePerVisit * guestsCount;
  const totalPrice = rawPrice;

  const isOwnListing = house.hostId === currentUserId;

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUserRole !== 'guest') {
      alert('게스트(매수 희망자) 모드에서만 매물 임장 투어를 신청할 수 있습니다. 상단의 역할 선택에서 변경해주세요!');
      return;
    }
    
    if (guestsCount > house.maxGuests) {
      alert(`해당 매물의 회차별 최대 가이드 인원(${house.maxGuests}명)을 초과해 동행할 수 없습니다.`);
      return;
    }

    onBook({
      houseId: house.id,
      houseTitle: house.title,
      houseImage: house.imageUrl,
      housePricePerVisit: house.pricePerVisit,
      visitDate,
      visitTimeSlot,
      totalVisitors: guestsCount,
      totalPrice,
    });

    setSuccessBooking(true);
    setTimeout(() => {
      setSuccessBooking(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
      <AnimatePresence>
        {successBooking ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center justify-center border border-blue-100"
          >
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white mb-4 animate-bounce shadow-md">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-neutral-905 tracking-tight mb-2">현장 임장 예약 접수 완료!</h3>
            <p className="text-neutral-600 text-xs md:text-sm font-semibold mb-1">공인중개사 및 소유주에게 투어 안내 예약 신청이 실시간 전달되었습니다.</p>
            <p className="text-[11px] text-neutral-400">내 현장 임장 예약 목록 탭에서 실시간 확정 상태를 조회하실 수 있습니다.</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl"
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white z-10 border-b border-blue-100 flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                  Zilllow Style Imjang Detail
                </span>
                <span className="text-neutral-400 text-xs font-medium">| 매물의뢰 에이전트: {house.hostName}</span>
              </div>
              <button
                id="close-detail-modal"
                onClick={onClose}
                className="p-1 px-2.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 inline-block" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6 grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8">
              {/* Left Column: Image, Description, Amenities (3/5 width) */}
              <div className="md:col-span-3 space-y-6">
                {/* Large Beautiful Cover with Multi-Image Carousel / Gallery */}
                <div className="space-y-3">
                  <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-100 shadow-xs group">
                    {/* Active image render */}
                    <img
                      src={
                        house.imageUrls && house.imageUrls.length > 0
                          ? house.imageUrls[activeImageIdx]
                          : house.imageUrl
                      }
                      alt={`${house.title} - 전경 ${activeImageIdx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 ease-out"
                    />

                    {/* Left & Right Chevron Controls */}
                    {house.imageUrls && house.imageUrls.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIdx((prev) =>
                              prev === 0 ? house.imageUrls!.length - 1 : prev - 1
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-neutral-900 text-white p-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer z-10 flex items-center justify-center"
                          title="이전 사진"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIdx((prev) =>
                              prev === house.imageUrls!.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-neutral-900 text-white p-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer z-10 flex items-center justify-center"
                          title="다음 사진"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>

                        {/* Image Counter Badge */}
                        <div className="absolute bottom-4 left-4 bg-black/60 text-white text-[11px] font-bold px-3 py-1 rounded-full pointer-events-none select-none tracking-widest">
                          {activeImageIdx + 1} / {house.imageUrls.length}
                        </div>
                      </>
                    )}

                    {/* Heart button */}
                    <button
                      onClick={() => setHearted(!hearted)}
                      className="absolute top-4 right-4 bg-white p-2.5 rounded-full shadow-md text-neutral-700 hover:scale-105 active:scale-95 transition-transform cursor-pointer z-10"
                    >
                      <Heart className={`w-5 h-5 ${hearted ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'}`} />
                    </button>
                  </div>

                  {/* Thumbnail Row Indicator for multi-images */}
                  {house.imageUrls && house.imageUrls.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-thin">
                      {house.imageUrls.map((thumb, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIdx(idx)}
                          className={`relative aspect-video w-16 md:w-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                            activeImageIdx === idx
                              ? 'border-blue-600 ring-2 ring-blue-100 opacity-100'
                              : 'border-neutral-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Listing identity info */}
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-neutral-900 leading-snug tracking-tight">
                    {house.title}
                  </h1>
                  
                  {/* Specs row */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <span className="bg-neutral-100 text-neutral-800 text-xs font-bold px-3 py-1 rounded-lg">
                      방 {house.rooms ?? 3}개
                    </span>
                    <span className="bg-neutral-100 text-neutral-800 text-xs font-bold px-3 py-1 rounded-lg">
                      욕실 {house.bathrooms ?? 2}개
                    </span>
                    <span className="bg-blue-50 text-blue-700 text-xs font-extrabold px-3 py-1 rounded-lg">
                      {house.area ?? 24}평 (공급면적)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-neutral-600">
                    {house.reviewsCount && house.reviewsCount > 0 && typeof house.rating === 'number' ? (
                      <span className="flex items-center gap-1 font-semibold text-neutral-800">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span>{house.rating.toFixed(1)}</span>
                        <span className="font-normal text-neutral-500">({house.reviewsCount}명의 전속 바이어 리뷰 만족도)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-semibold text-neutral-500">
                        <Star className="w-4 h-4 text-neutral-300" />
                        <span className="font-normal">아직 등록된 리뷰가 없습니다</span>
                      </span>
                    )}
                    <span className="text-neutral-300">•</span>
                    <span className="flex items-center gap-1 font-medium text-neutral-800">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span>{house.location}</span>
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-neutral-150 pt-5">
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={house.hostAvatar}
                      alt={house.hostName}
                      className="w-12 h-12 rounded-full object-cover border border-neutral-200"
                    />
                    <div>
                      <h4 className="font-bold text-neutral-900">검증된 중개 파트너 {house.hostName}</h4>
                      <p className="text-xs text-neutral-400">매물 실소유주 연계 인증 공인 중개 매칭 전문가</p>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-bold text-neutral-800 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Building className="w-4 h-4 text-blue-600" /> [매물의 건축학적 가치 및 실내 디테일 소개]
                    </h5>
                    <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
                      {house.description}
                    </p>
                  </div>
                </div>

                {/* Amenities section */}
                {house.amenities && house.amenities.length > 0 && (
                  <div className="border-t border-neutral-150 pt-5">
                    <h3 className="font-bold text-neutral-900 text-base mb-3 flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-amber-500" /> 하이엔드 인테리어 포인트 & 건축 혜택 요소
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {house.amenities.map((amenity, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-neutral-700 bg-neutral-50 rounded-xl p-2.5 px-3 border border-neutral-100">
                          <Coffee className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-medium">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Reservation form widget (2/5 width) */}
              <div className="md:col-span-2">
                <div className="sticky top-0 bg-blue-50/10 rounded-3xl border border-blue-100 p-5 space-y-4">
                  <div>
                    <span className="text-2xl font-black text-blue-600">₩{house.pricePerVisit.toLocaleString()}</span>
                    <span className="text-xs text-neutral-500 font-bold block mt-1"> / 현장 투어 코디네이팅 & 임장 개방비</span>
                  </div>

                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    {/* Visitor inputs mapping host-configured arrays: resolvedDates and resolvedTimeSlots */}
                    <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white divide-y divide-neutral-150">
                      <div className="p-3">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span>소유주 등록 방문일 선택 ({resolvedDates.length}개 일자 조율가능)</span>
                        </label>
                        <select
                          value={visitDate}
                          onChange={(e) => setVisitDate(e.target.value)}
                          className="w-full text-xs font-bold focus:outline-hidden text-neutral-850 bg-transparent py-1 cursor-pointer border-none outline-hidden"
                          required
                        >
                          {resolvedDates.map((date) => (
                            <option key={date} value={date}>
                              {date}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="p-3">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>소유주 등록 투어 타임을 선택하세요</span>
                        </label>
                        <select
                          value={visitTimeSlot}
                          onChange={(e) => setVisitTimeSlot(e.target.value)}
                          className="w-full text-xs font-bold focus:outline-hidden text-neutral-850 bg-transparent py-1 cursor-pointer border-none outline-hidden"
                          required
                        >
                          {resolvedTimeSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Guests count */}
                    <div className="border border-neutral-200 rounded-2xl p-3 bg-white">
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">동반 임장 실사 인원</label>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500 font-semibold">총 동반 참석자</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setGuestsCount(Math.max(1, guestsCount - 1))}
                            className="w-7 h-7 flex items-center justify-center border border-neutral-300 rounded-full text-xs font-bold hover:bg-neutral-100 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-sm font-bold text-neutral-800 w-4 text-center">{guestsCount}</span>
                          <button
                            type="button"
                            onClick={() => setGuestsCount(Math.min(house.maxGuests, guestsCount + 1))}
                            className="w-7 h-7 flex items-center justify-center border border-neutral-300 rounded-full text-xs font-bold hover:bg-neutral-100 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">
                        중개자나 소유주가 설정한 회차별 쾌적한 동반 임장 한도는 최대 <strong className="text-neutral-700">{house.maxGuests}명</strong>입니다.
                      </p>
                    </div>

                    {/* Cost Split block */}
                    <div className="space-y-2 pt-3.5 border-t border-neutral-200 text-xs text-neutral-600">
                      <div className="flex justify-between">
                        <span className="underline">오픈하우스 입장 개방료 (₩{house.pricePerVisit.toLocaleString()} × {guestsCount}인)</span>
                        <span>₩{rawPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="underline">다과 및 현장 가이드 브리핑 (3%)</span>
                        <span>₩{guidingFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="underline">IMTAM 안심 중개 매칭 플랫폼 삼자 매칭비 (5%)</span>
                        <span>₩{platformFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-neutral-900 border-t border-neutral-200 pt-2.5 text-sm">
                        <span>총 임장 서비스 예산</span>
                        <span className="text-blue-600 font-black text-base">₩{totalPrice.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {isOwnListing ? (
                      <div className="bg-amber-50 text-amber-800 text-xs rounded-xl p-3 border border-amber-200 text-center font-medium">
                        소유주로 전속 리스팅한 주택은 자가 자격으로 임장을 신청할 수 없습니다.
                      </div>
                    ) : currentUserRole === 'host' ? (
                      <div className="bg-blue-50 text-blue-800 text-xs rounded-xl p-3 border border-blue-100 text-center font-medium leading-relaxed">
                        다른 매물 임장을 원하시면 상단 바의 역할스위치에서 <strong>계정 모드를 &quot;임장 희망자&quot;</strong>로 전환해주세요!
                      </div>
                    ) : (
                      <button
                        type="submit"
                        className="w-full bg-blue-600 cursor-pointer text-white text-sm font-bold py-3.5 px-4 rounded-xl shadow-md hover:bg-blue-700 transition-colors text-center block"
                      >
                        현장 오픈하우스 임장 희망 예약하기
                      </button>
                    )}
                  </form>

                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Zillow-IMTAM 신뢰: 등기 의무 허위 등록 및 불일치시 100% 반환</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
