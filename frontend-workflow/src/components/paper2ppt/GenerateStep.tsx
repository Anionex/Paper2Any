import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Sparkles, Loader2, MessageSquare, RefreshCw,
  ArrowLeft, CheckCircle2, AlertCircle, Plus, Trash2, Pencil, Save, Crop, X
} from 'lucide-react';
import { SlideOutline, GenerateResult, SlideEditRegion, Step } from './types';
import VersionHistory from './VersionHistory';

interface GenerateStepProps {
  outlineData: SlideOutline[];
  currentSlideIndex: number;
  setCurrentSlideIndex: (index: number) => void;
  generateResults: GenerateResult[];
  isGenerating: boolean;
  taskMessage?: string;
  slidePrompt: string;
  setSlidePrompt: (prompt: string) => void;
  saveCurrentSlideEdits: (layoutDescription: string, keyPoints: string[]) => void;
  handleRegenerateSlideFromOutline: () => void;
  slideEditRegion: SlideEditRegion | null;
  setSlideEditRegion: (region: SlideEditRegion | null) => void;
  handleRegenerateSlide: () => void;
  handleConfirmSlide: () => void;
  setCurrentStep: (step: Step) => void;
  error: string | null;
  handleRevertToVersion: (versionNumber: number) => void;
}

const GenerateStep: React.FC<GenerateStepProps> = ({
  outlineData,
  currentSlideIndex,
  setCurrentSlideIndex,
  generateResults,
  isGenerating,
  taskMessage,
  slidePrompt,
  setSlidePrompt,
  saveCurrentSlideEdits,
  handleRegenerateSlideFromOutline,
  slideEditRegion,
  setSlideEditRegion,
  handleRegenerateSlide,
  handleConfirmSlide,
  setCurrentStep,
  error,
  handleRevertToVersion
}) => {
  const currentSlide = outlineData[currentSlideIndex];
  const currentResult = generateResults[currentSlideIndex];
  const [isEditingSlideMeta, setIsEditingSlideMeta] = useState(false);
  const [draftLayoutDescription, setDraftLayoutDescription] = useState('');
  const [draftKeyPoints, setDraftKeyPoints] = useState<string[]>(['']);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [draftRegion, setDraftRegion] = useState<SlideEditRegion | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const syncDraftFromCurrentSlide = () => {
    setDraftLayoutDescription(currentSlide?.layout_description || '');
    setDraftKeyPoints(currentSlide?.key_points?.length ? [...currentSlide.key_points] : ['']);
  };

  useEffect(() => {
    setIsEditingSlideMeta(false);
    setSlideEditRegion(null);
    setDraftRegion(null);
    setDragStart(null);
    syncDraftFromCurrentSlide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideIndex, currentSlide?.id]);

  const handleEditStart = () => {
    syncDraftFromCurrentSlide();
    setIsEditingSlideMeta(true);
  };

  const handleEditCancel = () => {
    syncDraftFromCurrentSlide();
    setIsEditingSlideMeta(false);
  };

  const handleEditSave = () => {
    saveCurrentSlideEdits(
      draftLayoutDescription,
      draftKeyPoints.length > 0 ? draftKeyPoints : ['']
    );
    setIsEditingSlideMeta(false);
  };

  const handleDraftKeyPointChange = (index: number, value: string) => {
    setDraftKeyPoints(prev =>
      prev.map((point, pointIndex) => (pointIndex === index ? value : point))
    );
  };

  const handleAddDraftKeyPoint = () => {
    setDraftKeyPoints(prev => [...prev, '']);
  };

  const handleRemoveDraftKeyPoint = (index: number) => {
    setDraftKeyPoints(prev => {
      const nextKeyPoints = prev.filter((_, pointIndex) => pointIndex !== index);
      return nextKeyPoints.length > 0 ? nextKeyPoints : [''];
    });
  };

  const getRelativePoint = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const beginSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isGenerating || isEditingSlideMeta || !currentResult?.afterImage) return;
    const point = getRelativePoint(event);
    if (!point) return;
    setDragStart(point);
    setDraftRegion({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const updateSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const point = getRelativePoint(event);
    if (!point) return;
    const x = Math.min(dragStart.x, point.x);
    const y = Math.min(dragStart.y, point.y);
    const width = Math.abs(point.x - dragStart.x);
    const height = Math.abs(point.y - dragStart.y);
    setDraftRegion({ x, y, width, height });
  };

  const finishSelection = () => {
    if (draftRegion && draftRegion.width > 0.01 && draftRegion.height > 0.01) {
      setSlideEditRegion(draftRegion);
    }
    setDragStart(null);
    setDraftRegion(null);
  };

  const visibleRegion = draftRegion || slideEditRegion;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">逐页生成</h2>
        <p className="text-gray-400">第 {currentSlideIndex + 1} / {outlineData.length} 页：{currentSlide?.title}</p>
      </div>

      <div className="mb-6">
        <div className="flex gap-1">
          {generateResults.map((result, index) => (
            <div key={result.slideId} className={`flex-1 h-2 rounded-full transition-all ${
              result.status === 'done' ? 'bg-purple-400' : result.status === 'processing' ? 'bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse' : index === currentSlideIndex ? 'bg-purple-400/50' : 'bg-white/10'
            }`} />
          ))}
        </div>
      </div>

      {currentSlide && (
        <div className="glass rounded-xl border border-white/10 p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-medium text-white">页面内容</h3>
            <div className="flex items-center gap-2">
              {isEditingSlideMeta && (
                <button
                  onClick={handleEditCancel}
                  disabled={isGenerating}
                  className="p-2 rounded-lg border border-white/15 text-gray-300 hover:text-red-300 hover:border-red-400 hover:bg-white/5 disabled:opacity-50"
                  title="舍弃当前修改"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={isEditingSlideMeta ? handleEditSave : handleEditStart}
                disabled={isGenerating}
                className="p-2 rounded-lg border border-white/15 text-gray-300 hover:text-purple-300 hover:border-purple-400 hover:bg-white/5 disabled:opacity-50"
                title={isEditingSlideMeta ? '保存当前修改' : '编辑当前页内容'}
              >
                {isEditingSlideMeta ? <Save size={14} /> : <Pencil size={14} />}
              </button>
            </div>
          </div>
          <div className="mb-3">
            <h4 className="text-sm text-gray-400 mb-2 flex items-center gap-2"><FileText size={14} className="text-purple-400" /> 布局描述</h4>
            {isEditingSlideMeta ? (
              <textarea
                value={draftLayoutDescription}
                onChange={(e) => setDraftLayoutDescription(e.target.value)}
                disabled={isGenerating}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm text-purple-100 outline-none focus:ring-2 focus:ring-purple-500 resize-none disabled:opacity-60"
                placeholder="直接调整当前页的布局描述..."
              />
            ) : (
              <p className="text-xs text-purple-400/80 italic">{currentSlide.layout_description}</p>
            )}
          </div>
          <div className="pt-3 border-t border-white/10">
            {isEditingSlideMeta ? (
              <>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h4 className="text-sm text-gray-400">要点内容</h4>
                  <button
                    onClick={handleAddDraftKeyPoint}
                    disabled={isGenerating}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-dashed border-white/20 text-xs text-gray-300 hover:text-purple-300 hover:border-purple-400 disabled:opacity-60 flex items-center gap-1"
                  >
                    <Plus size={12} /> 添加要点
                  </button>
                </div>
                <div className="space-y-2">
                  {draftKeyPoints.map((point, idx) => (
                    <div key={`${currentSlide.id}-kp-${idx}`} className="flex gap-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => handleDraftKeyPointChange(idx, e.target.value)}
                        disabled={isGenerating}
                        className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                        placeholder={`要点 ${idx + 1}`}
                      />
                      <button
                        onClick={() => handleRemoveDraftKeyPoint(idx)}
                        disabled={isGenerating || draftKeyPoints.length <= 1}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                        title="删除该要点"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h4 className="text-sm text-gray-400 mb-2">要点内容</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {currentSlide.key_points.slice(0, 4).map((point, idx) => (
                    <li key={idx} className="text-xs text-gray-400 flex items-start gap-1"><span className="text-purple-400">•</span><span className="line-clamp-1">{point}</span></li>
                  ))}
                  {currentSlide.key_points.length > 4 && (<li className="text-xs text-gray-500 italic">...还有 {currentSlide.key_points.length - 4} 条</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-xl border border-white/10 p-6 mb-6">
        <div className="max-w-3xl mx-auto">
          <h4 className="text-sm text-gray-400 mb-3 flex items-center justify-center gap-2"><Sparkles size={14} className="text-purple-400" /> AI 生成结果</h4>
          <div className="rounded-lg overflow-hidden border border-purple-500/30 aspect-[16/9] bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center">
            {isGenerating ? (
              <div className="text-center">
                <Loader2 size={40} className="text-purple-400 animate-spin mx-auto mb-3" />
                <p className="text-base text-purple-300">{generateResults.every(r => r.status === 'processing') ? '正在批量生成所有页面...' : '正在重新生成当前页...'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {taskMessage || (generateResults.every(r => r.status === 'processing') ? `共 ${outlineData.length} 页，请稍候` : 'AI 正在根据您的提示重新创建')}
                </p>
              </div>
            ) : currentResult?.afterImage ? (
              <div className="relative h-full w-full flex items-center justify-center">
                <img ref={imageRef} src={currentResult.afterImage} alt="Generated" className="max-h-full max-w-full object-contain" />
                <div
                  className="absolute inset-0 cursor-crosshair"
                  onMouseDown={beginSelection}
                  onMouseMove={updateSelection}
                  onMouseUp={finishSelection}
                  onMouseLeave={finishSelection}
                />
                {visibleRegion && imageRef.current && (
                  <div
                    className="pointer-events-none absolute border-2 border-cyan-300 bg-cyan-400/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.15)]"
                    style={{
                      left: `${visibleRegion.x * 100}%`,
                      top: `${visibleRegion.y * 100}%`,
                      width: `${visibleRegion.width * 100}%`,
                      height: `${visibleRegion.height * 100}%`,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="text-center"><FileText size={32} className="text-gray-500 mx-auto mb-2" /><span className="text-gray-500">等待生成</span></div>
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleRegenerateSlideFromOutline}
              disabled={isGenerating || isEditingSlideMeta}
              className="px-5 py-2.5 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} /> 按当前内容重新生成
            </button>
          </div>
        </div>
      </div>

      {currentResult?.versionHistory && currentResult.versionHistory.length > 0 && (
        <VersionHistory
          versions={currentResult.versionHistory}
          currentVersionIndex={currentResult.currentVersionIndex}
          onRevert={handleRevertToVersion}
          isGenerating={isGenerating || isEditingSlideMeta}
        />
      )}

      <div className="glass rounded-xl border border-white/10 p-4 mb-6">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <Crop size={14} className="text-cyan-300" />
            <span>可直接在页面预览上拖拽框选区域，微调时将优先修改该区域。</span>
          </div>
          {slideEditRegion && (
            <button
              type="button"
              onClick={() => setSlideEditRegion(null)}
              className="inline-flex items-center gap-1 text-red-300 hover:text-red-200"
            >
              <X size={12} /> 清除选区
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <MessageSquare size={18} className="text-purple-400" />
          <input
            type="text"
            value={slidePrompt}
            onChange={e => setSlidePrompt(e.target.value)}
            placeholder={slideEditRegion ? '输入微调 Prompt，将优先编辑已框选区域...' : '输入微调 Prompt，然后点击按提示微调...'}
            disabled={isEditingSlideMeta}
            className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-gray-500 disabled:opacity-50"
          />
          <button onClick={handleRegenerateSlide} disabled={isGenerating || isEditingSlideMeta || !slidePrompt.trim()} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} /> 按提示微调
          </button>
        </div>
        {isEditingSlideMeta && (
          <p className="mt-3 text-xs text-amber-300">当前正在编辑页面内容，请先选择保存或舍弃更改，再重新生成或切换页面。</p>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => setCurrentStep('outline')} disabled={isGenerating || isEditingSlideMeta} className="px-6 py-2.5 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10 flex items-center gap-2 disabled:opacity-30">
          <ArrowLeft size={18} /> 返回大纲
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (currentSlideIndex > 0) {
                setCurrentSlideIndex(currentSlideIndex - 1);
                setSlidePrompt('');
                setSlideEditRegion(null);
              }
            }}
            disabled={currentSlideIndex === 0 || isGenerating || isEditingSlideMeta}
            className="px-6 py-2.5 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10 flex items-center gap-2 disabled:opacity-30"
          >
            <ArrowLeft size={18} /> 上一页
          </button>
          <button onClick={handleConfirmSlide} disabled={isGenerating || isEditingSlideMeta || currentResult?.status !== 'done'} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold flex items-center gap-2 disabled:opacity-50">
            <CheckCircle2 size={18} /> {currentSlideIndex < outlineData.length - 1 ? '确认并继续' : '完成生成'}
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

export default GenerateStep;
