import React, { useState } from "react";
import { X, Mail, Lock, User, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile } from "../types";
import { fetchProfile } from "../dbService";

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const randomAvatars = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  ];

  async function loadAndFinish(userId: string) {
    const profile = await fetchProfile(userId);
    if (profile) {
      onLoginSuccess(profile);
    } else {
      // 트리거가 막 생성한 직후라 잠시 후 재시도
      setTimeout(async () => {
        const p2 = await fetchProfile(userId);
        if (p2) onLoginSuccess(p2);
      }, 600);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
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
    if (isSignUp && password !== confirmPassword) {
      setErrorMessage("비밀번호가 일치하지 않습니다. 다시 확인해주세요.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const avatar = randomAvatars[Math.floor(Math.random() * randomAvatars.length)];
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined" ? window.location.origin : undefined,
            data: { name: name.trim(), avatar },
          },
        });
        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }
        setSuccessMessage("회원 가입이 완료되었습니다.");
        if (data.session?.user) {
          await loadAndFinish(data.session.user.id);
        } else if (data.user) {
          // 메일 확인이 필요한 경우 대비
          await loadAndFinish(data.user.id);
        }
        setLoading(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setErrorMessage("이메일 또는 비밀번호가 올바르지 않습니다.");
          setLoading(false);
          return;
        }
        setSuccessMessage("로그인 성공");
        if (data.user) await loadAndFinish(data.user.id);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl border border-blue-100 flex flex-col relative animate-fadeIn p-6 md:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 transition-all cursor-pointer"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-black text-neutral-905 tracking-tight">
            {isSignUp ? "IMTAM 가입" : "IMTAM 로그인"}
          </h2>
        </div>

        {errorMessage && (
          <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-xl border border-red-150 mb-4 animate-shake">
            ⚠️ {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 text-emerald-800 text-xs font-bold p-3.5 rounded-xl border border-emerald-150 mb-4 flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                사용자명 *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="예: 김성민"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-bold pl-10 pr-3 py-3 border border-neutral-200 rounded-xl bg-neutral-50/50 focus:bg-white focus:border-blue-400 focus:outline-hidden text-neutral-800"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              이메일 *
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

          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              {isSignUp ? "비밀번호 설정 *" : "비밀번호 *"}
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

          {isSignUp && (
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                비밀번호 확인 *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="password"
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full text-xs font-bold pl-10 pr-3 py-3 border border-neutral-200 rounded-xl bg-neutral-50/50 focus:bg-white focus:border-blue-400 focus:outline-hidden text-neutral-800"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 cursor-pointer hover:bg-blue-700 disabled:bg-blue-350 text-white font-bold text-xs md:text-sm py-3.5 px-4 rounded-xl shadow-md transition-all mt-2 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? "약관 동의하고 가입하기" : "IMTAM에 접속"}
          </button>
        </form>

        <div className="text-center mt-5 pt-4 border-t border-neutral-100 text-xs">
          <span className="text-neutral-400">{isSignUp ? "이미 계정이 있으신가요?" : "첫 방문이신가요?"}</span>{" "}
          <button
            onClick={() => {
              if (!loading) {
                setIsSignUp(!isSignUp);
                setErrorMessage("");
                setSuccessMessage("");
                setConfirmPassword("");
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
