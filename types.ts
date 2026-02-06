// FIX: Import React to resolve React.ReactElement type.
import React from 'react';

// FIX: Define AIStudio interface and declare global window.aistudio type to fix conflict.
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

export type ImageStatus = 'pending' | 'generating' | 'completed' | 'error';
export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:3';
export type ImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type ImageSize = '1K' | '2K' | '4K';


export interface ImageSlot {
  id: string;
  prompt: string;
  url: string | null;
  status: ImageStatus;
  indexDisplay: string;
  isEditing: boolean;
  overlayText: string;
  isAddingText: boolean;
  isUpscaling: boolean;
  upscaledUrl: string | null;
}

export interface RatioOption {
  id: AspectRatio;
  label: string;
  icon: React.ReactElement;
  desc: string;
}

export interface StyleOption {
  id: string;
  label: string;
  tag: string;
}