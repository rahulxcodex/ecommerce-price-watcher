import { Platform } from '@/types';

const PLATFORM_CONFIGS: Record<string, { label: string; bg: string; dot: string }> = {
  amazon: {
    label: 'Amazon',
    bg: 'bg-amber-950/25 text-amber-300/90 border-amber-800/35',
    dot: 'bg-amber-400',
  },
  flipkart: {
    label: 'Flipkart',
    bg: 'bg-sky-950/25 text-sky-300/90 border-sky-800/35',
    dot: 'bg-sky-400',
  },
  meesho: {
    label: 'Meesho',
    bg: 'bg-pink-950/25 text-pink-300/90 border-pink-800/35',
    dot: 'bg-pink-400',
  },
  myntra: {
    label: 'Myntra',
    bg: 'bg-rose-950/25 text-rose-300/90 border-rose-800/35',
    dot: 'bg-rose-400',
  },
  ajio: {
    label: 'Ajio',
    bg: 'bg-indigo-950/25 text-indigo-300/90 border-indigo-800/35',
    dot: 'bg-indigo-400',
  },
  westside: {
    label: 'Westside',
    bg: 'bg-surface-subtle text-champagne border-white/10',
    dot: 'bg-gold',
  },
};

const DEFAULT_CONFIG = {
  label: 'Unknown',
  bg: 'bg-surface-subtle text-champagne-muted border-surface-border',
  dot: 'bg-champagne-faint',
};

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className = '' }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIGS[platform] || { ...DEFAULT_CONFIG, label: platform };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wider uppercase border ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
