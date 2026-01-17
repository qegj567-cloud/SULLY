
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { useOS } from '../context/OSContext';
import { DB, ScheduledMessage } from '../utils/db';
import { Message, MessageType, ChatTheme, BubbleStyle, MemoryFragment } from '../types';
import Modal from '../components/os/Modal';
import { processImage } from '../utils/file';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ContextBuilder } from '../utils/context';

// Built-in presets map to the new data structure for consistency
const PRESET_THEMES: Record<string, ChatTheme> = {
    default: {
        id: 'default', name: 'Indigo', type: 'preset',
        user: { textColor: '#ffffff', backgroundColor: '#6366f1', borderRadius: 20, opacity: 1, backgroundImageOpacity: 0.5 }, 
        ai: { textColor: '#1e293b', backgroundColor: '#ffffff', borderRadius: 20, opacity: 1, backgroundImageOpacity: 0.5 }
    },
    dream: {
        id: 'dream', name: 'Dream', type: 'preset',
        user: { textColor: '#ffffff', backgroundColor: '#f472b6', borderRadius: 20, opacity: 1, backgroundImageOpacity: 0.5 },
        ai: { textColor: '#1e293b', backgroundColor: '#ffffff', borderRadius: 20, opacity: 1, backgroundImageOpacity: 0.5 }
    },
    forest: {
        id: 'forest', name: 'Forest', type: 'preset',
        user: { textColor: '#ffffff', backgroundColor: '#10b981', borderRadius: 20, opacity: 1, backgroundImageOpacity: 0.5 },
        ai: { textColor: '#1e293b', backgroundColor: '#ffffff', borderRadius: 20, opacity: 1, backgroundImageOpacity: 0.5 }
    },
};

interface MessageItemProps {
    msg: Message;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
    activeTheme: ChatTheme;
    charAvatar: string;
    charName: string;
    userAvatar: string; 
    onLongPress: (m: Message) => void;
}

const MessageItem = React.memo(({ msg: m, isFirstInGroup, isLastInGroup, activeTheme, charAvatar, charName, userAvatar, onLongPress }: MessageItemProps) => {
    const isUser = m.role === 'user';
    const isSystem = m.role === 'system';
    const marginBottom = isLastInGroup ? 'mb-6' : 'mb-1.5';
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const styleConfig = isUser ? activeTheme.user : activeTheme.ai;

    const handleTouchStart = () => {
        longPressTimer.current = setTimeout(() => onLongPress(m), 600);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const interactionProps = {
        onMouseDown: handleTouchStart,
        onMouseUp: handleTouchEnd,
        onMouseLeave: handleTouchEnd,
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            onLongPress(m);
        }
    };

    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Render Avatar with potential decoration/frame
    const renderAvatar = (src: string) => (
        <div className="relative w-9 h-9 shrink-0 self-end mb-5 z-0">
            {isLastInGroup && (
                <>
                    <img 
                        src={src} 
                        className="w-full h-full rounded-full object-cover shadow-sm ring-1 ring-black/5 relative z-0" 
                        alt="avatar" 
                        loading="lazy" 
                        decoding="async" 
                    />
                    {styleConfig.avatarDecoration && (
                        <img 
                            src={styleConfig.avatarDecoration}
                            className="absolute pointer-events-none z-10 max-w-none"
                            style={{
                                left: `${styleConfig.avatarDecorationX ?? 50}%`,
                                top: `${styleConfig.avatarDecorationY ?? 50}%`,
                                width: `${36 * (styleConfig.avatarDecorationScale ?? 1)}px`, // Base size 36px (w-9)
                                height: 'auto',
                                transform: `translate(-50%, -50%) rotate(${styleConfig.avatarDecorationRotate ?? 0}deg)`,
                            }}
                        />
                    )}
                </>
            )}
        </div>
    );

    // --- SYSTEM MESSAGE RENDERING ---
    if (isSystem) {
        // Clean up text: remove [System:] or [系统:] prefix for display
        const displayText = m.content.replace(/^\[(System|系统|System Log|系统记录)\s*[:：]?\s*/i, '').replace(/\]$/, '').trim();
        
        return (
            <div className="flex justify-center my-6 px-10 animate-fade-in">
                <div className="flex items-center gap-1.5 bg-slate-200/40 backdrop-blur-md text-slate-500 px-3 py-1 rounded-full shadow-sm border border-white/20 select-none">
                    {/* Optional Icon based on content */}
                    {displayText.includes('任务') ? '✨' : 
                     displayText.includes('纪念日') || displayText.includes('Event') ? '📅' :
                     displayText.includes('转账') ? '💰' : '🔔'}
                    <span className="text-[10px] font-medium tracking-wide">{displayText}</span>
                </div>
            </div>
        );
    }

    if (m.type === 'interaction') {
        return (
            <div className={`flex flex-col items-center ${marginBottom} w-full animate-fade-in`}>
                <div className="text-[10px] text-slate-400 mb-1 opacity-70">{formatTime(m.timestamp)}</div>
                <div className="group relative cursor-pointer active:scale-95 transition-transform" {...interactionProps}>
                        <div className="text-[11px] text-slate-500 bg-slate-200/50 backdrop-blur-sm px-4 py-1.5 rounded-full flex items-center gap-1.5 border border-white/40 shadow-sm select-none">
                        <span className="group-hover:animate-bounce">👉</span>
                        <span className="font-medium opacity-80">{isUser ? '你' : charName}</span>
                        <span className="opacity-60">戳了戳</span>
                        <span className="font-medium opacity-80">{isUser ? charName : '你'}</span>
                    </div>
                </div>
            </div>
        );
    }

    const commonLayout = (content: React.ReactNode) => (
            <div className={`flex items-end ${isUser ? 'justify-end' : 'justify-start'} ${marginBottom} px-3 group select-none relative`}>
                {!isUser && <div className="mr-3">{renderAvatar(charAvatar)}</div>}
                
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`} {...interactionProps}>
                    {content}
                    {isLastInGroup && <div className="text-[9px] text-slate-400/80 px-1 mt-1 font-medium">{formatTime(m.timestamp)}</div>}
                </div>

                {isUser && <div className="ml-3">{renderAvatar(userAvatar)}</div>}
            </div>
    );

    if (m.type === 'transfer') {
        return commonLayout(
            <div className="w-64 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden group active:scale-[0.98] transition-transform">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.324.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" /><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V6Z" clipRule="evenodd" /><path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z" /></svg></div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75-.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd" /><path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z" /></svg></div>
                        <span className="font-medium text-white/90">Sully Pay</span>
                    </div>
                    <div className="text-2xl font-bold tracking-tight mb-1">₩ {m.metadata?.amount}</div>
                    <div className="text-[10px] text-white/70">转账给{isUser ? charName : '你'}</div>
            </div>
        );
    }

    if (m.type === 'emoji') {
        return commonLayout(
            <img src={m.content} className="max-w-[160px] max-h-[160px] rounded-2xl hover:scale-105 transition-transform shadow-md active:scale-95" loading="lazy" decoding="async" />
        );
    }

    if (m.type === 'image') {
        return commonLayout(
            <div className="relative group">
                <img src={m.content} className="max-w-[200px] max-h-[300px] rounded-2xl shadow-sm border border-black/5" alt="Uploaded" loading="lazy" decoding="async" />
            </div>
        );
    }

    // --- Dynamic Style Generation for Bubble ---
    const radius = styleConfig.borderRadius;
    let borderObj: React.CSSProperties = {};
    
    // Border Radius Logic
    if (!isFirstInGroup && !isLastInGroup) {
        borderObj = isUser 
            ? { borderRadius: `${radius}px`, borderTopRightRadius: '4px', borderBottomRightRadius: '4px' }
            : { borderRadius: `${radius}px`, borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' };
    } else if (isFirstInGroup && !isLastInGroup) {
        borderObj = isUser
            ? { borderRadius: `${radius}px`, borderBottomRightRadius: '4px' }
            : { borderRadius: `${radius}px`, borderBottomLeftRadius: '4px' };
    } else if (!isFirstInGroup && isLastInGroup) {
        borderObj = isUser
            ? { borderRadius: `${radius}px`, borderTopRightRadius: '4px' }
            : { borderRadius: `${radius}px`, borderTopLeftRadius: '4px' };
    } else {
            borderObj = isUser
            ? { borderRadius: `${radius}px`, borderBottomRightRadius: '2px' }
            : { borderRadius: `${radius}px`, borderBottomLeftRadius: '2px' };
    }

    // Container style (BackgroundColor + Opacity)
    const containerStyle: React.CSSProperties = {
        backgroundColor: styleConfig.backgroundColor,
        opacity: styleConfig.opacity, // Overall container opacity
        ...borderObj,
    };

    // --- Enhanced Text Rendering (Markdown Lite) ---
    const renderContent = (text: string) => {
        // 1. Split by Code Blocks
        const parts = text.split(/(```[\s\S]*?```)/g);
        return parts.map((part, index) => {
            // Render Code Block
            if (part.startsWith('```') && part.endsWith('```')) {
                const codeContent = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                return (
                    <pre key={index} className="bg-black/80 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2 whitespace-pre shadow-inner border border-white/10">
                        {codeContent}
                    </pre>
                );
            }
            
            // Render Regular Text (split by newlines for paragraph spacing)
            return part.split('\n').map((line, lineIdx) => {
                const key = `${index}-${lineIdx}`;
                
                // Quote Format "> text"
                if (line.trim().startsWith('>')) {
                    const quoteText = line.trim().substring(1).trim();
                    if (!quoteText) return null;
                    return (
                        <div key={key} className="my-1 pl-2.5 border-l-[3px] border-current opacity-70 italic text-[13px]">
                            {quoteText}
                        </div>
                    );
                }
                
                // Inline Bold Parsing (**text**)
                // A simple split by ** works for basic cases
                const boldSegments = line.split(/(\*\*.*?\*\*)/g);
                const renderedLine = boldSegments.map((seg, i) => {
                    if (seg.startsWith('**') && seg.endsWith('**')) {
                        return <strong key={i} className="font-bold">{seg.slice(2, -2)}</strong>;
                    }
                    return seg;
                });

                return <div key={key} className="min-h-[1.2em]">{renderedLine}</div>;
            });
        });
    };

    return commonLayout(
        <div className="relative shadow-sm px-5 py-3 animate-fade-in border border-black/5 active:scale-[0.98] transition-transform overflow-hidden" style={containerStyle}>
            
            {/* Layer 1: Background Image with Independent Opacity */}
            {styleConfig.backgroundImage && (
                <div 
                    className="absolute inset-0 bg-cover bg-center pointer-events-none z-0"
                    style={{ 
                        backgroundImage: `url(${styleConfig.backgroundImage})`,
                        opacity: styleConfig.backgroundImageOpacity ?? 0.5 
                    }}
                />
            )}

            {/* Layer 2: Decoration Sticker (Custom Position) */}
            {styleConfig.decoration && (
                <img 
                    src={styleConfig.decoration} 
                    className="absolute z-10 w-8 h-8 object-contain drop-shadow-sm pointer-events-none" 
                    style={{ 
                        left: `${styleConfig.decorationX ?? (isUser ? 90 : 10)}%`,
                        top: `${styleConfig.decorationY ?? -10}%`,
                        transform: `translate(-50%, -50%) scale(${styleConfig.decorationScale ?? 1}) rotate(${styleConfig.decorationRotate ?? 0}deg)`
                    }}
                    alt=""
                />
            )}

            {/* Layer 3: Text Content */}
            <div className="relative z-10 text-[15px] leading-relaxed break-words" style={{ color: styleConfig.textColor }}>
                {renderContent(m.content)}
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.msg.id === next.msg.id && 
           prev.msg.content === next.msg.content &&
           prev.isFirstInGroup === next.isFirstInGroup &&
           prev.isLastInGroup === next.isLastInGroup &&
           prev.activeTheme === next.activeTheme;
});


const Chat: React.FC = () => {
    const { characters, activeCharacterId, setActiveCharacterId, updateCharacter, apiConfig, closeApp, customThemes, removeCustomTheme, addToast, userProfile, lastMsgTimestamp } = useOS();
    const [messages, setMessages] = useState<Message[]>([]);
    const [visibleCount, setVisibleCount] = useState(30);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [recallStatus, setRecallStatus] = useState<string>('');
    const [showPanel, setShowPanel] = useState<'none' | 'actions' | 'emojis' | 'chars'>('none');
    const [emojis, setEmojis] = useState<{name: string, url: string}[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const chatImageInputRef = useRef<HTMLInputElement>(null);

    // Stats
    const [lastTokenUsage, setLastTokenUsage] = useState<number | null>(null);

    const [modalType, setModalType] = useState<'none' | 'transfer' | 'emoji-import' | 'chat-settings' | 'message-options' | 'edit-message' | 'delete-emoji'>('none');
    const [transferAmt, setTransferAmt] = useState('');
    const [emojiImportText, setEmojiImportText] = useState('');
    const [settingsContextLimit, setSettingsContextLimit] = useState(500);
    const [preserveContext, setPreserveContext] = useState(true); 
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [selectedEmoji, setSelectedEmoji] = useState<{name: string, url: string} | null>(null);
    const [editContent, setEditContent] = useState('');
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    const char = characters.find(c => c.id === activeCharacterId) || characters[0];
    const currentThemeId = char?.bubbleStyle || 'default';
    const activeTheme = useMemo(() => customThemes.find(t => t.id === currentThemeId) || PRESET_THEMES[currentThemeId] || PRESET_THEMES.default, [currentThemeId, customThemes]);
    const draftKey = `chat_draft_${activeCharacterId}`;

    useEffect(() => {
        if (activeCharacterId) {
            DB.getMessagesByCharId(activeCharacterId).then(setMessages);
            DB.getEmojis().then(setEmojis);
            const savedDraft = localStorage.getItem(draftKey);
            setInput(savedDraft || '');
            if (char) setSettingsContextLimit(char.contextLimit || 500);
            setVisibleCount(30);
            setLastTokenUsage(null);
        }
    }, [activeCharacterId]);

    // New: Listen for global scheduled message signals
    useEffect(() => {
        if (activeCharacterId && lastMsgTimestamp > 0) {
            DB.getMessagesByCharId(activeCharacterId).then(setMessages);
        }
    }, [lastMsgTimestamp]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
        if (val.trim()) localStorage.setItem(draftKey, val);
        else localStorage.removeItem(draftKey);
    };

    useLayoutEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, activeCharacterId]);

    useEffect(() => {
        if (isTyping && scrollRef.current) {
             scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isTyping, recallStatus]);

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };
    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    };

    const getDetailedLogsForMonth = (year: string, month: string) => {
        if (!char.memories) return null;
        const target = `${year}-${month.padStart(2, '0')}`;
        const logs = char.memories.filter(m => {
            return m.date.includes(target) || m.date.includes(`${year}年${parseInt(month)}月`);
        });
        
        if (logs.length === 0) return null;
        return logs.map(m => `[${m.date}] (${m.mood || 'normal'}): ${m.summary}`).join('\n');
    };

    const getTimeGapHint = (lastMsg: Message | undefined, currentTimestamp: number): string => {
        if (!lastMsg) return '';
        const diffMs = currentTimestamp - lastMsg.timestamp;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const currentHour = new Date(currentTimestamp).getHours();
        const isNight = currentHour >= 23 || currentHour <= 6;
        if (diffMins < 10) return ''; 
        if (diffMins < 60) return `[系统提示: 距离上一条消息: ${diffMins} 分钟。短暂的停顿。]`;
        if (diffHours < 6) {
            if (isNight) return `[系统提示: 距离上一条消息: ${diffHours} 小时。现在是深夜/清晨。沉默是正常的（正在睡觉）。]`;
            return `[系统提示: 距离上一条消息: ${diffHours} 小时。用户离开了一会儿。]`;
        }
        if (diffHours < 24) return `[系统提示: 距离上一条消息: ${diffHours} 小时。很长的间隔。]`;
        const days = Math.floor(diffHours / 24);
        return `[系统提示: 距离上一条消息: ${days} 天。用户消失了很久。请根据你们的关系做出反应（想念、生气、担心或冷漠）。]`;
    };

    // --- AI Logic ---

    const triggerAI = async (currentMsgs: Message[]) => {
        if (isTyping || !char) return;
        if (!apiConfig.baseUrl) { alert("请先在设置中配置 API URL"); return; }

        setIsTyping(true);
        setRecallStatus('');

        try {
            const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey || 'sk-none'}` };

            // 1. Build Standardized System Prompt using ContextBuilder
            // This now automatically includes Identity, Worldview, Refined Memories, and Active Logs
            let baseSystemPrompt = ContextBuilder.buildCoreContext(char, userProfile);

            // 2. Append Chat-Specific Instructions
            const emojiNames = emojis.map(e => e.name).join(', ');
            baseSystemPrompt += `### 聊天 App 行为规范 (Chat App Rules)
1. **沉浸感**: 保持角色扮演。使用适合即时通讯(IM)的口语化短句。
2. **行为模式**: 不要总是围绕用户转。分享你自己的生活、想法或随意的观察。有时候要“任性”或“以自我为中心”一点，这更像真人，具体的程度视你的性格而定。
3. **格式要求**:
   - 将回复拆分成简短的气泡（句子）。内部使用句号"。"作为气泡分隔符。
   - 【严禁】在输出中包含时间戳、名字前缀或"[角色名]:"。
   - **【严禁】模仿历史记录中的系统日志格式（如"[你 发送了...]"）。**
   - **发送表情包**: 必须且只能使用命令: \`[[SEND_EMOJI: 表情名称]]\`。可用表情: [${emojiNames || '无'}]。
4. **环境感知**:
   - 留意 [系统提示] 中的时间跨度。如果用户消失了很久，请根据你们的关系做出反应（如撒娇、生气、担心或冷漠）。
   - 如果用户发送了图片，请对图片内容进行评论。
5. **可用动作**:
   - 回戳用户: \`[[ACTION:POKE]]\`
   - 转账: \`[[ACTION:TRANSFER:100]]\`
   - 调取记忆: \`[[RECALL: YYYY-MM]]\`
   - **添加纪念日**: 如果你觉得今天是个值得纪念的日子（或者你们约定了某天），你可以**主动**将它添加到用户的日历中。单独起一行输出: \`[[ACTION:ADD_EVENT | 标题(Title) | YYYY-MM-DD]]\`。
   - **定时发送消息**: 如果你想在未来某个时间主动发消息（比如晚安、早安或提醒），请单独起一行输出: \`[schedule_message | YYYY-MM-DD HH:MM:SS | fixed | 消息内容]\`。`;

            // INJECT SYSTEM NOTE IF SWITCHING FROM DATE MODE
            // Check the message immediately preceding the latest one (which is the user's input).
            // If that message was from Date mode, tell AI to switch back.
            const previousMsg = currentMsgs.length > 1 ? currentMsgs[currentMsgs.length - 2] : null;
            if (previousMsg && previousMsg.metadata?.source === 'date') {
                baseSystemPrompt += `\n\n[System Note: You just finished a face-to-face meeting. You are now back on the phone. Switch back to texting style.]`;
            }

            const limit = char.contextLimit || 500;
            const historySlice = currentMsgs.slice(-limit);
            
            let timeGapHint = "";
            if (historySlice.length >= 2) {
                const lastMsg = currentMsgs[currentMsgs.length - 2];
                const currentMsg = currentMsgs[currentMsgs.length - 1];
                if (lastMsg && currentMsg) timeGapHint = getTimeGapHint(lastMsg, currentMsg.timestamp);
            }

            const buildHistory = (msgs: Message[]) => msgs.map((m, index) => {
                let content: any = m.content;
                const timeStr = `[${formatDate(m.timestamp)}]`;
                
                if (m.type === 'image') {
                     let textPart = `${timeStr} [User sent an image]`;
                     if (index === msgs.length - 1 && timeGapHint && m.role === 'user') {
                         textPart += `\n\n${timeGapHint}`;
                     }
                     return {
                         role: m.role,
                         content: [
                             { type: "text", text: textPart },
                             { type: "image_url", image_url: { url: m.content } }
                         ]
                     };
                }

                if (index === msgs.length - 1 && timeGapHint && m.role === 'user') content = `${content}\n\n${timeGapHint}`; 

                // Localized System Logs for Context
                if (m.type === 'interaction') content = `${timeStr} [系统: 用户戳了你一下]`; 
                else if (m.type === 'transfer') content = `${timeStr} [系统: 用户转账 ${m.metadata?.amount}]`;
                else if (m.type === 'emoji') {
                     const stickerName = emojis.find(e => e.url === m.content)?.name || 'Image/Sticker';
                     content = `${timeStr} [${m.role === 'user' ? '用户' : '你'} 发送了表情包: ${stickerName}]`;
                }
                else content = `${timeStr} ${content}`;

                return { role: m.role, content };
            });

            let apiMessages = [
                { role: 'system', content: baseSystemPrompt },
                ...buildHistory(historySlice)
            ];

            let response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ model: apiConfig.model, messages: apiMessages, temperature: 0.85, stream: false })
            });

            if (!response.ok) throw new Error(`API Error ${response.status}`);
            let data = await response.json();
            
            // Extract Token Stats
            if (data.usage && data.usage.total_tokens) {
                setLastTokenUsage(data.usage.total_tokens);
            }

            let aiContent = data.choices?.[0]?.message?.content || '';

            // ... (Rest of message processing logic - refined) ...
            aiContent = aiContent.replace(/\[\d{4}[-/年]\d{1,2}[-/月]\d{1,2}.*?\]/g, '');
            aiContent = aiContent.replace(/^[\w\u4e00-\u9fa5]+:\s*/, ''); 

            // 0. Pre-process: Handle AI Hallucinating System Logs as Emoji
            // Regex to catch: [你 发送了表情包: name] or [你发送了表情包：name]
            aiContent = aiContent.replace(/\[(?:你|User|用户|System)\s*发送了表情包[:：]\s*(.*?)\]/g, '[[SEND_EMOJI: $1]]');

            // 3. RECALL Logic (Explicit recall still works alongside passive injection)
            const recallMatch = aiContent.match(/\[\[RECALL:\s*(\d{4})[-/年](\d{1,2})\]\]/);
            if (recallMatch) {
                const year = recallMatch[1];
                const month = recallMatch[2];
                setRecallStatus(`正在调阅 ${year}年${month}月 的详细档案...`);
                const detailedLogs = getDetailedLogsForMonth(year, month);
                
                if (detailedLogs) {
                    const injectionMessage = {
                        role: 'system', 
                        content: `[系统: 已成功调取 ${year}-${month} 的详细日志]\n${detailedLogs}\n[系统: 现在请结合这些细节回答用户。保持对话自然。]`
                    };
                    apiMessages = [...apiMessages, injectionMessage];
                    response = await fetch(`${baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ model: apiConfig.model, messages: apiMessages, temperature: 0.8, stream: false })
                    });
                    if (response.ok) {
                        data = await response.json();
                        aiContent = data.choices?.[0]?.message?.content || '';
                        aiContent = aiContent.replace(/\[\d{4}[-/年]\d{1,2}[-/月]\d{1,2}.*?\]/g, '');
                        aiContent = aiContent.replace(/^[\w\u4e00-\u9fa5]+:\s*/, '');
                        // Re-run the anti-hallucination replacement just in case
                        aiContent = aiContent.replace(/\[(?:你|User|用户|System)\s*发送了表情包[:：]\s*(.*?)\]/g, '[[SEND_EMOJI: $1]]');
                        addToast(`已调用 ${year}-${month} 详细记忆`, 'info');
                    }
                }
            }
            setRecallStatus('');

            if (aiContent.includes('[[ACTION:POKE]]')) {
                await DB.saveMessage({ charId: char.id, role: 'assistant', type: 'interaction', content: '[戳一戳]' });
                aiContent = aiContent.replace('[[ACTION:POKE]]', '').trim();
            }
            
            const transferMatch = aiContent.match(/\[\[ACTION:TRANSFER:(\d+)\]\]/);
            if (transferMatch) {
                await DB.saveMessage({ charId: char.id, role: 'assistant', type: 'transfer', content: '[转账]', metadata: { amount: transferMatch[1] } });
                aiContent = aiContent.replace(transferMatch[0], '').trim();
            }

            // NEW: Add Event Action
            const eventMatch = aiContent.match(/\[\[ACTION:ADD_EVENT\s*\|\s*(.*?)\s*\|\s*(.*?)\]\]/);
            if (eventMatch) {
                const title = eventMatch[1].trim();
                const date = eventMatch[2].trim();
                
                if (title && date) {
                    const anni: any = {
                        id: `anni-${Date.now()}`,
                        title: title,
                        date: date,
                        charId: char.id
                    };
                    await DB.saveAnniversary(anni);
                    addToast(`${char.name} 添加了新日程: ${title}`, 'success');
                    
                    // Add System Message to log this (Localized)
                    await DB.saveMessage({
                        charId: char.id,
                        role: 'system',
                        type: 'text',
                        content: `[系统: ${char.name} 新增了日程 "${title}" (${date})]`
                    });
                }
                aiContent = aiContent.replace(eventMatch[0], '').trim();
            }

            // Loop for Emojis
            while (true) {
                const match = aiContent.match(/\[\[SEND_EMOJI:\s*(.*?)\]\]/);
                if (!match) break;
                
                const emojiName = match[1].trim();
                const foundEmoji = emojis.find(e => e.name === emojiName);
                if (foundEmoji) {
                    await DB.saveMessage({ charId: char.id, role: 'assistant', type: 'emoji', content: foundEmoji.url });
                }
                aiContent = aiContent.replace(match[0], '').trim();
            }

            const scheduleRegex = /\[schedule_message \| (.*?) \| fixed \| (.*?)\]/g;
            let match;
            while ((match = scheduleRegex.exec(aiContent)) !== null) {
                const timeStr = match[1].trim();
                const content = match[2].trim();
                
                const dueTime = new Date(timeStr).getTime();
                if (!isNaN(dueTime) && dueTime > Date.now()) {
                    await DB.saveScheduledMessage({
                        id: `sched-${Date.now()}-${Math.random()}`,
                        charId: char.id,
                        content: content,
                        dueAt: dueTime,
                        createdAt: Date.now()
                    });
                    
                    try {
                        const hasPerm = await LocalNotifications.checkPermissions();
                        if (hasPerm.display === 'granted') {
                            await LocalNotifications.schedule({
                                notifications: [{
                                    title: char.name,
                                    body: content, // Changed here
                                    id: Math.floor(Math.random() * 100000),
                                    schedule: { at: new Date(dueTime) },
                                    smallIcon: 'ic_stat_icon_config_sample' 
                                }]
                            });
                        }
                    } catch (e) { console.log("Notification schedule skipped (web mode)"); }
                    
                    addToast(`${char.name} 似乎打算一会儿找你...`, 'info');
                }
            }
            aiContent = aiContent.replace(scheduleRegex, '').trim();

            aiContent = aiContent.replace(/\[\[RECALL:.*?\]\]/g, '').trim();
            
            if (aiContent) {
                let tempContent = aiContent
                    .replace(/\.\.\./g, '{{ELLIPSIS_ENG}}')
                    .replace(/……/g, '{{ELLIPSIS_CN}}')
                    .replace(/([。])/g, '{{SPLIT}}')
                    .replace(/\.($|\s+)/g, '{{SPLIT}}')
                    .replace(/([！!？?~]+)/g, '$1{{SPLIT}}')
                    .replace(/\n+/g, '{{SPLIT}}');
                    // REMOVED AGGRESSIVE CHINESE SPACE SPLITTING
                    // .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1{{SPLIT}}$2');

                const finalChunks = tempContent
                    .split('{{SPLIT}}')
                    .map(c => c.trim())
                    .filter(c => c.length > 0)
                    .map(c => c.replace(/{{ELLIPSIS_ENG}}/g, '...').replace(/{{ELLIPSIS_CN}}/g, '……'));

                if (finalChunks.length === 0 && aiContent.trim()) finalChunks.push(aiContent.trim());

                for (let i = 0; i < finalChunks.length; i++) {
                    const chunk = finalChunks[i];
                    const delay = Math.min(Math.max(chunk.length * 50, 500), 2000);
                    await new Promise(r => setTimeout(r, delay));
                    await DB.saveMessage({ charId: char.id, role: 'assistant', type: 'text', content: chunk });
                    setMessages(await DB.getMessagesByCharId(char.id));
                }
            } else {
                setMessages(await DB.getMessagesByCharId(char.id));
            }

        } catch (e: any) {
            await DB.saveMessage({ charId: char.id, role: 'system', type: 'text', content: `[连接中断: ${e.message}]` });
            setMessages(await DB.getMessagesByCharId(char.id));
        } finally {
            setIsTyping(false);
            setRecallStatus('');
        }
    };

    const handleChatImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await processImage(file);
            setShowPanel('none');
            await handleSendText(base64, 'image');
        } catch (err: any) {
            addToast(err.message || '图片处理失败', 'error');
        } finally {
            if (chatImageInputRef.current) chatImageInputRef.current.value = '';
        }
    };

    const handleTouchStart = (item: Message | {name: string, url: string}, type: 'message' | 'emoji') => {
        longPressTimer.current = setTimeout(() => {
            if (type === 'message') {
                setSelectedMessage(item as Message);
                setModalType('message-options');
            } else {
                setSelectedEmoji(item as any);
                setModalType('delete-emoji');
            }
        }, 600);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleDeleteMessage = async () => {
        if (!selectedMessage) return;
        await DB.deleteMessage(selectedMessage.id);
        setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
        setModalType('none');
        setSelectedMessage(null);
        addToast('消息已删除', 'success');
    };
    
    const handleDeleteEmoji = async () => {
        if (!selectedEmoji) return;
        await DB.deleteEmoji(selectedEmoji.name);
        setEmojis(prev => prev.filter(e => e.name !== selectedEmoji.name));
        setModalType('none');
        setSelectedEmoji(null);
        addToast('表情包已删除', 'success');
    };

    const handleEditMessage = () => {
        if (!selectedMessage) return;
        setEditContent(selectedMessage.content);
        setModalType('edit-message');
    };

    const confirmEditMessage = async () => {
        if (!selectedMessage) return;
        await DB.updateMessage(selectedMessage.id, editContent);
        setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, content: editContent } : m));
        setModalType('none');
        setSelectedMessage(null);
        addToast('消息已修改', 'success');
    };

    const handleClearHistory = async () => {
        if (!char) return;
        if (preserveContext) {
            const toDelete = messages.slice(0, -10);
            if (toDelete.length === 0) {
                addToast('消息太少，无需清理', 'info');
                return;
            }
            await DB.deleteMessages(toDelete.map(m => m.id));
            setMessages(messages.slice(-10));
            addToast(`已清理 ${toDelete.length} 条历史，保留最近10条`, 'success');
        } else {
            await DB.clearMessages(char.id);
            setMessages([]);
            addToast('已清空 (包含见面记录)', 'success');
        }
        setModalType('none');
    };

    const handleReroll = async () => {
        if (isTyping || messages.length === 0) return;
        
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role !== 'assistant') return;

        const toDeleteIds: number[] = [];
        let index = messages.length - 1;
        while (index >= 0 && messages[index].role === 'assistant') {
            toDeleteIds.push(messages[index].id);
            index--;
        }

        if (toDeleteIds.length === 0) return;

        await DB.deleteMessages(toDeleteIds);
        const newHistory = messages.slice(0, index + 1);
        setMessages(newHistory);
        addToast('回溯对话中...', 'info');

        triggerAI(newHistory);
    };

    const handleFullArchive = async () => {
        if (!apiConfig.apiKey || !char) {
            addToast('请先配置 API Key', 'error');
            return;
        }
        
        const msgsByDate: Record<string, Message[]> = {};
        messages.forEach(m => {
            // FIX: Use local date construction to avoid UTC offset issues
            const d = new Date(m.timestamp);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            if (!msgsByDate[dateStr]) msgsByDate[dateStr] = [];
            msgsByDate[dateStr].push(m);
        });

        const dates = Object.keys(msgsByDate).sort();
        // REMOVED FILTER: Blindly process ALL dates present in logs
        const datesToProcess = dates;

        if (datesToProcess.length === 0) {
            addToast('聊天记录为空，无法归档', 'info');
            return;
        }

        setIsSummarizing(true);
        setShowPanel('none');
        
        try {
            let processedCount = 0;
            const newMemories: MemoryFragment[] = [];

            for (const dateStr of datesToProcess) {
                const dayMsgs = msgsByDate[dateStr];
                // Use formatTime which is local
                const rawLog = dayMsgs.map(m => `[${formatTime(m.timestamp)}] ${m.role === 'user' ? userProfile.name : char.name}: ${m.type === 'image' ? '[Image]' : m.content}`).join('\n');
                
                // Enhanced Prompt for concise memory
                const prompt = `系统: 你是 ${char.name}。
用户: ${userProfile.name} (请直接称呼名字，严禁使用'User')。
任务: 将 ${dateStr} 的聊天记录压缩为一条“核心记忆”。
核心目的: 节省长期记忆Token，同时保留关键信息。
要求:
1. **第一人称** (“我”)。
2. **极其简练**：用最少的字数把事情和互动重点说清楚。
3. **微带情绪**：保留一点你的态度，但绝对不要写成冗长的日记。
4. **语言**: 必须使用中文。
日志:
${rawLog.substring(0, 8000)}`;

                const response = await fetch(`${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                    body: JSON.stringify({
                        model: apiConfig.model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.5,
                        // FIX: Increased token limit for reasoning models
                        max_tokens: 4000 
                    })
                });

                if (!response.ok) throw new Error(`API Error on ${dateStr}`);
                
                const data = await response.json();
                
                // Fallback Logic for empty content (reasoning models sometimes cut off)
                let summary = data.choices?.[0]?.message?.content || '';
                
                if (!summary && data.choices?.[0]?.message?.reasoning_content) {
                     // If main content is empty but reasoning exists, try to salvage.
                     // But ideally 4000 tokens fixes this.
                     console.warn("Content empty, checking reasoning...");
                }

                summary = summary.trim();
                summary = summary.replace(/^["']|["']$/g, ''); // Remove surrounding quotes

                if (summary) {
                    newMemories.push({
                        id: `mem-${Date.now()}-${Math.random()}`,
                        date: dateStr,
                        summary: summary,
                        mood: 'archive'
                    });
                    processedCount++;
                } else {
                    console.error(`Empty summary for ${dateStr}`);
                }

                await new Promise(r => setTimeout(r, 500));
            }

            const finalMemories = [...(char.memories || []), ...newMemories];
            updateCharacter(char.id, { memories: finalMemories });
            
            if (processedCount > 0) {
                addToast(`成功归档 ${processedCount} 天的记忆`, 'success');
            } else {
                addToast('归档完成，但没有生成有效内容', 'info');
            }

        } catch (e: any) {
            addToast(`归档中断: ${e.message}`, 'error');
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleSendText = async (customContent?: string, customType?: MessageType, metadata?: any) => {
        if (!char || (!input.trim() && !customContent)) return;
        const text = customContent || input.trim();
        const type = customType || 'text';

        if (!customContent) { setInput(''); localStorage.removeItem(draftKey); }
        
        if (type === 'image') {
            await DB.saveGalleryImage({
                id: `img-${Date.now()}-${Math.random()}`,
                charId: char.id,
                url: text,
                timestamp: Date.now()
            });
            addToast('图片已保存至相册', 'info');
        }

        await DB.saveMessage({ charId: char.id, role: 'user', type, content: text, metadata });
        const updatedMsgs = await DB.getMessagesByCharId(char.id);
        setMessages(updatedMsgs);
        setShowPanel('none');
        
       
    };

    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        try {
            const dataUrl = await processImage(file);
            updateCharacter(char.id, { chatBackground: dataUrl });
            addToast('聊天背景已更新', 'success');
        } catch(err: any) {
            addToast(err.message, 'error');
        }
    };

    const saveSettings = () => {
        updateCharacter(char.id, { contextLimit: settingsContextLimit });
        setModalType('none');
        addToast('设置已保存', 'success');
    };

    const handleMessageLongPress = useCallback((m: Message) => {
        setSelectedMessage(m);
        setModalType('message-options');
    }, []);

    const displayMessages = messages
        .filter(m => m.metadata?.source !== 'date') // HIDE MESSAGES GENERATED IN DATE APP
        .slice(-visibleCount);

    return (
        <div 
            className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden relative font-sans transition-all duration-500"
            style={{ 
                backgroundImage: char.chatBackground ? `url(${char.chatBackground})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
             {/* ... (Modals kept same) ... */}
             <Modal 
                isOpen={modalType === 'transfer'} title="Credits 转账" onClose={() => setModalType('none')}
                footer={<><button onClick={() => setModalType('none')} className="flex-1 py-3 bg-slate-100 rounded-2xl">取消</button><button onClick={() => { if(transferAmt) handleSendText(`[转账]`, 'transfer', { amount: transferAmt }); setModalType('none'); }} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl">确认</button></>}
            ><input type="number" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} className="w-full bg-slate-100 rounded-2xl px-5 py-4 text-lg font-bold" autoFocus /></Modal>

            <Modal 
                isOpen={modalType === 'emoji-import'} title="表情注入" onClose={() => setModalType('none')}
                footer={<button onClick={async () => { const lines = emojiImportText.split('\n'); for (const line of lines) { const [n, u] = line.split('--'); if (n && u) await DB.saveEmoji(n.trim(), u.trim()); } setEmojis(await DB.getEmojis()); setModalType('none'); }} className="w-full py-4 bg-primary text-white font-bold rounded-2xl">注入</button>}
            ><textarea value={emojiImportText} onChange={e => setEmojiImportText(e.target.value)} placeholder="Name--URL" className="w-full h-40 bg-slate-100 rounded-2xl p-4 resize-none" /></Modal>

            <Modal 
                isOpen={modalType === 'chat-settings'} title="聊天设置" onClose={() => setModalType('none')}
                footer={<button onClick={saveSettings} className="w-full py-3 bg-primary text-white font-bold rounded-2xl">保存设置</button>}
            >
                <div className="space-y-6">
                     <div>
                         <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">聊天背景</label>
                         <div onClick={() => bgInputRef.current?.click()} className="h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-primary/50 overflow-hidden relative">
                             {char.chatBackground ? <img src={char.chatBackground} className="w-full h-full object-cover opacity-60" /> : <span className="text-xs text-slate-400">点击上传图片</span>}
                             {char.chatBackground && <span className="absolute z-10 text-xs bg-white/80 px-2 py-1 rounded">更换</span>}
                         </div>
                         <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
                         {char.chatBackground && <button onClick={() => updateCharacter(char.id, { chatBackground: undefined })} className="text-[10px] text-red-400 mt-1">移除背景</button>}
                     </div>
                     <div>
                         <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">上下文条数 ({settingsContextLimit})</label>
                         <input type="range" min="20" max="5000" step="10" value={settingsContextLimit} onChange={e => setSettingsContextLimit(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-full appearance-none accent-primary" />
                         <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>20 (省流)</span><span>5000 (超长记忆)</span></div>
                     </div>
                     
                     <div className="pt-2 border-t border-slate-100">
                         <label className="text-xs font-bold text-red-400 uppercase mb-3 block">危险区域 (Danger Zone)</label>
                         <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setPreserveContext(!preserveContext)}>
                             <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${preserveContext ? 'bg-primary border-primary' : 'bg-slate-100 border-slate-300'}`}>
                                 {preserveContext && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                             </div>
                             <span className="text-sm text-slate-600">清空时保留最后10条记录 (维持语境)</span>
                         </div>
                         <button onClick={handleClearHistory} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-2xl border border-red-100 active:scale-95 transition-transform flex items-center justify-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                             执行清空
                         </button>
                     </div>
                </div>
            </Modal>
            
            <Modal
                isOpen={modalType === 'message-options'} title="消息操作" onClose={() => setModalType('none')}
            >
                <div className="space-y-3">
                    <p className="text-xs text-slate-400 px-1 mb-2">对选中的消息进行操作。</p>
                    {selectedMessage?.type === 'text' && (
                        <button onClick={handleEditMessage} className="w-full py-3 bg-slate-50 text-slate-700 font-medium rounded-2xl active:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                            编辑内容
                        </button>
                    )}
                    <button onClick={handleDeleteMessage} className="w-full py-3 bg-red-50 text-red-500 font-medium rounded-2xl active:bg-red-100 transition-colors flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                        删除消息
                    </button>
                </div>
            </Modal>
            
             <Modal
                isOpen={modalType === 'delete-emoji'} title="删除表情包" onClose={() => setModalType('none')}
                footer={<><button onClick={() => setModalType('none')} className="flex-1 py-3 bg-slate-100 rounded-2xl">取消</button><button onClick={handleDeleteEmoji} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl">删除</button></>}
            >
                <div className="flex flex-col items-center gap-4 py-2">
                    {selectedEmoji && <img src={selectedEmoji.url} className="w-24 h-24 object-contain rounded-xl border" />}
                    <p className="text-center text-sm text-slate-500">确定要删除这个表情包吗？</p>
                </div>
            </Modal>

            <Modal
                isOpen={modalType === 'edit-message'} title="编辑内容" onClose={() => setModalType('none')}
                footer={<><button onClick={() => setModalType('none')} className="flex-1 py-3 bg-slate-100 rounded-2xl">取消</button><button onClick={confirmEditMessage} className="flex-1 py-3 bg-primary text-white font-bold rounded-2xl">保存</button></>}
            >
                <textarea 
                    value={editContent} 
                    onChange={e => setEditContent(e.target.value)} 
                    className="w-full h-32 bg-slate-100 rounded-2xl p-4 resize-none focus:ring-1 focus:ring-primary/20 transition-all text-sm leading-relaxed" 
                />
            </Modal>

            {/* Header */}
            <div className="h-24 bg-white/80 backdrop-blur-xl px-5 flex items-end pb-4 border-b border-slate-200/60 shrink-0 z-30 sticky top-0 shadow-sm relative">
                <div className="flex items-center gap-3 w-full">
                    <button onClick={closeApp} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
</svg></button>
                    <div onClick={() => setShowPanel('chars')} className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer">
                        <img src={char.avatar} className="w-10 h-10 rounded-xl object-cover shadow-sm" alt="a" />
                        <div>
                            <div className="font-bold text-slate-800">{char.name}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] text-slate-400 uppercase">Online</div>
                                {lastTokenUsage && (
                                    <div className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md font-mono border border-slate-200">
                                        ⚡ {lastTokenUsage}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => triggerAI(messages)} disabled={isTyping} className={`p-2 rounded-full ${isTyping ? 'bg-slate-100' : 'bg-primary/10 text-primary'}`}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg></button>
                </div>
                {isSummarizing && (
                    <div className="absolute top-full left-0 w-full bg-indigo-50 border-b border-indigo-100 p-2 flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                        <span className="text-xs text-indigo-600 font-medium">正在整理记忆档案，请稍候...</span>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto pt-6 pb-6 no-scrollbar" style={{ backgroundImage: activeTheme.type === 'custom' && activeTheme.user.backgroundImage ? 'none' : undefined }}>
                
                {messages.length > visibleCount && (
                    <div className="flex justify-center mb-6">
                        <button 
                            onClick={() => setVisibleCount(prev => prev + 30)}
                            className="px-4 py-2 bg-white/50 backdrop-blur-sm rounded-full text-xs text-slate-500 shadow-sm border border-white hover:bg-white transition-colors"
                        >
                            加载历史消息 ({messages.length - visibleCount})
                        </button>
                    </div>
                )}

                {displayMessages.map((m, i) => {
                    const prevRole = i > 0 ? displayMessages[i - 1].role : null;
                    const nextRole = i < displayMessages.length - 1 ? displayMessages[i + 1].role : null;
                    return (
                        <MessageItem 
                            key={m.id || i}
                            msg={m}
                            isFirstInGroup={prevRole !== m.role}
                            isLastInGroup={nextRole !== m.role}
                            activeTheme={activeTheme}
                            charAvatar={char.avatar}
                            charName={char.name}
                            userAvatar={userProfile.avatar} // Pass User Avatar
                            onLongPress={handleMessageLongPress}
                        />
                    );
                })}
                
                {(isTyping || recallStatus) && (
                    <div className="flex items-end gap-3 px-3 mb-6 animate-fade-in">
                        <img src={char.avatar} className="w-9 h-9 rounded-[10px] object-cover" />
                        <div className="bg-white px-4 py-3 rounded-2xl shadow-sm">
                            {recallStatus ? (
                                <div className="flex items-center gap-2 text-xs text-indigo-500 font-medium">
                                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    {recallStatus}
                                </div>
                            ) : (
                                <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div></div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white/90 backdrop-blur-2xl border-t border-slate-200/50 pb-safe shrink-0 z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] relative">
                
                {!isTyping && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                    <div className="absolute -top-12 right-4 flex justify-end">
                         <button onClick={handleReroll} className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-slate-100 flex items-center gap-1 text-xs text-slate-500 hover:text-primary active:scale-95 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                            重新生成
                         </button>
                    </div>
                )}

                <div className="p-3 px-4 flex gap-3 items-end">
                    <button onClick={() => setShowPanel(showPanel === 'actions' ? 'none' : 'actions')} className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
                    <div className="flex-1 bg-slate-100 rounded-[24px] flex items-center px-1 border border-transparent focus-within:bg-white focus-within:border-primary/30 transition-all">
                        <textarea rows={1} value={input} onChange={handleInputChange} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} className="flex-1 bg-transparent px-4 py-3 text-[15px] resize-none max-h-24" placeholder="Message..." style={{ height: 'auto' }} />
                        <button onClick={() => setShowPanel(showPanel === 'emojis' ? 'none' : 'emojis')} className="p-2 text-slate-400 hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" /></svg></button>
                    </div>
                    <button onClick={() => handleSendText()} disabled={!input.trim()} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg></button>
                </div>
                
                {/* ... Panel Content (Kept same) ... */}
                {showPanel !== 'none' && (
                    <div className="bg-slate-50 h-72 border-t border-slate-200/60 overflow-y-auto no-scrollbar relative z-0">
                         {showPanel === 'actions' && (
                             <div className="p-6 grid grid-cols-4 gap-8">
                                <button onClick={() => setModalType('transfer')} className="flex flex-col items-center gap-2 text-slate-600 active:scale-95 transition-transform"><div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center shadow-sm text-orange-400 border border-orange-100"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" /><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75-.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd" /><path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z" /></svg></div><span className="text-xs font-bold">转账</span></button>
                                <button onClick={() => handleSendText('[戳一戳]', 'interaction')} className="flex flex-col items-center gap-2 text-slate-600 active:scale-95 transition-transform"><div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center shadow-sm text-2xl border border-sky-100">👉</div><span className="text-xs font-bold">戳一戳</span></button>
                                <button onClick={handleFullArchive} className="flex flex-col items-center gap-2 text-slate-600 active:scale-95 transition-transform"><div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm text-indigo-400 border border-indigo-100"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg></div><span className="text-xs font-bold">{isSummarizing ? '归档中...' : '记忆归档'}</span></button>
                                <button onClick={() => setModalType('chat-settings')} className="flex flex-col items-center gap-2 text-slate-600 active:scale-95 transition-transform"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shadow-sm text-slate-500 border border-slate-100"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg></div><span className="text-xs font-bold">设置</span></button>
                                
                                <button onClick={() => chatImageInputRef.current?.click()} className="flex flex-col items-center gap-2 text-slate-600 active:scale-95 transition-transform">
                                    <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center shadow-sm text-pink-400 border border-pink-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                            <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold">相册</span>
                                </button>
                                <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={handleChatImageSelect} />

                             </div>
                         )}
                         {showPanel === 'emojis' && (
                            <div className="p-4 grid grid-cols-4 gap-3">
                                <button onClick={() => setModalType('emoji-import')} className="aspect-square bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-2xl text-slate-400">+</button>
                                {emojis.map((e, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleSendText(e.url, 'emoji')} 
                                        onTouchStart={() => handleTouchStart(e, 'emoji')}
                                        onTouchEnd={handleTouchEnd}
                                        onMouseDown={() => handleTouchStart(e, 'emoji')}
                                        onMouseUp={handleTouchEnd}
                                        onMouseLeave={handleTouchEnd}
                                        onContextMenu={(ev) => { ev.preventDefault(); setSelectedEmoji(e); setModalType('delete-emoji'); }}
                                        className="aspect-square bg-white rounded-2xl p-2 shadow-sm relative active:scale-95 transition-transform"
                                    >
                                        <img src={e.url} className="w-full h-full object-contain pointer-events-none" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {showPanel === 'chars' && (
                            <div className="p-5 space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 px-1 tracking-wider uppercase mb-3">气泡样式</h3>
                                    <div className="flex gap-3 px-1 overflow-x-auto no-scrollbar pb-2">
                                        {Object.values(PRESET_THEMES).map(t => (
                                            <button key={t.id} onClick={() => updateCharacter(char.id, { bubbleStyle: t.id })} className={`px-6 py-3 rounded-2xl text-xs font-bold border shrink-0 transition-all ${char.bubbleStyle === t.id ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600'}`}>{t.name}</button>
                                        ))}
                                        {customThemes.map(t => (
                                            <div key={t.id} className="relative group shrink-0">
                                                <button onClick={() => updateCharacter(char.id, { bubbleStyle: t.id })} className={`px-6 py-3 rounded-2xl text-xs font-bold border transition-all ${char.bubbleStyle === t.id ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                                    {t.name} (DIY)
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); removeCustomTheme(t.id); }} className="absolute -top-2 -right-2 bg-red-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 px-1 tracking-wider uppercase mb-3">切换会话</h3>
                                    <div className="space-y-3">
                                        {characters.map(c => (
                                            <div key={c.id} onClick={() => { setActiveCharacterId(c.id); setShowPanel('none'); }} className={`flex items-center gap-4 p-3 rounded-[20px] border cursor-pointer ${c.id === activeCharacterId ? 'bg-white border-primary/30 shadow-md' : 'bg-white/50 border-transparent'}`}>
                                                <img src={c.avatar} className="w-12 h-12 rounded-2xl object-cover" />
                                                <div className="flex-1"><div className="font-bold text-sm text-slate-700">{c.name}</div><div className="text-xs text-slate-400 truncate">{c.description}</div></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chat;
