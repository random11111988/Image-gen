import React, { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, Image as ImageIcon, Trash2, FileText, Sparkles, Pencil, Move, Maximize2, Minimize2, Check, Monitor, Smartphone, Square, Upload, X, Type, ArrowUpCircle, KeyRound, AlertTriangle } from 'lucide-react';
import { ImageSlot, AspectRatio, ImageModel, ImageSize } from './types';
import { improvePromptWithGemini, generateVariationsWithGemini, generateStoryboardWithGemini, upscaleImageWithGemini, generateImageWithGemini, analyzeImageWithGemini } from './services/geminiService';

// FIX: Removed global type declaration to resolve conflict. It has been moved to types.ts.

const App = () => {
  const [promptsInput, setPromptsInput] = useState('');
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('9:16');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [stickyText, setStickyText] = useState('');
  const [stickyPos, setStickyPos] = useState({ x: 20, y: 150 });
  const [isStickyMinimized, setIsStickyMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const isProcessingRef = useRef(false);

  // New state for model and quality selection
  const [selectedModel, setSelectedModel] = useState<ImageModel>('gemini-2.5-flash-image');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('1K');
  const [isKeySelected, setIsKeySelected] = useState(true);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsKeySelected(hasKey);
      }
    };
    checkApiKey();
  }, []);
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success to avoid race conditions
      setIsKeySelected(true);
    }
  };

  const handleApiError = (error: any) => {
    if (error instanceof Error && error.message.includes("Requested entity was not found")) {
        setIsKeySelected(false);
    }
    console.error(error);
  };

  const improvePrompt = async () => {
    if (!promptsInput.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await improvePromptWithGemini(promptsInput.split('\n')[0]);
      if (result) setPromptsInput(result.trim());
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateVariations = async () => {
    if (!promptsInput.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await generateVariationsWithGemini(promptsInput.split('\n')[0]);
      if (result) setPromptsInput(result.trim());
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateBatchStory = async () => {
    if (!promptsInput.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await generateStoryboardWithGemini(promptsInput.split('\n')[0]);
      if (result) setPromptsInput(result.trim());
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsAiLoading(false);
    }
  };
  
  const handleAnalyzeImage = async () => {
    if (!uploadedImage) return;
    setIsAiLoading(true);
    try {
        const result = await analyzeImageWithGemini(uploadedImage);
        if (result) setPromptsInput(result.trim());
    } catch (err) {
        handleApiError(err);
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleStyle = (id: string) => {
    setSelectedStyles(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragRef.current = { x: e.clientX - stickyPos.x, y: e.clientY - stickyPos.y };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setStickyPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleStartBatch = async () => {
    if (isProcessingRef.current) return;
    if (selectedModel === 'gemini-3-pro-image-preview' && !isKeySelected) {
        await handleSelectKey();
    }

    const promptList = promptsInput.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    const effectivePrompts = promptList.length > 0 ? promptList : (uploadedImage ? ["Complete Transformation"] : []);
    
    if (effectivePrompts.length === 0) return;
    
    setIsGenerating(true);
    isProcessingRef.current = true;

    const newSlots: ImageSlot[] = effectivePrompts.map((p, idx) => ({
      prompt: p, url: null, status: 'pending', id: `img-${Date.now()}-${idx}`, indexDisplay: `${idx + 1}/${effectivePrompts.length}`, isEditing: false, overlayText: '', isAddingText: false, isUpscaling: false, upscaledUrl: null
    }));

    setImages(prev => [...newSlots, ...prev]);
    setPromptsInput('');

    const stylesString = selectedStyles.length ? styleOptions.filter(o => selectedStyles.includes(o.id)).map(o => o.tag).join(", ") : "";

    for (const slot of newSlots) {
      setImages(curr => curr.map(img => img.id === slot.id ? { ...img, status: 'generating' } : img));
      try {
        const url = await generateImageWithGemini(slot.prompt, stylesString, selectedRatio, selectedModel, selectedSize, uploadedImage);
        setImages(curr => curr.map(img => img.id === slot.id ? { ...img, status: 'completed', url } : img));
        await delay(1200);
      } catch (err) {
        handleApiError(err);
        setImages(curr => curr.map(img => img.id === slot.id ? { ...img, status: 'error' } : img));
      }
    }
    setIsGenerating(false);
    isProcessingRef.current = false;
  };

  const handleUpdateWithText = async (imgId: string) => {
    if (selectedModel === 'gemini-3-pro-image-preview' && !isKeySelected) {
        await handleSelectKey();
    }
    const target = images.find(i => i.id === imgId);
    if (!target || !target.overlayText.trim()) return;
    setImages(curr => curr.map(img => img.id === imgId ? { ...img, status: 'generating', isAddingText: false } : img));
    try {
      const stylesString = selectedStyles.length ? styleOptions.filter(o => selectedStyles.includes(o.id)).map(o => o.tag).join(", ") : "";
      const url = await generateImageWithGemini(target.prompt, stylesString, selectedRatio, selectedModel, selectedSize, target.url, target.overlayText);
      setImages(curr => curr.map(img => img.id === imgId ? { ...img, status: 'completed', url } : img));
    } catch (err) { 
        handleApiError(err);
        setImages(curr => curr.map(img => img.id === imgId ? { ...img, status: 'error' } : img)); 
    }
  };

  const handleUpscaleImage = async (imgId: string) => {
    if (!isKeySelected) {
      await handleSelectKey();
    }
    const targetImage = images.find(img => img.id === imgId);
    if (!targetImage || !targetImage.url) return;

    setImages(currentImages => currentImages.map(img =>
      img.id === imgId ? { ...img, isUpscaling: true } : img
    ));

    try {
      const upscaledUrl = await upscaleImageWithGemini(targetImage.url);
      setImages(currentImages => currentImages.map(img =>
        img.id === imgId ? { ...img, isUpscaling: false, upscaledUrl: upscaledUrl } : img
      ));
    } catch (error) {
      handleApiError(error);
      setImages(currentImages => currentImages.map(img =>
        img.id === imgId ? { ...img, isUpscaling: false } : img
      ));
    }
  };

  const ratioOptions: { id: AspectRatio, label: string, icon: React.ReactElement, desc: string }[] = [
    { id: '1:1', label: '1:1 Square', icon: <Square size={14} />, desc: 'Post' },
    { id: '9:16', label: '9:16 Vertical', icon: <Smartphone size={14} />, desc: 'Shorts/TikTok' },
    { id: '16:9', label: '16:9 Wide', icon: <Monitor size={14} />, desc: 'YouTube' },
    { id: '4:3', label: '4:3 Classic', icon: <Monitor size={14} />, desc: 'Standard' }
  ];

  const styleOptions: { id: string, label: string, tag: string }[] = [
    { id: 'realistic', label: 'Realistic', tag: 'photorealistic 8k, ultra-detailed textures, realistic lighting' },
    { id: 'cinematic', label: 'Cinematic', tag: 'cinematic depth of field, dramatic movie lighting, anamorphic' },
    { id: 'anime', label: 'Anime', tag: 'high-quality modern anime art style, cel-shaded' },
    { id: 'cyberpunk', label: 'Cyberpunk', tag: 'futuristic high-tech aesthetic, advanced urban textures, carbon fiber, tactical apparel, futuristic vehicles and shoes, integrated tech-wear, subtle neon accents, NO exaggerated floating lines or neon biker glows on skin' },
    { id: '3d', label: '3D Render', tag: 'stylized 3D render, octane render, high-end CGI, unreal engine 5' },
    { id: 'oil', label: 'Oil Painting', tag: 'classical oil painting, textured brush strokes, fine art' }
  ];


  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 font-sans text-slate-900 relative">
      <div onMouseDown={handleMouseDown} style={{ left: stickyPos.x, top: stickyPos.y, zIndex: 100 }} className="fixed bg-yellow-100 shadow-2xl rounded-xl border border-yellow-200">
        <div className="drag-handle flex items-center justify-between p-3 bg-yellow-200 cursor-grab active:cursor-grabbing rounded-t-xl">
          <div className="flex items-center gap-2 text-yellow-800 font-black text-[10px]"><Move size={14}/> STICKY NOTE</div>
          <button onClick={() => setIsStickyMinimized(!isStickyMinimized)} className="p-1 hover:bg-yellow-300 rounded text-yellow-800">
            {isStickyMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
          </button>
        </div>
        {!isStickyMinimized && <textarea value={stickyText} onChange={(e) => setStickyText(e.target.value)} className="w-64 h-64 p-4 bg-transparent border-none outline-none text-sm text-yellow-900 placeholder:text-yellow-600/50 resize" placeholder="Paste your lists here..."/>}
      </div>

      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg"><Sparkles className="text-white" size={28}/></div>
            <h1 className="text-2xl font-black italic tracking-tighter">GEMINI BATCH STUDIO</h1>
          </div>
          <button onClick={() => setImages([])} className="px-4 py-2 bg-white rounded-xl border text-xs font-bold uppercase text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
        </header>

        <main className="bg-white rounded-[2rem] shadow-xl border p-6 md:p-8 mb-10 relative overflow-hidden">
          {isAiLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center flex-col gap-3">
               <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
               <span className="text-xs font-black uppercase text-indigo-600 tracking-widest">✨ AI Brainstorming...</span>
            </div>
          )}

          <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><FileText size={14}/> Image Concepts</div>
             <div className="flex gap-2">
                <button onClick={improvePrompt} disabled={!promptsInput.trim()} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black border border-indigo-100 hover:bg-indigo-100 transition-all disabled:opacity-50 underline-offset-2">✨ Improve</button>
                <button onClick={generateVariations} disabled={!promptsInput.trim()} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black border border-amber-100 hover:bg-amber-100 transition-all disabled:opacity-50">✨ Variations</button>
                <button onClick={generateBatchStory} disabled={!promptsInput.trim()} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100 hover:bg-emerald-100 transition-all disabled:opacity-50">✨ Storyboard</button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="md:col-span-3">
               <textarea value={promptsInput} onChange={(e) => setPromptsInput(e.target.value)} placeholder="Describe your image or let ✨ AI expand your idea..." className="w-full h-40 p-5 rounded-2xl bg-slate-50 border-2 focus:border-indigo-500 outline-none text-lg font-medium"/>
            </div>
            <div className="relative group border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center p-4 hover:border-indigo-400 transition-all">
                <div className="flex flex-col items-center justify-center w-full h-full cursor-pointer" onClick={() => !uploadedImage && fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                  {uploadedImage ? (
                    <div className="relative w-full h-full">
                      <img src={uploadedImage} alt="Uploaded blueprint" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                      <span className="text-[10px] font-black uppercase text-slate-500">Image Blueprint</span>
                    </div>
                  )}
                </div>
                {uploadedImage && (
                    <button onClick={handleAnalyzeImage} className="mt-3 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black border border-indigo-100 hover:bg-indigo-100 transition-all w-full">✨ Analyze</button>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 bg-slate-50 rounded-2xl border">
              <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-slate-400"><Sparkles size={14}/> Generation Engine</div>
              <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSelectedModel('gemini-2.5-flash-image')} className={`flex-1 p-3 rounded-xl border transition-all text-center ${selectedModel === 'gemini-2.5-flash-image' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>
                      <div className="text-xs font-black">Fast</div>
                      <div className="text-[9px] opacity-70">Good quality, quick</div>
                  </button>
                  <button onClick={() => setSelectedModel('gemini-3-pro-image-preview')} className={`flex-1 p-3 rounded-xl border transition-all text-center ${selectedModel === 'gemini-3-pro-image-preview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>
                      <div className="text-xs font-black">High Quality</div>
                      <div className="text-[9px] opacity-70">Best quality, slower</div>
                  </button>
              </div>
              {selectedModel === 'gemini-3-pro-image-preview' && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-slate-400"><Maximize2 size={14}/> Image Size</div>
                    <div className="flex flex-wrap gap-2">
                        {(['1K', '2K', '4K'] as ImageSize[]).map(size => (
                          <button key={size} onClick={() => setSelectedSize(size)} className={`flex-1 p-2 rounded-xl border text-xs font-bold ${selectedSize === size ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>{size}</button>
                        ))}
                    </div>
                </div>
              )}
            </div>
             <div className="p-4 bg-slate-50 rounded-2xl border">
                <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-slate-400"><Smartphone size={14}/> Output Dimension</div>
                <div className="flex flex-wrap gap-2">
                  {ratioOptions.map(r => (
                    <button key={r.id} onClick={() => setSelectedRatio(r.id)} className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${selectedRatio === r.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>
                      <div className="flex items-center gap-2 text-xs font-black">{r.icon} {r.label}</div>
                      <span className="text-[9px] opacity-70">{r.desc}</span>
                    </button>
                  ))}
                </div>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl border">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-slate-400"><Sparkles size={14}/> Style Engine</div>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map(s => (
                <button key={s.id} onClick={() => toggleStyle(s.id)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${selectedStyles.includes(s.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <div className={`w-3 h-3 rounded-sm border ${selectedStyles.includes(s.id) ? 'bg-white border-white' : 'bg-transparent border-slate-300'}`}>
                    {selectedStyles.includes(s.id) && <Check size={10} className="text-indigo-600" />}
                  </div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {selectedModel === 'gemini-3-pro-image-preview' && !isKeySelected && (
             <div className="mb-6 p-4 bg-amber-50 border-amber-200 border rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="text-amber-500"/>
                    <div>
                      <p className="text-sm font-bold text-amber-800">API Key Required for High Quality Model</p>
                      <p className="text-xs text-amber-700">Please select an API key from a paid GCP project to use this feature. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Learn more</a>.</p>
                    </div>
                </div>
                <button onClick={handleSelectKey} className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-amber-600 transition-colors"><KeyRound size={14}/> Select API Key</button>
             </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleStartBatch} disabled={isGenerating || (!promptsInput.trim() && !uploadedImage)} className={`px-12 py-4 rounded-2xl font-black text-white shadow-xl ${isGenerating || (!promptsInput.trim() && !uploadedImage) ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all'}`}>
              {isGenerating ? 'TRANSFORMING...' : '✨ START TRANSFORMATION'}
            </button>
          </div>
        </main>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
          {images.map(img => (
            <div key={img.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-md border flex flex-col group transition-all hover:shadow-xl">
              <div className={`relative bg-slate-50 flex items-center justify-center overflow-hidden ${selectedRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'}`}>
                {img.isUpscaling && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
                    <ArrowUpCircle className="animate-pulse text-indigo-600" size={32}/>
                    <span className="text-[10px] font-black text-indigo-600 tracking-tighter uppercase">Upscaling to HD...</span>
                  </div>
                )}
                {img.status === 'completed' ? <img src={img.upscaledUrl || img.url!} alt={img.prompt} className="w-full h-full object-cover"/> : img.status === 'generating' ? <div className="flex flex-col items-center gap-2"><RefreshCw className="animate-spin text-indigo-600" size={32}/><span className="text-[10px] font-black text-indigo-600 tracking-tighter uppercase">Redrawing...</span></div> : <ImageIcon size={64} className="text-slate-200"/>}
                <div className="absolute top-5 left-5 bg-indigo-600 text-white text-[10px] font-black px-4 py-1 rounded-full shadow-lg">{img.indexDisplay}</div>
                {img.upscaledUrl && (
                  <div className="absolute top-5 right-5 bg-black/50 text-white text-[10px] font-black px-4 py-1 rounded-full shadow-lg backdrop-blur-sm">HD</div>
                )}
              </div>
              <div className="p-6 flex flex-col flex-grow">
                {img.isEditing ? (
                  <textarea value={img.prompt} onChange={(e) => setImages(prev => prev.map(i => i.id === img.id ? {...i, prompt: e.target.value} : i))} className="w-full p-4 rounded-xl border text-xs h-24 mb-4 font-medium focus:border-indigo-400 outline-none"/>
                ) : img.isAddingText ? (
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase text-indigo-600 mb-2">Overlay Text Content</p>
                    <textarea value={img.overlayText} onChange={(e) => setImages(prev => prev.map(i => i.id === img.id ? {...i, overlayText: e.target.value} : i))} placeholder="Type text here..." className="w-full p-4 rounded-xl border text-xs h-24 font-medium focus:border-indigo-400 outline-none bg-indigo-50/30" autoFocus/>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs font-bold leading-relaxed line-clamp-3 mb-4 italic">"{img.prompt}"</p>
                )}

                <div className="flex justify-between gap-2 mt-auto">
                  <div className="flex gap-1">
                    <button onClick={() => setImages(prev => prev.map(i => i.id === img.id ? {...i, isEditing: !i.isEditing, isAddingText: false} : i))} className={`p-3 rounded-xl transition-all ${img.isEditing ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title="Edit Prompt"><Pencil size={18}/></button>
                    <button onClick={() => setImages(prev => prev.map(i => i.id === img.id ? {...i, isAddingText: !i.isAddingText, isEditing: false} : i))} className={`p-3 rounded-xl transition-all ${img.isAddingText ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title="Add Text Overlay"><Type size={18}/></button>
                    <button onClick={() => handleUpscaleImage(img.id)} disabled={img.status !== 'completed' || !!img.upscaledUrl || img.isUpscaling} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Upscale to HD"><ArrowUpCircle size={18}/></button>
                    <a href={img.url ?? '#'} download={`transformation_sd_${img.id}.png`} className={`p-3 rounded-xl transition-all ${img.status !== 'completed' ? 'opacity-20 pointer-events-none' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title="Download SD"><Download size={18}/></a>
                    {img.upscaledUrl && (<a href={img.upscaledUrl} download={`transformation_hd_${img.id}.png`} className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-all" title="Download HD"><Download size={18}/></a>)}
                  </div>
                  {img.isAddingText ? (
                    <button onClick={() => handleUpdateWithText(img.id)} disabled={!img.overlayText.trim()} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-indigo-700 transition-all shadow-md">✨ Apply</button>
                  ) : (
                    <button onClick={() => {
                        const targetImage = images.find(i => i.id === img.id);
                        if(targetImage) {
                            setPromptsInput(targetImage.prompt);
                            handleStartBatch();
                        }
                    }} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-indigo-600 transition-all shadow-md">✨ Redo</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
