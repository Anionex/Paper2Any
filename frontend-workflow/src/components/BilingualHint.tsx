import React from 'react';
import { Info } from 'lucide-react';

type HintTone = 'sky' | 'violet' | 'emerald';

interface BilingualHintProps {
  title: string;
  zh: string;
  en: string;
  tone?: HintTone;
  className?: string;
}

const toneStyles: Record<HintTone, { ring: string; glow: string; badge: string; icon: string }> = {
  sky: {
    ring: 'ring-sky-400/30',
    glow: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    badge: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
    icon: 'text-sky-300',
  },
  violet: {
    ring: 'ring-violet-400/30',
    glow: 'from-violet-500/20 via-fuchsia-500/10 to-transparent',
    badge: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
    icon: 'text-violet-300',
  },
  emerald: {
    ring: 'ring-emerald-400/30',
    glow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    icon: 'text-emerald-300',
  },
};

const BilingualHint: React.FC<BilingualHintProps> = ({ title, zh, en, tone = 'sky', className }) => {
  const styles = toneStyles[tone];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 ring-1 ${styles.ring} ${className || ''}`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.glow}`} />
      <div className="relative flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border ${styles.badge}`}>
          <Info size={16} className={styles.icon} />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-200">{zh}</p>
          <p className="text-[11px] text-slate-400">{en}</p>
        </div>
      </div>
    </div>
  );
};

export default BilingualHint;
