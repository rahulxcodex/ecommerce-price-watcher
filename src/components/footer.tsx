import Link from 'next/link';
import { ShieldCheck, Heart, Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-6 sm:py-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-[11px] sm:text-xs">SSRF-Protected • 100% Free Tier</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-1">
          <Link href="/dashboard" className="hover:text-slate-300 py-1 transition-colors">
            Dashboard
          </Link>
          <Link href="/add" className="hover:text-slate-300 py-1 transition-colors">
            Track Product
          </Link>
          <Link href="/settings" className="hover:text-slate-300 py-1 transition-colors">
            Alerts
          </Link>
          <Link href="/extension" className="hover:text-slate-300 py-1 transition-colors">
            Extension
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs text-slate-600">
          <span>GitHub Actions &amp; Supabase</span>
        </div>
      </div>
    </footer>
  );
}
