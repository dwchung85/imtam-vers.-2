import { useState, useEffect } from 'react';
import { House, Booking, UserProfile } from './types';
import Navbar from './components/Navbar';
import HouseCard from './components/HouseCard';
import HouseDetail from './components/HouseDetail';
import HostDashboard from './components/HostDashboard';
import GuestDashboard from './components/GuestDashboard';
import AuthModal from './components/AuthModal';
import { 
  seedInitialDatabaseIfEmpty, 
  fetchHouses, 
  fetchBookings, 
  addHouseListingDb, 
  addBookingDb, 
  updateBookingStatusDb,
  findUserByEmail
} from './dbService';
import { Search, Info, Sparkles, Building, Landmark, Compass, LogIn, Loader2 } from 'lucide-react';

export default function App() {
  const [houses, setHouses] = useState<House[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Current logged in user context
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('imtam_logged_in_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [userRole, setUserRole] = useState<'guest' | 'host'>('guest');
  const [activeTab, setActiveTab] = useState<'browse' | 'guest' | 'host'>('browse');
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);

  // Auth modal view controller
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // App Search & Spec Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [minRooms, setMinRooms] = useState<number>(0); // 0 means '전체' (any)
  const [minBathrooms, setMinBathrooms] = useState<number>(0); // 0 means '전체' (any)
  const [minArea, setMinArea] = useState<number>(0); // 0 means '전체' (any)

  // Load and sync Firestore database data on mount
  useEffect(() => {
    async function initApp() {
      try {
        setLoading(true);
        // Step 1: Seed if database collections are empty
        await seedInitialDatabaseIfEmpty();

        // If no user is logged in, auto-fill with standard demo credential and sync to DB
        let user = currentUser;
        if (!user) {
          const demoUser = await findUserByEmail('test@imtam.com');
          if (demoUser) {
            user = demoUser;
            setCurrentUser(demoUser);
            localStorage.setItem('imtam_logged_in_user', JSON.stringify(demoUser));
          }
        }

        // Step 2: Fetch houses & bookings
        const dbHouses = await fetchHouses();
        const dbBookings = await fetchBookings();
        
        setHouses(dbHouses);
        setBookings(dbBookings);
      } catch (error) {
        console.error("Failed to fetch initial Firestore data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    initApp();
  }, []);

  // Sync current user to local storage if it changes manually
  useEffect(() => {
    if (currentUser) {
      if (typeof window === 'undefined') return;
      localStorage.setItem('imtam_logged_in_user', JSON.stringify(currentUser));
    } else {
      if (typeof window === 'undefined') return;
      localStorage.removeItem('imtam_logged_in_user');
    }
  }, [currentUser]);

  // --- Actions ---
  const handleToggleRole = () => {
    const nextRole = userRole === 'guest' ? 'host' : 'guest';
    setUserRole(nextRole);
    if (nextRole === 'host') {
      setActiveTab('host');
    } else {
      setActiveTab('browse');
    }
  };

  // Auth Handlers
  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    // Refresh bookings & houses list for user specificity
    try {
      const dbBookings = await fetchBookings();
      setBookings(dbBookings);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('browse');
    setUserRole('guest');
  };

  // 1. Request House Tour (Guest Action)
  const handleBookHouse = async (bookingData: Omit<Booking, 'id' | 'guestId' | 'guestName' | 'status' | 'createdAt'>) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    const newBooking: Booking = {
      ...bookingData,
      id: `booking-${Date.now()}`,
      guestId: currentUser.id,
      guestName: currentUser.name,
      status: 'pending', // Pending host approval
      createdAt: new Date().toISOString().split('T')[0],
    };

    try {
      // Optimitistic Local Update for snappiness
      setBookings((prev) => [newBooking, ...prev]);
      
      // Real DB action
      await addBookingDb(newBooking);
    } catch (error) {
      console.error("DB error booking house:", error);
    }
  };

  // 2. Add a new House showcasing Listing (Host Action)
  const handleAddHouseListing = async (newHouseData: Omit<House, 'id' | 'hostId' | 'hostName' | 'hostAvatar' | 'rating' | 'reviewsCount'>) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    const newHouse: House = {
      ...newHouseData,
      id: `house-${Date.now()}`,
      hostId: currentUser.id,
      hostName: currentUser.name,
      hostAvatar: currentUser.avatar,
      rating: 4.8 + Math.random() * 0.2, // Premium design rating scale
      reviewsCount: 1,
    };

    try {
      // Optimistic Local Update
      setHouses((prev) => [newHouse, ...prev]);

      // Real DB action
      await addHouseListingDb(newHouse);
    } catch (error) {
      console.error("DB error listing house:", error);
    }
  };

  // 3. Confirm / Cancel Booking Incoming (Host Action)
  const handleUpdateBookingStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    try {
      // Optimistic local update
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );

      // Real DB action
      await updateBookingStatusDb(bookingId, status);
    } catch (error) {
      console.error("DB error updating booking:", error);
    }
  };

  // 4. Cancel Guest Reservation (Guest Action)
  const handleCancelBooking = async (bookingId: string) => {
    try {
      // Optimistic local update
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b))
      );

      // Real DB action
      await updateBookingStatusDb(bookingId, 'cancelled');
    } catch (error) {
      console.error("DB error cancelling booking:", error);
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-xs text-neutral-500 font-bold">공식 런칭용 Firestore 실시간 부동산 데이터베이스 연결 중...</p>
          </div>
        ) : (
          <>
            {activeTab === 'browse' && (
              <div className="space-y-6 md:space-y-8 animate-fadeIn">
                {/* Visual Header / Search / Filter row */}
                <div className="bg-white rounded-3xl border border-blue-100 p-5 md:p-8 shadow-xs space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl md:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                        <Building className="w-7 h-7 text-blue-600 inline shrink-0" />
                        <span>전국 프리미엄 실주택 매물 오픈하우스 임장 매칭</span>
                      </h1>
                      <p className="text-neutral-500 text-xs md:text-sm mt-1.5 font-medium leading-relaxed">
                        <strong>IMTAM(임탐)</strong>은 단순 숙박을 넘어 실제 중개 의뢰중인 트렌디한 인테리어 주택과 오두막 쇼룸을 탐방하는 플랫폼입니다. <br className="hidden md:inline" />
                        동기부여를 위한 수입 가구 배치 실사 및 실제 매수 목적의 맞춤형 실사 오픈하우스 일정을 예약해 직접 임장해 보세요.
                      </p>
                    </div>

                    {/* Search Bar inside card */}
                    <div className="relative w-full md:max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                      <input
                        type="text"
                        placeholder="매물 건축 타입, 옵션, 수입 가구 태그 등으로 서칭..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs md:text-sm pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-blue-400 focus:outline-hidden bg-neutral-50 focus:bg-white text-neutral-800 transition-all font-bold"
                      />
                    </div>
                  </div>

                  {/* Advanced Spec Filters (방 갯수, 화장실 갯수, 넓이 (평) 기준) */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-t border-blue-50">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Filter label */}
                      <span className="text-xs text-neutral-500 font-extrabold flex items-center gap-1.5 shrink-0">
                        <Compass className="w-4 h-4 text-blue-600" />
                        <span>매물 상세 필터 조건 :</span>
                      </span>

                      {/* Rooms Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-600">방 개수</span>
                        <select
                          value={minRooms}
                          onChange={(e) => setMinRooms(Number(e.target.value))}
                          className="text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50 hover:bg-white transition-all text-neutral-850 cursor-pointer"
                        >
                          <option value="0">전체</option>
                          <option value="1">1개 이상</option>
                          <option value="2">2개 이상</option>
                          <option value="3">3개 이상</option>
                          <option value="4">4개 이상</option>
                        </select>
                      </div>

                      {/* Bathrooms Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-600">화장실 개수</span>
                        <select
                          value={minBathrooms}
                          onChange={(e) => setMinBathrooms(Number(e.target.value))}
                          className="text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50 hover:bg-white transition-all text-neutral-850 cursor-pointer"
                        >
                          <option value="0">전체</option>
                          <option value="1">1개 이상</option>
                          <option value="2">2개 이상</option>
                          <option value="3">3개 이상</option>
                        </select>
                      </div>

                      {/* Area Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-600">넓이 (평)</span>
                        <select
                          value={minArea}
                          onChange={(e) => setMinArea(Number(e.target.value))}
                          className="text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50 hover:bg-white transition-all text-neutral-850 cursor-pointer"
                        >
                          <option value="0">전체</option>
                          <option value="10">10평 이상</option>
                          <option value="20">20평 이상</option>
                          <option value="30">30평 이상</option>
                          <option value="40">40평 이상</option>
                        </select>
                      </div>

                      {/* Reset filter button if any filter is active */}
                      {(minRooms > 0 || minBathrooms > 0 || minArea > 0 || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setMinRooms(0);
                            setMinBathrooms(0);
                            setMinArea(0);
                            setSearchQuery('');
                          }}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          🔄 필터 초기화
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Platform Houses Grid */}
                {filteredHouses.length === 0 ? (
                  <div className="text-center py-20 bg-white border border-neutral-250 rounded-3xl p-6">
                    <Info className="w-12 h-12 text-blue-500/30 mx-auto mb-3" />
                    <h3 className="font-bold text-neutral-800 text-lg">해당 조건에 부합하는 오픈하우스 임장 매물을 찾을 수 없습니다</h3>
                    <p className="text-neutral-500 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed font-semibold">
                      검색 조건을 변경해보시거나, 소유주 모드로 전환해 자가 주택을 직접 프리미엄 매물로 첫 번째로 리스팅 해보세요!
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-4.5 px-1">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">실시간 예약 일정 조율가능 매물 ({filteredHouses.length}개)</span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded-lg">전속 특약 한정권</span>
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
            {activeTab === 'guest' && currentUser && (
              <GuestDashboard
                bookings={bookings}
                currentUserId={currentUser.id}
                onCancelBooking={handleCancelBooking}
              />
            )}

            {/* Host Dashboard Page */}
            {activeTab === 'host' && currentUser && (
              <HostDashboard
                houses={houses}
                bookings={bookings}
                currentUserId={currentUser.id}
                onAddHouse={handleAddHouseListing}
                onUpdateBookingStatus={handleUpdateBookingStatus}
                onSelectHouse={(h) => setSelectedHouse(h)}
              />
            )}

            {/* Guest fallback banner if on internal pages while logged out */}
            {(activeTab === 'guest' || activeTab === 'host') && !currentUser && (
              <div className="text-center py-16 bg-white border border-neutral-205 rounded-3xl p-6 max-w-md mx-auto space-y-4">
                <LogIn className="w-12 h-12 text-blue-600 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-neutral-850">오픈하우스 실사 및 전속 리스팅 기능을 이용하려면 세션 입장이 필요합니다</h3>
                <p className="text-xs text-neutral-400 font-semibold">
                  IMTAM은 빠르고 간편한 에이전트 이메일 로그인으로 나만의 전속 매물 및 스케줄 데이터를 영구 소장합니다.
                </p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 font-bold text-white text-xs py-2.5 px-5 rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  에이전트 로그인 및 파트너 가입
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* House Details Modal */}
      {selectedHouse && (
        <HouseDetail
          house={selectedHouse}
          onClose={() => setSelectedHouse(null)}
          onBook={handleBookHouse}
          currentUserRole={userRole}
          currentUserId={currentUser?.id || ''}
        />
      )}

      {/* Auth Modal Trigger overlay */}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-16 py-6 text-center text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-bold text-neutral-500">🏢 IMTAM (임탐) - 하이엔드 전외주택 오픈하우스 & 매물의 현장 실사 임장 중개 테크 매칭 플랫폼</p>
          <p>© 2026 IMTAM Zillow-Style Engine for real estate workspace environment. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
