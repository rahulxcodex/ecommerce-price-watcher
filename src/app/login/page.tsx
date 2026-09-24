'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  Lock,
  User,
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

  // Signin state: 4-digit PIN only
  const [signinPin, setSigninPin] = useState(['', '', '', '']);
  const pinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Signup state: Name + 4-digit PIN
  const [signupName, setSignupName] = useState('');
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

  // Focus first PIN input on signin mode
  useEffect(() => {
    if (mode === 'signin') {
      pinInputRefs[0].current?.focus();
    }
  }, [mode]);

  // Handle PIN input digit changes
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
      // 4th digit entered: auto submit if all 4 are filled
      const fullPin = updated.join('');
      if (fullPin.length === 4) {
        submitSignin(fullPin);
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

    if (paste.length === 4) {
      submitSignin(paste);
    } else {
      pinInputRefs[Math.min(paste.length, 3)].current?.focus();
    }
  };

  const submitSignin = async (pinStr: string) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await signin(pinStr);
    setIsLoading(false);

    if (res.success && res.user) {
      setSuccessMsg(
        res.user.isCombined
          ? `Welcome back, ${res.user.name}! 👑 Combined Access active.`
          : `Welcome back, ${res.user.name}!`
      );
      setTimeout(() => {
        router.push(redirectUrl);
      }, 600);
    } else {
      setError(res.error || 'Invalid 4-digit PIN.');
      // Reset inputs & focus first
      setSigninPin(['', '', '', '']);
      pinInputRefs[0].current?.focus();
    }
  };

  const handleManualSigninSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = signinPin.join('');
    if (fullPin.length !== 4) {
      setError('Please enter your complete 4-digit PIN.');
      return;
    }
    submitSignin(fullPin);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!signupName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!/^\d{4}$/.test(signupPin.trim())) {
      setError('PIN must be exactly 4 numeric digits.');
      return;
    }

    setIsLoading(true);
    const res = await signup(signupName.trim(), signupPin.trim());
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
    signupName.toLowerCase().trim() === 'me';

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
          Fast, passwordless PIN authentication with secure server session
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
            Sign In (PIN Only)
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
            Sign Up (Name + PIN)
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

        {/* SIGN IN FORM (PIN ONLY) */}
        {mode === 'signin' && (
          <form onSubmit={handleManualSigninSubmit} className="space-y-6">
            <div className="text-center space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Enter your 4-Digit PIN
              </label>
              <p className="text-[11px] text-slate-400">
                Sign in instantly using just your 4-digit code.
              </p>
            </div>

            {/* 4 Digit Boxes */}
            <div className="flex justify-center items-center gap-3 sm:gap-4 my-4">
              {signinPin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={pinInputRefs[idx]}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  disabled={isLoading}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  onPaste={handlePinPaste}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-mono font-bold bg-slate-950 border-2 border-slate-800 rounded-2xl text-emerald-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 focus:outline-none transition-all disabled:opacity-50"
                  autoComplete="off"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || signinPin.join('').length !== 4}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Verifying PIN...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
              >
                Don&apos;t have a PIN yet? <span className="font-semibold underline">Sign up here</span>
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP FORM (NAME + 4-DIGIT PIN) */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Your Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Choose a 4-Digit Numeric PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={signupPin}
                  onChange={(e) => setSignupPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4 digits (e.g. 2489)"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 font-mono tracking-widest text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                You will use only this 4-digit PIN to sign in later.
              </p>
            </div>

            {/* Special Combined Access Indicator */}
            {isSignupCombinedPreview && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
                <Crown className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300">Special Combined Access Unlocked:</span>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    This account is granted full access to the shared watchlist space and combined price alerts.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !signupName.trim() || signupPin.length !== 4}
              className="w-full mt-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
              >
                Already have a PIN? <span className="font-semibold underline">Sign in</span>
              </button>
            </div>
          </form>
        )}

        {/* Security Notice */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Server-side HTTP-only session • Zero local storage tokens</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400 text-sm">Loading login...</div>}>
      <LoginForm />
    </Suspense>
  );
}
