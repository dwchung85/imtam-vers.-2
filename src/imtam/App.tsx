import { useState, useEffect, useRef } from "react";
import { House, Booking, UserProfile } from "./types";
import Navbar from "./components/Navbar";
import HouseCard from "./components/HouseCard";
import HouseDetail from "./components/HouseDetail";
import HostDashboard from "./components/HostDashboard";
import MyInfoDashboard from "./components/MyInfoDashboard";
import AdminDashboard from "./components/AdminDashboard";
import GuestDashboard from "./components/GuestDashboard";
import AuthModal from "./components/AuthModal";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchHouses,
  fetchBookings,
  fetchProfile,
  addHouseListingDb,
  updateBookingStatusDb,
  submitBookingReviewDb,
  checkIsAdmin,
  updateHouseApprovalDb,
} from "./dbService";

import { Search, Info, Compass, LogIn, Calendar } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { T } from "./strings";
import { payTourFromWallet } from "./tossCheckout";
import PaymentCloseButton from "./components/PaymentCloseButton";
import type { PaymentClose } from "./dismissiblePayment";
import { cancelTourBooking, completeTourBooking } from "@/lib/payments.functions";

export default function App() {
  const [closePayment, setClosePayment] = useState<PaymentClose | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  const [activeTab, setActiveTab] = useState<"browse" | "guest" | "host" | "myinfo" | "admin">("browse");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [minRooms, setMinRooms] = useState<number>(0);
  const [minBathrooms, setMinBathrooms] = useState<number>(0);
  const [minArea, setMinArea] = useState<number>(0);
  const [visitDateFrom, setVisitDateFrom] = useState<string>("");
  const [visitDateTo, setVisitDateTo] = useState<string>("");
  const [visitDateOpen, setVisitDateOpen] = useState<boolean>(false);
  const visitDateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visitDateOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (visitDateRef.current && !visitDateRef.current.contains(e.target as Node)) {
        setVisitDateOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [visitDateOpen]);

  const visitDateRange: DateRange | undefined =
    visitDateFrom || visitDateTo
      ? {
          from: visitDateFrom ? new Date(visitDateFrom + "T00:00:00") : undefined,
          to: visitDateTo ? new Date(visitDateTo + "T00:00:00") : undefined,
        }
      : undefined;
  const formatVisitDate = (s: string) =>
    s ? format(new Date(s + "T00:00:00"), "M/d") : "";

  // Load houses (public) on mount
  useEffect(() => {
    fetchHouses()
      .then(setHouses)
      .catch((e) => console.error(e));
  }, []);

  // Wire Supabase auth: listener + initial session check
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (userId) {
        // Defer extra calls to avoid deadlock
        setTimeout(() => {
          fetchProfile(userId).then((p) => {
            if (p) {
              setCurrentUser(p);
              setIsAuthModalOpen(false);
              fetchBookings()
                .then(setBookings)
                .catch(() => {});
              checkIsAdmin(userId)
                .then(setIsAdmin)
                .catch(() => {});
              fetchHouses()
                .then(setHouses)
                .catch(() => {});
            }
          });
        }, 0);
      } else {
        setCurrentUser(null);
        setBookings([]);
        setIsAdmin(false);
      }
    });

    // Initial session
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (userId) {
        fetchProfile(userId).then((p) => {
          if (p) {
            setCurrentUser(p);
            checkIsAdmin(userId)
              .then(setIsAdmin)
              .catch(() => {});
            fetchHouses()
              .then(setHouses)
              .catch(() => {});
            fetchBookings()
              .then(setBookings)
              .catch(() => {});
          }
        });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // 예약 상태가 바뀌면(승인/거절/완료) 양쪽 화면에 실시간 반영
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel("imtam-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchBookings()
          .then(setBookings)
          .catch(() => {});
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);


  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    try {
      const dbBookings = await fetchBookings();
      setBookings(dbBookings);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setBookings([]);
    setIsAdmin(false);
    setActiveTab("browse");
    fetchHouses()
      .then(setHouses)
      .catch(() => {});
  };

  // 관리자 승인 심사 처리
  const handleReviewHouse = async (
    houseId: string,
    status: "approved" | "rejected" | "pending",
    rejectReason = "",
  ) => {
    if (!currentUser) return;
    const updated = await updateHouseApprovalDb(houseId, status, currentUser.id, rejectReason);
    if (updated) {
      setHouses((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    }
  };

  const handleResetToHome = () => {
    setActiveTab("browse");
    setSelectedHouse(null);
    setSearchQuery("");
    setMinRooms(0);
    setMinBathrooms(0);
    setMinArea(0);
  };

  // 1. Request House Tour (Guest Action) — 실패 시 사유 문구를 반환
  const handleBookHouse = async (
    bookingData: Omit<Booking, "id" | "guestId" | "guestName" | "status" | "createdAt">,
  ): Promise<string | null> => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return T.app.loginRequiredError;
    }
    try {
      // 선불 잔액에서 투어 비용 결제 (100% IMTAM 보관)
      const err = await payTourFromWallet({
        houseId: bookingData.houseId,
        visitDate: bookingData.visitDate,
        visitTimeSlot: bookingData.visitTimeSlot,
        totalVisitors: bookingData.totalVisitors,
      });
      if (!err) {
        fetchBookings().then(setBookings).catch(() => {});
        alert("잔액에서 투어 비용이 결제되어 예약 신청이 완료되었습니다.");
      }
      return err;
    } catch (error) {
      console.error("DB error booking house:", error);
      return T.app.bookingErrorGeneric;
    }
  };


  // 2. Add a new House showcasing Listing (Host Action)
  const handleAddHouseListing = async (
    newHouseData: Omit<House, "id" | "hostId" | "hostName" | "hostAvatar" | "rating" | "reviewsCount">,
  ) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const created = await addHouseListingDb({
        ...newHouseData,
        hostId: currentUser.id,
        hostName: currentUser.name,
        hostAvatar: currentUser.avatar,
      });
      if (created) setHouses((prev) => [created, ...prev]);
    } catch (error) {
      console.error("DB error listing house:", error);
    }
  };

  // 3. Confirm / Cancel / Complete Booking Incoming (Host Action)
  const handleUpdateBookingStatus = async (bookingId: string, status: "confirmed" | "cancelled" | "completed") => {
    try {
      if (status === "cancelled") {
        const r = await cancelTourBooking({ data: { bookingId } });
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? { ...b, status, paymentStatus: r.refunded ? "refunded" : b.paymentStatus }
              : b,
          ),
        );
      } else if (status === "completed") {
        await completeTourBooking({ data: { bookingId } });
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      } else {
        await updateBookingStatusDb(bookingId, status);
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      }
    } catch (error) {
      console.error("DB error updating booking:", error);
      alert(error instanceof Error ? error.message : T.app.bookingErrorGeneric);
    }
  };

  // 4. Cancel Guest Reservation (Guest Action)
  const handleCancelBooking = async (bookingId: string) => {
    try {
      const r = await cancelTourBooking({ data: { bookingId } });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "cancelled" as const, paymentStatus: r.refunded ? "refunded" : b.paymentStatus }
            : b,
        ),
      );
      if (r.refunded) alert("예약이 취소되고 투어 비용 전액이 환불되었습니다.");
    } catch (error) {
      console.error("DB error cancelling booking:", error);
      alert(error instanceof Error ? error.message : T.app.bookingErrorGeneric);
    }
  };

  // 5. Submit Star Rating after Tour Completion (Guest Action)
  const handleSubmitReview = async (bookingId: string, rating: number) => {
    try {
      const updatedHouse = await submitBookingReviewDb(bookingId, rating);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, rating } : b)));
      if (updatedHouse) {
        setHouses((prev) =>
          prev.map((h) =>
            h.id === updatedHouse.id
              ? { ...h, rating: updatedHouse.rating, reviewsCount: updatedHouse.reviewsCount }
              : h,
          ),
        );
      }
    } catch (error) {
      console.error("DB error submitting review:", error);
    }
  };

  // --- Filtering listings ---
  const filteredHouses = houses.filter((house) => {
    // 관리자 승인이 완료된 매물만 둘러보기에 노출
    if ((house.approvalStatus ?? "pending") !== "approved") return false;

    // Search query match
    const lowercaseQuery = searchQuery.trim().toLowerCase();
    const searchMatch =
      !lowercaseQuery ||
      house.title.toLowerCase().includes(lowercaseQuery) ||
      house.description.toLowerCase().includes(lowercaseQuery) ||
      house.location.toLowerCase().includes(lowercaseQuery) ||
      house.amenities.some((a) => a.toLowerCase().includes(lowercaseQuery));

    // Room count match (rooms defaults to 3 if not present in existing documents)
    const houseRooms = house.rooms ?? 3;
    const roomsMatch = minRooms === 0 || houseRooms >= minRooms;

    // Bathroom count match (bathrooms defaults to 2 if not present in existing documents)
    const houseBathrooms = house.bathrooms ?? 2;
    const bathroomsMatch = minBathrooms === 0 || houseBathrooms >= minBathrooms;

    // Area (pyung) match (area defaults to 24 if not present in existing documents)
    const houseArea = house.area ?? 24;
    const areaMatch = minArea === 0 || houseArea >= minArea;

    // Visit date range match: house must have at least one available date inside the range
    const dateRangeMatch =
      (!visitDateFrom && !visitDateTo) ||
      (house.availableDates ?? []).some(
        (d) => (!visitDateFrom || d >= visitDateFrom) && (!visitDateTo || d <= visitDateTo),
      );

    return searchMatch && roomsMatch && bathroomsMatch && areaMatch && dateRangeMatch;
  });

  // --- 알림 배지: 내가 처리해야 할 항목 개수 ---
  const myHouseIds = currentUser ? houses.filter((h) => h.hostId === currentUser.id).map((h) => h.id) : [];
  const hostBadge = currentUser
    ? bookings.filter((b) => myHouseIds.includes(b.houseId) && b.status === "pending").length
    : 0;
  const guestBadge = currentUser
    ? bookings.filter(
        (b) =>
          b.guestId === currentUser.id &&
          (b.status === "confirmed" || (b.status === "completed" && typeof b.rating !== "number")),
      ).length
    : 0;
  const adminBadge = isAdmin ? houses.filter((h) => (h.approvalStatus ?? "pending") === "pending").length : 0;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      {/* Dynamic Header / Navigation bar */}
      <Navbar
        currentTab={activeTab}
        setTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onResetToHome={handleResetToHome}
        guestBadge={guestBadge}
        hostBadge={hostBadge}
        isAdmin={isAdmin}
        adminBadge={adminBadge}
      />


      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <>
              {activeTab === "browse" && (
                <div className="space-y-6 md:space-y-8 animate-fadeIn">
                  {/* Visual Header / Search / Filter row */}
                  <div className="bg-white rounded-[10px] border border-neutral-200 p-5 md:p-8 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Search Bar inside card */}
                      <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#008000]" />
                        <input
                          type="text"
                          placeholder={T.app.searchPlaceholder}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full text-xs md:text-sm pl-10 pr-4 py-3 rounded-[10px] border border-neutral-200 focus:border-blue-400 focus:outline-hidden bg-neutral-50 focus:bg-white text-neutral-800 transition-all font-bold"
                        />
                      </div>
                    </div>

                    {/* Advanced Spec Filters — unified pill selects */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-blue-50 md:flex md:flex-wrap md:items-center">
                      {/* Rooms */}
                      <div className="relative min-w-0">
                        <select
                          value={minRooms}
                          onChange={(e) => setMinRooms(Number(e.target.value))}
                          className={`w-full appearance-none text-[11px] md:text-xs font-bold pl-3 md:pl-4 ${minRooms > 0 ? "pr-8" : "pr-7 md:pr-9"} py-2.5 rounded-[10px] border transition-all cursor-pointer focus:outline-hidden truncate ${
                            minRooms > 0
                              ? "bg-white border-[#008000] text-[#008000] hover:border-[#008000]"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <option value="0">{T.app.roomsLabel}</option>
                          <option value="1">{T.app.rooms1Plus}</option>
                          <option value="2">{T.app.rooms2Plus}</option>
                          <option value="3">{T.app.rooms3Plus}</option>
                          <option value="4">{T.app.rooms4Plus}</option>
                        </select>
                        {minRooms > 0 ? (
                          <button
                            type="button"
                            onClick={() => setMinRooms(0)}
                            aria-label={T.app.roomsFilterResetAriaLabel}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#008000]/10 hover:bg-[#008000]/20 flex items-center justify-center text-[#008000] transition-colors cursor-pointer"
                          >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </button>
                        ) : (
                          <svg className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-neutral-500" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Bathrooms */}
                      <div className="relative min-w-0">
                        <select
                          value={minBathrooms}
                          onChange={(e) => setMinBathrooms(Number(e.target.value))}
                          className={`w-full appearance-none text-[11px] md:text-xs font-bold pl-3 md:pl-4 ${minBathrooms > 0 ? "pr-8" : "pr-7 md:pr-9"} py-2.5 rounded-[10px] border transition-all cursor-pointer focus:outline-hidden truncate ${
                            minBathrooms > 0
                              ? "bg-white border-[#008000] text-[#008000] hover:border-[#008000]"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <option value="0">{T.app.bathroomsLabel}</option>
                          <option value="1">{T.app.bathrooms1Plus}</option>
                          <option value="2">{T.app.bathrooms2Plus}</option>
                          <option value="3">{T.app.bathrooms3Plus}</option>
                        </select>
                        {minBathrooms > 0 ? (
                          <button
                            type="button"
                            onClick={() => setMinBathrooms(0)}
                            aria-label={T.app.bathroomsFilterResetAriaLabel}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#008000]/10 hover:bg-[#008000]/20 flex items-center justify-center text-[#008000] transition-colors cursor-pointer"
                          >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </button>
                        ) : (
                          <svg className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-neutral-500" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Area */}
                      <div className="relative min-w-0">
                        <select
                          value={minArea}
                          onChange={(e) => setMinArea(Number(e.target.value))}
                          className={`w-full appearance-none text-[11px] md:text-xs font-bold pl-3 md:pl-4 ${minArea > 0 ? "pr-8" : "pr-7 md:pr-9"} py-2.5 rounded-[10px] border transition-all cursor-pointer focus:outline-hidden truncate ${
                            minArea > 0
                              ? "bg-white border-[#008000] text-[#008000] hover:border-[#008000]"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <option value="0">{T.app.areaLabel}</option>
                          <option value="10">{T.app.area10Plus}</option>
                          <option value="20">{T.app.area20Plus}</option>
                          <option value="30">{T.app.area30Plus}</option>
                          <option value="40">{T.app.area40Plus}</option>
                        </select>
                        {minArea > 0 ? (
                          <button
                            type="button"
                            onClick={() => setMinArea(0)}
                            aria-label={T.app.areaFilterResetAriaLabel}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#008000]/10 hover:bg-[#008000]/20 flex items-center justify-center text-[#008000] transition-colors cursor-pointer"
                          >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </button>
                        ) : (
                          <svg className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-neutral-500" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Visit Date Range */}
                      <div ref={visitDateRef} className="relative min-w-0 col-span-3 md:col-span-1">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={T.app.visitDateLabel}
                          onClick={() => setVisitDateOpen((v) => !v)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setVisitDateOpen((v) => !v);
                            }
                          }}
                          className={`min-w-0 flex items-center gap-1.5 text-[11px] md:text-xs font-bold pl-3 md:pl-4 pr-2 py-2.5 rounded-[10px] border transition-all cursor-pointer ${
                            visitDateFrom || visitDateTo
                              ? "bg-white border-[#008000] text-[#008000]"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 shrink-0 text-[#008000]" />
                          <span className="shrink-0">{T.app.visitDateLabel}</span>
                          {(visitDateFrom || visitDateTo) && (
                            <span className="flex-1 min-w-0 flex items-center justify-center gap-1">
                              <span>{formatVisitDate(visitDateFrom)}</span>
                              <span className="text-neutral-400">~</span>
                              <span>{formatVisitDate(visitDateTo)}</span>
                            </span>
                          )}
                          {(visitDateFrom || visitDateTo) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVisitDateFrom("");
                                setVisitDateTo("");
                              }}
                              aria-label={T.app.visitDateResetAriaLabel}
                              className="w-5 h-5 shrink-0 rounded-full bg-[#008000]/10 hover:bg-[#008000]/20 flex items-center justify-center text-[#008000] transition-colors cursor-pointer"
                            >
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                            </button>
                          )}
                        </div>
                        {visitDateOpen && (
                          <div className="absolute left-0 top-full mt-1 z-50 rounded-[10px] border border-neutral-200 bg-white shadow-lg">
                              <CalendarPicker
                                mode="range"
                                selected={visitDateRange}
                                onSelect={(range) => {
                                  setVisitDateFrom(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                                  setVisitDateTo(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                                }}
                                numberOfMonths={1}
                                locale={ko}
                                defaultMonth={visitDateRange?.from}
                                className="p-3 pointer-events-auto"
                              />
                          </div>
                        )}
                      </div>
                    </div>


                  </div>

                  {/* Platform Houses Grid */}
                  {filteredHouses.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-neutral-250 rounded-3xl p-6">
                      <Info className="w-12 h-12 text-blue-500/30 mx-auto mb-3" />
                      <h3 className="font-bold text-neutral-800 text-lg">{T.app.noMatchingHouses}</h3>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">
                        {filteredHouses.map((house) => (
                          <HouseCard
                            key={house.id}
                            house={house}
                            onClick={() => setSelectedHouse(house)}
                            isOwnListing={currentUser ? house.hostId === currentUser.id : false}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Guest Booking Dashboard Page */}
              {activeTab === "guest" &&
                (currentUser ? (
                  <GuestDashboard
                    bookings={bookings}
                    currentUserId={currentUser.id}
                    onCancelBooking={handleCancelBooking}
                    onSubmitReview={handleSubmitReview}
                  />
                ) : (
                  <LoginRequired onOpenAuth={() => setIsAuthModalOpen(true)} />
                ))}

              {/* Host Dashboard Page */}
              {activeTab === "host" &&
                (currentUser ? (
                  <HostDashboard
                    houses={houses}
                    bookings={bookings}
                    currentUserId={currentUser.id}
                    onAddHouse={handleAddHouseListing}
                    onUpdateBookingStatus={handleUpdateBookingStatus}
                    onSelectHouse={(h) => setSelectedHouse(h)}
                  />
                ) : (
                  <LoginRequired onOpenAuth={() => setIsAuthModalOpen(true)} />
                ))}

              {/* My Info Page */}
              {activeTab === "myinfo" &&
                (currentUser ? (
                  <MyInfoDashboard
                    houses={houses}
                    bookings={bookings}
                    currentUser={currentUser}
                    onSelectHouse={(h) => setSelectedHouse(h)}
                     onProfileUpdated={setCurrentUser}
                  />
                ) : (
                  <LoginRequired onOpenAuth={() => setIsAuthModalOpen(true)} />
                ))}

              {/* Admin Review Page */}
              {activeTab === "admin" &&
                (!currentUser ? (
                  <LoginRequired onOpenAuth={() => setIsAuthModalOpen(true)} />
                ) : isAdmin ? (
                  <AdminDashboard houses={houses} onReviewHouse={handleReviewHouse} />
                ) : (
                  <div className="text-center py-20 bg-white border border-neutral-200 rounded-3xl p-6 max-w-md mx-auto space-y-3">
                    <h3 className="text-lg font-bold text-neutral-800">{T.admin.noAccessTitle}</h3>
                    <p className="text-xs text-neutral-400 font-semibold">{T.admin.noAccessDesc}</p>
                  </div>
                ))}
        </>
      </main>

      {/* House Details Modal */}
      {selectedHouse && (
        <HouseDetail
          house={selectedHouse}
          onClose={() => setSelectedHouse(null)}
          onBook={handleBookHouse}
          
          currentUserId={currentUser?.id || ""}
        />
      )}

      {/* Auth Modal Trigger overlay */}
      {closePayment && <PaymentCloseButton close={closePayment} />}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} onLoginSuccess={handleLoginSuccess} />}

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-16 py-6 text-center text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>{T.app.footerCopyright}</p>
        </div>
      </footer>
    </div>
  );
}

function LoginRequired({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <div className="text-center py-20 bg-white border border-neutral-200 rounded-3xl p-6 max-w-md mx-auto space-y-4 animate-fadeIn">
      <LogIn className="w-12 h-12 text-blue-600 mx-auto" />
      <h3 className="text-lg font-bold text-neutral-800">{T.app.loginRequiredTitle}</h3>
      <p className="text-xs text-neutral-400 font-semibold">
        {T.app.loginRequiredDesc}
      </p>
      <button
        onClick={onOpenAuth}
        className="bg-white border border-[#008000] text-[#008000] hover:bg-[#008000] hover:text-white font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-colors"
      >
        {T.app.loginSignup}
      </button>
    </div>
  );
}
