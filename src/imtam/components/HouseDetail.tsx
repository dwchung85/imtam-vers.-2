import React, { useEffect, useMemo, useState } from "react";
import { House, Booking, SlotLoad } from "../types";
import {
  X,
  Star,
  MapPin,
  Users,
  Calendar,
  ShieldCheck,
  Heart,
  Building,
  Clock,
  Coffee,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchHouseSlotLoad } from "../dbService";
import { T } from "../strings";

interface HouseDetailProps {
  house: House;
  onClose: () => void;
  onBook: (
    bookingData: Omit<Booking, "id" | "guestId" | "guestName" | "status" | "createdAt">,
  ) => Promise<string | null>;
  currentUserId: string;
}

export default function HouseDetail({ house, onClose, onBook, currentUserId }: HouseDetailProps) {
  // 호스트가 등록한 방문 가능 일정만 사용 (가짜 일정 생성 없음)
  const resolvedDates = house.availableDates ?? [];
  const resolvedTimeSlots = house.availableTimeSlots ?? [];
  const hasSchedule = resolvedDates.length > 0 && resolvedTimeSlots.length > 0;

  const [visitDate, setVisitDate] = useState<string>(resolvedDates[0] ?? "");
  const [visitTimeSlot, setVisitTimeSlot] = useState<string>(resolvedTimeSlots[0] ?? "");
  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [hearted, setHearted] = useState<boolean>(false);
  const [successBooking, setSuccessBooking] = useState<boolean>(false);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [slotLoads, setSlotLoads] = useState<SlotLoad[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // 날짜·시간대별 이미 예약된 인원 로드 (중복/초과 예약 방지)
  useEffect(() => {
    let alive = true;
    fetchHouseSlotLoad(house.id)
      .then((loads) => {
        if (alive) setSlotLoads(loads);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [house.id]);

  const bookedFor = (date: string, slot: string) =>
    slotLoads.find((s) => s.visitDate === date && s.visitTimeSlot === slot)?.bookedVisitors ?? 0;

  const remainingFor = (date: string, slot: string) => Math.max(house.maxGuests - bookedFor(date, slot), 0);

  const remainingSeats = useMemo(
    () => remainingFor(visitDate, visitTimeSlot),
    [visitDate, visitTimeSlot, slotLoads, house.maxGuests],
  );

  // 선택한 슬롯의 남은 자리보다 많은 인원이 선택되어 있으면 자동 보정
  useEffect(() => {
    if (remainingSeats > 0 && guestsCount > remainingSeats) setGuestsCount(remainingSeats);
  }, [remainingSeats]);

  const isSlotFull = hasSchedule && remainingSeats === 0;

  // Home tour math — 호스트가 등록한 입장 개방료 외 추가 비용은 부과하지 않음
  const rawPrice = house.pricePerVisit * guestsCount;
  const totalPrice = rawPrice;

  const isOwnListing = house.hostId === currentUserId;

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!hasSchedule) {
      setBookingError(T.houseDetail.hostScheduleMissingError);
      return;
    }
    if (isSlotFull) {
      setBookingError(T.houseDetail.slotFullError);
      return;
    }
    if (guestsCount > remainingSeats) {
      setBookingError(
        `${T.houseDetail.remainingSeatsErrorPrefix}${remainingSeats}${T.houseDetail.remainingSeatsErrorSuffix}`,
      );
      return;
    }

    setSubmitting(true);
    const errorMessage = await onBook({
      houseId: house.id,
      houseTitle: house.title,
      houseImage: house.imageUrl,
      housePricePerVisit: house.pricePerVisit,
      visitDate,
      visitTimeSlot,
      totalVisitors: guestsCount,
      totalPrice,
    });
    setSubmitting(false);

    if (errorMessage) {
      setBookingError(errorMessage);
      // 다른 사용자의 예약으로 정원이 바뀐 경우를 대비해 최신 현황 재조회
      fetchHouseSlotLoad(house.id)
        .then(setSlotLoads)
        .catch(() => {});
      return;
    }

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
            <h3 className="text-xl md:text-2xl font-black text-neutral-905 tracking-tight mb-2">
              {T.houseDetail.successTitle}
            </h3>
            <p className="text-neutral-600 text-xs md:text-sm font-semibold mb-1">{T.houseDetail.successMessage1}</p>
            <p className="text-[11px] text-neutral-400">{T.houseDetail.successMessage2}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl"
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white z-10 border-b border-blue-100 flex items-center justify-end px-6 py-4">
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
                        house.imageUrls && house.imageUrls.length > 0 ? house.imageUrls[activeImageIdx] : house.imageUrl
                      }
                      alt={`${house.title}${T.houseDetail.coverImageAltInfix}${activeImageIdx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 ease-out"
                    />

                    {/* Left & Right Chevron Controls */}
                    {house.imageUrls && house.imageUrls.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIdx((prev) => (prev === 0 ? house.imageUrls!.length - 1 : prev - 1))
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-neutral-900 text-white p-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer z-10 flex items-center justify-center"
                          title={T.houseDetail.prevPhoto}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIdx((prev) => (prev === house.imageUrls!.length - 1 ? 0 : prev + 1))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-neutral-900 text-white p-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer z-10 flex items-center justify-center"
                          title={T.houseDetail.nextPhoto}
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
                      <Heart className={`w-5 h-5 ${hearted ? "fill-rose-500 text-rose-500" : "text-neutral-400"}`} />
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
                              ? "border-blue-600 ring-2 ring-blue-100 opacity-100"
                              : "border-neutral-200 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={thumb} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                      {T.houseDetail.roomsPrefix}
                      {house.rooms ?? 3}
                      {T.houseDetail.unitSuffix}
                    </span>
                    <span className="bg-neutral-100 text-neutral-800 text-xs font-bold px-3 py-1 rounded-lg">
                      {T.houseDetail.bathroomsPrefix}
                      {house.bathrooms ?? 2}
                      {T.houseDetail.unitSuffix}
                    </span>
                    <span className="bg-neutral-100 text-neutral-800 text-xs font-bold px-3 py-1 rounded-lg">
                      {house.area ?? 24}
                      {T.houseDetail.areaSuffix}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-neutral-600">
                    {house.reviewsCount && house.reviewsCount > 0 && typeof house.rating === "number" ? (
                      <span className="flex items-center gap-1 font-semibold text-neutral-800">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span>{house.rating.toFixed(1)}</span>
                        <span className="font-normal text-neutral-500">
                          ({house.reviewsCount}
                          {T.houseDetail.reviewsCountSuffix})
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-semibold text-neutral-500">
                        <Star className="w-4 h-4 text-neutral-300" />
                        <span className="font-normal">{T.houseDetail.noReviewsYet}</span>
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
                      <h4 className="font-bold text-neutral-900">
                        {T.houseDetail.verifiedPartnerPrefix}
                        {house.hostName}
                      </h4>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-bold text-neutral-800 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Building className="w-4 h-4 text-blue-600" /> {T.houseDetail.introTitle}
                    </h5>
                    <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">{house.description}</p>
                  </div>
                </div>

                {/* Amenities section */}
                {house.amenities && house.amenities.length > 0 && (
                  <div className="border-t border-neutral-150 pt-5">
                    <h3 className="font-bold text-neutral-900 text-base mb-3 flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-amber-500" /> {T.houseDetail.amenitiesTitle}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {house.amenities.map((amenity, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm text-neutral-700 bg-neutral-50 rounded-xl p-2.5 px-3 border border-neutral-100"
                        >
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
                    <span className="text-xs text-neutral-500 font-bold block mt-1">{T.houseDetail.perVisitLabel}</span>
                  </div>

                  {!hasSchedule && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] font-bold text-amber-700">
                      {T.houseDetail.noScheduleWarning}
                    </div>
                  )}

                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    {/* Visitor inputs mapping host-configured arrays: resolvedDates and resolvedTimeSlots */}
                    <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white divide-y divide-neutral-150">
                      <div className="p-3">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span>
                            {T.houseDetail.visitDateLabelPrefix}
                            {resolvedDates.length}
                            {T.houseDetail.visitDateLabelSuffix}
                          </span>
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
                          <span>{T.houseDetail.timeSlotLabel}</span>
                        </label>
                        <select
                          value={visitTimeSlot}
                          onChange={(e) => setVisitTimeSlot(e.target.value)}
                          className="w-full text-xs font-bold focus:outline-hidden text-neutral-850 bg-transparent py-1 cursor-pointer border-none outline-hidden"
                          required
                        >
                          {resolvedTimeSlots.map((slot) => {
                            const left = remainingFor(visitDate, slot);
                            return (
                              <option key={slot} value={slot} disabled={left === 0}>
                                {slot}{" "}
                                {left === 0
                                  ? T.houseDetail.slotClosedText
                                  : `${T.houseDetail.slotRemainingPrefix}${left}${T.houseDetail.slotRemainingSuffix}`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {hasSchedule && (
                      <div
                        className={`rounded-xl px-3 py-2 text-[11px] font-bold ${
                          isSlotFull
                            ? "bg-rose-50 border border-rose-200 text-rose-600"
                            : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                        }`}
                      >
                        {isSlotFull
                          ? T.houseDetail.slotFullMessage
                          : `${T.houseDetail.slotRemainingSummaryPart1}${remainingSeats}${T.houseDetail.slotRemainingSummaryPart2}${house.maxGuests}${T.houseDetail.slotRemainingSummaryPart3}`}
                      </div>
                    )}

                    {/* Guests count */}
                    <div className="border border-neutral-200 rounded-2xl p-3 bg-white">
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                        {T.houseDetail.guestsCountLabel}
                      </label>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500 font-semibold">{T.houseDetail.totalGuestsLabel}</span>
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
                            onClick={() =>
                              setGuestsCount(Math.min(Math.min(house.maxGuests, remainingSeats || 1), guestsCount + 1))
                            }
                            className="w-7 h-7 flex items-center justify-center border border-neutral-300 rounded-full text-xs font-bold hover:bg-neutral-100 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">
                        {T.houseDetail.guestsInfoPrefix}
                        <strong className="text-neutral-700">
                          {house.maxGuests}
                          {T.houseDetail.guestsUnit}
                        </strong>
                        {T.houseDetail.guestsInfoMiddle}
                        <strong className="text-neutral-700">
                          {remainingSeats}
                          {T.houseDetail.guestsUnit}
                        </strong>
                        {T.houseDetail.guestsInfoSuffix}
                      </p>
                    </div>

                    {/* Cost Split block */}
                    <div className="space-y-2 pt-3.5 border-t border-neutral-200 text-xs text-neutral-600">
                      <div className="flex justify-between">
                        <span className="underline">
                          {T.houseDetail.openingFeeLabelPrefix}
                          {house.pricePerVisit.toLocaleString()}
                          {T.houseDetail.openingFeeLabelMiddle}
                          {guestsCount}
                          {T.houseDetail.openingFeeLabelSuffix}
                        </span>
                        <span>₩{rawPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-neutral-400">
                        <span>{T.houseDetail.additionalFeeLabel}</span>
                        <span>{T.houseDetail.noneLabel}</span>
                      </div>
                      <div className="flex justify-between font-bold text-neutral-900 border-t border-neutral-200 pt-2.5 text-sm">
                        <span>{T.houseDetail.tourCostLabel}</span>
                        <span className="text-blue-600 font-black text-base">₩{totalPrice.toLocaleString()}</span>
                      </div>
                    </div>

                    {bookingError && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-600">
                        {bookingError}
                      </div>
                    )}

                    {/* Actions */}
                    <button
                      type="submit"
                      disabled={!hasSchedule || isSlotFull || submitting}
                      className="w-full bg-blue-600 cursor-pointer text-white text-sm font-bold py-3.5 px-4 rounded-xl shadow-md hover:bg-blue-700 transition-colors text-center block disabled:bg-neutral-300 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {submitting
                        ? T.houseDetail.submittingLabel
                        : isSlotFull
                          ? T.houseDetail.slotFullButtonLabel
                          : T.houseDetail.submitButtonLabel}
                    </button>
                  </form>

                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{T.houseDetail.trustLabel}</span>
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
