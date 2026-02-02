import React from 'react';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  align?: 'center' | 'left';
}

const Header: React.FC<HeaderProps> = ({ badge, title, subtitle, align = 'center' }) => {
  const { t } = useTranslation('paper2graph');

  const resolvedBadge = badge ?? t('hero.badge');
  const resolvedTitle = title ?? t('hero.title');
  const resolvedSubtitle = subtitle ?? t('hero.subtitle');
  const alignClass = align === 'left' ? 'text-left' : 'text-center';

  return (
    <div className={`mb-8 ${alignClass}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-primary-300 mb-2">
        {resolvedBadge}
      </p>
      <h1 className="text-3xl font-semibold text-white mb-2">
        {resolvedTitle}
      </h1>
      <p className="text-sm text-gray-400 max-w-2xl mx-auto">
        {resolvedSubtitle}
      </p>
    </div>
  );
};

export default Header;
