export type Genre =
  | "Fantasy"
  | "Romance"
  | "Action"
  | "Mystery"
  | "Sci-Fi"
  | "Horror"
  | "Comedy"
  | "Drama"
  | "Thriller"
  | "Slice of Life";

export interface Chapter {
  id: string;
  number: number;
  title: string;
  isPremium: boolean;
  panels: string[]; // image URLs (can be https or data: base64)
  // Real dialogues/narration exported from Creator (one string per panel).
  // When present, translation uses these instead of generated placeholders.
  dialogues?: string[];
  coinPrice?: number; // custom per-chapter price (for premium chapters); defaults to 10 if omitted
  thumbnail?: string; // small generated preview (data URL) from first panel - for lists/cards
}

export interface Comic {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
  // Advanced upload: optional gallery of additional covers + banner image (all optimized data: URLs)
  coverGallery?: string[];
  bannerUrl?: string;
  genres: Genre[];
  description: string;
  chapters: Chapter[];
  views: number;
  publishedAt: string; // ISO
  isAIGenerated?: boolean;
  source?: 'mock' | 'user' | 'creator';   // 'creator' = published from inkforg_apexpanel Creator App via localStorage bridge
  status?: 'ongoing' | 'completed';
  tags?: string[];
  unlockAllPrice?: number; // custom price to unlock all premium chapters in this comic; defaults to 60
  isPublic?: boolean; // true for comics stored in Supabase (public discovery for logged-in users)
}

export interface UserCoinState {
  balance: number;
  unlockedChapters: Record<string, boolean>; // key: `${comicId}:${chapterId}`
}

export interface PublishChapterInput {
  title: string;
  isPremium: boolean;
  panels: string[]; // data URLs after processing
  coinPrice?: number; // optional custom price for this premium chapter (forwarded to Chapter)
}

export interface PublishComicInput {
  title: string;
  author: string;
  description: string;
  genres: Genre[];
  coverUrl: string; // data URL
  chapters: PublishChapterInput[];
  status?: 'ongoing' | 'completed';
  tags?: string[];
  unlockAllPrice?: number; // custom price to unlock all premium chapters
  isPublic?: boolean; // when true: upload to Supabase Storage + insert to DB with is_public=true (shared)
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string; // ISO string
  likes: number;
  reactions: Record<string, number>; // e.g. { "❤️": 5, "😂": 2 }
  parentId?: string; // for nested replies
  avatar?: string; // optional seed or emoji for avatar (client-generated)
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji or lucide name
  unlockedAt?: string;
}
