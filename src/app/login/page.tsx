'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  Lock,
  User,
  Mail,
  KeyRound,
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

  useEffect(() => {
    if (user) {
      router.replace(redirectUrl);
    }
  }, [user, redirectUrl, router]);

  const handlePinChange = (index: number, val: string) => {
    setError(null);
    const cleaned = val.replace(/\D/g, '');

    if (!cleaned) {
      const updated = [...signinPin];
      updated[index] = '';
      setSigninPin(updated);
      return;
    }

    const digit = cleaned.slice(-1);
    const updated = [...signinPin];
    updated[index] = digit;
    setSigninPin(updated);

    if (index < 3) {
      pinInputRefs[index + 1].current?.focus();
    } else {
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
    signupEmail.trim().toLowerCase() === 'rahulr24g@gmail.com';

  return (
    <div className="max-w-md mx-auto py-8 sm:py-14 px-2">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-sm bg-surface border border-gold/30 mb-3 text-gold">
          <KeyRound className="w-6 h-6 stroke-[2]" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-normal text-champagne tracking-tight">
          PriceWatcher <span className="text-gold italic">Access</span>
        </h1>
        <p className="text-xs text-champagne-faint mt-1 font-mono">
          Stateless session with salted PBKDF2/SHA-256 PIN authentication
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-surface border border-surface-border rounded-sm p-6 sm:p-8">
        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 p-1 bg-obsidian rounded-sm border border-surface-border mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`py-2 text-xs font-mono uppercase tracking-wider transition-colors rounded-sm ${
              mode === 'signin'
                ? 'bg-gold text-obsidian font-semibold'
                : 'text-champagne-muted hover:text-champagne'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-2 text-xs font-mono uppercase tracking-wider transition-colors rounded-sm ${
              mode === 'signup'
                ? 'bg-gold text-obsidian font-semibold'
                : 'text-champagne-muted hover:text-champagne'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-5 p-3.5 rounded-sm bg-terracotta/10 border border-terracotta/30 flex items-start gap-2.5 text-terracotta text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 rounded-sm bg-sage/10 border border-sage/30 flex items-start gap-2.5 text-sage text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{successMsg}</p>
          </div>
        )}

        {/* SIGN IN FORM (EMAIL + PIN) */}
        {mode === 'signin' && (
          <form onSubmit={handleSigninSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-champagne-faint" />
                <input
                  type="email"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  autoFocus
                  required
                  className="w-full bg-obsidian border border-surface-border rounded-sm pl-10 pr-4 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-champagne-muted">
                4-Digit Security PIN
              </label>
              <div className="flex justify-center gap-3 py-1">
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
                    className="w-12 h-14 text-center text-xl font-mono font-bold bg-obsidian border border-surface-border rounded-sm text-champagne focus:border-gold focus:outline-none transition-colors"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !signinEmail.trim() || signinPin.join('').length < 4}
              className="w-full py-2.5 px-4 rounded-sm bg-gold text-obsidian font-semibold text-xs sm:text-sm hover:bg-gold-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-obsidian border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* SIGN UP FORM (NAME + EMAIL + PIN) */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-1.5">
                Your Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-champagne-faint" />
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Rahul"
                  required
                  className="w-full bg-obsidian border border-surface-border rounded-sm pl-10 pr-4 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-champagne-faint" />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full bg-obsidian border border-surface-border rounded-sm pl-10 pr-4 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-1.5">
                Set 4-6 Digit Security PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-champagne-faint" />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  value={signupPin}
                  onChange={(e) => setSignupPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234 or 123456"
                  required
                  className="w-full bg-obsidian border border-surface-border rounded-sm pl-10 pr-4 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors tracking-widest font-mono"
                />
              </div>
            </div>

            {isSignupCombinedPreview && (
              <div className="p-3 rounded-sm bg-surface-subtle border border-gold/30 flex items-start gap-2.5 text-gold text-xs">
                <Crown className="w-4 h-4 flex-shrink-0 text-gold mt-0.5" />
                <div>
                  <span className="font-semibold text-champagne">Special Combined Access Active</span>
                  <p className="text-[11px] text-champagne-faint mt-0.5">
                    Your account will automatically connect to the synchronized joint watchlist with your partner.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !signupName.trim() || !signupEmail.trim() || signupPin.length < 4}
              className="w-full py-2.5 px-4 rounded-sm bg-gold text-obsidian font-semibold text-xs sm:text-sm hover:bg-gold-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-obsidian border-t-transparent rounded-full animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security badges */}
        <div className="mt-6 pt-5 border-t border-surface-border flex items-center justify-center gap-4 text-[10px] font-mono text-champagne-faint">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-gold" />
            PBKDF2/SHA-256 Salted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-champagne-muted" />
            HTTP-Only Stateless Cookie
          </span>
        </div>
      </div>

      <div className="text-center mt-6">
        <Link
          href="/"
          className="text-xs font-mono text-champagne-faint hover:text-champagne transition-colors"
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
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
