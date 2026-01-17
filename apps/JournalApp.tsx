

import React, { useState, useEffect, useRef } from 'react';
import { useOS } from '../context/OSContext';
import { DB } from '../utils/db';
import { CharacterProfile, DiaryEntry, StickerData, MemoryFragment, DiaryPage } from '../types';
import { ContextBuilder } from '../utils/context';
import { processImage } from '../utils/file';
import Modal from '../components/os/Modal';

// --- Assets & Constants ---

const PAPER_STYLES = [
    { id: 'plain', name: '白纸', css: 'bg-white', text: 'text-slate-700' },
    { id: 'grid', name: '网格', css: 'bg-white', text: 'text-slate-700', style: { backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' } },
    { id: 'dot', name: '点阵', css: 'bg-[#fffdf5]', text: 'text-slate-700', style: { backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', backgroundSize: '20px 20px' } },
    { id: 'lined', name: '横线', css: 'bg-[#fefce8]', text: 'text-slate-700', style: { backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, #e5e7eb 23px, #e5e7eb 24px)' } },
    { id: 'dark', name: '夜空', css: 'bg-slate-800', text: 'text-white/90' },
    { id: 'pink', name: '少女', css: 'bg-pink-50', text: 'text-slate-700', style: { backgroundImage: 'radial-gradient(#fbcfe8 2px, transparent 2px)', backgroundSize: '30px 30px' } },
];

const DEFAULT_STICKERS = [
    '✨', '💖', '🌸', '🎀', '🍰', '🐱', '🐶', '☁️', '🌙', '⭐', '🎵', '🌿', '🍓', '🧸', '🎈', '💌', '💤', '🥺', '😡', '😭'
];

// HELPER: Get local date string YYYY-MM-DD
const getLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const JournalApp: React.FC = () => {
    const { closeApp, characters, activeCharacterId, apiConfig, addToast, userProfile, updateCharacter } = useOS();
    
    const [mode, setMode] = useState<'select' | 'calendar' | 'write'>('select');
    const [selectedChar, setSelectedChar] = useState<CharacterProfile | null>(null);
    const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
    const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
    // FIX: Use local date instead of UTC
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateStr());
    
    // Editor State
    const [isThinking, setIsThinking] = useState(false);
    const [showStickerPanel, setShowStickerPanel] = useState(false);
    const [activeTab, setActiveTab] = useState<'user' | 'char'>('user'); // View Tab
    
    // Sticker Interaction State
    const [draggingSticker, setDraggingSticker] = useState<string | null>(null);
    const paperRef = useRef<HTMLDivElement>(null);
    
    // Custom Stickers State
    const [customStickers, setCustomStickers] = useState<{name: string, url: string}[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [deletingSticker, setDeletingSticker] = useState<{name: string, url: string} | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Data Loading ---

    useEffect(() => {
        if (characters.length > 0 && activeCharacterId) {
            const initial = characters.find(c => c.id === activeCharacterId);
            if (initial) {
                setSelectedChar(initial);
                setMode('calendar');
                loadDiaries(initial.id);
            }
        }
        // Load custom stickers (reusing emoji store)
        DB.getEmojis().then(setCustomStickers);
    }, [activeCharacterId]);

    const loadDiaries = async (charId: string) => {
        const list = await DB.getDiariesByCharId(charId);
        setDiaries(list.sort((a, b) => b.date.localeCompare(a.date)));
    };

    const handleCharSelect = (char: CharacterProfile) => {
        setSelectedChar(char);
        setMode('calendar');
        loadDiaries(char.id);
    };

    const openEntry = (date: string) => {
        const existing = diaries.find(d => d.date === date);
        if (existing) {
            setCurrentEntry(existing);
            // Default to char tab if they replied
            setActiveTab(existing.charPage ? 'char' : 'user');
        } else {
            // New Entry
            setCurrentEntry({
                id: `diary-${Date.now()}`,
                charId: selectedChar!.id,
                date: date,
                userPage: { text: '', paperStyle: 'grid', stickers: [] },
                timestamp: Date.now(),
                isArchived: false
            });
            setActiveTab('user');
        }
        setMode('write');
        setSelectedDate(date);
    };

    // --- Editor Logic ---

    const updatePage = (updates: Partial<DiaryEntry['userPage']>, side: 'user' | 'char' = 'user') => {
        if (!currentEntry) return;
        const targetPage = side === 'user' ? 'userPage' : 'charPage';
        
        // If char page doesn't exist yet, init it
        let pageData = currentEntry[targetPage] || { text: '', paperStyle: 'plain', stickers: [] };
        
        setCurrentEntry(prev => {
            if (!prev) return null;
            return {
                ...prev,
                [targetPage]: { ...pageData, ...updates }
            };
        });
    };

    const addSticker = (url: string) => {
        const side = activeTab;
        const targetPage = side === 'user' ? currentEntry?.userPage : currentEntry?.charPage;
        if (!targetPage && side === 'char') return; // Cannot edit char page if it doesn't exist

        const newSticker: StickerData = {
            id: `st-${Date.now()}-${Math.random()}`,
            url,
            x: 50, // Default center
            y: 50,
            rotation: (Math.random() - 0.5) * 40
        };
        
        const currentStickers = targetPage?.stickers || [];
        updatePage({ stickers: [...currentStickers, newSticker] }, side);
        setShowStickerPanel(false);
    };

    const handleImportStickers = async () => {
        if (!importText.trim()) return;
        const lines = importText.split('\n');
        let count = 0;
        for (const line of lines) {
            const parts = line.split('--');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const url = parts.slice(1).join('--').trim();
                if (name && url) {
                    await DB.saveEmoji(name, url);
                    count++;
                }
            }
        }
        setCustomStickers(await DB.getEmojis());
        setImportText('');
        setShowImportModal(false);
        addToast(`成功添加 ${count} 个贴纸`, 'success');
    };

    const handleDeleteSticker = async () => {
        if (deletingSticker) {
            await DB.deleteEmoji(deletingSticker.name);
            setCustomStickers(prev => prev.filter(s => s.name !== deletingSticker.name));
            setDeletingSticker(null);
            addToast('贴纸已删除', 'success');
        }
    };

    const saveEntry = async () => {
        if (!currentEntry) return;
        await DB.saveDiary(currentEntry);
        await loadDiaries(currentEntry.charId);
        addToast('日记已保存', 'success');
    };

    // --- Sticker Dragging Logic ---

    const handlePointerDown = (e: React.PointerEvent, stickerId: string) => {
        if (activeTab === 'char' && currentEntry?.charPage) return; // Prevent editing char stickers unless strictly needed
        if (activeTab === 'user') {
             e.stopPropagation();
             e.currentTarget.setPointerCapture(e.pointerId);
             setDraggingSticker(stickerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingSticker || !paperRef.current || !currentEntry) return;

        const rect = paperRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Clamp values 0-100
        const clampedX = Math.max(0, Math.min(100, x));
        const clampedY = Math.max(0, Math.min(100, y));

        const targetPage = activeTab === 'user' ? currentEntry.userPage : currentEntry.charPage;
        if (!targetPage) return;

        const updatedStickers = targetPage.stickers.map(s => 
            s.id === draggingSticker ? { ...s, x: clampedX, y: clampedY } : s
        );

        updatePage({ stickers: updatedStickers }, activeTab);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setDraggingSticker(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Long press handler for drawer items
    const handleDrawerTouchStart = (s: {name: string, url: string}) => {
        longPressTimer.current = setTimeout(() => {
            setDeletingSticker(s);
        }, 600);
    };

    const handleDrawerTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // --- AI Interaction ---

    const handleExchange = async () => {
        if (!currentEntry || !selectedChar || !apiConfig.apiKey) {
            addToast('配置错误或内容为空', 'error');
            return;
        }
        if (!currentEntry.userPage.text.trim()) {
            addToast('请先写下今天的日记', 'info');
            return;
        }

        setIsThinking(true);
        saveEntry(); 

        try {
            // 1. Build Standardized Core Context
            let systemPrompt = ContextBuilder.buildCoreContext(selectedChar, userProfile);

            const styleOptions = PAPER_STYLES.map(p => p.id).join(', ');
            const defaultStickers = DEFAULT_STICKERS.join(' ');
            
            // Format custom stickers for prompt
            const customStickerContext = customStickers.length > 0 
                ? `Custom Stickers (Name: URL): \n${customStickers.map(s => `- ${s.name}: ${s.url}`).join('\n')}`
                : '';

            // 2. Fetch Recent Chat History for Context
            const recentMsgs = await DB.getMessagesByCharId(selectedChar.id);
            const contextLimit = 30; // Limit to last 30 messages to catch recent events
            const recentContext = recentMsgs.slice(-contextLimit).map(m => {
                const content = m.type === 'image' ? '[User sent an image]' : m.content;
                return `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role === 'user' ? 'User' : 'You'}: ${content}`;
            }).join('\n');

            // 3. Append Diary Instructions with Context
            systemPrompt += `### [Exchange Diary Mode Instructions]
你正在和用户进行【交换日记】互动。

### 关键：最近发生的互动 (Recent Context)
这是你们最近在聊天软件或见面时的对话记录。请**务必**阅读这些记录，并在日记中提及今天发生的具体事情（例如聊过的话题、去过的地方、用户发过的图片）。
不要只写空泛的回复，还要说一些用户不知道的，你自己没有说过的想法，和你自己独立于用户经历过的今天的事情。
[RECENT LOGS START]
${recentContext}
[RECENT LOGS END]

### 任务
1. 阅读用户今天的日记 (${currentEntry.date})。
2. 以你的角色口吻写一篇**回复日记**。
   - 首先回应用户的内容（吐槽、安慰、共鸣等）。
   - **结合上面的 [RECENT LOGS]**，回顾今天互动的细节。
   - 然后分享一些你自己生活中的琐事或心情，得是对方不知道的。
3. 选择适合你心情的信纸和贴纸。

### 关于贴纸 (Stickers)
你可以使用默认的 Emoji，也可以使用【Custom Stickers】。
${customStickerContext}
如果要使用 Custom Sticker，请将 URL 直接放入返回的 stickers 数组中。

### 输出格式 (必须是纯 JSON)
不要使用 markdown 代码块。直接返回 JSON 对象。
Structure:
{
  "text": "日记正文...",
  "paperStyle": "one of: ${styleOptions}",
  "stickers": ["sticker1", "http://custom-sticker-url..."] (从默认列表: ${defaultStickers} 或 Custom Stickers 中选0-3个)
}`;

            const response = await fetch(`${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Users Diary:\n${currentEntry.userPage.text}` }
                    ],
                    temperature: 0.85
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            let content = data.choices[0].message.content.trim();
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                parsed = { text: content, paperStyle: 'plain', stickers: [] };
            }

            const charStickers: StickerData[] = (parsed.stickers || []).map((s: string) => ({
                id: `st-${Math.random()}`,
                url: s,
                x: Math.random() * 70 + 10,
                y: Math.random() * 70 + 10,
                rotation: (Math.random() - 0.5) * 40
            }));

            const charPage: DiaryPage = {
                text: parsed.text || '',
                paperStyle: PAPER_STYLES.find(p => p.id === parsed.paperStyle)?.id || 'plain',
                stickers: charStickers
            };

            const updatedEntry = { ...currentEntry, charPage };
            setCurrentEntry(updatedEntry);
            await DB.saveDiary(updatedEntry);
            await loadDiaries(selectedChar.id);
            setActiveTab('char'); // Switch to see reply
            addToast('对方已回复', 'success');

        } catch (e: any) {
            addToast(`回复失败: ${e.message}`, 'error');
        } finally {
            setIsThinking(false);
        }
    };

    const handleArchive = async () => {
        if (!currentEntry || !selectedChar || currentEntry.isArchived) return;
        
        try {
            addToast('正在归档...', 'info');
            const prompt = `Task: 将这篇交换日记 (${currentEntry.date}) 总结为 ${selectedChar.name} 的一条记忆。
            
            User Diary: ${currentEntry.userPage.text}
            Char Diary: ${currentEntry.charPage?.text || ''}
            
            Output: 一句简短的总结 (中文)。`;
            
            const response = await fetch(`${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.3
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const summary = data.choices[0].message.content;
                
                const newMem: MemoryFragment = {
                    id: `mem-${Date.now()}`,
                    date: currentEntry.date,
                    summary,
                    mood: 'diary'
                };
                
                const updatedMems = [...selectedChar.memories, newMem];
                updateCharacter(selectedChar.id, { memories: updatedMems });
                
                const updatedDiary = { ...currentEntry, isArchived: true };
                setCurrentEntry(updatedDiary);
                await DB.saveDiary(updatedDiary);
                await loadDiaries(selectedChar.id);
                
                addToast('已归档至记忆库', 'success');
            }
        } catch (e) {
            addToast('归档失败', 'error');
        }
    };

    // --- Renderers ---

    const renderPage = (page: DiaryPage, side: 'user' | 'char') => {
        const style = PAPER_STYLES.find(s => s.id === page.paperStyle) || PAPER_STYLES[0];
        
        return (
            <div 
                ref={side === activeTab ? paperRef : undefined}
                className={`relative w-full h-full shadow-md transition-all duration-300 overflow-hidden ${style.css} flex flex-col rounded-3xl touch-none`}
                style={{ ...style.style }}
                onPointerMove={side === activeTab ? handlePointerMove : undefined}
                onPointerUp={side === activeTab ? handlePointerUp : undefined}
                onPointerLeave={side === activeTab ? handlePointerUp : undefined}
            >
                {/* Content Container */}
                <div className="flex-1 p-6 relative z-10 flex flex-col">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-black/5 shrink-0">
                        <span className={`text-xs font-bold uppercase tracking-widest opacity-50 ${style.text}`}>
                            {side === 'user' ? 'MY DIARY' : 'REPLY'}
                        </span>
                        <span className={`text-[10px] opacity-40 font-mono ${style.text}`}>
                            {currentEntry?.date}
                        </span>
                    </div>

                    <textarea 
                        value={page.text}
                        onChange={e => updatePage({ text: e.target.value }, side)}
                        placeholder={side === 'user' ? "记录今天发生的事情..." : "等待回复..."}
                        className={`flex-1 w-full bg-transparent resize-none outline-none leading-loose text-[16px] font-normal ${style.text} placeholder:opacity-30 no-scrollbar`}
                        readOnly={isThinking} 
                    />
                </div>

                {/* Stickers Layer */}
                {page.stickers.map(s => (
                    <div 
                        key={s.id} 
                        onPointerDown={(e) => handlePointerDown(e, s.id)}
                        className={`absolute text-6xl select-none drop-shadow-md z-20 cursor-move ${draggingSticker === s.id ? 'scale-110 opacity-90' : ''} transition-transform`}
                        style={{ 
                            left: `${s.x}%`, 
                            top: `${s.y}%`, 
                            transform: `translate(-50%, -50%) rotate(${s.rotation}deg)` 
                        }}
                    >
                        {s.url.startsWith('http') || s.url.startsWith('data') ? (
                            <img src={s.url} className="w-20 h-20 object-contain pointer-events-none" />
                        ) : s.url}
                    </div>
                ))}
                
                {/* Paper Texture Overlay (Subtle) */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] opacity-10 pointer-events-none z-0 mix-blend-multiply"></div>
            </div>
        );
    };

    if (mode === 'select') {
        return (
            <div className="h-full w-full bg-amber-50 flex flex-col font-light">
                {/* Fixed Status Bar overlap with pt-12 */}
                <div className="pt-12 pb-4 px-6 border-b border-amber-100 bg-amber-50/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between shrink-0 h-24 box-border">
                    <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-amber-100/50 active:scale-90 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-amber-900"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                    </button>
                    <span className="font-bold text-amber-900 text-lg tracking-wide">选择日记本</span>
                    <div className="w-8"></div>
                </div>
                
                <div className="p-6 grid grid-cols-2 gap-5 overflow-y-auto pb-20 no-scrollbar">
                    {characters.map(c => (
                        <div key={c.id} onClick={() => handleCharSelect(c)} className="aspect-[3/4] bg-white rounded-r-2xl rounded-l-md border-l-4 border-l-amber-800 shadow-[2px_4px_12px_rgba(0,0,0,0.08)] p-4 flex flex-col items-center justify-center gap-3 cursor-pointer active:scale-95 transition-all relative overflow-hidden group">
                            {/* Decorative Spine Shadow */}
                            <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/10 to-transparent"></div>
                            
                            <div className="w-16 h-16 rounded-full p-[2px] border border-amber-100 bg-amber-50">
                                <img src={c.avatar} className="w-full h-full rounded-full object-cover" />
                            </div>
                            <span className="font-bold text-amber-900 text-sm">{c.name}</span>
                            <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-mono uppercase tracking-wide">Journal</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (mode === 'calendar' && selectedChar) {
        return (
            <div className="h-full w-full bg-white flex flex-col font-light relative">
                {/* Expanded Header with pt-12 */}
                <div className="pt-12 pb-6 px-6 bg-amber-500 shadow-lg shrink-0 rounded-b-[2rem] z-20">
                    <div className="flex justify-between items-start mb-4">
                         <button onClick={() => setMode('select')} className="text-white/80 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                         </button>
                         <div className="w-6"></div>
                    </div>
                    <div className="text-white">
                        <div className="text-xs opacity-70 uppercase tracking-widest font-bold mb-1">Exchange Diary</div>
                        <div className="text-3xl font-bold tracking-tight">{selectedChar.name}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 pb-20 no-scrollbar">
                    {/* FIX: Use local date for creating new entry */}
                    <button onClick={() => openEntry(getLocalDateStr())} className="w-full py-5 mb-8 border-2 border-dashed border-amber-200 rounded-2xl text-amber-500 font-bold flex items-center justify-center gap-2 hover:bg-amber-50 active:scale-95 transition-all">
                        <span className="text-xl">+</span> 写今天的日记
                    </button>
                    
                    <div className="space-y-4">
                        {diaries.map(d => (
                            <div key={d.id} onClick={() => openEntry(d.date)} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition-all hover:shadow-md cursor-pointer relative overflow-hidden group">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                                <div className="w-14 h-14 bg-amber-50 rounded-xl flex flex-col items-center justify-center text-amber-800 shrink-0 border border-amber-100">
                                    <span className="text-[10px] font-bold opacity-60">{d.date.split('-')[1]}月</span>
                                    <span className="text-xl font-bold leading-none">{d.date.split('-')[2]}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 truncate font-medium">{d.userPage.text || '(空)'}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-xs text-slate-400 font-mono">{d.date.split('-')[0]}</p>
                                        <div className="flex gap-2">
                                            {d.charPage && <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-[9px] font-bold">已回复</span>}
                                            {d.isArchived && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[9px] font-bold">已归档</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // --- WRITE MODE (Fullscreen Single Page) ---
    return (
        <div className="h-full w-full bg-[#1a1a1a] flex flex-col relative overflow-hidden">
            
            {/* 1. Editor Header with pt-12 safe area */}
            <div className="pt-12 pb-3 px-4 bg-[#1a1a1a]/90 backdrop-blur-md flex items-center justify-between text-white shrink-0 z-30 h-24 box-border">
                <button onClick={() => setMode('calendar')} className="p-2 -ml-2 text-white/60 hover:text-white rounded-full active:bg-white/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <div className="flex gap-3">
                    {currentEntry?.charPage && !currentEntry.isArchived && (
                        <button onClick={handleArchive} className="px-4 py-1.5 bg-emerald-600/90 rounded-full text-xs font-bold shadow-lg shadow-emerald-900/50 active:scale-95 transition-transform">
                            归档记忆
                        </button>
                    )}
                    <button onClick={saveEntry} className="px-4 py-1.5 bg-white/10 rounded-full text-xs font-bold hover:bg-white/20 active:scale-95 transition-transform">
                        保存
                    </button>
                </div>
            </div>

            {/* 2. Main Page Area */}
            <div className="flex-1 relative w-full overflow-hidden flex flex-col">
                <div className="flex-1 w-full max-w-xl mx-auto px-2 pb-4 pt-2 flex flex-col relative">
                    
                    {/* The Page Itself */}
                    <div className="flex-1 relative rounded-3xl transition-all duration-500">
                        {activeTab === 'user' && currentEntry && renderPage(currentEntry.userPage, 'user')}
                        
                        {activeTab === 'char' && (
                            currentEntry?.charPage ? renderPage(currentEntry.charPage, 'char') : (
                                <div className="w-full h-full bg-[#252525] rounded-3xl border border-white/5 flex flex-col items-center justify-center text-white/40 gap-4 p-8 text-center">
                                    <div className="text-5xl opacity-20 animate-pulse">💌</div>
                                    {isThinking ? (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-amber-500">对方正在阅读你的日记...</p>
                                            <div className="flex justify-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-100"></div>
                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-200"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm">写完日记后，点击下方按钮<br/>邀请 {selectedChar?.name} 交换日记。</p>
                                            <button 
                                                onClick={handleExchange} 
                                                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 transition-all mt-2"
                                            >
                                                查看 TA 的今日
                                            </button>
                                        </>
                                    )}
                                </div>
                            )
                        )}
                    </div>

                </div>
            </div>

            {/* 3. Bottom Controls */}
            <div className="shrink-0 bg-[#222] border-t border-white/5 pb-safe pt-2 z-30">
                {/* Page Switcher Tabs */}
                <div className="flex justify-center gap-4 mb-4 px-4">
                    <button 
                        onClick={() => setActiveTab('user')}
                        className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden ${activeTab === 'user' ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                        My Diary
                    </button>
                    <button 
                        onClick={() => setActiveTab('char')}
                        className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden ${activeTab === 'char' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                        {selectedChar?.name || 'Partner'}
                        {currentEntry?.charPage && activeTab !== 'char' && <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full shadow-sm animate-pulse"></div>}
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 pb-4">
                    <div className="flex gap-3 bg-[#111] p-1.5 rounded-full border border-white/10">
                        {PAPER_STYLES.slice(0, 4).map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => updatePage({ paperStyle: s.id }, activeTab)}
                                className={`w-8 h-8 rounded-full border border-white/10 transition-transform active:scale-90 ${s.css}`}
                                title={s.name}
                            />
                        ))}
                    </div>
                    
                    <div className="flex gap-3">
                        {/* Regenerate Button (Only visible on char page if reply exists) */}
                        {activeTab === 'char' && currentEntry?.charPage && !isThinking && (
                            <button onClick={handleExchange} className="w-11 h-11 bg-white/10 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform border border-white/5">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                            </button>
                        )}
                        
                        <button 
                            onClick={() => setShowStickerPanel(!showStickerPanel)} 
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-lg active:scale-90 transition-transform ${showStickerPanel ? 'bg-white text-black' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'}`}
                        >
                            ✨
                        </button>
                    </div>
                </div>

                {/* Sticker Drawer */}
                {showStickerPanel && (
                    <div className="bg-[#1a1a1a] border-t border-white/10 p-4 animate-slide-up h-48 overflow-y-auto no-scrollbar">
                        <div className="grid grid-cols-6 gap-3">
                            <button onClick={() => setShowImportModal(true)} className="flex items-center justify-center bg-white/10 rounded-xl border-2 border-dashed border-white/20 text-white/50 text-xl font-bold hover:bg-white/20 hover:text-white transition-all aspect-square">
                                +
                            </button>
                            {DEFAULT_STICKERS.map((s, i) => (
                                <button key={`def-${i}`} onClick={() => addSticker(s)} className="text-3xl hover:scale-110 transition-transform p-2 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center">
                                    {s}
                                </button>
                            ))}
                            {customStickers.map((s, i) => (
                                <button 
                                    key={`cust-${i}`} 
                                    onClick={() => addSticker(s.url)} 
                                    onTouchStart={() => handleDrawerTouchStart(s)}
                                    onTouchEnd={handleDrawerTouchEnd}
                                    onMouseDown={() => handleDrawerTouchStart(s)}
                                    onMouseUp={handleDrawerTouchEnd}
                                    onMouseLeave={handleDrawerTouchEnd}
                                    onContextMenu={(e) => { e.preventDefault(); setDeletingSticker(s); }}
                                    className="p-2 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center relative active:scale-95 transition-transform"
                                >
                                    <img src={s.url} className="w-8 h-8 object-contain pointer-events-none" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sticker Import Modal */}
            <Modal 
                isOpen={showImportModal} title="添加贴纸" onClose={() => setShowImportModal(false)}
                footer={<button onClick={handleImportStickers} className="w-full py-3 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all">确认添加</button>}
            >
                <div className="space-y-3">
                    <p className="text-xs text-slate-500">格式：贴纸名称--图片URL (每行一个)</p>
                    <textarea 
                        value={importText} 
                        onChange={e => setImportText(e.target.value)} 
                        placeholder={`CoolCat--https://...\nHeart--https://...`}
                        className="w-full h-32 bg-slate-100 rounded-2xl p-4 text-sm resize-none focus:outline-none text-slate-700"
                    />
                </div>
            </Modal>

            {/* Sticker Delete Confirmation Modal */}
            <Modal 
                isOpen={!!deletingSticker} title="删除贴纸" onClose={() => setDeletingSticker(null)}
                footer={<div className="flex gap-2 w-full"><button onClick={() => setDeletingSticker(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold">取消</button><button onClick={handleDeleteSticker} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold">删除</button></div>}
            >
                <div className="flex flex-col items-center gap-3 py-2">
                    {deletingSticker && <img src={deletingSticker.url} className="w-16 h-16 object-contain rounded-lg bg-slate-100 border" />}
                    <p className="text-sm text-slate-600">确定要删除这个贴纸吗？</p>
                </div>
            </Modal>
        </div>
    );
};

export default JournalApp;