import { useTranslation } from 'react-i18next';
import Paper2GraphPage from './paper2graph';

const Paper2GraphTechExpPage = () => {
  const { t } = useTranslation('paper2graph');

  return (
    <Paper2GraphPage
      allowedGraphTypes={['tech_route', 'exp_data']}
      defaultGraphType="tech_route"
      header={{
        badge: t('subpages.techExp.badge'),
        title: t('subpages.techExp.title'),
        subtitle: t('subpages.techExp.subtitle'),
      }}
      hint={{
        title: t('subpages.techExp.hintTitle'),
        zh: t('subpages.techExp.hintZh'),
        en: t('subpages.techExp.hintEn'),
        tone: 'sky',
      }}
      exampleTypes={['tech_route', 'exp_data']}
    />
  );
};

export default Paper2GraphTechExpPage;
