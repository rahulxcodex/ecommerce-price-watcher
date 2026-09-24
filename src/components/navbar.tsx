'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PlusCircle,
  LayoutDashboard,
  Settings,
  TrendingDown,
  Sparkles,
  Menu,
  X,
  KeyRound,
  LogOut,
  Crown,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  // Automatically close mobile menu when navigating to another route
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      desc: 'View tracked products & filters',
    },
    {
      href: '/add',
      label: 'Track Product',
      icon: PlusCircle,
      desc: 'Add product link across 6 stores',
    },
    {
      href: '/settings',
      label: 'Alert Settings',
      icon: Settings,
      desc: 'Telegram, WhatsApp, Push & Webhooks',
    },
    {
      href: '/extension',
      label: 'Extension',
      icon: Sparkles,
      desc: '1-Click Chrome & Brave Companion',
    },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/90 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg text-slate-100 tracking-tight leading-none">
                Price<span className="text-emerald-400">Watcher</span>
              </span>
              <span className="hidden sm:block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Multi-Store Price Tracker • 6 Platforms
              </span>
              <span className="block sm:hidden text-[9px] text-emerald-400 font-semibold tracking-wider uppercase">
                6 Stores Tracker
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <Link
              href="/add"
              className="ml-2 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Link</span>
            </Link>

            {/* Desktop Auth Section */}
            {user ? (
              <div className="ml-2 pl-2 border-l border-slate-800 flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold ${
                    user.isCombined
                      ? 'bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                  title={user.isCombined ? 'Special Combined Access (Shared Space)' : `Signed in as ${user.name}`}
                >
                  {user.isCombined ? (
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{user.name}</span>
                  {user.isCombined && (
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                      Combined
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-2 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign In</span>
              </Link>
            )}
          </nav>

          {/* Mobile Right Controls: Compact Add Button + Auth + Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/add"
              className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg text-xs transition-all shadow-sm shadow-emerald-500/20"
              aria-label="Add product link"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/98 px-4 pt-3 pb-6 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-150">
          {/* User profile card on mobile */}
          {user ? (
            <div className="mb-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    user.isCombined
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {user.isCombined ? <Crown className="w-4 h-4 text-amber-400" /> : user.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-100 text-xs flex items-center gap-1.5">
                    <span>{user.name}</span>
                    {user.isCombined && (
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                        Combined
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {user.isCombined ? 'Shared Combined Space' : 'Active Account'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-400 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="mb-3 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
            >
              <KeyRound className="w-4 h-4" />
              <span>Sign In with 4-Digit PIN</span>
            </Link>
          )}

          <div className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-slate-800/80 text-emerald-400 border border-slate-700/60'
                      : 'text-slate-300 hover:bg-slate-900 border border-transparent hover:text-slate-100'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm leading-tight flex items-center justify-between">
                      <span>{link.label}</span>
                      {isActive && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Free Tier Multi-Store Monitor</span>
            <span className="text-emerald-400 font-medium">6 Platforms</span>
          </div>
        </div>
      )}
    </header>
  );
}
