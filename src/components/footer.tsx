import Link from 'next/link';
import { ShieldCheck, Heart, Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>SSRF-Protected • 100% Free Tier Architecture</span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
            Dashboard
          </Link>
          <Link href="/add" className="hover:text-slate-300 transition-colors">
            Track Product
          </Link>
          <Link href="/settings" className="hover:text-slate-300 transition-colors">
            Alerts
          </Link>
          <Link href="/extension" className="hover:text-slate-300 transition-colors">
            Extension
          </Link>
        </div>

        <div className="flex items-center gap-1 text-slate-600">
          <span>Powered by GitHub Actions & Supabase</span>
        </div>
      </div>
    </footer>
  );
}
