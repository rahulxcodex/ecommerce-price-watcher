import { Platform } from '@/types';

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className = '' }: PlatformBadgeProps) {
  const configs = {
    amazon: {
      label: 'Amazon',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dot: 'bg-amber-400',
    },
    flipkart: {
      label: 'Flipkart',
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      dot: 'bg-blue-400',
    },
    meesho: {
      label: 'Meesho',
      bg: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
      dot: 'bg-pink-400',
    },
    myntra: {
      label: 'Myntra',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      dot: 'bg-rose-400',
    },
    ajio: {
      label: 'Ajio',
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      dot: 'bg-indigo-400',
    },
    westside: {
      label: 'Westside',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
  };

  const config = configs[platform] || {
    label: platform,
    bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
