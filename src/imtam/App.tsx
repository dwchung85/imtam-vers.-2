import { useState, useEffect } from "react";
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

import { Info, Compass, LogIn } from "lucide-react";
import BrowseFilters from "./components/BrowseFilters";
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
                  <BrowseFilters
                    filters={{ searchQuery, minRooms, minBathrooms, minArea, visitDateFrom, visitDateTo }}
                    onChange={(filters) => {
                      setSearchQuery(filters.searchQuery);
                      setMinRooms(filters.minRooms);
                      setMinBathrooms(filters.minBathrooms);
                      setMinArea(filters.minArea);
                      setVisitDateFrom(filters.visitDateFrom);
                      setVisitDateTo(filters.visitDateTo);
                    }}
                  />

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
