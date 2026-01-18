

export enum AppID {
  Launcher = 'launcher',
  Settings = 'settings',
  Character = 'character',
  Chat = 'chat',
  Gallery = 'gallery',
  Music = 'music',
  Browser = 'browser',
  ThemeMaker = 'thememaker',
  Appearance = 'appearance',
  Date = 'date',
  User = 'user',
  Journal = 'journal',
  Schedule = 'schedule', // New App
}

export type MessageType = 'text' | 'transfer' | 'interaction' | 'voice' | 'emoji' | 'image';

export interface Message {
    id: number;
    charId: string;
    role: 'user' | 'assistant' | 'system';
    type: MessageType;
    content: string;
    metadata?: any; 
    timestamp: number;
}

export interface AppConfig {
  id: AppID;
  name: string;
  icon: string;
  color: string;
}

export interface OSTheme {
  hue: number;
  saturation: number;
  lightness: number; 
  wallpaper: string;
  darkMode: boolean;
  contentColor: string; // New: Custom color for status bar and widgets
}

export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ApiPreset {
    id: string;
    name: string;
    config: APIConfig;
}

export interface VirtualTime {
  hours: number;
  minutes: number;
  day: string;
}

export interface MemoryFragment {
  id: string;
  date: string;
  summary: string;
  mood?: string;
}

export interface SpriteConfig {
    scale: number;
    x: number; // percentage -100 to 100
    y: number; // percentage -100 to 100
}

// New: User Impression Structure v2.0
export interface UserImpression {
    version: number;
    lastUpdated?: number;
    value_map: {
        likes: string[];
        dislikes: string[];
        core_values: string;
    };
    behavior_profile: {
        tone_style: string;
        emotion_summary: string;
        response_patterns: string;
    };
    emotion_schema: {
        triggers: {
            positive: string[];
            negative: string[];
        };
        comfort_zone: string;
        stress_signals: string[];
    };
    personality_core: {
        observed_traits: string[];
        interaction_style: string;
        summary: string;
    };
    observed_changes?: string[];
}

export interface CharacterProfile {
  id: string;
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  worldview?: string; // New: Global worldview/lore settings
  memories: MemoryFragment[];
  refinedMemories?: Record<string, string>; 
  activeMemoryMonths?: string[]; 
  
  // New: Internal impression of the user
  impression?: UserImpression;

  bubbleStyle?: string;
  chatBackground?: string; 
  contextLimit?: number;   
  
  dateBackground?: string;
  sprites?: Record<string, string>; 
  spriteConfig?: SpriteConfig; 
}

// Data structure for exporting/sharing characters
export interface CharacterExportData extends Omit<CharacterProfile, 'id' | 'memories' | 'refinedMemories' | 'activeMemoryMonths' | 'impression'> {
    version: number;
    type: 'sully_character_card';
    embeddedTheme?: ChatTheme; // Include custom theme data if used
}

export interface UserProfile {
    name: string;
    avatar: string;
    bio: string; 
}

export interface BubbleStyle {
    textColor: string;
    backgroundColor: string;
    backgroundImage?: string;
    backgroundImageOpacity?: number; // 0-1, independent of container opacity
    borderRadius: number; 
    opacity: number; // Container opacity
    
    // Bubble Sticker
    decoration?: string; 
    decorationX?: number; // %
    decorationY?: number; // %
    decorationScale?: number; // 0.5 - 2.0
    decorationRotate?: number; // deg

    // Avatar Decoration (Frame/Sticker)
    avatarDecoration?: string;
    avatarDecorationX?: number; // % relative to avatar center
    avatarDecorationY?: number; // % relative to avatar center
    avatarDecorationScale?: number;
    avatarDecorationRotate?: number;
}

export interface ChatTheme {
    id: string;
    name: string;
    type: 'preset' | 'custom';
    user: BubbleStyle;
    ai: BubbleStyle;
    customCss?: string; // New: Raw CSS for advanced customization
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface GalleryImage {
    id: string;
    charId: string; 
    url: string; 
    timestamp: number;
    review?: string; 
    reviewTimestamp?: number;
}

// Diary Types
export interface StickerData {
    id: string;
    url: string; // Emoji or Image URL
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    rotation: number; // Degrees
}

export interface DiaryPage {
    text: string;
    paperStyle: string; // ID of the paper background
    stickers: StickerData[];
}

export interface DiaryEntry {
    id: string;
    charId: string;
    date: string; // YYYY-MM-DD
    userPage: DiaryPage;
    charPage?: DiaryPage; // Optional until AI replies
    timestamp: number;
    isArchived: boolean;
}

// --- Schedule App Types ---

export interface Task {
    id: string;
    title: string;
    supervisorId: string; // Character ID
    tone: 'gentle' | 'strict' | 'tsundere'; // Interaction style
    deadline?: string; // YYYY-MM-DD
    isCompleted: boolean;
    completedAt?: number;
    createdAt: number;
}

export interface Anniversary {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    charId: string;
    aiThought?: string; // Cache the generated thought
    lastThoughtGeneratedAt?: number;
}

export interface FullBackupData {
    timestamp: number;
    version: number;
    theme?: OSTheme;
    apiConfig?: APIConfig;
    apiPresets?: ApiPreset[]; 
    availableModels?: string[];
    customIcons?: Record<string, string>; 
    characters?: CharacterProfile[];
    messages?: Message[];
    customThemes?: ChatTheme[];
    savedEmojis?: {name: string, url: string}[];
    assets?: { id: string, data: string }[]; 
    galleryImages?: GalleryImage[];
    userProfile?: UserProfile;
    diaries?: DiaryEntry[]; 
    tasks?: Task[]; // Added
    anniversaries?: Anniversary[]; // Added
}