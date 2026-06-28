import React, { useState } from "react";
import { X, Mail, Lock, User, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { UserProfile } from "../types";
import { findUserByEmail, createUserProfile } from "../dbService";

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [canAutoRegister, setCanAutoRegister] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Submit Handler using local IMTAM demo DB Service
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setCanAutoRegister(null);
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해주세요.");
      setLoading(false);
      return;
    }

    if (isSignUp && !name.trim()) {
      setErrorMessage("이름을 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Find if user already exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
          setErrorMessage("이미 가입된 이메일 주소입니다.");
          setLoading(false);
          return;
        }

        // Generate random stylish avatar
        const randomAvatars = [
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
        ];
        const randomAvatar = randomAvatars[Math.floor(Math.random() * randomAvatars.length)];

        // Create new user in the local demo database
        const createdUser = await createUserProfile(email, name, randomAvatar);

        setSuccessMessage("회원 가입이 완료되었습니다.");

        setTimeout(() => {
          onLoginSuccess(createdUser);
          setLoading(false);
        }, 1500);
      } else {
        // Sign In Flow with local demo database
        const foundUser = await findUserByEmail(email);

        if (!foundUser) {
          setErrorMessage("가입 정보가 없는 이메일입니다.");
          setCanAutoRegister(email.trim());
          setLoading(false);
          return;
        }

        setSuccessMessage("로그인 성공");

        setTimeout(() => {
          onLoginSuccess(foundUser);
          setLoading(false);
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("로컬 데이터베이스 처리 중 오류가 발생했습니다. 입력값을 확인해 주세요.");
      setLoading(false);
    }
  };

  const handleInstantRegister = async () => {
    if (!canAutoRegister) return;
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const parts = canAutoRegister.split("@");
      const fallbackName = parts[0].substring(0, 10) + " 투어러";
      const randomAvatars = [
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
      ];
      const randomAvatar = randomAvatars[Math.floor(Math.random() * randomAvatars.length)];
      const newUser = await createUserProfile(canAutoRegister, fallbackName, randomAvatar);

      setSuccessMessage(`🎉 '${canAutoRegister}' 회원가입 완료 및 실시간 주택 대시보드 로그인이 승인되었습니다!`);
      setTimeout(() => {
        onLoginSuccess(newUser);
        setLoading(false);
        setCanAutoRegister(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setErrorMessage("즉시 회원 생성이 정상 처리되지 않았습니다. 잠시 후 재시행 바랍니다.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl border border-blue-100 flex flex-col relative animate-fadeIn p-6 md:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 transition-all cursor-pointer"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand identity center header */}
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-black text-neutral-905 tracking-tight">
            {isSignUp ? "IMTAM 가입" : "IMTAM 로그인"}
          </h2>
        </div>

        {/* Error / Success feedback blocks */}
        {errorMessage && (
          <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-xl border border-red-150 mb-4 animate-shake">
            ⚠️ {errorMessage}
          </div>
        )}
        {errorMessage && canAutoRegister && (
          <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-2xl mb-4 text-center">
            <p className="text-[11px] font-bold text-blue-800 mb-2">
              입력하신 이메일('{canAutoRegister}')로 신규 가입하고 즉시 로그인하시겠습니까?
            </p>
            <button
              type="button"
              onClick={handleInstantRegister}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold py-2 px-4 rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 animate-bounce" />
              <span>'{canAutoRegister.split("@")[0]}' 임장러 계정으로 간편 가입 & 로그인</span>
            </button>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-3.5 rounded-xl border border-emerald-150 mb-4 flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field - Show only on Sign Up */}
          {isSignUp && (
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                사용자 실명 / 에이전트명 *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="예: 공인중개사 김성민"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-bold pl-10 pr-3 py-3 border border-neutral-200 rounded-xl bg-neutral-50/50 focus:bg-white focus:border-blue-400 focus:outline-hidden text-neutral-800"
                  required
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              에이전트 로그인 이메일 *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="email"
                placeholder="example@imtam.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full text-xs font-bold pl-10 pr-3 py-3 border border-neutral-200 rounded-xl bg-neutral-50/50 focus:bg-white focus:border-blue-400 focus:outline-hidden text-neutral-800"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              비밀번호 설정 *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full text-xs font-bold pl-10 pr-3 py-3 border border-neutral-200 rounded-xl bg-neutral-50/50 focus:bg-white focus:border-blue-400 focus:outline-hidden text-neutral-800"
                required
              />
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 cursor-pointer hover:bg-blue-700 disabled:bg-blue-350 text-white font-bold text-xs md:text-sm py-3.5 px-4 rounded-xl shadow-md transition-all mt-2 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? "약관 동의하고 파트너 가입하기" : "IMTAM 엔진 에 접속"}
          </button>
        </form>

        {/* Account Swap Switcher */}
        <div className="text-center mt-5 pt-4 border-t border-neutral-100 text-xs">
          <span className="text-neutral-400">
            {isSignUp ? "이미 에이전트 계정이 있으신가요?" : "중개 엔진에 첫 방문이신가요?"}
          </span>{" "}
          <button
            onClick={() => {
              if (!loading) {
                setIsSignUp(!isSignUp);
                setErrorMessage("");
                setSuccessMessage("");
              }
            }}
            className="text-blue-600 hover:text-blue-800 underline font-bold ml-1 cursor-pointer"
            disabled={loading}
          >
            {isSignUp ? "여기서 로그인" : "이메일 가입하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
