'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, PlusCircle, LayoutDashboard, Settings, TrendingDown } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/add', label: 'Track Product', icon: PlusCircle },
    { href: '/settings', label: 'Alert Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <TrendingDown className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-100 tracking-tight leading-none">
                Price<span className="text-emerald-400">Watcher</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Amazon • Flipkart • Meesho
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
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
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}

            <Link
              href="/add"
              className="ml-2 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-3.5 py-1.5 rounded-lg text-sm transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Link</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
