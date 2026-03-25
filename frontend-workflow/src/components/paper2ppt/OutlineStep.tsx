import React from 'react';
import {
  GripVertical, Check, Trash2, Edit3, ChevronUp, ChevronDown, Plus,
  ArrowLeft, ArrowRight, AlertCircle, Sparkles, ImagePlus, X
} from 'lucide-react';
import { SlideOutline, Step } from './types';

interface OutlineStepProps {
  outlineData: SlideOutline[];
  editingId: string | null;
  editContent: {
    title: string;
    layout_description: string;
    key_points: string[];
    asset_ref: string | null;
  };
  setEditContent: React.Dispatch<React.SetStateAction<{
    title: string;
    layout_description: string;
    key_points: string[];
    asset_ref: string | null;
  }>>;
  handleEditStart: (slide: SlideOutline) => void;
  handleEditSave: () => void;
  handleEditCancel: () => void;
  handleKeyPointChange: (index: number, value: string) => void;
  handleAddKeyPoint: () => void;
  handleRemoveKeyPoint: (index: number) => void;
  handleDeleteSlide: (id: string) => void;
  handleAddSlide: (index: number) => void;
  handleMoveSlide: (index: number, direction: 'up' | 'down') => void;
  handleConfirmOutline: () => void;
  handleRefineOutline: () => void;
  handleSlideAssetUpload: (slideId: string, file: File) => Promise<void>;
  handleRemoveSlideAsset: (slideId: string) => void;
  setCurrentStep: (step: Step) => void;
  error: string | null;
  outlineFeedback: string;
  setOutlineFeedback: React.Dispatch<React.SetStateAction<string>>;
  isRefiningOutline: boolean;
  uploadingAssetSlideId: string | null;
}

const OutlineStep: React.FC<OutlineStepProps> = ({
  outlineData,
  editingId,
  editContent,
  setEditContent,
  handleEditStart,
  handleEditSave,
  handleEditCancel,
  handleKeyPointChange,
  handleAddKeyPoint,
  handleRemoveKeyPoint,
  handleDeleteSlide,
  handleAddSlide,
  handleMoveSlide,
  handleConfirmOutline,
  handleRefineOutline,
  handleSlideAssetUpload,
  handleRemoveSlideAsset,
  setCurrentStep,
  error,
  outlineFeedback,
  setOutlineFeedback,
  isRefiningOutline,
  uploadingAssetSlideId,
}) => {
  const disabledClass = "disabled:opacity-50 disabled:cursor-not-allowed";
  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>, slideId: string) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    const file = imageItem?.getAsFile();
    if (!file) return;
    event.preventDefault();
    await handleSlideAssetUpload(slideId, file);
  };

  const isImageAsset = (assetRef: string | null) => Boolean(assetRef && !/^table/i.test(assetRef));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">确认大纲</h2>
        <p className="text-gray-400">检查从论文提取的内容结构，可编辑、排序或删除</p>
      </div>

      <div className="glass rounded-xl border border-white/10 p-6 mb-6">
        <div className="space-y-3">
          {outlineData.map((slide, index) => (
            <div 
              key={slide.id} 
              onPaste={(event) => void handlePaste(event, slide.id)}
              tabIndex={0}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                editingId === slide.id 
                  ? 'bg-purple-500/10 border-purple-500/40' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 pt-1">
                <GripVertical size={16} className="text-gray-500" />
                <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 text-sm font-medium flex items-center justify-center">
                  {slide.pageNum}
                </span>
              </div>
              
              <div className="flex-1">
                {editingId === slide.id ? (
                  <div className="space-y-3">
                    <input type="text" value={editContent.title} onChange={e => setEditContent(p => ({ ...p, title: e.target.value }))} disabled={isRefiningOutline} className={`w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm outline-none focus:ring-2 focus:ring-purple-500 ${disabledClass}`} placeholder="标题" />
                    <textarea value={editContent.layout_description} onChange={e => setEditContent(p => ({ ...p, layout_description: e.target.value }))} rows={2} disabled={isRefiningOutline} className={`w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none ${disabledClass}`} placeholder="布局描述" />
                    {isImageAsset(editContent.asset_ref) && (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                        <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2">
                          <img src={editContent.asset_ref || ''} alt="配图素材" className="max-h-full w-full object-contain" />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400">已附加配图素材</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlideAsset(slide.id)}
                            disabled={isRefiningOutline}
                            className={`inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200 ${disabledClass}`}
                          >
                            <X size={12} /> 移除
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {editContent.key_points.map((p, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="text" value={p} onChange={e => handleKeyPointChange(i, e.target.value)} disabled={isRefiningOutline} className={`flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm ${disabledClass}`} placeholder={`要点 ${i + 1}`} />
                          <button onClick={() => handleRemoveKeyPoint(i)} disabled={isRefiningOutline} className={`p-2 text-gray-400 hover:text-red-400 ${disabledClass}`}><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <button onClick={handleAddKeyPoint} disabled={isRefiningOutline} className={`px-3 py-1.5 rounded-lg bg-white/5 border border-dashed border-white/20 text-gray-400 text-sm w-full hover:text-purple-400 hover:border-purple-400 ${disabledClass}`}>+ 添加要点</button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleEditSave} disabled={isRefiningOutline} className={`px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm flex items-center gap-1 ${disabledClass}`}><Check size={14} /> 保存</button>
                      <button onClick={handleEditCancel} disabled={isRefiningOutline} className={`px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-sm ${disabledClass}`}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-2"><h4 className="text-white font-medium">{slide.title}</h4></div>
                    <p className="text-xs text-purple-400/70 mb-2 italic">📐 {slide.layout_description}</p>
                    {isImageAsset(slide.asset_ref) && (
                      <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
                        <img src={slide.asset_ref || ''} alt="页面配图" className="max-h-full w-full object-contain" />
                      </div>
                    )}
                    <ul className="space-y-1">
                      {slide.key_points.map((p, i) => (
                        <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                          <span className="text-purple-400 mt-0.5">•</span><span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {editingId !== slide.id && (
                <div className="flex flex-col items-end gap-2 self-stretch justify-between py-1">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleMoveSlide(index, 'up')} disabled={isRefiningOutline || index === 0} className={`p-2 text-gray-400 hover:text-white disabled:opacity-30 ${disabledClass}`}><ChevronUp size={16} /></button>
                    <button onClick={() => handleMoveSlide(index, 'down')} disabled={isRefiningOutline || index === outlineData.length - 1} className={`p-2 text-gray-400 hover:text-white disabled:opacity-30 ${disabledClass}`}><ChevronDown size={16} /></button>
                    <button onClick={() => handleEditStart(slide)} disabled={isRefiningOutline} className={`p-2 text-gray-400 hover:text-purple-400 ${disabledClass}`}><Edit3 size={16} /></button>
                    <button onClick={() => handleDeleteSlide(slide.id)} disabled={isRefiningOutline} className={`p-2 text-gray-400 hover:text-red-400 ${disabledClass}`}><Trash2 size={16} /></button>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:border-purple-400 hover:text-purple-300 ${isRefiningOutline ? 'pointer-events-none opacity-50' : ''}`}>
                      <ImagePlus size={14} />
                      {uploadingAssetSlideId === slide.id ? '上传中...' : '上传/粘贴图片'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleSlideAssetUpload(slide.id, file);
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {slide.asset_ref && (
                      <button
                        onClick={() => handleRemoveSlideAsset(slide.id)}
                        disabled={isRefiningOutline}
                        className={`text-xs text-red-300 hover:text-red-200 ${disabledClass}`}
                      >
                        移除素材
                      </button>
                    )}
                    <span className="max-w-[140px] text-right text-[10px] leading-relaxed text-gray-500">
                      点击后可上传，也可聚焦卡片直接 Ctrl/Cmd+V 粘贴图片
                    </span>
                  </div>
                  <button onClick={() => handleAddSlide(index)} disabled={isRefiningOutline} className={`p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors ${disabledClass}`} title="在此后添加新页面">
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={() => setCurrentStep('upload')} disabled={isRefiningOutline} className={`px-6 py-2.5 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10 flex items-center gap-2 ${disabledClass}`}>
          <ArrowLeft size={18} /> 返回上传
        </button>
        <button onClick={handleConfirmOutline} disabled={isRefiningOutline} className={`px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold flex items-center gap-2 transition-all ${disabledClass}`}>
          确认并开始生成 <ArrowRight size={18} />
        </button>
      </div>

      <div className="mt-6 glass rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" /> AI 辅助修改
        </h3>
        <div className="flex gap-3">
          <textarea
            value={outlineFeedback}
            onChange={(e) => setOutlineFeedback(e.target.value)}
            placeholder="输入修改需求，例如：第3页更偏技术细节，突出方法贡献..."
            rows={2}
            disabled={isRefiningOutline}
            className={`flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none ${disabledClass}`}
          />
          <button
            onClick={handleRefineOutline}
            disabled={isRefiningOutline || !outlineFeedback.trim()}
            className={`px-4 py-2 rounded-lg bg-white/10 text-gray-200 text-sm flex items-center gap-2 hover:bg-white/20 ${disabledClass}`}
          >
            {isRefiningOutline ? 'AI 调整中...' : '开始调整'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}
    </div>
  );
};

export default OutlineStep;
