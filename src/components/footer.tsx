import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-surface-border bg-obsidian py-6 text-xs text-champagne-faint">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <span className="text-[11px] font-mono tracking-tight">SSRF Hardened • 4-Hour Cron • Multi-Store Architecture</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-1 text-[11px]">
          <Link href="/dashboard" className="hover:text-champagne transition-colors">
            Watchlist
          </Link>
          <Link href="/discover" className="hover:text-champagne transition-colors">
            Discover
          </Link>
          <Link href="/add" className="hover:text-champagne transition-colors">
            Track URL
          </Link>
          <Link href="/settings" className="hover:text-champagne transition-colors">
            Alerts
          </Link>
          <Link href="/extension" className="hover:text-champagne transition-colors">
            Extension
          </Link>
          <Link href="/about" className="hover:text-champagne transition-colors text-gold">
            About Us
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-champagne-faint">
          <span>Obsidian &amp; Champagne • v2.0</span>
        </div>
      </div>
    </footer>
  );
}
