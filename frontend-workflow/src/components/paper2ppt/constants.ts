export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const STORAGE_KEY = 'paper2ppt-storage';

const STYLE_PRESET_CONFIG = {
  modern: {
    prompt: '现代简约风格，使用干净的线条和充足的留白',
    preview: '/paper2ppt/modern-preview.webp',
  },
  business: {
    prompt: '商务专业风格，稳重大气，适合企业演示',
    preview: '/paper2ppt/business-preview.webp',
  },
  academic: {
    prompt: '学术报告风格，清晰的层次结构，适合论文汇报',
    preview: '/paper2ppt/academic-preview.webp',
  },
  creative: {
    prompt: '创意设计风格，活泼生动，色彩丰富',
    preview: '/paper2ppt/creative-preview.webp',
  },
} as const;

export const STYLE_PRESETS: Record<string, string> = Object.fromEntries(
  Object.entries(STYLE_PRESET_CONFIG).map(([preset, config]) => [preset, config.prompt]),
);

export const STYLE_PRESET_META = Object.fromEntries(
  Object.entries(STYLE_PRESET_CONFIG).map(([preset, config]) => [preset, { preview: config.preview }]),
) as Record<keyof typeof STYLE_PRESET_CONFIG, { preview: string }>;
