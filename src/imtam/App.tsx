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
  fetchHouseFull,
  fetchHousesFull,
  fetchBookings,
  fetchProfile,
  addHouseListingDb,
  updateBookingStatusDb,
  submitBookingReviewDb,
  checkIsAdmin,
  updateHouseApprovalDb,
} from "./dbService";

import { Info, Compass, LogIn, List, Map as MapIcon, X } from "lucide-react";
import BrowseFilters from "./components/BrowseFilters";
import IntroHero from "./components/IntroHero";
import HousesMap from "./components/HousesMap";
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
  
  const [seenGuestAlerts, setSeenGuestAlerts] = useState<string[] | null>(null);
  const [seenHostAlerts, setSeenHostAlerts] = useState<string[] | null>(null);
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // 토큰 갱신 때마다 전체 데이터를 다시 받지 않도록 건너뜀
      if (event === "TOKEN_REFRESHED") return;
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

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // 관리자 탭에서만 사진·증빙 문서를 포함한 전체 매물을 받는다
  const [adminHouses, setAdminHouses] = useState<House[]>([]);
  useEffect(() => {
    if (activeTab === "admin" && isAdmin) fetchHousesFull().then(setAdminHouses).catch(() => {});
  }, [activeTab, isAdmin]);

  // 상세 화면을 열면 전체 사진을 추가로 불러온다
  const openHouse = (h: House) => {
    setSelectedHouse(h);
    fetchHouseFull(h.id)
      .then((full) => full && setSelectedHouse((cur) => (cur?.id === full.id ? { ...cur, ...full } : cur)))
      .catch(() => {});
  };

  // 예약 기록에는 사진 사본이 없으므로 집 목록의 대표 사진을 붙인다
  const bookingsView = bookings.map((b) =>
    b.houseImage ? b : { ...b, houseImage: houses.find((h) => h.id === b.houseId)?.imageUrl ?? "" },
  );

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
      setAdminHouses((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
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
  const [browseView, setBrowseView] = useState<"list" | "map">("list");
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const v = window.localStorage.getItem("imtam_browse_view");
    if (v === "map" || v === "list") setBrowseView(v);
  }, []);
  const changeBrowseView = (v: "list" | "map") => {
    setBrowseView(v);
    setMapSelectedId(null);
    window.localStorage.setItem("imtam_browse_view", v);
  };

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
  // 내정보 알림: 처리 대기(신청됨) 예약 중 아직 확인 안 한 것이 있으면 숫자로 표시
  const myHouseIds = currentUser ? houses.filter((h) => h.hostId === currentUser.id).map((h) => h.id) : [];
  const hostAlertKeys = currentUser
    ? bookings
        .filter((b) => myHouseIds.includes(b.houseId) && b.status === "pending")
        .map((b) => `${b.id}:pending`)
    : [];
  const hostSeenStorageKey = currentUser ? `imtam_seen_host_alerts_${currentUser.id}` : "";
  useEffect(() => {
    if (!hostSeenStorageKey) return setSeenHostAlerts([]);
    try {
      setSeenHostAlerts(JSON.parse(localStorage.getItem(hostSeenStorageKey) || "[]"));
    } catch {
      setSeenHostAlerts([]);
    }
  }, [hostSeenStorageKey]);
  const hostAlertSig = hostAlertKeys.join("|");
  useEffect(() => {
    if (activeTab !== "myinfo" || !hostSeenStorageKey || seenHostAlerts === null) return;
    if (hostAlertKeys.every((k) => seenHostAlerts.includes(k))) return;
    const merged = Array.from(new Set([...seenHostAlerts, ...hostAlertKeys]));
    setSeenHostAlerts(merged);
    localStorage.setItem(hostSeenStorageKey, JSON.stringify(merged));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hostAlertSig, hostSeenStorageKey, seenHostAlerts]);
  const hostBadge =
    seenHostAlerts === null
      ? 0
      : hostAlertKeys.filter((k) => !seenHostAlerts.includes(k)).length;
  // 예약 내역 알림: 예약 신청·수락·거절(취소)·투어 전날 이벤트 중 아직 확인 안 한 것이 있으면 느낌표
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const guestAlertKeys = currentUser
    ? bookings
        .filter(
          (b) => b.guestId === currentUser.id && b.paymentStatus !== "unpaid" && b.paymentStatus !== "failed",
        )
        .flatMap((b) => {
          const keys: string[] = [];
          if (b.status === "pending" || b.status === "confirmed" || b.status === "cancelled") keys.push(`${b.id}:${b.status}`);
          if (b.status === "confirmed" && b.visitDate === tomorrow) keys.push(`${b.id}:eve`);
          return keys;
        })
    : [];
  const seenStorageKey = currentUser ? `imtam_seen_guest_alerts_${currentUser.id}` : "";
  useEffect(() => {
    if (!seenStorageKey) return setSeenGuestAlerts([]);
    try {
      setSeenGuestAlerts(JSON.parse(localStorage.getItem(seenStorageKey) || "[]"));
    } catch {
      setSeenGuestAlerts([]);
    }
  }, [seenStorageKey]);
  const guestAlertSig = guestAlertKeys.join("|");
  useEffect(() => {
    if (activeTab !== "guest" || !seenStorageKey || seenGuestAlerts === null) return;
    if (guestAlertKeys.every((k) => seenGuestAlerts.includes(k))) return;
    const merged = Array.from(new Set([...seenGuestAlerts, ...guestAlertKeys]));
    setSeenGuestAlerts(merged);
    localStorage.setItem(seenStorageKey, JSON.stringify(merged));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, guestAlertSig, seenStorageKey, seenGuestAlerts]);
  const guestAlert =
    seenGuestAlerts !== null && guestAlertKeys.some((k) => !seenGuestAlerts.includes(k));
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
        guestAlert={guestAlert}
        hostBadge={hostBadge}
        isAdmin={isAdmin}
        adminBadge={adminBadge}
      />


      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <>
              {activeTab === "browse" && (
                <div className="space-y-6 md:space-y-8 animate-fadeIn">
                  <IntroHero
                    onBrowse={() =>
                      document.getElementById("browse-results")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    onRegister={() => (currentUser ? setActiveTab("host") : setIsAuthModalOpen(true))}
                  />
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

                  <div id="browse-results" className="scroll-mt-24" />

                  <div className="flex justify-end">
                    <div className="inline-flex rounded-[10px] border border-[#008000] overflow-hidden" role="group" aria-label="보기 방식">
                      {([["list", "목록", List], ["map", "지도", MapIcon]] as const).map(([v, label, Icon]) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={browseView === v}
                          onClick={() => changeBrowseView(v)}
                          className={`flex items-center gap-1.5 px-4 h-9 text-sm font-bold ${browseView === v ? "bg-[#008000] text-white" : "bg-white text-[#008000]"}`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {browseView === "map" && filteredHouses.length > 0 ? (
                    <div className="md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
                      <div className="hidden md:block md:h-[calc(100dvh-260px)] md:min-h-[480px] overflow-y-auto pr-1 space-y-4">
                        {filteredHouses.map((house) => (
                          <div
                            key={house.id}
                            onMouseEnter={() => setMapSelectedId(house.id)}
                            className={`rounded-[10px] ${mapSelectedId === house.id ? "ring-2 ring-[#008000]" : ""}`}
                          >
                            <HouseCard
                              house={house}
                              onClick={() => openHouse(house)}
                              isOwnListing={currentUser ? house.hostId === currentUser.id : false}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="relative">
                        <HousesMap
                          houses={filteredHouses}
                          selectedId={mapSelectedId}
                          onSelect={(id) => {
                            setMapSelectedId(id);
                            if (id && window.matchMedia("(min-width: 768px)").matches) {
                              document.getElementById(`house-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }
                          }}
                          className="w-full h-[calc(100dvh-230px)] min-h-[420px] md:h-[calc(100dvh-260px)] md:min-h-[480px] rounded-[10px] border border-neutral-200 overflow-hidden"
                        />
                        {(() => {
                          const sel = filteredHouses.find((h) => h.id === mapSelectedId);
                          if (!sel) return null;
                          return (
                            <div className="md:hidden absolute left-3 right-3 bottom-3 z-10">
                              <div className="relative bg-white rounded-[10px] border border-neutral-200 flex overflow-hidden cursor-pointer" onClick={() => openHouse(sel)}>
                                <img src={sel.imageUrl} alt={sel.title} className="w-28 h-28 object-cover shrink-0" />
                                <div className="p-3 pr-9 min-w-0 flex flex-col justify-center gap-1">
                                  <div className="font-bold text-sm text-neutral-900 truncate">{sel.title}</div>
                                  <div className="text-xs text-neutral-500 truncate">{sel.location}</div>
                                  <div className="text-sm font-black text-neutral-600">₩{sel.pricePerVisit.toLocaleString("ko-KR")}</div>
                                </div>
                                <button
                                  type="button"
                                  aria-label="닫기"
                                  onClick={(e) => { e.stopPropagation(); setMapSelectedId(null); }}
                                  className="absolute top-2 right-2 p-1 text-neutral-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : filteredHouses.length === 0 ? (
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
                            onClick={() => openHouse(house)}
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
                    bookings={bookingsView}
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
                    bookings={bookingsView}
                    currentUserId={currentUser.id}
                    onAddHouse={handleAddHouseListing}
                    onUpdateBookingStatus={handleUpdateBookingStatus}
                    onSelectHouse={openHouse}
                  />
                ) : (
                  <LoginRequired onOpenAuth={() => setIsAuthModalOpen(true)} />
                ))}

              {/* My Info Page */}
              {activeTab === "myinfo" &&
                (currentUser ? (
                  <MyInfoDashboard
                    houses={houses}
                    bookings={bookingsView}
                    currentUser={currentUser}
                    onSelectHouse={openHouse}
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
                  <AdminDashboard houses={adminHouses} onReviewHouse={handleReviewHouse} />
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
