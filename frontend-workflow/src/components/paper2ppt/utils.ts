import { GenerateResult, SlideOutline } from './types';

export const stripImageQuery = (value?: string | null): string => {
  if (!value) return '';
  return value.split('?', 1)[0];
};

export const withCacheBust = (value?: string | null): string => {
  const clean = stripImageQuery(value);
  if (!clean) return '';
  return `${clean}?t=${Date.now()}`;
};

export const buildSlideSignature = (
  slide: Pick<SlideOutline, 'title' | 'layout_description' | 'key_points' | 'asset_ref'>,
): string => JSON.stringify({
  title: slide.title.trim(),
  layout_description: slide.layout_description.trim(),
  key_points: slide.key_points.map((point) => point.trim()),
  asset_ref: (slide.asset_ref || '').trim(),
});

export const buildResultForSlide = (
  slide: SlideOutline,
  signature: string,
  previous?: GenerateResult,
): GenerateResult => {
  const afterImagePath = stripImageQuery(previous?.afterImagePath || previous?.afterImage);
  const afterImage = afterImagePath ? withCacheBust(afterImagePath) : '';

  return {
    slideId: slide.id,
    slideSignature: signature,
    beforeImage: previous?.beforeImage || '',
    afterImage,
    afterImagePath,
    status: previous && afterImagePath ? 'done' : 'processing',
    userPrompt: previous?.userPrompt,
    versionHistory: previous?.versionHistory || [],
    currentVersionIndex: previous?.currentVersionIndex ?? -1,
    wasReused: Boolean(previous && afterImagePath),
  };
};
