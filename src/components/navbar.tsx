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
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          </nav>

          {/* Mobile Right Controls: Compact Add Button + Hamburger Toggle */}
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
