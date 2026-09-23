import React from "react";
import { T } from "../strings";
import { House, Booking } from "../types";

interface MyInfoDashboardProps {
  houses: House[];
  bookings: Booking[];
  currentUserId: string;
}

export default function MyInfoDashboard({
  houses,
  bookings,
  currentUserId,
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
    </div>
  );
}
