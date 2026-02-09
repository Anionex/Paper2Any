import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ToolType, KnowledgeBaseEntry, KnowledgeFile } from './types';
import { ToolSelector } from './ToolSelector';
import { ChatTool } from './tools/ChatTool';
import { SearchTool } from './tools/SearchTool';
import { DeepResearchTool } from './tools/DeepResearchTool';
import { ReportTool } from './tools/ReportTool';
import { PptTool } from './tools/PptTool';
import { MindMapTool } from './tools/MindMapTool';
import { PodcastTool } from './tools/PodcastTool';
import { VideoTool } from './tools/VideoTool';

interface RightPanelProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  files: KnowledgeFile[];
  knowledgeBases?: KnowledgeBaseEntry[];
  selectedIds: Set<string>;
  onGenerateSuccess: (file: KnowledgeFile) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

const RIGHT_PANEL_MIN = 320;
const RIGHT_PANEL_MAX = 560;

export const RightPanel = ({ activeTool, onToolChange, files, knowledgeBases = [], selectedIds, onGenerateSuccess, width, onWidthChange }: RightPanelProps) => {
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(false);
  const toolLabels: Record<ToolType, string> = {
    chat: '智能问答',
    search: '语义检索',
    deepresearch: '深度研究',
    report: '报告生成',
    ppt: 'PPT 生成',
    mindmap: '思维导图',
    podcast: '知识播客',
    video: '视频讲解'
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col border-l border-white/5 bg-[#0a0a1a] relative z-20 shadow-2xl"
      style={{ width: width ? `${width}px` : '400px' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-purple-500/30 transition-colors z-30"
        onMouseDown={(e) => {
          if (!onWidthChange || !width) return;
          e.preventDefault();
          document.body.style.userSelect = 'none';
          const startX = e.clientX;
          const startWidth = width;
          const onMove = (evt: MouseEvent) => {
            const next = Math.min(RIGHT_PANEL_MAX, Math.max(RIGHT_PANEL_MIN, startWidth - (evt.clientX - startX)));
            onWidthChange(next);
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.userSelect = '';
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />
      {/* Tools Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#050512] border-b border-white/5">
        <div className="text-xs text-gray-400">
          当前工具：<span className="text-gray-200">{toolLabels[activeTool]}</span>
        </div>
        <button
          onClick={() => setIsToolsCollapsed(prev => !prev)}
          className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200 transition-colors"
        >
          {isToolsCollapsed ? '展开功能卡片' : '收起功能卡片'}
          {isToolsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Top Grid Selector */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isToolsCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[240px] opacity-100'
        }`}
      >
        <ToolSelector activeTool={activeTool} onToolChange={onToolChange} />
      </div>

      {/* Content Area with Slide Animation */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'chat' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <ChatTool files={files} selectedIds={selectedIds} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'search' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <SearchTool files={files} selectedIds={selectedIds} knowledgeBases={knowledgeBases} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'deepresearch' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <DeepResearchTool files={files} selectedIds={selectedIds} onGenerateSuccess={onGenerateSuccess} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'report' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <ReportTool files={files} selectedIds={selectedIds} onGenerateSuccess={onGenerateSuccess} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'ppt' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <PptTool files={files} selectedIds={selectedIds} onGenerateSuccess={onGenerateSuccess} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'mindmap' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <MindMapTool files={files} selectedIds={selectedIds} onGenerateSuccess={onGenerateSuccess} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'podcast' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <PodcastTool files={files} selectedIds={selectedIds} onGenerateSuccess={onGenerateSuccess} />
        </div>
        <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${activeTool === 'video' ? 'translate-x-0' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <VideoTool />
        </div>
      </div>
    </div>
  );
};
