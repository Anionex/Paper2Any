export type MaterialType = 'image' | 'doc' | 'video' | 'link' | 'audio';

export interface KnowledgeFile {
  id: string;
  name: string;
  type: MaterialType;
  url?: string;
  file?: File;
  desc?: string;
  size?: string;
  sizeBytes?: number;
  uploadTime: string;
  isEmbedded?: boolean;
  kbFileId?: string;
  kbId?: string | null;
  kbName?: string | null;
}

export interface KnowledgeBaseEntry {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  details?: {
    filename: string;
    analysis: string;
  }[];
}

export type SectionType = 'library' | 'upload' | 'output' | 'settings';
export type ToolType = 'chat' | 'ppt' | 'mindmap' | 'podcast' | 'video' | 'search' | 'deepresearch' | 'report';
