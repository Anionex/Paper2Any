import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

interface MarkdownViewerModalProps {
  open: boolean;
  title?: string;
  markdown: string;
  onClose: () => void;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);

const extractText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children) return extractText(node.props.children);
  return '';
};

export const MarkdownViewerModal = ({ open, title, markdown, onClose }: MarkdownViewerModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const headings = useMemo(() => {
    const lines = (markdown || '').split('\n');
    return lines
      .filter(line => /^#{1,3}\s+/.test(line))
      .map(line => {
        const level = line.match(/^#{1,3}/)?.[0].length || 1;
        const text = line.replace(/^#{1,3}\s+/, '').trim();
        return { level, text, id: slugify(text) };
      })
      .filter(h => h.text);
  }, [markdown]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-md flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-6xl h-[92vh] rounded-2xl border border-white/10 bg-[#0b0b1d] shadow-[0_30px_120px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
          <div className="text-sm text-white/90 font-semibold">{title || 'Markdown 阅读器'}</div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex gap-6 px-6 py-5">
          <div className="flex-1 min-w-0 overflow-y-auto pr-2">
            <div className="max-w-3xl mx-auto text-gray-100 leading-relaxed text-[15px]">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => {
                    const text = extractText(children);
                    const id = slugify(text);
                    return <h1 id={id} className="text-2xl font-semibold text-white mt-6 mb-3">{children}</h1>;
                  },
                  h2: ({ children }) => {
                    const text = extractText(children);
                    const id = slugify(text);
                    return <h2 id={id} className="text-xl font-semibold text-white/90 mt-5 mb-2">{children}</h2>;
                  },
                  h3: ({ children }) => {
                    const text = extractText(children);
                    const id = slugify(text);
                    return <h3 id={id} className="text-lg font-semibold text-white/80 mt-4 mb-2">{children}</h3>;
                  },
                  p: ({ children }) => <p className="text-gray-200/90 mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="ml-5 list-disc space-y-2 text-gray-200/90 mb-3">{children}</ul>,
                  ol: ({ children }) => <ol className="ml-5 list-decimal space-y-2 text-gray-200/90 mb-3">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-emerald-400/50 pl-4 py-2 bg-emerald-500/5 text-emerald-100/80 rounded-r-lg mb-3">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-200 text-[13px]">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="p-4 rounded-xl bg-black/40 border border-white/10 text-gray-200 text-[13px] overflow-x-auto mb-3">
                      {children}
                    </pre>
                  ),
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="text-emerald-300 hover:text-emerald-200 underline">
                      {children}
                    </a>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>

          {headings.length > 0 && (
            <div className="w-56 flex-shrink-0 hidden lg:block">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">目录</div>
              <div className="space-y-2 text-xs text-gray-400">
                {headings.map(h => (
                  <a
                    key={`${h.id}-${h.text}`}
                    href={`#${h.id}`}
                    className="block hover:text-emerald-300 transition-colors"
                    style={{ paddingLeft: `${(h.level - 1) * 8}px` }}
                  >
                    {h.text}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
