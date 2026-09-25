import React, { useEffect, useState } from "react";
import { UserCircle2, Heart } from "lucide-react";
import { fetchFavoriteIds, setFavorite } from "../favorites";
import { supabase } from "@/integrations/supabase/client";
import { T } from "../strings";
import { House, Booking, UserProfile } from "../types";

// 한국 주요 은행 목록 (은행명 드롭다운용)
const KOREAN_BANKS = [
  "국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "농협은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "기업은행",
  "산업은행",
  "SC제일은행",
  "한국씨티은행",
  "수협은행",
  "우체국예금",
  "대구은행",
  "부산은행",
  "경남은행",
  "광주은행",
  "전북은행",
  "제주은행",
  "저축은행",
];

interface MyInfoDashboardProps {
  houses: House[];
  bookings: Booking[];
  currentUser: UserProfile;
  onSelectHouse?: (h: House) => void;
}

export default function MyInfoDashboard({
  houses,
  bookings,
  currentUser,
  onSelectHouse,
}: MyInfoDashboardProps) {
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [joinedAt, setJoinedAt] = useState<string>("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  useEffect(() => {
    fetchFavoriteIds(currentUser.id).then(setFavoriteIds);
  }, [currentUser.id]);
  const favoriteHouses = houses.filter((h) => favoriteIds.includes(h.id));

  const [phone, setPhone] = useState<string>(currentUser.phone ?? "");
  const [bankName, setBankName] = useState<string>(currentUser.bankName ?? "");
  const [bankAccount, setBankAccount] = useState<string>(currentUser.bankAccount ?? "");

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  // Keep local fields in sync when the profile loads/changes externally
  useEffect(() => {
    setPhone(currentUser.phone ?? "");
    setBankName(currentUser.bankName ?? "");
    setBankAccount(currentUser.bankAccount ?? "");
  }, [currentUser.id, currentUser.phone, currentUser.bankName, currentUser.bankAccount]);

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

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        phone: phone.trim(),
        bank_name: bankName.trim(),
        bank_account: bankAccount.trim(),
      })
      .eq("id", currentUser.id);
    setIsSaving(false);
    if (error) {
      console.error("profile update error", error);
      alert(T.host.accountSaveFailedAlert);
      return;
    }
    setIsEditing(false);
  };

  const bankDisplay =
    [bankName, bankAccount].filter(Boolean).join(" ") || "-";

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
        <div className="flex items-center justify-between gap-2 mb-4">
          <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2">
            <UserCircle2 className="w-4 h-4 text-[#008000]" />
            <span>{T.host.accountInfoTitle}</span>
          </h4>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-full px-3 py-1 hover:bg-neutral-50 transition-colors"
            >
              {T.host.accountEditButton}
            </button>
          )}
        </div>

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
          <div className="py-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-neutral-500">{T.host.accountPhoneLabel}</span>
            {isEditing ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-40 md:w-56 h-9 text-sm font-bold text-neutral-900 text-right border border-neutral-200 rounded-lg px-2.5 focus:outline-none focus:border-neutral-400"
              />
            ) : (
              <span className="text-sm font-bold text-neutral-900 break-all text-right">{phone || "-"}</span>
            )}
          </div>
          <div className="py-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-neutral-500 shrink-0">{T.host.accountBankLabel}</span>
            {isEditing ? (
              <div className="flex flex-col items-end gap-1.5">
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-40 md:w-56 h-9 text-sm font-bold text-neutral-900 text-right border border-neutral-200 rounded-lg px-2.5 bg-white appearance-none focus:outline-none focus:border-neutral-400"
                >
                  <option value="">{T.host.accountBankSelectPlaceholder}</option>
                  {KOREAN_BANKS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder={T.host.accountBankAccountPlaceholder}
                  className="w-40 md:w-56 h-9 text-sm font-bold text-neutral-900 text-right border border-neutral-200 rounded-lg px-2.5 focus:outline-none focus:border-neutral-400"
                />
              </div>
            ) : (
              <span className="text-sm font-bold text-neutral-900 break-all text-right">{bankDisplay}</span>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPhone(currentUser.phone ?? "");
                setBankName(currentUser.bankName ?? "");
                setBankAccount(currentUser.bankAccount ?? "");
                setIsEditing(false);
              }}
              className="text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-full px-4 py-1.5 hover:bg-neutral-50 transition-colors"
            >
              {T.host.accountCancelButton}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs font-semibold text-white bg-neutral-900 rounded-full px-4 py-1.5 hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {T.host.accountSaveButton}
            </button>
          </div>
        )}
      </div>

      {/* 찜한 매물 */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4">
        <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2">
          <Heart className="w-4 h-4 text-[#008000]" />
          찜한 매물 ({favoriteHouses.length})
        </h4>
        {favoriteHouses.length === 0 ? (
          <p className="text-xs text-neutral-500">아직 찜한 매물이 없습니다. 상세보기에서 하트를 눌러 찜해보세요.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {favoriteHouses.map((h) => (
              <div key={h.id} className="flex items-center gap-3 border border-neutral-200 rounded-2xl p-2">
                <button type="button" onClick={() => onSelectHouse?.(h)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <img src={h.imageUrl} alt={h.title} className="w-14 h-14 rounded-xl object-cover bg-neutral-100" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{h.title}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{h.location}</p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="찜 해제"
                  onClick={async () => {
                    setFavoriteIds((ids) => ids.filter((x) => x !== h.id));
                    await setFavorite(currentUser.id, h.id, false).catch(() => {});
                  }}
                  className="p-2"
                >
                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
