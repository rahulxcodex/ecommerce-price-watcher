'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  Lock,
  User,
  Mail,
  KeyRound,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Crown,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const { user, signin, signup } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Signin state: Email + 4-6 digit PIN
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPin, setSigninPin] = useState(['', '', '', '']);
  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Signup state: Name + Email + 4-6 digit PIN
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPin, setSignupPin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      router.replace(redirectUrl);
    }
  }, [user, redirectUrl, router]);

  // Handle PIN input digit changes for signin
  const handlePinChange = (index: number, val: string) => {
    setError(null);
    const cleaned = val.replace(/\D/g, ''); // Numbers only

    if (!cleaned) {
      const updated = [...signinPin];
      updated[index] = '';
      setSigninPin(updated);
      return;
    }

    const digit = cleaned.slice(-1); // Take last digit
    const updated = [...signinPin];
    updated[index] = digit;
    setSigninPin(updated);

    // Auto-advance focus to next digit
    if (index < 3) {
      pinInputRefs[index + 1].current?.focus();
    } else {
      // 4th digit entered: if email is filled, auto-submit
      const fullPin = updated.join('');
      if (fullPin.length === 4 && signinEmail.trim()) {
        executeSignin(signinEmail.trim(), fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !signinPin[index] && index > 0) {
      pinInputRefs[index - 1].current?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!paste) return;

    const updated = ['', '', '', ''];
    for (let i = 0; i < paste.length; i++) {
      updated[i] = paste[i];
    }
    setSigninPin(updated);

    if (paste.length === 4 && signinEmail.trim()) {
      executeSignin(signinEmail.trim(), paste);
    } else {
      pinInputRefs[Math.min(paste.length, 3)].current?.focus();
    }
  };

  const executeSignin = async (emailStr: string, pinStr: string) => {
    if (!emailStr.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (pinStr.length < 4) {
      setError('Please enter your 4-digit PIN.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await signin(emailStr, pinStr);
    setIsLoading(false);

    if (res.success && res.user) {
      setSuccessMsg(
        res.user.isCombined
          ? `Welcome back, ${res.user.name}! 👑 Combined Access active.`
          : `Welcome back, ${res.user.name}!`
      );
      setTimeout(() => {
        router.push(redirectUrl);
      }, 500);
    } else {
      setError(res.error || 'Invalid email or PIN.');
      setSigninPin(['', '', '', '']);
      pinInputRefs[0].current?.focus();
    }
  };

  const handleSigninSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = signinPin.join('');
    executeSignin(signinEmail.trim(), fullPin);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!signupName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!signupEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!/^\d{4,6}$/.test(signupPin.trim())) {
      setError('PIN must be 4 to 6 numeric digits (e.g. 1234).');
      return;
    }

    setIsLoading(true);
    const res = await signup(signupName.trim(), signupEmail.trim(), signupPin.trim());
    setIsLoading(false);

    if (res.success && res.user) {
      setSuccessMsg(
        res.user.isCombined
          ? `Account created! 👑 Special Combined Access unlocked for ${res.user.name}.`
          : `Account created for ${res.user.name}!`
      );
      setTimeout(() => {
        router.push(redirectUrl);
      }, 700);
    } else {
      setError(res.error || 'Failed to create account.');
    }
  };

  const isSignupCombinedPreview =
    signupName.toLowerCase().includes('rahul') ||
    signupName.toLowerCase().includes('nisha') ||
    signupName.toLowerCase().trim() === 'me' ||
    signupEmail.toLowerCase().includes('rahul') ||
    signupEmail.toLowerCase().includes('nisha') ||
    signupEmail.toLowerCase().includes('rsahgupta');

  return (
    <div className="max-w-md mx-auto py-6 sm:py-12 px-2">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/20 mb-4">
          <KeyRound className="w-7 h-7 text-slate-950 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Price<span className="text-emerald-400">Watcher</span> Access
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
          Fast, secure Email & PIN authentication with stateless session
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              mode === 'signin'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In (Email + PIN)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              mode === 'signup'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-emerald-400 text-xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-semibold">{successMsg}</p>
          </div>
        )}

        {/* SIGN IN FORM (EMAIL + PIN) */}
        {mode === 'signin' && (
          <form onSubmit={handleSigninSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  autoFocus
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                4-Digit Security PIN
              </label>
              {/* 4 Digit Boxes */}
              <div className="flex justify-center gap-3 sm:gap-4 py-1">
                {signinPin.map((digit, index) => (
                  <input
                    key={index}
                    ref={pinInputRefs[index]}
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    onPaste={handlePinPaste}
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-black bg-slate-950/90 border border-slate-700/80 rounded-2xl text-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !signinEmail.trim() || signinPin.join('').length < 4}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* SIGN UP FORM (NAME + EMAIL + PIN) */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Rahul or Nishaa"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Set 4-6 Digit Security PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={signupPin}
                  onChange={(e) => setSignupPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234 or 123456"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors tracking-widest font-mono"
                />
              </div>
            </div>

            {/* Special Combined Access Indicator */}
            {isSignupCombinedPreview && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-300 text-xs animate-in fade-in duration-200">
                <Crown className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-200">Special Combined Access Detected!</span>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Your account will automatically share a synchronized joint watchlist with your partner.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !signupName.trim() || !signupEmail.trim() || signupPin.length < 4}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security badges */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            PBKDF2/SHA-256 Salted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-teal-400" />
            HTTP-Only Cookie
          </span>
        </div>
      </div>

      <div className="text-center mt-6">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Return to PriceWatcher Home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
