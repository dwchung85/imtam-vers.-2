import { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { Home, Compass, Calendar, Briefcase, LogIn, LogOut } from 'lucide-react';

interface NavbarProps {
  currentTab: 'browse' | 'guest' | 'host';
  setTab: (tab: 'browse' | 'guest' | 'host') => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onResetToHome?: () => void;
}

export default function Navbar({
  currentTab,
  setTab,
  currentUser,
  onOpenAuth,
  onLogout,
  onResetToHome,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onResetToHome ? onResetToHome() : setTab('browse')}>
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

          {/* User profile */}
          <div className="flex items-center gap-3">
            {/* Profile widget or Login Trigger */}
            {currentUser ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-full cursor-pointer transition-all"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="사용자 메뉴"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className={`w-9 h-9 rounded-full object-cover transition-all ${
                      menuOpen
                        ? 'ring-2 ring-blue-500 ring-offset-2'
                        : 'ring-1 ring-neutral-200 hover:ring-neutral-300'
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-3 w-56 origin-top-right rounded-2xl bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)] border border-neutral-200/80 overflow-hidden z-50 animate-fadeIn">
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-neutral-50/80">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-neutral-200"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-neutral-900 truncate">{currentUser.name}</p>
                        {currentUser.email && (
                          <p className="text-[11px] text-neutral-500 truncate">{currentUser.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-neutral-100" />
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
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
