import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface ManagedApiNoticeProps {
  className?: string;
  title?: string;
  description?: string;
}

const ManagedApiNotice: React.FC<ManagedApiNoticeProps> = ({
  className = '',
  title = '后端托管模型已开启',
  description = '当前为 Free 模式，功能调用将通过消耗点数来使用平台托管模型，无需手动填写 API URL 或 API Key。',
}) => (
  <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 ${className}`.trim()}>
    <div className="flex items-start gap-3">
      <ShieldCheck size={18} className="mt-0.5 text-emerald-300 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-emerald-200">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">{description}</p>
      </div>
    </div>
  </div>
);

export default ManagedApiNotice;
