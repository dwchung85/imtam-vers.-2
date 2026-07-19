import { useState, useEffect } from "react";
import { House, Booking, UserProfile } from "./types";
import Navbar from "./components/Navbar";
import HouseCard from "./components/HouseCard";
import HouseDetail from "./components/HouseDetail";
import HostDashboard from "./components/HostDashboard";
import GuestDashboard from "./components/GuestDashboard";
import AuthModal from "./components/AuthModal";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchHouses,
  fetchBookings,
  fetchProfile,
  addHouseListingDb,
  addBookingDb,
  updateBookingStatusDb,
  submitBookingReviewDb,
} from "./dbService";

import { Search, Info, Compass, LogIn } from "lucide-react";

export default function App() {
  const [houses, setHouses] = useState<House[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<"guest" | "host">("guest");
  const [activeTab, setActiveTab] = useState<"browse" | "guest" | "host">("browse");
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [minRooms, setMinRooms] = useState<number>(0);
  const [minBathrooms, setMinBathrooms] = useState<number>(0);
  const [minArea, setMinArea] = useState<number>(0);

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
              fetchHouses()
                .then(setHouses)
                .catch(() => {});
            }
          });
        }, 0);
      } else {
        setCurrentUser(null);
        setBookings([]);
      }
    });

    // Initial session
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (userId) {
        fetchProfile(userId).then((p) => {
          if (p) {
            setCurrentUser(p);
            fetchBookings()
              .then(setBookings)
              .catch(() => {});
          } else {
            setIsAuthModalOpen(true);
          }
        });
      } else {
        setIsAuthModalOpen(true);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleToggleRole = () => {
    const nextRole = userRole === "guest" ? "host" : "guest";
    setUserRole(nextRole);
    setActiveTab(nextRole === "host" ? "host" : "browse");
  };

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
    setActiveTab("browse");
    setUserRole("guest");
    setIsAuthModalOpen(true);
  };

  const handleResetToHome = () => {
    setActiveTab("browse");
    setSelectedHouse(null);
    setSearchQuery("");
    setMinRooms(0);
    setMinBathrooms(0);
    setMinArea(0);
  };

  // 1. Request House Tour (Guest Action)
  const handleBookHouse = async (
    bookingData: Omit<Booking, "id" | "guestId" | "guestName" | "status" | "createdAt">,
  ) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    try {
      const created = await addBookingDb({
        ...bookingData,
        guestId: currentUser.id,
        guestName: currentUser.name,
      });
      if (created) setBookings((prev) => [created, ...prev]);
    } catch (error) {
      console.error("DB error booking house:", error);
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
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      await updateBookingStatusDb(bookingId, status);
    } catch (error) {
      console.error("DB error updating booking:", error);
    }
  };

  // 4. Cancel Guest Reservation (Guest Action)
  const handleCancelBooking = async (bookingId: string) => {
    try {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" as const } : b)));
      await updateBookingStatusDb(bookingId, "cancelled");
    } catch (error) {
      console.error("DB error cancelling booking:", error);
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

    return searchMatch && roomsMatch && bathroomsMatch && areaMatch;
  });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      {/* Dynamic Header / Navigation bar */}
      <Navbar
        currentTab={activeTab}
        setTab={setActiveTab}
        currentUser={currentUser}
        userRole={userRole}
        onToggleRole={handleToggleRole}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onResetToHome={handleResetToHome}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <>
          {!currentUser ? (
            <div className="text-center py-20 bg-white border border-neutral-205 rounded-3xl p-6 max-w-md mx-auto space-y-4 animate-fadeIn">
              <LogIn className="w-12 h-12 text-blue-600 mx-auto" />
              <h3 className="text-lg font-bold text-neutral-850">IMTAM 이용을 위해 로그인이 필요합니다</h3>
              <p className="text-xs text-neutral-400 font-semibold">
                회원 가입 또는 로그인 후 매물 및 임장 정보를 확인할 수 있습니다.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 font-bold text-white text-xs py-2.5 px-5 rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                로그인 / 회원가입
              </button>
            </div>
          ) : (
            <>
              {activeTab === "browse" && (
                <div className="space-y-6 md:space-y-8 animate-fadeIn">
                  {/* Visual Header / Search / Filter row */}
                  <div className="bg-white rounded-3xl border border-blue-100 p-5 md:p-8 shadow-xs space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Search Bar inside card */}
                      <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                        <input
                          type="text"
                          placeholder="경기도 성남시 분당구 판교원로 82번길"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full text-xs md:text-sm pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-400 focus:outline-hidden bg-neutral-50 focus:bg-white text-neutral-800 transition-all font-bold"
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
                          className={`w-full appearance-none text-[11px] md:text-xs font-bold pl-3 md:pl-4 ${minRooms > 0 ? "pr-8" : "pr-7 md:pr-9"} py-2.5 rounded-full border transition-all cursor-pointer focus:outline-hidden truncate ${
                            minRooms > 0
                              ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <option value="0">방 개수</option>
                          <option value="1">방 1개 이상</option>
                          <option value="2">방 2개 이상</option>
                          <option value="3">방 3개 이상</option>
                          <option value="4">방 4개 이상</option>
                        </select>
                        {minRooms > 0 ? (
                          <button
                            type="button"
                            onClick={() => setMinRooms(0)}
                            aria-label="방 개수 필터 초기화"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
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
                          className={`w-full appearance-none text-[11px] md:text-xs font-bold pl-3 md:pl-4 ${minBathrooms > 0 ? "pr-8" : "pr-7 md:pr-9"} py-2.5 rounded-full border transition-all cursor-pointer focus:outline-hidden truncate ${
                            minBathrooms > 0
                              ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <option value="0">화장실 개수</option>
                          <option value="1">화장실 1개 이상</option>
                          <option value="2">화장실 2개 이상</option>
                          <option value="3">화장실 3개 이상</option>
                        </select>
                        {minBathrooms > 0 ? (
                          <button
                            type="button"
                            onClick={() => setMinBathrooms(0)}
                            aria-label="화장실 개수 필터 초기화"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
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
                          className={`w-full appearance-none text-[11px] md:text-xs font-bold pl-3 md:pl-4 ${minArea > 0 ? "pr-8" : "pr-7 md:pr-9"} py-2.5 rounded-full border transition-all cursor-pointer focus:outline-hidden truncate ${
                            minArea > 0
                              ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                              : "bg-white border-neutral-200 text-neutral-700 hover:border-blue-300"
                          }`}
                        >
                          <option value="0">넓이 (평)</option>
                          <option value="10">10평 이상</option>
                          <option value="20">20평 이상</option>
                          <option value="30">30평 이상</option>
                          <option value="40">40평 이상</option>
                        </select>
                        {minArea > 0 ? (
                          <button
                            type="button"
                            onClick={() => setMinArea(0)}
                            aria-label="넓이 필터 초기화"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
                          >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </button>
                        ) : (
                          <svg className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-neutral-500" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>


                  </div>

                  {/* Platform Houses Grid */}
                  {filteredHouses.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-neutral-250 rounded-3xl p-6">
                      <Info className="w-12 h-12 text-blue-500/30 mx-auto mb-3" />
                      <h3 className="font-bold text-neutral-800 text-lg">조건에 부합하는 오픈하우스가 없습니다</h3>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4.5 px-1">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">
                          예약 일정 조율가능 매물 ({filteredHouses.length}개)
                        </span>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded-lg">
                          전속 특약 한정권
                        </span>
                      </div>
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
              {activeTab === "guest" && currentUser && (
                <GuestDashboard
                  bookings={bookings}
                  currentUserId={currentUser.id}
                  onCancelBooking={handleCancelBooking}
                  onSubmitReview={handleSubmitReview}
                />
              )}

              {/* Host Dashboard Page */}
              {activeTab === "host" && currentUser && (
                <HostDashboard
                  houses={houses}
                  bookings={bookings}
                  currentUserId={currentUser.id}
                  onAddHouse={handleAddHouseListing}
                  onUpdateBookingStatus={handleUpdateBookingStatus}
                  onSelectHouse={(h) => setSelectedHouse(h)}
                />
              )}
            </>
          )}
        </>
      </main>

      {/* House Details Modal */}
      {selectedHouse && (
        <HouseDetail
          house={selectedHouse}
          onClose={() => setSelectedHouse(null)}
          onBook={handleBookHouse}
          currentUserRole={userRole}
          currentUserId={currentUser?.id || ""}
        />
      )}

      {/* Auth Modal Trigger overlay */}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} onLoginSuccess={handleLoginSuccess} />}

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-16 py-6 text-center text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>© 2026 IMTAM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
