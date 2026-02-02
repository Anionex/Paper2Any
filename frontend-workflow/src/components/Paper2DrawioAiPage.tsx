import { useTranslation } from 'react-i18next';
import Header from './paper2graph/Header';
import BilingualHint from './BilingualHint';
import Paper2DrawioPage from './paper2drawio';

const Paper2DrawioAiPage = () => {
  const { t } = useTranslation('paper2drawio');

  return (
    <Paper2DrawioPage
      initialMode="ai"
      lockMode
      showModePanel={false}
      showHeader={false}
      showBanner={false}
      intro={
        <div className="w-full max-w-6xl mx-auto">
          <Header
            badge={t('subpages.ai.badge')}
            title={t('subpages.ai.title')}
            subtitle={t('subpages.ai.subtitle')}
          />
          <div className="mb-8">
            <BilingualHint
              title={t('subpages.ai.hintTitle')}
              zh={t('subpages.ai.hintZh')}
              en={t('subpages.ai.hintEn')}
              tone="violet"
            />
          </div>
        </div>
      }
    />
  );
};

export default Paper2DrawioAiPage;
