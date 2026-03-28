import { FrontendEditableField, FrontendSlide } from './types';

const PLACEHOLDER_RE = /\{\{(?:field|list):([a-zA-Z0-9_]+)\}\}/g;
const FORBIDDEN_HTML_RE = /<\s*(script|iframe|img|video|audio|canvas|svg)\b|on[a-z]+\s*=/i;
const FORBIDDEN_CSS_RE = /@import|url\s*\(|(?:^|[,{])\s*(?:body|html|:root|#root)\b|position\s*:\s*fixed/i;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatTextValue = (value: string) => escapeHtml(value).replace(/\n/g, '<br />');

const sanitizeTemplate = (value: string) =>
  value
    .replace(/<\s*\/?\s*(html|head|body)\b[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');

const sanitizeCss = (value: string) =>
  value
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\s*\(([^)]*)\)/gi, 'none');

const ensureSlideRoot = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '<div class="slide-root"></div>';
  if (trimmed.includes('class="slide-root"') || trimmed.includes("class='slide-root'")) {
    return trimmed;
  }
  return `<div class="slide-root">${trimmed}</div>`;
};

const wrapEditableText = (
  field: FrontendEditableField,
  renderedValue: string,
  itemIndex?: number,
) => {
  const itemAttr = typeof itemIndex === 'number' ? ` data-edit-index="${itemIndex}"` : '';
  const itemClass = typeof itemIndex === 'number' ? ' ppt-inline-editable-list' : '';
  return `<span class="ppt-inline-editable${itemClass}" data-edit-key="${field.key}" data-edit-type="${field.type}"${itemAttr}>${renderedValue}</span>`;
};

const renderFieldValue = (field: FrontendEditableField) => {
  if (field.type === 'list') {
    return field.items
      .filter((item) => item.trim())
      .map((item, index) => `<li>${wrapEditableText(field, formatTextValue(item), index)}</li>`)
      .join('');
  }
  return wrapEditableText(field, formatTextValue(field.value || ''));
};

export const buildFrontendSlideMarkup = (slide: FrontendSlide) => {
  let html = ensureSlideRoot(sanitizeTemplate(slide.htmlTemplate || ''));
  slide.editableFields.forEach((field) => {
    const listToken = `{{list:${field.key}}}`;
    const fieldToken = `{{field:${field.key}}}`;
    const renderedValue = renderFieldValue(field);
    if (field.type === 'list') {
      html = html.split(listToken).join(renderedValue);
      html = html.split(fieldToken).join(
        wrapEditableText(
          field,
          formatTextValue(field.items.filter((item) => item.trim()).join(' • ')),
        ),
      );
    } else {
      html = html.split(fieldToken).join(renderedValue);
      html = html.split(listToken).join(`<li>${renderedValue}</li>`);
    }
  });
  html = html.replace(/\{\{(?:field|list):[^}]+\}\}/g, '');
  const css = sanitizeCss(slide.cssCode || '');
  const editableHintCss = `
.slide-root .ppt-inline-editable {
  cursor: text;
  transition: box-shadow 0.18s ease, background-color 0.18s ease;
}
.slide-root .ppt-inline-editable:hover {
  background: rgba(125, 211, 252, 0.08);
  box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.16);
  border-radius: 0.2em;
}
`.trim();
  return `<style>${css}\n${editableHintCss}</style>${html}`;
};

export interface FrontendCodeValidationResult {
  ok: boolean;
  sanitizedHtml: string;
  sanitizedCss: string;
  issues: string[];
  warnings: string[];
}

export const validateFrontendSlideCode = (
  slide: FrontendSlide,
  htmlTemplate: string,
  cssCode: string,
): FrontendCodeValidationResult => {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!htmlTemplate.trim()) {
    issues.push('HTML 模板不能为空。');
  }
  if (!cssCode.trim()) {
    warnings.push('CSS 为空，将只使用默认样式约束。');
  }
  if (htmlTemplate.length > 20000) {
    issues.push('HTML 代码过长，请控制在 20000 字符以内。');
  }
  if (cssCode.length > 24000) {
    issues.push('CSS 代码过长，请控制在 24000 字符以内。');
  }
  if (FORBIDDEN_HTML_RE.test(htmlTemplate)) {
    issues.push('HTML 中包含不允许的标签或内联事件，例如 script/img/svg/iframe。');
  }
  if (FORBIDDEN_CSS_RE.test(cssCode)) {
    issues.push('CSS 中包含不允许的全局选择器、远程资源或 fixed 定位。');
  }

  const sanitizedHtml = ensureSlideRoot(sanitizeTemplate(htmlTemplate));
  const sanitizedCss = sanitizeCss(cssCode);
  const availableKeys = new Set(slide.editableFields.map((field) => field.key));
  const placeholderKeys = Array.from(sanitizedHtml.matchAll(PLACEHOLDER_RE)).map((match) => match[1]);

  if (placeholderKeys.length === 0) {
    issues.push('HTML 中至少需要保留一个 `{{field:...}}` 或 `{{list:...}}` 占位符。');
  }

  const unknownKeys = Array.from(new Set(placeholderKeys.filter((key) => !availableKeys.has(key))));
  if (unknownKeys.length > 0) {
    issues.push(`发现未知占位符字段：${unknownKeys.join('、')}。`);
  }

  const unusedKeys = slide.editableFields
    .map((field) => field.key)
    .filter((key) => !placeholderKeys.includes(key));
  if (unusedKeys.length > 0) {
    warnings.push(`以下字段当前未被模板使用：${unusedKeys.slice(0, 6).join('、')}。`);
  }

  if (!sanitizedHtml.includes('class="slide-root"') && !sanitizedHtml.includes("class='slide-root'")) {
    issues.push('HTML 根节点必须包含 `.slide-root`。');
  }

  return {
    ok: issues.length === 0,
    sanitizedHtml,
    sanitizedCss,
    issues,
    warnings,
  };
};

export const buildFrontendCodeRepairPrompt = (
  slide: FrontendSlide,
  validation: FrontendCodeValidationResult,
) => {
  const issueText = [...validation.issues, ...validation.warnings].join('；') || '请整体检查当前 HTML/CSS 的结构、占位符和版式。';
  return [
    `Keep the same slide topic "${slide.title}" and keep the same deck theme.`,
    'Repair the current HTML/CSS slide implementation while preserving editable text placeholders.',
    'Fix any invalid placeholder mapping, unsafe code, overflow risk, and readability problems.',
    `Specific issues: ${issueText}`,
  ].join(' ');
};

const describeElement = (node: HTMLElement) => {
  const className = (node.className || '').toString().trim().split(/\s+/).filter(Boolean)[0];
  if (className) {
    return `${node.tagName.toLowerCase()}.${className}`;
  }
  return node.tagName.toLowerCase();
};

export const inspectSlideLayout = (
  node: HTMLElement,
  width: number = 1600,
  height: number = 900,
) => {
  const root = (node.querySelector('.slide-root') as HTMLElement | null) || node;
  const issues: string[] = [];

  if (root.scrollWidth > width + 4) {
    issues.push(`画布横向内容溢出，实际宽度约 ${root.scrollWidth}px。`);
  }
  if (root.scrollHeight > height + 4) {
    issues.push(`画布纵向内容溢出，实际高度约 ${root.scrollHeight}px。`);
  }

  const rootRect = root.getBoundingClientRect();
  const overflowElements: string[] = [];
  const textCrowdedElements: string[] = [];

  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) {
      return;
    }

    const style = window.getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize || '0');
    if (fontSize > 72) {
      textCrowdedElements.push(describeElement(element));
    }

    const overflowRight = rect.right - rootRect.right > 2;
    const overflowBottom = rect.bottom - rootRect.bottom > 2;
    const overflowLeft = rootRect.left - rect.left > 2;
    const overflowTop = rootRect.top - rect.top > 2;

    if (overflowRight || overflowBottom || overflowLeft || overflowTop) {
      overflowElements.push(describeElement(element));
      return;
    }

    if (element.scrollHeight - element.clientHeight > 4 || element.scrollWidth - element.clientWidth > 4) {
      overflowElements.push(describeElement(element));
    }
  });

  if (overflowElements.length > 0) {
    issues.push(
      `检测到 ${overflowElements.length} 个元素超出或挤出容器，例如：${overflowElements.slice(0, 3).join('、')}。`,
    );
  }
  if (textCrowdedElements.length > 0) {
    issues.push(
      `检测到字体过大的元素，例如：${textCrowdedElements.slice(0, 3).join('、')}。`,
    );
  }

  return {
    passed: issues.length === 0,
    issues,
  };
};

export const captureSlideToPngBlob = async (
  node: HTMLElement,
  width: number = 1600,
  height: number = 900,
) => {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = '0';

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `.trim();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法将前端页面转换为截图'));
    image.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建截图画布');
  }
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png');
  });
  if (!blob) {
    throw new Error('截图导出失败');
  }
  return blob;
};
