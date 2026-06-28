import { UserProfile } from '../types';
import { Home, Compass, Calendar, Briefcase, RefreshCw, LogIn, LogOut } from 'lucide-react';

interface NavbarProps {
  currentTab: 'browse' | 'guest' | 'host';
  setTab: (tab: 'browse' | 'guest' | 'host') => void;
  currentUser: UserProfile | null;
  userRole: 'guest' | 'host';
  onToggleRole: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onResetToHome?: () => void;
}

export default function Navbar({
  currentTab,
  setTab,
  currentUser,
  userRole,
  onToggleRole,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab('browse')}>
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xs">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-neutral-900 tracking-tight text-xl">IMTAM</span>
            </div>
          </div>

          {/* Navigation Links (Tabs) */}
          <nav className="hidden md:flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <button
              onClick={() => setTab('browse')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'browse'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              매물 및 임장 찾기
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenAuth();
                } else {
                  setTab('guest');
                }
              }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'guest'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              내 현장 임장 예약
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenAuth();
                } else {
                  setTab('host');
                }
              }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'host'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-950'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              내 매물·투어 리스팅 관리
            </button>
          </nav>

          {/* User profile & Role switcher */}
          <div className="flex items-center gap-3">
            {currentUser && (
              /* Role switcher badge */
              <button
                onClick={onToggleRole}
                className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all cursor-pointer"
                title="역할을 임장 신청자(Guest) 및 중개/매도인(Agent) 간 전환합니다"
              >
                <RefreshCw className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">전환:</span>
                <span className="underline decoration-dotted">{userRole === 'host' ? '중개인·소유주' : '임장 희망자'}</span>
              </button>
            )}

            {/* Profile widget or Login Trigger */}
            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 border-r border-neutral-200 pr-2.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-neutral-300 ring-2 ring-neutral-50"
                  />
                  <div className="hidden lg:block text-left leading-tight">
                    <p className="text-xs font-bold text-neutral-800 truncate max-w-[80px]">{currentUser.name}</p>
                    <p className="text-[9px] text-neutral-400 capitalize">{userRole === 'host' ? '전문 에이전트' : '투자자/매수 희망'}</p>
                  </div>
                </div>
                {/* Logout action */}
                <button
                  onClick={onLogout}
                  className="p-1 px-2.5 hover:bg-neutral-100 text-neutral-400 hover:text-rose-500 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>로그인/회원가입</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Links */}
        <div className="md:hidden flex justify-around border-t border-neutral-100 py-2">
          <button
            onClick={() => setTab('browse')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-2 py-1 transition-colors ${
              currentTab === 'browse' ? 'text-blue-600' : 'text-neutral-400'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>매물 임장</span>
          </button>
          <button
            onClick={() => {
              if (!currentUser) {
                onOpenAuth();
              } else {
                setTab('guest');
              }
            }}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-2 py-1 transition-colors ${
              currentTab === 'guest' ? 'text-blue-600' : 'text-neutral-400'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>예약 내역</span>
          </button>
          <button
            onClick={() => {
              if (!currentUser) {
                onOpenAuth();
              } else {
                setTab('host');
              }
            }}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-2 py-1 transition-colors ${
              currentTab === 'host' ? 'text-blue-600' : 'text-neutral-400'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>매물 리스팅</span>
          </button>
        </div>
      </div>
    </header>
  );
}
