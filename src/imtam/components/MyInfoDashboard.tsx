import React, { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { T } from "../strings";
import { House, Booking, UserProfile } from "../types";

interface MyInfoDashboardProps {
  houses: House[];
  bookings: Booking[];
  currentUser: UserProfile;
}

export default function MyInfoDashboard({
  houses,
  bookings,
  currentUser,
}: MyInfoDashboardProps) {
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [joinedAt, setJoinedAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      setAccountEmail(data.user.email ?? "");
      setJoinedAt(data.user.created_at ? data.user.created_at.split("T")[0] : "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter objects owned by the current host
  const hostHouses = houses.filter((h) => h.hostId === currentUser.id);
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
      <div className="bg-white rounded-3xl border border-neutral-200 p-5 md:p-6 shadow-xs">
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

      {/* Account Info */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-5 md:p-6 shadow-xs">
        <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2 mb-4">
          <UserCircle2 className="w-4 h-4 text-[#008000]" />
          <span>{T.host.accountInfoTitle}</span>
        </h4>

        <div className="flex items-center gap-3 mb-4">
          <img
            src={currentUser.avatar}
            alt=""
            className="w-12 h-12 rounded-full object-cover border-2 border-black bg-neutral-100"
            referrerPolicy="no-referrer"
          />
          <span className="text-base font-bold text-neutral-900">{currentUser.name}</span>
        </div>

        <div className="divide-y divide-neutral-150">
          <div className="py-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-neutral-500">{T.host.accountNameLabel}</span>
            <span className="text-sm font-bold text-neutral-900">{currentUser.name}</span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-neutral-500">{T.host.accountEmailLabel}</span>
            <span className="text-sm font-bold text-neutral-900 break-all text-right">{accountEmail || "-"}</span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-neutral-500">{T.host.accountJoinedLabel}</span>
            <span className="text-sm font-bold text-neutral-900">{joinedAt || "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
