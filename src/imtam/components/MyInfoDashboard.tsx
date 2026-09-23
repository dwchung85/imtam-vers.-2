import React from "react";
import { T } from "../strings";
import { House, Booking } from "../types";
import { ListFilter, ClipboardCheck, Calendar, User, Eye } from "lucide-react";

interface MyInfoDashboardProps {
  houses: House[];
  bookings: Booking[];
  currentUserId: string;
  onUpdateBookingStatus: (bookingId: string, status: "confirmed" | "cancelled" | "completed") => void;
  onSelectHouse: (house: House) => void;
}

export default function MyInfoDashboard({
  houses,
  bookings,
  currentUserId,
  onUpdateBookingStatus,
  onSelectHouse,
}: MyInfoDashboardProps) {
  // Filter objects owned by the current host
  const hostHouses = houses.filter((h) => h.hostId === currentUserId);
  const hostHouseIds = hostHouses.map((h) => h.id);
  const receivedBookings = bookings.filter((b) => hostHouseIds.includes(b.houseId));

  // Stats calculation
  const totalHostEarnings = receivedBookings
    .filter((b) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const confirmedCount = receivedBookings.filter((b) => b.status === "confirmed").length;
  const completedCount = receivedBookings.filter((b) => b.status === "completed").length;
  const pendingCount = receivedBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Host Earnings & Wallet Stats */}
      <div className="bg-white rounded-3xl border border-[#008000] p-5 md:p-6 shadow-xs">
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-neutral-500 block">
            {T.host.totalEarningsLabel}
          </span>
          <div className="mt-1 text-2xl md:text-3xl font-black text-neutral-900">
            ₩{totalHostEarnings.toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-semibold text-neutral-500 block">{T.host.confirmedCountPrefix}</span>
            <span className="text-lg font-bold text-neutral-900">{confirmedCount}{T.host.confirmedCountSuffix}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-neutral-500 block">{T.host.completedCountPrefix}</span>
            <span className="text-lg font-bold text-neutral-900">{completedCount}{T.host.completedCountSuffix}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* List of current listings */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4">
          <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-blue-600" />
            <span>{T.host.myListingsPrefix}{hostHouses.length}{T.host.myListingsSuffix}</span>
          </h4>

          {hostHouses.length === 0 ? (
            <p className="text-neutral-400 text-xs text-center py-6 font-semibold">
              {T.host.noListingsYet}
            </p>
          ) : (
            <div className="divide-y divide-neutral-105 max-h-[190px] overflow-y-auto pr-1">
              {hostHouses.map((hCode) => (
                <div key={hCode.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={hCode.imageUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover bg-neutral-100 shrink-0 border border-neutral-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-neutral-800 truncate" title={hCode.title}>
                        {hCode.title}
                      </h5>
                      <p className="text-[10px] text-neutral-500 font-semibold">
                        {T.host.specRoomsPrefix}{hCode.rooms ?? 3}{T.host.specRoomsMid}{hCode.bathrooms ?? 2}{T.host.specBathroomsMid}{hCode.area ?? 24}{T.host.specAreaSuffix}
                      </p>
                      <p className="text-[10px] text-blue-600 font-bold">
                        ₩{hCode.pricePerVisit.toLocaleString()}{T.host.perGuideSuffix}
                      </p>
                      {(hCode.approvalStatus ?? 'pending') !== 'approved' && (
                        <p
                          className={`text-[10px] font-bold mt-0.5 ${
                            (hCode.approvalStatus ?? 'pending') === 'rejected'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {(hCode.approvalStatus ?? 'pending') === 'rejected'
                            ? `${T.host.approvalRejected}${hCode.rejectReason ? ` · ${hCode.rejectReason}` : ''}`
                            : T.host.approvalPending}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectHouse(hCode)}
                    className="shrink-0 text-[10px] font-bold px-2 py-1 border border-neutral-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-neutral-600 bg-white flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3 text-blue-500" />
                    {T.host.inspectButton}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Bookings panel */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4 flex flex-col h-[400px]">
          <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
              <span>{T.host.applicantsListTitle}</span>
            </div>
            {pendingCount > 0 && (
              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {T.host.negotiatingPrefix}{pendingCount}
              </span>
            )}
          </h4>

          {receivedBookings.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              <Calendar className="w-10 h-10 text-neutral-300 mb-2" />
              <p className="text-neutral-500 text-xs font-bold">{T.host.noBookingsYet}</p>
              <p className="text-[10px] text-neutral-400 mt-1 max-w-[200px] leading-relaxed font-semibold">
                {T.host.switchAccountHint}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {receivedBookings.map((bk) => (
                <div
                  key={bk.id}
                  className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl flex flex-col gap-2.5 relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-neutral-800">{bk.guestName}</span>
                        <span className="text-[10px] text-neutral-400 ml-1">{T.host.buyerAspirant}</span>
                      </div>
                    </div>

                    {/* Status pill */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        bk.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-700"
                          : bk.status === "cancelled"
                            ? "bg-neutral-200 text-neutral-600"
                            : bk.status === "completed"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {bk.status === "confirmed"
                        ? T.host.statusConfirmed
                        : bk.status === "cancelled"
                          ? T.host.statusCancelled
                          : bk.status === "completed"
                            ? T.host.statusCompleted
                            : T.host.statusPending}
                    </span>
                  </div>

                  {/* Booking stays summary */}
                  <div className="text-xs text-neutral-600 border-t border-neutral-150 pt-2 space-y-1 font-semibold">
                    <p className="font-bold text-neutral-800 truncate mb-1">{T.host.tourHousePrefix}{bk.houseTitle}</p>
                    <p className="text-[11px]">
                      <span className="text-neutral-400 shrink-0">{T.host.matchScheduleLabel}</span> {bk.visitDate} ({bk.visitTimeSlot})
                    </p>
                    <p className="text-[11px]">
                      <span className="text-neutral-400 shrink-0">{T.host.accompanyCountLabel}</span> {bk.totalVisitors}{T.host.peopleSuffix}
                    </p>
                    <p className="text-[11px] font-bold text-blue-700">
                      <span className="text-neutral-400 font-semibold text-neutral-600">{T.host.settlementAmountLabel}</span> ₩
                      {bk.totalPrice.toLocaleString()}
                    </p>
                  </div>

                  {/* Pending Action Buttons */}
                  {bk.status === "pending" && (
                    <div className="grid grid-cols-2 gap-2 border-t border-neutral-150 pt-2 text-xs font-sans">
                      <button
                        onClick={() => onUpdateBookingStatus(bk.id, "cancelled")}
                        className="py-1 px-2 border border-neutral-300 rounded-lg hover:border-neutral-400 font-bold text-neutral-500 hover:text-neutral-850 bg-white cursor-pointer transition-all"
                      >
                        {T.host.rejectButton}
                      </button>
                      <button
                        onClick={() => onUpdateBookingStatus(bk.id, "confirmed")}
                        className="py-1 px-2 bg-blue-600 hover:bg-blue-700 font-bold text-white rounded-lg cursor-pointer transition-all"
                      >
                        {T.host.acceptButton}
                      </button>
                    </div>
                  )}

                  {/* Confirmed → Complete tour guide */}
                  {bk.status === "confirmed" && (
                    <div className="border-t border-neutral-150 pt-2">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              T.host.completeGuideConfirm,
                            )
                          ) {
                            onUpdateBookingStatus(bk.id, "completed");
                          }
                        }}
                        className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded-lg cursor-pointer transition-all text-xs"
                      >
                        {T.host.completeGuideButton}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
