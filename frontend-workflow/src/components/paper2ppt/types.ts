export type Step = 'upload' | 'outline' | 'generate' | 'complete';

export interface SlideOutline {
  id: string;
  pageNum: number;
  title: string;
  layout_description: string;
  key_points: string[];
  asset_ref: string | null;
  generated_img_path?: string;
}

export interface SlideEditRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageVersion {
  versionNumber: number;
  imageUrl: string;
  prompt: string;
  timestamp: number;
  isCurrentVersion: boolean;
}

export interface GenerateResult {
  slideId: string;
  slideSignature?: string;
  beforeImage: string;
  afterImage: string;
  afterImagePath?: string;
  status: 'pending' | 'processing' | 'done';
  userPrompt?: string;
  versionHistory: ImageVersion[];
  currentVersionIndex: number;
  wasReused?: boolean;
}

export type Paper2PPTTaskStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Paper2PPTTaskResponse {
  success: boolean;
  task_id: string;
  task_type: string;
  status: Paper2PPTTaskStatus;
  message: string;
  error?: string | null;
  result?: {
    success: boolean;
    ppt_pdf_path?: string;
    ppt_pptx_path?: string;
    pagecontent?: Array<Record<string, unknown>>;
    result_path?: string;
    all_output_files?: string[];
  } | null;
}

export type UploadMode = 'file' | 'text' | 'topic';
export type StyleMode = 'prompt' | 'reference';
export type StylePreset = 'modern' | 'business' | 'academic' | 'creative';
