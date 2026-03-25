import React, { useState, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadAndSaveFile } from '../../services/fileService';
import { API_KEY, DEFAULT_LLM_API_URL } from '../../config/api';
import { DEFAULT_PAPER2PPT_GEN_FIG_MODEL, DEFAULT_PAPER2PPT_MODEL } from '../../config/models';
import { checkQuota, recordUsage } from '../../services/quotaService';
import { verifyLlmConnection } from '../../services/llmService';
import { useAuthStore } from '../../stores/authStore';
import { getApiSettings, saveApiSettings } from '../../services/apiSettingsService';

import {
  Step,
  SlideOutline,
  GenerateResult,
  UploadMode,
  StyleMode,
  StylePreset,
  Paper2PPTTaskResponse,
} from './types';
import { MAX_FILE_SIZE, STORAGE_KEY } from './constants';
import { buildResultForSlide, buildSlideSignature, stripImageQuery, withCacheBust } from './utils';

import Banner from './Banner';
import StepIndicator from './StepIndicator';
import UploadStep from './UploadStep';
import OutlineStep from './OutlineStep';
import GenerateStep from './GenerateStep';
import CompleteStep from './CompleteStep';

const Paper2PptPage = () => {
  const { user, refreshQuota } = useAuthStore();
  
  // Step 状态
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  
  // Step 1: 上传相关状态
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [styleMode, setStyleMode] = useState<StyleMode>('prompt');
  const [stylePreset, setStylePreset] = useState<StylePreset>('modern');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [pageCount, setPageCount] = useState(6);
  const [useLongPaper, setUseLongPaper] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  
  // Step 2: Outline 相关状态
  const [outlineData, setOutlineData] = useState<SlideOutline[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<{
    title: string;
    layout_description: string;
    key_points: string[];
  }>({ title: '', layout_description: '', key_points: [] });
  const [outlineFeedback, setOutlineFeedback] = useState('');
  const [isRefiningOutline, setIsRefiningOutline] = useState(false);
  
  // Step 3: 生成相关状态
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [generateResults, setGenerateResults] = useState<GenerateResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slidePrompt, setSlidePrompt] = useState('');
  const [generateTaskMessage, setGenerateTaskMessage] = useState('');
  
  // Step 4: 完成状态
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [finalTaskMessage, setFinalTaskMessage] = useState('');

  // 通用状态
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  // API 配置状态 - 从环境变量读取默认值
  const [llmApiUrl, setLlmApiUrl] = useState(DEFAULT_LLM_API_URL);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_PAPER2PPT_MODEL);
  const [genFigModel, setGenFigModel] = useState(DEFAULT_PAPER2PPT_GEN_FIG_MODEL);
  const [language, setLanguage] = useState<'zh' | 'en'>('en');
  const [resultPath, setResultPath] = useState<string | null>(null);

  // GitHub Stars
  const [stars, setStars] = useState<{dataflow: number | null, agent: number | null, dataflex: number | null}>({
    dataflow: null,
    agent: null,
    dataflex: null,
  });
  const [copySuccess, setCopySuccess] = useState('');

  const shareText = `发现一个超好用的AI工具 DataFlow-Agent！🚀
支持论文转PPT、PDF转PPT、PPT美化等功能，科研打工人的福音！

🔗 在线体验：https://dcai-paper2any.nas.cpolar.cn/
⭐ GitHub Agent：https://github.com/OpenDCAI/Paper2Any
🌟 GitHub Core：https://github.com/OpenDCAI/DataFlow

转发本文案+截图，联系微信群管理员即可获取免费Key！🎁
#AI工具 #PPT制作 #科研效率 #开源项目`;

  const handleCopyShareText = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareText;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback: Oops, unable to copy', err);
          throw err;
        } finally {
          document.body.removeChild(textArea);
        }
      }
      setCopySuccess('文案已复制！快去分享吧');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('复制失败', err);
      setCopySuccess('复制失败，请手动复制');
    }
  };

  useEffect(() => {
    const fetchStars = async () => {
      try {
        const [res1, res2, res3] = await Promise.all([
          fetch('https://api.github.com/repos/OpenDCAI/DataFlow'),
          fetch('https://api.github.com/repos/OpenDCAI/Paper2Any'),
          fetch('https://api.github.com/repos/OpenDCAI/DataFlex')
        ]);
        const data1 = await res1.json();
        const data2 = await res2.json();
        const data3 = await res3.json();
        setStars({
          dataflow: data1.stargazers_count,
          agent: data2.stargazers_count,
          dataflex: data3.stargazers_count,
        });
      } catch (e) {
        console.error('Failed to fetch stars', e);
      }
    };
    fetchStars();
  }, []);

  // 从 localStorage 恢复配置
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        
        if (saved.uploadMode) setUploadMode(saved.uploadMode);
        if (saved.textContent) setTextContent(saved.textContent);
        if (saved.styleMode) setStyleMode(saved.styleMode);
        if (saved.stylePreset) setStylePreset(saved.stylePreset);
        if (saved.globalPrompt) setGlobalPrompt(saved.globalPrompt);
        if (saved.pageCount) setPageCount(saved.pageCount);
        if (saved.useLongPaper !== undefined) setUseLongPaper(saved.useLongPaper);
        if (saved.model) setModel(saved.model);
        if (saved.genFigModel) setGenFigModel(saved.genFigModel);
        if (saved.language) setLanguage(saved.language);

        // API settings: prioritize user-specific settings from apiSettingsService
        const userApiSettings = getApiSettings(user?.id || null);
        if (userApiSettings) {
          if (userApiSettings.apiUrl) setLlmApiUrl(userApiSettings.apiUrl);
          if (userApiSettings.apiKey) setApiKey(userApiSettings.apiKey);
        } else {
          if (saved.llmApiUrl) setLlmApiUrl(saved.llmApiUrl);
          if (saved.apiKey) setApiKey(saved.apiKey);
        }
      }
    } catch (e) {
      console.error('Failed to restore paper2ppt config', e);
    }
  }, [user?.id]);

  // 将配置写入 localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const data = {
      uploadMode,
      textContent,
      styleMode,
      stylePreset,
      globalPrompt,
      pageCount,
      useLongPaper,
      llmApiUrl,
      apiKey,
      model,
      genFigModel,
      language
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (user?.id && llmApiUrl && apiKey) {
        saveApiSettings(user.id, { apiUrl: llmApiUrl, apiKey });
      }
    } catch (e) {
      console.error('Failed to persist paper2ppt config', e);
    }
  }, [
    uploadMode, textContent, styleMode, stylePreset, globalPrompt,
    pageCount, useLongPaper, llmApiUrl, apiKey,
    model, genFigModel, language, user?.id
  ]);

  // 自动加载版本历史
  useEffect(() => {
    if (currentStep === 'generate' && currentSlideIndex >= 0 && generateResults[currentSlideIndex]) {
      const currentResult = generateResults[currentSlideIndex];
      // 如果版本历史为空且页面已生成，则自动加载版本历史
      if (currentResult.versionHistory.length === 0 && (currentResult.afterImagePath || currentResult.afterImage)) {
        console.log(`[Paper2PptPage] 自动加载页面 ${currentSlideIndex} 的版本历史`);
        fetchVersionHistory(currentSlideIndex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, currentSlideIndex]); // 移除 generateResults 依赖，避免无限循环

  const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

  const parseErrorMessage = async (res: Response, fallback: string) => {
    if (res.status === 429) {
      return '请求过于频繁，请稍后再试';
    }
    try {
      const errBody = await res.json();
      return errBody?.error || errBody?.detail || errBody?.message || fallback;
    } catch {
      return fallback;
    }
  };

  const submitPaper2PptTask = async (formData: FormData): Promise<Paper2PPTTaskResponse> => {
    const res = await fetch('/api/v1/paper2ppt/generate-task', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, '服务器繁忙，请稍后再试'));
    }

    const data = await res.json() as Paper2PPTTaskResponse;
    if (!data.success || !data.task_id) {
      throw new Error(data.error || data.message || '任务提交失败');
    }
    return data;
  };

  const pollPaper2PptTask = async (
    taskId: string,
    onUpdate?: (task: Paper2PPTTaskResponse) => void,
  ) => {
    let transientFailures = 0;

    for (let attempt = 0; attempt < 720; attempt += 1) {
      try {
        const res = await fetch(`/api/v1/paper2ppt/tasks/${taskId}`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) {
          throw new Error(await parseErrorMessage(res, '任务状态查询失败'));
        }

        const data = await res.json() as Paper2PPTTaskResponse;
        onUpdate?.(data);
        transientFailures = 0;

        if (data.status === 'done') {
          if (!data.result) {
            throw new Error('任务已完成，但缺少结果文件');
          }
          return data.result;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || data.message || '任务执行失败');
        }
      } catch (err) {
        transientFailures += 1;
        if (transientFailures >= 5) {
          throw err instanceof Error ? err : new Error('任务轮询失败');
        }
      }

      await sleep(attempt < 20 ? 1500 : 2500);
    }

    throw new Error('任务执行超时，请稍后到历史输出目录检查结果');
  };

  const preloadGeneratedImages = (outputFiles?: string[]) => {
    if (!outputFiles || !Array.isArray(outputFiles)) return;
    console.log('预加载所有生成的图片...');
    outputFiles.forEach((url: string) => {
      if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg')) {
        const img = new Image();
        img.src = url;
      }
    });
  };

  const findPageImage = (outputFiles: string[] | undefined, pageIndex: number) => {
    if (!outputFiles || !Array.isArray(outputFiles)) return '';
    const pageNumStr = String(pageIndex).padStart(3, '0');
    return outputFiles.find((url: string) => url.includes(`ppt_pages/page_${pageNumStr}.png`)) || '';
  };

  const applyBatchGenerateResult = (
    data: NonNullable<Paper2PPTTaskResponse['result']>,
    baseResults: GenerateResult[],
  ) => {
    if (data.result_path) {
      setResultPath(data.result_path);
    }

    const updatedResults = baseResults.map((result, index) => {
      const page = data.pagecontent?.[index] as Record<string, unknown> | undefined;
      const pageImg = typeof page?.generated_img_path === 'string'
        ? page.generated_img_path
        : findPageImage(data.all_output_files, index);
      return {
        ...result,
        afterImagePath: stripImageQuery(pageImg || result.afterImagePath || result.afterImage),
        afterImage: pageImg ? withCacheBust(pageImg) : '',
        status: pageImg ? 'done' as const : 'pending' as const,
        versionHistory: [],
        currentVersionIndex: -1,
      };
    });

    preloadGeneratedImages(data.all_output_files);
    setGenerateResults(updatedResults);
  };

  const applyEditTaskResult = (pageIndex: number, data: NonNullable<Paper2PPTTaskResponse['result']>) => {
    const page = data.pagecontent?.[pageIndex] as Record<string, unknown> | undefined;
    const pageImg = typeof page?.generated_img_path === 'string'
      ? page.generated_img_path
      : findPageImage(data.all_output_files, pageIndex);
    if (!pageImg) return;

    setGenerateResults(prev => prev.map((result, index) => (
      index === pageIndex
        ? {
            ...result,
            afterImagePath: stripImageQuery(pageImg),
            afterImage: withCacheBust(pageImg),
            status: 'done' as const,
          }
        : result
    )));
  };
  // ============== Step 1: 上传处理 ==============
  const validateDocFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      setError('仅支持 PDF 格式');
      return false;
    }
    return true;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateDocFile(file)) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('文件大小超过 50MB 限制');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !validateDocFile(file)) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('文件大小超过 50MB 限制');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleReferenceImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      setError('参考图片仅支持 JPG/PNG/WEBP/GIF 格式');
      return;
    }
    setReferenceImage(file);
    setReferenceImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveReferenceImage = () => {
    if (referenceImagePreview) {
      URL.revokeObjectURL(referenceImagePreview);
    }
    setReferenceImage(null);
    setReferenceImagePreview(null);
  };

  const getStyleDescription = (preset: string): string => {
    const styles: Record<string, string> = {
      modern: '现代简约风格，使用干净的线条和充足的留白',
      business: '商务专业风格，稳重大气，适合企业演示',
      academic: '学术报告风格，清晰的层次结构，适合论文汇报',
      creative: '创意设计风格，活泼生动，色彩丰富',
    };
    return styles[preset] || styles.modern;
  };

  const handleUploadAndParse = async () => {
    if (uploadMode === 'file' && !selectedFile) {
      setError('请先选择 PDF 文件');
      return;
    }
    if ((uploadMode === 'text' || uploadMode === 'topic') && !textContent.trim()) {
      setError(uploadMode === 'text' ? '请输入长文本内容' : '请输入 Topic 主题');
      return;
    }
    
    if (!apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }

    // Check quota before proceeding
    const quota = await checkQuota(user?.id || null, user?.is_anonymous || false);
    if (quota.remaining <= 0) {
      setError(quota.isAuthenticated
        ? '今日配额已用完（10次/天），请明天再试'
        : '今日配额已用完（5次/天），登录后可获得更多配额');
      return;
    }

    try {
        // Step 0: Verify LLM Connection first
        setIsValidating(true);
        setError(null);
        await verifyLlmConnection(llmApiUrl, apiKey, import.meta.env.VITE_DEFAULT_LLM_MODEL || 'deepseek-v3.2');
        setIsValidating(false);
    } catch (err) {
        setIsValidating(false);
        const message = err instanceof Error ? err.message : 'API 验证失败';
        setError(message);
        return; // Stop execution if validation fails
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);
    setProgressStatus('正在初始化...');
    
    // 模拟进度
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90;
        const messages = [
           '正在内容准备...',
           '正在解析内容...',
           '正在分析结构...',
           '正在提取关键点...',
           '正在生成大纲...'
        ];
        const msgIndex = Math.floor(prev / 20);
        if (msgIndex < messages.length) {
          setProgressStatus(messages[msgIndex]);
        }
        // 调整进度速度，使其在 3 分钟左右达到 90%
        return prev + (Math.random() * 0.6 + 0.2);
      });
    }, 1000);

    try {
      const formData = new FormData();
      if (uploadMode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
        formData.append('input_type', 'pdf');
      } else {
        formData.append('text', textContent.trim());
        formData.append('input_type', uploadMode); // 'text' or 'topic'
      }
      
      formData.append('email', user?.id || user?.email || '');
      formData.append('chat_api_url', llmApiUrl.trim());
      formData.append('api_key', apiKey.trim());
      formData.append('model', model);
      formData.append('language', language);
      formData.append('style', globalPrompt || getStyleDescription(stylePreset));
      formData.append('gen_fig_model', genFigModel);
      formData.append('page_count', String(pageCount));
      formData.append('use_long_paper', String(useLongPaper));

      if (styleMode === 'reference' && referenceImage) {
        formData.append('reference_img', referenceImage);
        // 参考图模式下：保留用户显式输入的风格提示词（globalPrompt），但去掉默认 preset 描述
        formData.set('style', globalPrompt || '');
      }

      console.log(`Sending request to /api/v1/paper2ppt/page-content with input_type=${uploadMode}`);
      
      const res = await fetch('/api/v1/paper2ppt/page-content', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });
      
      if (!res.ok) {
        let msg = '服务器繁忙，请稍后再试';
        if (res.status === 403) {
          msg = '邀请码不正确或已失效';
        } else if (res.status === 429) {
          msg = '请求过于频繁，请稍后再试';
        } else {
          try {
            const errBody = await res.json();
            if (errBody?.error) msg = errBody.error;
          } catch { /* ignore parse error */ }
        }
        throw new Error(msg);
      }

      const data = await res.json();
      console.log('API Response:', JSON.stringify(data, null, 2));

      if (!data.success) {
        throw new Error(data.error || '服务器繁忙，请稍后再试');
      }
      
      const currentResultPath = data.result_path || '';
      if (currentResultPath) {
        setResultPath(currentResultPath);
      } else {
        throw new Error('后端未返回 result_path');
      }
      
      if (!data.pagecontent || data.pagecontent.length === 0) {
        throw new Error('解析结果为空，请检查输入内容是否正确');
      }
      
      const convertedSlides: SlideOutline[] = data.pagecontent.map((item: any, index: number) => ({
        ...normalizeSlideOutline(item, index),
        id: `${Date.now()}-${index}`,
      }));
      
      clearInterval(progressInterval);
      setProgress(100);
      setProgressStatus('解析完成！');
      
      // 稍微延迟一下跳转，让用户看到 100%
      setTimeout(() => {
        setOutlineData(convertedSlides);
        setCurrentStep('outline');
      }, 500);
      
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      const message = err instanceof Error ? err.message : '服务器繁忙，请稍后再试';
      setError(message);
      console.error(err);
    } finally {
      if (currentStep !== 'outline') {
         setIsUploading(false);
      } else {
         setIsUploading(false);
      }
    }
  };

  // ============== Step 2: Outline 编辑处理 ==============
  const handleEditStart = (slide: SlideOutline) => {
    setEditingId(slide.id);
    setEditContent({ 
      title: slide.title, 
      layout_description: slide.layout_description,
      key_points: [...slide.key_points]
    });
  };

  const handleEditSave = () => {
    if (!editingId) return;
    setOutlineData(prev => prev.map(s => 
      s.id === editingId 
        ? { ...s, title: editContent.title, layout_description: editContent.layout_description, key_points: editContent.key_points }
        : s
    ));
    setEditingId(null);
  };

  const handleKeyPointChange = (index: number, value: string) => {
    setEditContent(prev => {
      const newKeyPoints = [...prev.key_points];
      newKeyPoints[index] = value;
      return { ...prev, key_points: newKeyPoints };
    });
  };

  const handleAddKeyPoint = () => {
    setEditContent(prev => ({ ...prev, key_points: [...prev.key_points, ''] }));
  };

  const handleRemoveKeyPoint = (index: number) => {
    setEditContent(prev => ({ ...prev, key_points: prev.key_points.filter((_, i) => i !== index) }));
  };

  const handleEditCancel = () => setEditingId(null);
  
  const handleDeleteSlide = (id: string) => {
    setOutlineData(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, pageNum: i + 1 })));
  };

  const handleAddSlide = (index: number) => {
    setOutlineData(prev => {
      const newSlide: SlideOutline = {
        id: String(Date.now()),
        pageNum: 0, 
        title: '新页面',
        layout_description: '左右图文，左边是：，右边是：',
        key_points: [''],
        asset_ref: null,
      };
      const newData = [...prev];
      newData.splice(index + 1, 0, newSlide);
      return newData.map((s, i) => ({ ...s, pageNum: i + 1, title: s.title === '新页面' ? `第 ${i + 1} 页` : s.title }));
    });
  };
  
  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const newData = [...outlineData];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newData.length) return;
    [newData[index], newData[targetIndex]] = [newData[targetIndex], newData[index]];
    setOutlineData(newData.map((s, i) => ({ ...s, pageNum: i + 1 })));
  };

  const handleRefineOutline = async () => {
    if (isRefiningOutline) return;
    if (!outlineFeedback.trim()) {
      setError('请输入修改需求');
      return;
    }
    if (!resultPath) {
      setError('缺少 result_path，请重新上传文件');
      return;
    }

    setError(null);
    setIsRefiningOutline(true);

    const currentOutline = editingId
      ? outlineData.map(s =>
          s.id === editingId
            ? {
                ...s,
                title: editContent.title,
                layout_description: editContent.layout_description,
                key_points: editContent.key_points,
              }
            : s
        )
      : outlineData;

    if (editingId) {
      setOutlineData(currentOutline);
      setEditingId(null);
    }

    const pagecontent = currentOutline.map((slide) => ({
      title: slide.title,
      layout_description: slide.layout_description,
      key_points: slide.key_points,
      asset_ref: slide.asset_ref,
    }));

    try {
      const formData = new FormData();
      formData.append('outline_feedback', outlineFeedback.trim());
      formData.append('pagecontent', JSON.stringify(pagecontent));
      formData.append('chat_api_url', llmApiUrl.trim());
      formData.append('api_key', apiKey.trim());
      formData.append('model', model);
      formData.append('language', language);
      formData.append('email', user?.email || '');
      formData.append('result_path', resultPath);

      const res = await fetch('/api/v1/paper2ppt/outline-refine', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });

      if (!res.ok) {
        let msg = '服务器繁忙，请稍后再试';
        if (res.status === 429) {
          msg = '请求过于频繁，请稍后再试';
        } else {
          try {
            const errBody = await res.json();
            if (errBody?.error) msg = errBody.error;
          } catch { /* ignore parse error */ }
        }
        throw new Error(msg);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '服务器繁忙，请稍后再试');
      }

      if (!data.pagecontent || data.pagecontent.length === 0) {
        throw new Error('AI 调整失败，请重试');
      }

      const previousBySignature = new Map(
        currentOutline.map((slide) => [buildSlideSignature(slide), slide.id]),
      );
      const refinedSlides: SlideOutline[] = data.pagecontent.map((item: any, index: number) => {
        const nextSlide = normalizeSlideOutline(item, index);
        return {
          ...nextSlide,
          id: previousBySignature.get(buildSlideSignature(nextSlide)) || String(Date.now() + index),
        };
      });

      setOutlineData(refinedSlides);
      setOutlineFeedback('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '服务器繁忙，请稍后再试';
      setError(message);
    } finally {
      setIsRefiningOutline(false);
    }
  };

  const handleConfirmOutline = async () => {
    if (isRefiningOutline) return;

    const previousBySignature = new Map<string, GenerateResult[]>();
    generateResults.forEach((result) => {
      if (result.slideSignature && (result.afterImagePath || result.afterImage)) {
        const bucket = previousBySignature.get(result.slideSignature) || [];
        bucket.push(result);
        previousBySignature.set(result.slideSignature, bucket);
      }
    });

    const nextResults: GenerateResult[] = outlineData.map((slide) => {
      const signature = buildSlideSignature(slide);
      const bucket = previousBySignature.get(signature) || [];
      const previous = bucket.shift();
      if (bucket.length === 0) {
        previousBySignature.delete(signature);
      } else {
        previousBySignature.set(signature, bucket);
      }
      return buildResultForSlide(slide, signature, previous);
    });

    setCurrentStep('generate');
    setCurrentSlideIndex(0);
    setIsGenerating(true);
    setGenerateTaskMessage('');
    setError(null);
    setGenerateResults(nextResults);
    
    try {
      const formData = new FormData();
      formData.append('img_gen_model_name', genFigModel);
      formData.append('chat_api_url', llmApiUrl.trim());
      formData.append('api_key', apiKey.trim());
      formData.append('model', model);
      formData.append('language', language);
      formData.append('style', globalPrompt || getStyleDescription(stylePreset));
      formData.append('aspect_ratio', '16:9');
      formData.append('email', user?.id || user?.email || '');
      formData.append('result_path', resultPath || '');
      formData.append('get_down', 'false');

      // 如果用户选的是参考图模式，附加参考图，保留用户显式输入的风格提示词
      if (styleMode === 'reference' && referenceImage) {
        formData.append('reference_img', referenceImage);
        formData.set('style', globalPrompt || '');
      }

      const pagecontent = outlineData.map((slide, index) => ({
        title: slide.title,
        layout_description: slide.layout_description,
        key_points: slide.key_points,
        asset_ref: slide.asset_ref,
        generated_img_path: nextResults[index].afterImagePath || undefined,
      }));
      formData.append('pagecontent', JSON.stringify(pagecontent));

      const task = await submitPaper2PptTask(formData);
      setGenerateTaskMessage(task.message || '批量生成任务已提交');

      const data = await pollPaper2PptTask(task.task_id, (status) => {
        setGenerateTaskMessage(status.message || '正在生成页面');
      });
      applyBatchGenerateResult(data, nextResults);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : '服务器繁忙，请稍后再试';
      setError(message);
      setGenerateResults(nextResults.map(r => ({ ...r, status: 'pending' as const })));
    } finally {
      setGenerateTaskMessage('');
      setIsGenerating(false);
    }
  };

  const saveCurrentSlideEdits = (layoutDescription: string, keyPoints: string[]) => {
    setOutlineData(prev =>
      prev.map((slide, slideIndex) => {
        if (slideIndex !== currentSlideIndex) return slide;
        return {
          ...slide,
          layout_description: layoutDescription,
          key_points: keyPoints.length > 0 ? keyPoints : [''],
        };
      })
    );
  };

  const buildPagecontentForGeneration = () => (
    outlineData.map((slide, idx) => {
      const result = generateResults[idx];
      const generatedPath = result?.afterImagePath || stripImageQuery(result?.afterImage) || '';
      return {
        title: slide.title,
        layout_description: slide.layout_description,
        key_points: slide.key_points,
        asset_ref: slide.asset_ref,
        generated_img_path: generatedPath || undefined,
      };
    })
  );
  // ============== 版本历史相关函数 ==============
  const convertToHttpUrl = (path: string): string => {
    // 如果已经是HTTP URL，直接返回
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/outputs/')) {
      return path;
    }

    // 如果是文件系统路径，转换为HTTP URL
    // 例如：/data/users/.../outputs/xxx/yyy.png -> http://localhost:9090/outputs/xxx/yyy.png
    const outputsIndex = path.indexOf('/outputs/');
    if (outputsIndex !== -1) {
      const relativePath = path.substring(outputsIndex);
      // 使用当前页面的协议和主机
      const baseUrl = window.location.origin.replace(':3005', ':9090');
      return `${baseUrl}${relativePath}`;
    }

    // 如果无法转换，返回原路径
    console.warn('[convertToHttpUrl] 无法转换路径:', path);
    return path;
  };

  const fetchVersionHistory = async (pageIndex: number) => {
    if (!resultPath) return;

    try {
      const encodedPath = btoa(resultPath);
      const res = await fetch(
        `/api/v1/paper2ppt/version-history/${encodedPath}/${pageIndex}`,
        { headers: { 'X-API-Key': API_KEY } }
      );

      if (!res.ok) return;

      const data = await res.json();
      if (data.success && data.versions) {
        setGenerateResults(prev => prev.map((result, idx) =>
          idx === pageIndex
            ? (() => {
                const versionHistory = data.versions.map((v: any) => ({
                  versionNumber: v.version,
                  imageUrl: convertToHttpUrl(v.imageUrl),
                  prompt: v.prompt,
                  timestamp: v.timestamp,
                  isCurrentVersion: Boolean(v.is_current_version),
                }));
                const selectedVersion = data.current_version
                  ?? versionHistory.find((item) => item.isCurrentVersion)?.versionNumber
                  ?? null;
                return {
                  ...result,
                  versionHistory,
                  currentVersionIndex: selectedVersion == null
                    ? -1
                    : versionHistory.findIndex((item) => item.versionNumber === selectedVersion),
                };
              })()
            : result
        ));
      }
    } catch (err) {
      console.error('Failed to fetch version history:', err);
    }
  };

  const handleRevertToVersion = async (versionNumber: number) => {
    if (!resultPath) {
      setError('缺少 result_path');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('result_path', resultPath);
      formData.append('page_id', String(currentSlideIndex));
      formData.append('target_version', String(versionNumber));

      const res = await fetch('/api/v1/paper2ppt/revert-version', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });

      if (!res.ok) throw new Error('恢复版本失败');

      const data = await res.json();

      if (data.success) {
        const updatedResults = [...generateResults];
        updatedResults[currentSlideIndex] = {
          ...updatedResults[currentSlideIndex],
          afterImage: data.currentImageUrl + '?t=' + Date.now(),
          currentVersionIndex: updatedResults[currentSlideIndex].versionHistory.findIndex(
            item => item.versionNumber === (data.currentVersion ?? versionNumber),
          ),
        };
        setGenerateResults(updatedResults);
        await fetchVersionHistory(currentSlideIndex);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '恢复版本失败';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ============== Step 3: 重新生成单页 ==============
  const handleRegenerateSlide = async () => {
    if (!resultPath) {
      setError('缺少 result_path，请重新上传文件');
      return;
    }
    
    if (!slidePrompt.trim()) {
      setError('请输入重新生成的提示词');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    const updatedResults = [...generateResults];
    updatedResults[currentSlideIndex] = { 
      ...updatedResults[currentSlideIndex], 
      status: 'processing',
      userPrompt: slidePrompt,
    };
    setGenerateResults(updatedResults);
    
    try {
      const formData = new FormData();
      formData.append('img_gen_model_name', genFigModel);
      formData.append('chat_api_url', llmApiUrl.trim());
      formData.append('api_key', apiKey.trim());
      formData.append('model', model);
      formData.append('language', language);
      formData.append('style', globalPrompt || getStyleDescription(stylePreset));
      formData.append('aspect_ratio', '16:9');
      formData.append('email', user?.id || user?.email || '');
      formData.append('result_path', resultPath);
      formData.append('get_down', 'true');
      formData.append('page_id', String(currentSlideIndex));
      formData.append('edit_prompt', slidePrompt);

      // 如果用户选的是参考图模式，附加参考图，保留用户显式输入的风格提示词
      if (styleMode === 'reference' && referenceImage) {
        formData.append('reference_img', referenceImage);
        formData.set('style', globalPrompt || '');
      }

      const pagecontent = outlineData.map((slide, idx) => {
        const result = generateResults[idx];
        let generatedPath = '';
        if (result?.afterImage) {
          generatedPath = result.afterImage;
        }
        console.log(`[handleRegenerateSlide] 页面${idx}: afterImage=${result?.afterImage}, generatedPath=${generatedPath}`);
        return {
          title: slide.title,
          layout_description: slide.layout_description,
          key_points: slide.key_points,
          asset_ref: slide.asset_ref,
          generated_img_path: generatedPath || undefined,
        };
      });
      console.log(`[handleRegenerateSlide] 当前编辑页面: ${currentSlideIndex}`);
      console.log(`[handleRegenerateSlide] 完整pagecontent:`, JSON.stringify(pagecontent.map((p, i) => ({
        idx: i,
        title: p.title,
        generated_img_path: p.generated_img_path
      })), null, 2));
      formData.append('pagecontent', JSON.stringify(pagecontent));

      const res = await fetch('/api/v1/paper2ppt/generate', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });
      
      if (!res.ok) {
        let msg = '服务器繁忙，请稍后再试';
        if (res.status === 429) {
          msg = '请求过于频繁，请稍后再试';
        } else {
          try {
            const errBody = await res.json();
            if (errBody?.error) msg = errBody.error;
          } catch { /* ignore parse error */ }
        }
        throw new Error(msg);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '服务器繁忙，请稍后再试');
      }

      const pageNumStr = String(currentSlideIndex).padStart(3, '0');
      let afterImage = updatedResults[currentSlideIndex].afterImage;
      
      if (data.all_output_files && Array.isArray(data.all_output_files)) {
        const pageImg = data.all_output_files.find((url: string) => 
          url.includes(`ppt_pages/page_${pageNumStr}.png`)
        );
        if (pageImg) {
          afterImage = pageImg + '?t=' + Date.now();
        }
      }
      
      updatedResults[currentSlideIndex] = {
        ...updatedResults[currentSlideIndex],
        afterImage,
        status: 'done',
      };
      setGenerateResults([...updatedResults]);
      setSlidePrompt('');

      // 获取更新的版本历史
      await fetchVersionHistory(currentSlideIndex);

    } catch (err) {
      const message = err instanceof Error ? err.message : '服务器繁忙，请稍后再试';
      setError(message);
      updatedResults[currentSlideIndex] = { 
        ...updatedResults[currentSlideIndex], 
        status: 'done',
      };
      setGenerateResults([...updatedResults]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmSlide = () => {
    setError(null);
    if (currentSlideIndex < outlineData.length - 1) {
      const nextIndex = currentSlideIndex + 1;
      setCurrentSlideIndex(nextIndex);
      setSlidePrompt('');
    } else {
      setCurrentStep('complete');
    }
  };

  // ============== Step 4: 完成处理 ==============
  const handleGenerateFinal = async () => {
    if (!resultPath) {
      setError('缺少 result_path');
      return;
    }
    
    setIsGeneratingFinal(true);
    setFinalTaskMessage('');
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('img_gen_model_name', genFigModel);
      formData.append('chat_api_url', llmApiUrl.trim());
      formData.append('api_key', apiKey.trim());
      formData.append('model', model);
      formData.append('language', language);
      formData.append('style', globalPrompt || getStyleDescription(stylePreset));
      formData.append('aspect_ratio', '16:9');
      formData.append('email', user?.id || user?.email || '');
      formData.append('result_path', resultPath);
      formData.append('get_down', 'false');
      formData.append('all_edited_down', 'true');

      // 如果用户选的是参考图模式，附加参考图，保留用户显式输入的风格提示词
      if (styleMode === 'reference' && referenceImage) {
        formData.append('reference_img', referenceImage);
        formData.set('style', globalPrompt || '');
      }

      const pagecontent = outlineData.map((slide) => ({
        title: slide.title,
        layout_description: slide.layout_description,
        key_points: slide.key_points,
        asset_ref: slide.asset_ref,
      }));
      formData.append('pagecontent', JSON.stringify(pagecontent));

      const task = await submitPaper2PptTask(formData);
      setFinalTaskMessage(task.message || '最终导出任务已提交');

      const data = await pollPaper2PptTask(task.task_id, (status) => {
        setFinalTaskMessage(status.message || '正在生成最终文件');
      });

      // 优先使用后端直接返回的路径
      if (data.ppt_pptx_path) {
        setDownloadUrl(data.ppt_pptx_path);
      }
      if (data.ppt_pdf_path) {
        setPdfPreviewUrl(data.ppt_pdf_path);
      }
      
      // 备选：从 all_output_files 中查找
      if (data.all_output_files && Array.isArray(data.all_output_files)) {
        if (!data.ppt_pptx_path) {
          const pptxFile = data.all_output_files.find((url: string) => 
            url.endsWith('.pptx') || url.includes('editable.pptx')
          );
          if (pptxFile) {
            setDownloadUrl(pptxFile);
          }
        }
        if (!data.ppt_pdf_path) {
          const pdfFile = data.all_output_files.find((url: string) =>
            url.endsWith('.pdf') && !url.includes('input')
          );
          if (pdfFile) {
            setPdfPreviewUrl(pdfFile);
          }
        }
      }

      // 校验是否有有效的输出文件
      const hasOutput = data.ppt_pptx_path || data.ppt_pdf_path ||
        (data.all_output_files && data.all_output_files.some((url: string) =>
          url.endsWith('.pptx') || (url.endsWith('.pdf') && !url.includes('input'))
        ));
      if (!hasOutput) {
        throw new Error('生成失败：未能获取到有效的文件，请检查 API Key 余额后重试');
      }

      // 校验通过后才扣积分
      await recordUsage(user?.id || null, 'paper2ppt', { isAnonymous: user?.is_anonymous || false });
      refreshQuota();

      // Upload generated file to Supabase Storage (either PPTX or PDF)
      let filePath = data.ppt_pptx_path || (data.all_output_files?.find((url: string) =>
        url.endsWith('.pptx') || url.includes('editable.pptx')
      ));
      let defaultName = 'paper2ppt_result.pptx';

      if (!filePath) {
        filePath = data.ppt_pdf_path || (data.all_output_files?.find((url: string) =>
          url.endsWith('.pdf') && !url.includes('input')
        ));
        defaultName = 'paper2ppt_result.pdf';
      }

      if (filePath) {
        try {
          // Fix Mixed Content issue
          let fetchUrl = filePath;
          if (window.location.protocol === 'https:' && filePath.startsWith('http:')) {
            fetchUrl = filePath.replace('http:', 'https:');
          }

          const fileRes = await fetch(fetchUrl);
          if (fileRes.ok) {
            const fileBlob = await fileRes.blob();
            const fileName = filePath.split('/').pop() || defaultName;
            console.log('[Paper2PptPage] Uploading file to storage:', fileName);
            await uploadAndSaveFile(fileBlob, fileName, 'paper2ppt');
            console.log('[Paper2PptPage] File uploaded successfully');
          } else {
             console.error('[Paper2PptPage] Failed to fetch file for upload:', fileRes.status, fileRes.statusText);
          }
        } catch (e) {
          console.error('[Paper2PptPage] Failed to upload file:', e);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : '服务器繁忙，请稍后再试';
      setError(message);
    } finally {
      setFinalTaskMessage('');
      setIsGeneratingFinal(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;
    window.open(pdfPreviewUrl, '_blank');
  };

  const handleDownloadPptx = async () => {
    if (!downloadUrl) {
      setError('下载链接不存在');
      return;
    }

    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error('下载失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'paper2ppt_editable.pptx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '服务器繁忙，请稍后再试';
      setError(message);
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setOutlineData([]);
    setGenerateResults([]);
    setDownloadUrl(null);
    setPdfPreviewUrl(null);
    setResultPath(null);
    setError(null);
    setProgress(0);
    setProgressStatus('');
    setGenerateTaskMessage('');
    setFinalTaskMessage('');
  };

  return (
    <div className="w-full h-screen flex flex-col bg-[#050512] overflow-hidden">
      <Banner show={showBanner} onClose={() => setShowBanner(false)} stars={stars} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
          <StepIndicator currentStep={currentStep} />
          
          {currentStep === 'upload' && (
            <UploadStep
              uploadMode={uploadMode} setUploadMode={setUploadMode}
              textContent={textContent} setTextContent={setTextContent}
              selectedFile={selectedFile}
              isDragOver={isDragOver} setIsDragOver={setIsDragOver}
              styleMode={styleMode} setStyleMode={setStyleMode}
              stylePreset={stylePreset} setStylePreset={setStylePreset}
              globalPrompt={globalPrompt} setGlobalPrompt={setGlobalPrompt}
              referenceImage={referenceImage} referenceImagePreview={referenceImagePreview}
              isUploading={isUploading} isValidating={isValidating}
              pageCount={pageCount} setPageCount={setPageCount}
              useLongPaper={useLongPaper} setUseLongPaper={setUseLongPaper}
              progress={progress} progressStatus={progressStatus}
              error={error}
              llmApiUrl={llmApiUrl} setLlmApiUrl={setLlmApiUrl}
              apiKey={apiKey} setApiKey={setApiKey}
              model={model} setModel={setModel}
              genFigModel={genFigModel} setGenFigModel={setGenFigModel}
              language={language} setLanguage={setLanguage}
              handleFileChange={handleFileChange}
              handleDrop={handleDrop}
              handleReferenceImageChange={handleReferenceImageChange}
              handleRemoveReferenceImage={handleRemoveReferenceImage}
              handleUploadAndParse={handleUploadAndParse}
            />
          )}
          
      {currentStep === 'outline' && (
        <OutlineStep
          outlineData={outlineData}
          editingId={editingId}
          editContent={editContent}
          setEditContent={setEditContent}
          handleEditStart={handleEditStart}
          handleEditSave={handleEditSave}
          handleEditCancel={handleEditCancel}
          handleKeyPointChange={handleKeyPointChange}
          handleAddKeyPoint={handleAddKeyPoint}
          handleRemoveKeyPoint={handleRemoveKeyPoint}
          handleDeleteSlide={handleDeleteSlide}
          handleAddSlide={handleAddSlide}
          handleMoveSlide={handleMoveSlide}
          handleConfirmOutline={handleConfirmOutline}
          handleRefineOutline={handleRefineOutline}
          setCurrentStep={setCurrentStep}
          error={error}
          outlineFeedback={outlineFeedback}
          setOutlineFeedback={setOutlineFeedback}
          isRefiningOutline={isRefiningOutline}
        />
      )}
          
          {currentStep === 'generate' && (
            <GenerateStep
              outlineData={outlineData}
              currentSlideIndex={currentSlideIndex}
              setCurrentSlideIndex={setCurrentSlideIndex}
              generateResults={generateResults}
              isGenerating={isGenerating}
              taskMessage={generateTaskMessage}
              slidePrompt={slidePrompt}
              setSlidePrompt={setSlidePrompt}
              handleRegenerateSlide={handleRegenerateSlide}
              handleConfirmSlide={handleConfirmSlide}
              setCurrentStep={setCurrentStep}
              error={error}
              handleRevertToVersion={handleRevertToVersion}
            />
          )}
          
          {currentStep === 'complete' && (
            <CompleteStep
              outlineData={outlineData}
              generateResults={generateResults}
              downloadUrl={downloadUrl}
              pdfPreviewUrl={pdfPreviewUrl}
              isGeneratingFinal={isGeneratingFinal}
              taskMessage={finalTaskMessage}
              handleGenerateFinal={handleGenerateFinal}
              handleDownloadPptx={handleDownloadPptx}
              handleDownloadPdf={handleDownloadPdf}
              handleReset={handleReset}
              error={error}
              handleCopyShareText={handleCopyShareText}
              copySuccess={copySuccess}
              stars={stars}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        .animate-shimmer-fast {
          animation: shimmer 1.5s infinite;
        }
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); }
        .demo-input-placeholder {
          min-height: 80px;
        }
        .demo-output-placeholder {
          min-height: 80px;
        }
      `}</style>
    </div>
  );
};

export default Paper2PptPage;
