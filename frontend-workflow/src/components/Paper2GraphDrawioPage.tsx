import { useTranslation } from 'react-i18next';
import Paper2GraphPage from './paper2graph';

const Paper2GraphDrawioPage = () => {
  const { t } = useTranslation('paper2graph');

  return (
    <Paper2GraphPage
      allowedGraphTypes={['model_arch']}
      defaultGraphType="model_arch"
      enableDrawio
      drawioLabel={t('subpages.modelDrawio.drawioButton')}
      showDrawioEmpty
      header={{
        badge: t('subpages.modelDrawio.badge'),
        title: t('subpages.modelDrawio.title'),
        subtitle: t('subpages.modelDrawio.subtitle'),
      }}
      hint={{
        title: t('subpages.modelDrawio.hintTitle'),
        zh: t('subpages.modelDrawio.hintZh'),
        en: t('subpages.modelDrawio.hintEn'),
        tone: 'emerald',
      }}
      showExamples={false}
    />
  );
};

export default Paper2GraphDrawioPage;
