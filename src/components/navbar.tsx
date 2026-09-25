'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PlusCircle,
  LayoutDashboard,
  Settings,
  Sparkles,
  Menu,
  X,
  KeyRound,
  LogOut,
  Crown,
  User as UserIcon,
  Compass,
  Info,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isUserAdmin = Boolean(user?.isCombined || user?.role === 'combined');

  const links = [
    {
      href: '/dashboard',
      label: 'Watchlist',
      icon: LayoutDashboard,
      desc: 'Active price monitors & trends',
    },
    {
      href: '/discover',
      label: 'Discover',
      icon: Compass,
      desc: 'Search 10-15 products & smart filter',
    },
    {
      href: '/add',
      label: 'Track',
      icon: PlusCircle,
      desc: 'Add custom product URL',
    },
    {
      href: '/settings',
      label: 'Alerts',
      icon: Settings,
      desc: 'Telegram, WhatsApp, Push & Webhooks',
    },
    {
      href: '/extension',
      label: 'Extension',
      icon: Sparkles,
      desc: 'Browser companion for Chrome & Brave',
    },
    ...(isUserAdmin
      ? [
          {
            href: '/health',
            label: 'Health',
            icon: Activity,
            desc: 'Pipeline telemetry & storefront status',
          },
        ]
      : []),
    {
      href: '/about',
      label: 'About',
      icon: Info,
      desc: 'Decision science & engineering',
    },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-obsidian/95 border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo in Editorial Instrument Serif */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-sm bg-surface-subtle border border-gold/30 flex items-center justify-center flex-shrink-0 group-hover:border-gold transition-colors">
              <span className="font-display text-gold text-lg leading-none">P</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl sm:text-2xl text-champagne tracking-tight leading-none group-hover:text-champagne-light transition-colors">
                Price<span className="text-gold italic font-normal">Watcher</span>
              </span>
              <span className="hidden sm:block text-[9px] text-champagne-faint uppercase tracking-widest font-mono font-medium mt-0.5">
                Multi-Store Price Analytics • 6 Stores
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-surface-subtle text-champagne border border-gold/30'
                      : 'text-champagne-muted hover:text-champagne hover:bg-surface-subtle/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-gold' : 'text-champagne-muted'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Desktop Auth Section */}
            {user ? (
              <div className="ml-1.5 pl-2 border-l border-surface-border flex items-center gap-1.5">
                {(() => {
                  const displayName = user.name
                    ? user.name.replace(/\s*\[.*?\]$/, '').split('@')[0].trim()
                    : 'Account';
                  return (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-xs whitespace-nowrap ${
                        user.isCombined
                          ? 'bg-surface-subtle border-gold/40 text-gold font-medium'
                          : 'bg-surface border-surface-border text-champagne'
                      }`}
                      title={user.email ? `${user.name} (${user.email})` : user.name}
                    >
                      {user.isCombined ? (
                        <Crown className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5 text-champagne-muted flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium">{displayName}</span>
                      {user.isCombined && (
                        <span className="text-[9px] bg-gold/15 text-gold px-1 rounded-sm uppercase tracking-wider font-mono">
                          Joint
                        </span>
                      )}
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 rounded-sm bg-surface hover:bg-surface-subtle border border-surface-border text-champagne-muted hover:text-terracotta transition-colors"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-1.5 flex items-center gap-1.5 bg-surface hover:bg-surface-subtle border border-surface-border text-champagne px-2.5 py-1.5 rounded-sm text-xs transition-colors whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5 text-gold" />
                <span>Sign In</span>
              </Link>
            )}
          </nav>

          {/* Mobile Right Controls */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/discover"
              className="flex items-center gap-1 bg-gold text-obsidian font-semibold px-2.5 py-1 rounded-sm text-xs transition-colors"
              aria-label="Discover products"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Search</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-sm bg-surface border border-surface-border text-champagne hover:bg-surface-subtle transition-colors focus:outline-none"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu-drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gold" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu-drawer" className="md:hidden border-t border-surface-border bg-obsidian/98 px-4 pt-3 pb-6 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-150">
          {/* User profile card on mobile */}
          {user ? (
            <div className="mb-3 p-3 rounded-sm bg-surface border border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-sm flex items-center justify-center font-bold text-xs ${
                    user.isCombined
                      ? 'bg-gold/15 text-gold border border-gold/30'
                      : 'bg-surface-subtle text-champagne border border-surface-border'
                  }`}
                >
                  {user.isCombined ? <Crown className="w-4 h-4 text-gold" /> : user.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-champagne text-xs flex items-center gap-1.5">
                    <span>{user.name ? user.name.replace(/\s*\[.*?\]$/, '').split('@')[0].trim() : 'Account'}</span>
                    {user.isCombined && (
                      <span className="text-[9px] bg-gold/15 text-gold px-1 rounded-sm uppercase tracking-wider font-mono">
                        Joint
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-champagne-faint">
                    {user.email || (user.isCombined ? 'Shared Watchlist' : 'Personal Account')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 text-[11px] text-champagne-muted hover:text-terracotta px-2 py-1 rounded-sm bg-surface-subtle border border-surface-border transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="mb-3 flex items-center justify-center gap-2 p-2.5 rounded-sm bg-surface border border-gold/30 text-champagne text-xs font-medium hover:bg-surface-subtle transition-colors"
            >
              <KeyRound className="w-4 h-4 text-gold" />
              <span>Sign In with PIN</span>
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
                  className={`flex items-start gap-3 p-2.5 rounded-sm transition-colors ${
                    isActive
                      ? 'bg-surface text-champagne border border-gold/30'
                      : 'text-champagne-muted hover:bg-surface/50 hover:text-champagne'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-sm mt-0.5 ${
                      isActive
                        ? 'bg-gold/15 text-gold'
                        : 'bg-surface-subtle text-champagne-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-xs flex items-center justify-between">
                      <span>{link.label}</span>
                      {isActive && (
                        <span className="text-[9px] text-gold font-mono uppercase bg-gold/10 px-1.5 py-0.2 rounded-sm">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-champagne-faint mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-[11px] text-champagne-faint px-1">
            <span>Automated 4-Hour Price Monitor</span>
            <span className="text-gold font-mono">6 Platforms</span>
          </div>
        </div>
      )}
    </header>
  );
}
