import React from 'react';
import { Sparkles } from 'lucide-react';

type Tone = 'amber' | 'emerald' | 'sky';

interface CaseItem {
  title: string;
  description?: string;
  image: string;
}

interface CasesSectionProps {
  title: string;
  subtitle?: string;
  feishuLabel: string;
  feishuUrl: string;
  cases: CaseItem[];
  tone?: Tone;
  columns?: 1 | 2 | 3;
}

const toneStyles: Record<Tone, { border: string; glow: string; text: string; sparkle: string }> = {
  amber: {
    border: 'hover:border-amber-400/60',
    glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    text: 'text-amber-200 group-hover:text-amber-100',
    sparkle: 'text-amber-300',
  },
  emerald: {
    border: 'hover:border-emerald-400/60',
    glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]',
    text: 'text-emerald-200 group-hover:text-emerald-100',
    sparkle: 'text-emerald-300',
  },
  sky: {
    border: 'hover:border-sky-400/60',
    glow: 'hover:shadow-[0_0_20px_rgba(56,189,248,0.35)]',
    text: 'text-sky-200 group-hover:text-sky-100',
    sparkle: 'text-sky-300',
  },
};

const CasesSection: React.FC<CasesSectionProps> = ({
  title,
  subtitle,
  feishuLabel,
  feishuUrl,
  cases,
  tone = 'sky',
  columns = 2,
}) => {
  const toneClass = toneStyles[tone] || toneStyles.sky;
  const gridClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 3
        ? 'grid-cols-1 md:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <a
            href={feishuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`group inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition-all ${toneClass.border} ${toneClass.glow}`}
          >
            <Sparkles size={12} className={`animate-pulse ${toneClass.sparkle}`} />
            <span className={toneClass.text}>{feishuLabel}</span>
          </a>
        </div>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>

      <div className={`grid ${gridClass} gap-4`}>
        {cases.map((item) => (
          <div
            key={`${item.title}-${item.image}`}
            className="rounded-2xl bg-white/5 border border-white/10 p-3 transition-all duration-300 hover:bg-white/10"
          >
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            </div>
            <div className="mt-3">
              <p className="text-sm text-white font-medium">{item.title}</p>
              {item.description && (
                <p className="text-xs text-slate-400 leading-relaxed mt-1">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CasesSection;
