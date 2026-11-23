import React, { useState } from "react";
import { X, Mail, Lock, User, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { UserProfile } from "../types";
import { fetchProfile } from "../dbService";
import { T } from "../strings";

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

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setErrorMessage(T.auth.googleError);
        setLoading(false);
        return;
      }
      if (result.redirected) {
        // 구글 화면으로 이동 중 — 돌아오면 앱이 로그인 상태를 알아서 처리함
        return;
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMessage(T.auth.googleError);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setErrorMessage(T.auth.fillEmailPassword);
      setLoading(false);
      return;
    }
    if (isSignUp && !name.trim()) {
      setErrorMessage(T.auth.enterName);
      setLoading(false);
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setErrorMessage(T.auth.passwordMismatch);
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
        setSuccessMessage(T.auth.signupComplete);
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
          setErrorMessage(T.auth.invalidLogin);
          setLoading(false);
          return;
        }
        setSuccessMessage(T.auth.loginSuccess);
        if (data.user) await loadAndFinish(data.user.id);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(T.auth.processingError);
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
            {isSignUp ? T.auth.titleSignUp : T.auth.titleLogin}
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

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[#FFFFFF] border border-[#747775] text-[#1F1F1F] cursor-pointer hover:bg-neutral-50 disabled:opacity-50 font-medium text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2.5"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          {T.auth.googleLogin}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 border-t border-neutral-200" />
          <span className="text-[11px] font-bold text-neutral-400">{T.auth.orDivider}</span>
          <div className="flex-1 border-t border-neutral-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                {T.auth.usernameLabel}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder={T.auth.namePlaceholder}
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
              {T.auth.emailLabel}
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
              {isSignUp ? T.auth.passwordSetupLabel : T.auth.passwordLabel}
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
                {T.auth.confirmPasswordLabel}
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
            className="w-full bg-white border border-[#008000] text-[#008000] cursor-pointer hover:bg-[#008000] hover:text-white disabled:opacity-50 font-bold text-xs md:text-sm py-3.5 px-4 rounded-xl transition-all mt-2 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? T.auth.submitSignUp : T.auth.submitLogin}
          </button>
        </form>

        <div className="text-center mt-5 pt-4 border-t border-neutral-100 text-xs">
          <span className="text-neutral-400">{isSignUp ? T.auth.hasAccount : T.auth.firstVisit}</span>{" "}
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
            {isSignUp ? T.auth.goToLogin : T.auth.goToSignup}
          </button>
        </div>
      </div>
    </div>
  );
}
