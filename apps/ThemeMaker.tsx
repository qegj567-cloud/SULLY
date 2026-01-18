


import React, { useState, useRef } from 'react';
import { useOS } from '../context/OSContext';
import { ChatTheme, BubbleStyle } from '../types';
import { processImage } from '../utils/file';

const DEFAULT_STYLE: BubbleStyle = {
    textColor: '#334155',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    opacity: 1,
    backgroundImageOpacity: 0.5,
    decorationX: 90,
    decorationY: -10,
    decorationScale: 1,
    decorationRotate: 0,
    avatarDecorationX: 50,
    avatarDecorationY: 50,
    avatarDecorationScale: 1,
    avatarDecorationRotate: 0
};

const DEFAULT_THEME: ChatTheme = {
    id: '',
    name: 'New Theme',
    type: 'custom',
    user: { ...DEFAULT_STYLE, textColor: '#ffffff', backgroundColor: '#6366f1' },
    ai: { ...DEFAULT_STYLE },
    customCss: ''
};

// --- CSS Examples ---
const CSS_EXAMPLES = [
    {
        name: '毛玻璃 (Glass)',
        code: `/* Glassmorphism for bubbles */
.sully-bubble-user, .sully-bubble-ai {
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}
.sully-bubble-user { background: rgba(99, 102, 241, 0.7) !important; }
.sully-bubble-ai { background: rgba(255, 255, 255, 0.7) !important; }`
    },
    {
        name: '霓虹 (Neon)',
        code: `/* Glowing Neon Borders */
.sully-bubble-user {
  border: 2px solid #a855f7;
  box-shadow: 0 0 10px #a855f7;
  background: #2e1065 !important;
  color: #fff !important;
}
.sully-bubble-ai {
  border: 2px solid #3b82f6;
  box-shadow: 0 0 10px #3b82f6;
  background: #172554 !important;
  color: #fff !important;
}`
    },
    {
        name: '像素 (Pixel)',
        code: `/* Pixel Art Style */
.sully-bubble-user, .sully-bubble-ai {
  border-radius: 0px !important;
  border: 2px solid #000;
  box-shadow: 4px 4px 0px #000;
  font-family: monospace;
}`
    }
];

const ThemeMaker: React.FC = () => {
    const { closeApp, addCustomTheme, addToast } = useOS();
    const [editingTheme, setEditingTheme] = useState<ChatTheme>({ ...DEFAULT_THEME, id: `theme-${Date.now()}` });
    const [activeTab, setActiveTab] = useState<'user' | 'ai' | 'css'>('user');
    const [toolSection, setToolSection] = useState<'base' | 'sticker' | 'avatar'>('base'); // New Sub-tabs
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const decorationInputRef = useRef<HTMLInputElement>(null);
    const avatarDecoInputRef = useRef<HTMLInputElement>(null);

    const activeStyle = editingTheme[activeTab === 'css' ? 'user' : activeTab];

    const updateStyle = (key: keyof BubbleStyle, value: any) => {
        if (activeTab === 'css') return;
        setEditingTheme(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab as 'user' | 'ai'],
                [key]: value
            }
        }));
    };

    const handleImageUpload = async (file: File, type: 'bg' | 'deco' | 'avatarDeco') => {
        try {
            const result = await processImage(file);
            if (type === 'bg') updateStyle('backgroundImage', result);
            else if (type === 'deco') updateStyle('decoration', result);
            else if (type === 'avatarDeco') updateStyle('avatarDecoration', result);
            addToast('图片上传成功', 'success');
        } catch (e: any) {
            addToast(e.message, 'error');
        }
    };

    const saveTheme = () => {
        if (!editingTheme.name.trim()) return;
        addCustomTheme(editingTheme);
        closeApp();
    };

    const renderPreviewBubble = (role: 'user' | 'ai') => {
        const style = role === 'user' ? editingTheme.user : editingTheme.ai;
        const isUser = role === 'user';
        const isActive = activeTab === role || activeTab === 'css';
        
        // Container style logic to mimic Chat.tsx
        const containerStyle = {
            backgroundColor: style.backgroundColor,
            borderRadius: `${style.borderRadius}px`,
            opacity: style.opacity,
            // Simulate "FirstInGroup" border radius logic for a nicer preview look
            borderBottomLeftRadius: isUser ? `${style.borderRadius}px` : '4px',
            borderBottomRightRadius: isUser ? '4px' : `${style.borderRadius}px`,
            borderTopLeftRadius: `${style.borderRadius}px`,
            borderTopRightRadius: `${style.borderRadius}px`,
        };

        return (
            <div 
                className={`relative w-full flex items-end gap-3 transition-all duration-300 cursor-pointer ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                } ${isActive ? 'opacity-100 scale-100' : 'opacity-60 scale-95 grayscale-[0.5] hover:opacity-80'}`}
                onClick={() => setActiveTab(role)}
                title={`点击编辑${isUser ? '用户' : '角色'}气泡`}
            >
                {/* Avatar */}
                <div className="relative w-10 h-10 shrink-0 pb-1">
                    <div className="w-full h-full rounded-full bg-slate-300 overflow-hidden relative z-0 shadow-sm border border-white/50">
                         <div className="absolute inset-0 flex items-center justify-center text-white/50 font-bold text-[10px]">{isUser ? 'ME' : 'AI'}</div>
                    </div>
                    {style.avatarDecoration && (
                        <img 
                            src={style.avatarDecoration}
                            className="absolute pointer-events-none z-10 max-w-none"
                            style={{
                                left: `${style.avatarDecorationX ?? 50}%`,
                                top: `${style.avatarDecorationY ?? 50}%`,
                                width: `${40 * (style.avatarDecorationScale ?? 1)}px`, // Match container size 40px
                                height: 'auto',
                                transform: `translate(-50%, -50%) rotate(${style.avatarDecorationRotate ?? 0}deg)`,
                            }}
                        />
                    )}
                </div>

                {/* Bubble */}
                <div className="relative group max-w-[75%]">
                    {style.decoration && (
                        <img 
                            src={style.decoration} 
                            className="absolute z-20 w-8 h-8 object-contain drop-shadow-sm pointer-events-none"
                            style={{
                                left: `${style.decorationX ?? (isUser ? 90 : 10)}%`,
                                top: `${style.decorationY ?? -10}%`,
                                transform: `translate(-50%, -50%) scale(${style.decorationScale ?? 1}) rotate(${style.decorationRotate ?? 0}deg)`
                            }}
                        />
                    )}

                    <div 
                        className={`relative px-4 py-3 shadow-sm text-sm overflow-hidden ${isUser ? 'sully-bubble-user' : 'sully-bubble-ai'}`} 
                        style={containerStyle}
                    >
                        {style.backgroundImage && (
                            <div 
                                className="absolute inset-0 bg-cover bg-center pointer-events-none z-0"
                                style={{ 
                                    backgroundImage: `url(${style.backgroundImage})`,
                                    opacity: style.backgroundImageOpacity ?? 0.5
                                }}
                            ></div>
                        )}
                        <span className="relative z-10 leading-relaxed" style={{ color: style.textColor }}>
                            {isUser ? "这个样式看起来怎么样？" : "我觉得非常棒，完全符合人设！"}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col font-light relative">
            {/* Header */}
            <div className="h-20 bg-white/70 backdrop-blur-md flex items-end pb-3 px-4 border-b border-white/40 shrink-0 z-20 justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-medium text-slate-700">气泡工坊</h1>
                </div>
                <button onClick={saveTheme} className="px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/30 active:scale-95 transition-all">
                    保存
                </button>
            </div>

            {/* Preview Area (Realistic Chat Row) */}
            <div className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col p-6 justify-center items-center gap-6">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                {/* Live CSS Injection for Preview */}
                {editingTheme.customCss && <style>{editingTheme.customCss}</style>}

                {/* Simulated Chat Conversation */}
                <div className="w-full max-w-sm space-y-6">
                    {renderPreviewBubble('ai')}
                    {renderPreviewBubble('user')}
                </div>
                
                <div className="text-[10px] text-slate-400 absolute bottom-2">点击气泡可快速切换编辑对象</div>
            </div>

            {/* Editor Controls */}
            <div className="bg-white rounded-t-[2.5rem] shadow-[0_-5px_30px_rgba(0,0,0,0.08)] z-30 flex flex-col h-[55%] ring-1 ring-slate-100">
                {/* Main Tabs (User / AI / CSS) */}
                <div className="flex px-8 pt-6 pb-2 gap-6 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('user')} className={`text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'user' ? 'text-slate-800' : 'text-slate-300'}`}>用户气泡</button>
                    <button onClick={() => setActiveTab('ai')} className={`text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'ai' ? 'text-slate-800' : 'text-slate-300'}`}>角色气泡</button>
                    <button onClick={() => setActiveTab('css')} className={`text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${activeTab === 'css' ? 'text-indigo-600' : 'text-slate-300'}`}>
                        <span>⚡</span> 自定义CSS
                    </button>
                </div>

                {/* Conditional Sub-Tool Tabs */}
                {activeTab !== 'css' && (
                    <div className="flex px-6 border-b border-slate-100 mb-2 overflow-x-auto no-scrollbar">
                        <button onClick={() => setToolSection('base')} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${toolSection === 'base' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>基础样式</button>
                        <button onClick={() => setToolSection('sticker')} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${toolSection === 'sticker' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>气泡贴纸</button>
                        <button onClick={() => setToolSection('avatar')} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${toolSection === 'avatar' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>头像挂件</button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-20">
                    
                    {/* --- CSS EDITOR --- */}
                    {activeTab === 'css' && (
                        <div className="space-y-6 animate-fade-in h-full flex flex-col">
                            <div className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                                <span className="font-bold block mb-1 text-slate-500">CSS 增强模式</span>
                                可使用CSS类名 <code className="bg-slate-200 px-1 rounded">.sully-bubble-user</code> 和 <code className="bg-slate-200 px-1 rounded">.sully-bubble-ai</code> 来统一定制气泡样式。
                                <br/>支持使用 <code className="text-red-400">!important</code> 覆盖可视化编辑器的设置。
                            </div>

                            <textarea 
                                value={editingTheme.customCss || ''} 
                                onChange={(e) => setEditingTheme(prev => ({ ...prev, customCss: e.target.value }))}
                                placeholder="/* 在这里输入 CSS 代码 */"
                                className="flex-1 w-full bg-slate-800 text-slate-300 font-mono text-xs p-4 rounded-xl resize-none shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                                spellCheck={false}
                            />

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">快速模板 (Templates)</label>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    {CSS_EXAMPLES.map((ex, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setEditingTheme(prev => ({ ...prev, customCss: ex.code }))}
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-mono text-slate-600 border border-slate-200 whitespace-nowrap transition-colors"
                                        >
                                            {ex.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- BASE STYLE TOOLS --- */}
                    {activeTab !== 'css' && toolSection === 'base' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Name Input (Only on Base) */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">主题名称 (Theme Name)</label>
                                <input value={editingTheme.name} onChange={(e) => setEditingTheme(prev => ({...prev, name: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-primary/50 transition-all outline-none" placeholder="我的个性主题" />
                            </div>

                            {/* Colors */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">文字颜色</label>
                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100"><input type="color" value={activeStyle.textColor} onChange={(e) => updateStyle('textColor', e.target.value)} className="w-8 h-8 rounded-lg border-none cursor-pointer bg-transparent" /></div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">气泡颜色</label>
                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100"><input type="color" value={activeStyle.backgroundColor} onChange={(e) => updateStyle('backgroundColor', e.target.value)} className="w-8 h-8 rounded-lg border-none cursor-pointer bg-transparent" /></div>
                                </div>
                            </div>

                            {/* Background Image Logic */}
                            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group relative h-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 overflow-hidden hover:border-primary/50 hover:text-primary transition-all">
                                {activeStyle.backgroundImage ? (
                                    <>
                                        <img src={activeStyle.backgroundImage} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                        <span className="relative z-10 text-[10px] bg-white/80 px-2 py-1 rounded shadow-sm font-bold">更换底纹</span>
                                    </>
                                ) : <span className="text-xs font-bold">+ 上传底纹图片 (Texture)</span>}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'bg')} />
                                {activeStyle.backgroundImage && <button onClick={(e) => { e.stopPropagation(); updateStyle('backgroundImage', undefined); }} className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full z-20">移除</button>}
                            </div>

                            {/* Sliders */}
                            {activeStyle.backgroundImage && (
                                <div>
                                    <div className="flex justify-between mb-2"><label className="text-[10px] font-bold text-slate-400 uppercase">背景透明度</label><span className="text-[10px] text-slate-500 font-mono">{Math.round((activeStyle.backgroundImageOpacity ?? 0.5) * 100)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.05" value={activeStyle.backgroundImageOpacity ?? 0.5} onChange={(e) => updateStyle('backgroundImageOpacity', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary" />
                                </div>
                            )}
                            <div>
                                <div className="flex justify-between mb-2"><label className="text-[10px] font-bold text-slate-400 uppercase">圆角大小</label><span className="text-[10px] text-slate-500 font-mono">{activeStyle.borderRadius}px</span></div>
                                <input type="range" min="0" max="30" value={activeStyle.borderRadius} onChange={(e) => updateStyle('borderRadius', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary" />
                            </div>
                        </div>
                    )}

                    {/* --- STICKER TOOLS --- */}
                    {activeTab !== 'css' && toolSection === 'sticker' && (
                        <div className="space-y-6 animate-fade-in">
                            <div onClick={() => decorationInputRef.current?.click()} className="cursor-pointer group relative h-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-primary/50 hover:text-primary transition-all">
                                 {activeStyle.decoration ? <img src={activeStyle.decoration} className="h-10 w-10 object-contain" /> : <span className="text-xs font-bold">+ 上传气泡角标/贴纸</span>}
                                 <input type="file" ref={decorationInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'deco')} />
                                 {activeStyle.decoration && <button onClick={(e) => { e.stopPropagation(); updateStyle('decoration', undefined); }} className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">移除</button>}
                            </div>

                            {activeStyle.decoration && (
                                <div className="grid grid-cols-2 gap-x-6 gap-y-6 p-2">
                                    <div className="col-span-2"><label className="text-[10px] text-slate-400 uppercase block mb-2">位置坐标 (X / Y)</label>
                                        <div className="flex gap-3">
                                            <input type="range" min="-50" max="150" value={activeStyle.decorationX ?? 90} onChange={(e) => updateStyle('decorationX', parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-full accent-primary" />
                                            <input type="range" min="-50" max="150" value={activeStyle.decorationY ?? -10} onChange={(e) => updateStyle('decorationY', parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-full accent-primary" />
                                        </div>
                                    </div>
                                    <div><label className="text-[10px] text-slate-400 uppercase block mb-2">缩放 ({activeStyle.decorationScale ?? 1}x)</label>
                                        <input type="range" min="0.2" max="3" step="0.1" value={activeStyle.decorationScale ?? 1} onChange={(e) => updateStyle('decorationScale', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full accent-primary" />
                                    </div>
                                    <div><label className="text-[10px] text-slate-400 uppercase block mb-2">旋转 ({activeStyle.decorationRotate ?? 0}°)</label>
                                        <input type="range" min="-180" max="180" value={activeStyle.decorationRotate ?? 0} onChange={(e) => updateStyle('decorationRotate', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full accent-primary" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- AVATAR TOOLS --- */}
                    {activeTab !== 'css' && toolSection === 'avatar' && (
                        <div className="space-y-6 animate-fade-in">
                            <div onClick={() => avatarDecoInputRef.current?.click()} className="cursor-pointer group relative h-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-primary/50 hover:text-primary transition-all">
                                 {activeStyle.avatarDecoration ? <img src={activeStyle.avatarDecoration} className="h-10 w-10 object-contain" /> : <span className="text-xs font-bold">+ 上传头像框/挂件</span>}
                                 <input type="file" ref={avatarDecoInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatarDeco')} />
                                 {activeStyle.avatarDecoration && <button onClick={(e) => { e.stopPropagation(); updateStyle('avatarDecoration', undefined); }} className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">移除</button>}
                            </div>

                            {activeStyle.avatarDecoration && (
                                <div className="grid grid-cols-2 gap-x-6 gap-y-6 p-2">
                                    <div className="col-span-2"><label className="text-[10px] text-slate-400 uppercase block mb-2">中心偏移 (Offset X / Y)</label>
                                        <div className="flex gap-3">
                                            <input type="range" min="-50" max="150" value={activeStyle.avatarDecorationX ?? 50} onChange={(e) => updateStyle('avatarDecorationX', parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-full accent-primary" />
                                            <input type="range" min="-50" max="150" value={activeStyle.avatarDecorationY ?? 50} onChange={(e) => updateStyle('avatarDecorationY', parseInt(e.target.value))} className="flex-1 h-1.5 bg-slate-200 rounded-full accent-primary" />
                                        </div>
                                    </div>
                                    <div><label className="text-[10px] text-slate-400 uppercase block mb-2">缩放 ({activeStyle.avatarDecorationScale ?? 1}x)</label>
                                        <input type="range" min="0.5" max="3" step="0.1" value={activeStyle.avatarDecorationScale ?? 1} onChange={(e) => updateStyle('avatarDecorationScale', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full accent-primary" />
                                    </div>
                                    <div><label className="text-[10px] text-slate-400 uppercase block mb-2">旋转 ({activeStyle.avatarDecorationRotate ?? 0}°)</label>
                                        <input type="range" min="-180" max="180" value={activeStyle.avatarDecorationRotate ?? 0} onChange={(e) => updateStyle('avatarDecorationRotate', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-full accent-primary" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ThemeMaker;