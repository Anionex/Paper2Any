import { Grid, UploadCloud, Presentation, Settings2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionType } from './types';

interface SidebarProps {
  activeSection: SectionType;
  onSectionChange: (section: SectionType) => void;
  filesCount: number;
  outputCount: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = ({ activeSection, onSectionChange, filesCount, outputCount, collapsed = false, onToggleCollapse }: SidebarProps) => {
  const SidebarItem = ({ id, label, icon: Icon, count }: { id: SectionType, label: string, icon: any, count?: number }) => (
    <button
      onClick={() => onSectionChange(id)}
      className={`w-full flex items-center gap-3 ${collapsed ? 'px-3' : 'px-4'} py-3 rounded-xl transition-all mb-2 ${
        activeSection === id
          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
      }`}
    >
      <Icon size={18} />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && (
        <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  );

  return (
    <div
      className="flex-shrink-0 flex flex-col border-r border-white/5 bg-[#050512]/80 backdrop-blur-xl relative z-20 transition-all duration-300"
      style={{ width: collapsed ? '72px' : '260px' }}
    >
      <div className={`p-6 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'} overflow-y-auto`}>
        <SidebarItem id="library" label="我的知识库" icon={Grid} count={filesCount} />
        <SidebarItem id="upload" label="上传文件" icon={UploadCloud} />
        <div className="h-px bg-white/5 my-4 mx-2" />
        <SidebarItem id="output" label="知识产出" icon={Presentation} count={outputCount} />
        <SidebarItem id="settings" label="API 设置" icon={Settings2} />
      </nav>
    </div>
  );
};
