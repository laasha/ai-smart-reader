import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { book1Content, book2Content } from '../data/dummyBooks';
import { supabase } from '../services/supabase';

type Theme = 'light' | 'dark' | 'sepia';
type Font = 'Inter' | 'Sylfaen' | 'Merriweather';

export interface BookSection {
  id: string;
  content: string;
  page: number;
  isHeading?: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: 'PDF' | 'EPUB' | 'TXT' | 'DOCX' | 'WEB';
  progress: number;
  addedAt: number;
  content: BookSection[];
  category?: string;
  cover?: string;
}

export interface Flashcard {
  id: string;
  original: string;
  translated: string;
  context: string;
  interval: number; // in days
  ease: number;
  repetitions: number;
  nextReview: number; // timestamp
  tags?: string[];
}

export interface Highlight {
  id: string;
  bookId: string;
  segmentId: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink';
  note?: string;
}

interface ReaderState {
  theme: Theme;
  font: Font;
  fontSize: number;
  apiKey: string;
  books: Book[];
  currentBookId: string | null;
  playbackSpeed: number;
  autoNext: boolean;
  zenMode: boolean;
  showParallel: boolean;
  flashcards: Flashcard[];
  highlights: Highlight[];
  
  ttsVoice: string;
  ttsRate: string;
  ttsPitch: string;
  translateToLang: string;
  
  setTheme: (theme: Theme) => void;
  setFont: (font: Font) => void;
  setFontSize: (size: number) => void;
  setApiKey: (key: string) => void;
  setPlaybackSpeed: (speed: number) => void;
  setAutoNext: (enabled: boolean) => void;

  setTtsVoice: (voice: string) => void;
  setTtsRate: (rate: string) => void;
  setTtsPitch: (pitch: string) => void;
  setTranslateToLang: (lang: string) => void;
  
  addBook: (book: Book) => void;
  removeBook: (id: string) => void;
  updateBookProgress: (id: string, progress: number) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
  setCurrentBook: (id: string | null) => void;
  setZenMode: (enabled: boolean) => void;
  setShowParallel: (enabled: boolean) => void;
  addFlashcard: (card: Omit<Flashcard, 'interval' | 'ease' | 'repetitions' | 'nextReview'>) => void;
  updateFlashcard: (id: string, performance: number) => void;
  fetchBooks: () => Promise<void>;
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (id: string) => void;
  updateHighlightNote: (id: string, note: string) => void;
  enhanceBookWithAI: (id: string) => Promise<void>;
}

const defaultBooks: Book[] = [
  {
    id: 'dummy-1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    format: 'EPUB',
    progress: 45,
    addedAt: Date.now() - 100000,
    content: book1Content
  },
  {
    id: 'dummy-2',
    title: 'დიდი გეტსბი',
    author: 'ფ. სკოტ ფიცჯერალდი',
    format: 'EPUB',
    progress: 12,
    addedAt: Date.now() - 50000,
    content: book2Content
  }
];

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      theme: 'sepia',
      font: 'Sylfaen',
      fontSize: 18,
      apiKey: '',
      books: defaultBooks,
      currentBookId: null,
      playbackSpeed: 1.0,
      autoNext: false,
      zenMode: false,
      showParallel: false,
      flashcards: [],
      highlights: [],

      ttsVoice: 'ka-GE-EkaNeural',
      ttsRate: '+0%',
      ttsPitch: '+0Hz',
      translateToLang: 'none',

      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setFontSize: (fontSize) => set({ fontSize }),
      setApiKey: (apiKey) => set({ apiKey }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setAutoNext: (autoNext) => set({ autoNext }),
      setZenMode: (zenMode) => set({ zenMode }),
      setShowParallel: (showParallel) => set({ showParallel }),
      
      setTtsVoice: (ttsVoice) => set({ ttsVoice }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setTtsPitch: (ttsPitch) => set({ ttsPitch }),
      setTranslateToLang: (translateToLang) => set({ translateToLang }),

      addBook: async (book) => {
        set((state) => ({ books: [book, ...state.books] }));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('books').insert({
            id: book.id,
            user_id: session.user.id,
            title: book.title,
            author: book.author,
            format: book.format,
            progress: book.progress,
            added_at: new Date(book.addedAt).toISOString(),
            content: book.content
          });
        }
        // Auto-enhance after adding
        get().enhanceBookWithAI(book.id);
      },
      removeBook: async (id) => {
        set((state) => ({ 
          books: state.books.filter((b) => b.id !== id), 
          currentBookId: state.currentBookId === id ? null : state.currentBookId 
        }));
        await supabase.from('books').delete().eq('id', id);
      },
      updateBookProgress: async (id, progress) => {
        set((state) => ({
          books: state.books.map((b) => b.id === id ? { ...b, progress } : b)
        }));
        await supabase.from('books').update({ progress }).eq('id', id);
      },
      updateBook: async (id, updates) => {
        set((state) => ({
          books: state.books.map((b) => b.id === id ? { ...b, ...updates } : b)
        }));
        
        try {
          const dbUpdates: any = {};
          if (updates.title !== undefined) dbUpdates.title = updates.title;
          if (updates.author !== undefined) dbUpdates.author = updates.author;
          if (updates.category !== undefined) dbUpdates.category = updates.category;
          if (updates.cover !== undefined) dbUpdates.cover = updates.cover;
          if (Object.keys(dbUpdates).length > 0) {
            await supabase.from('books').update(dbUpdates).eq('id', id);
          }
        } catch(e) { console.error("Could not sync book updates to supabase", e); }
      },
      setCurrentBook: (currentBookId) => set({ currentBookId }),
      
      addFlashcard: async (card) => {
        const enhancedCard = { ...card, interval: 0, ease: 2.5, repetitions: 0, nextReview: Date.now() };
        set((state) => ({ flashcards: [enhancedCard, ...state.flashcards] }));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('flashcards').insert({
            id: enhancedCard.id,
            user_id: session.user.id,
            original: enhancedCard.original,
            translated: enhancedCard.translated,
            context: enhancedCard.context || null,
            interval: enhancedCard.interval,
            ease: enhancedCard.ease,
            repetitions: enhancedCard.repetitions,
            next_review: new Date(enhancedCard.nextReview).toISOString()
          });
        }
      },

      updateFlashcard: async (id, performance) => {
        let updatedCard;
        set((state) => {
          const cards = state.flashcards.map(card => {
            if (card.id !== id) return card;
            let { interval, ease, repetitions } = card;
            if (performance >= 3) {
              if (repetitions === 0) interval = 1; else if (repetitions === 1) interval = 6; else interval = Math.round(interval * ease);
              repetitions++;
            } else { repetitions = 0; interval = 1; }
            ease = Math.max(1.3, ease + (0.1 - (5 - performance) * (0.08 + (5 - performance) * 0.02)));
            const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;
            updatedCard = { ...card, interval, ease, repetitions, nextReview };
            return updatedCard;
          });
          return { flashcards: cards };
        });
        
        if (updatedCard) {
          await supabase.from('flashcards').update({
            interval: updatedCard.interval,
            ease: updatedCard.ease,
            repetitions: updatedCard.repetitions,
            next_review: new Date(updatedCard.nextReview).toISOString()
          }).eq('id', id);
        }
      },
      
      addHighlight: async (highlight) => {
        set((state) => ({ highlights: [...state.highlights, highlight] }));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('highlights').insert({
            id: highlight.id,
            user_id: session.user.id,
            book_id: highlight.bookId,
            segment_id: highlight.segmentId,
            text: highlight.text,
            color: highlight.color,
            note: highlight.note || null
          });
        }
      },
      
      removeHighlight: async (id) => {
        set((state) => ({ highlights: state.highlights.filter((h) => h.id !== id) }));
        await supabase.from('highlights').delete().eq('id', id);
      },
      
      updateHighlightNote: async (id, note) => {
        set((state) => ({
          highlights: state.highlights.map((h) => h.id === id ? { ...h, note } : h)
        }));
        await supabase.from('highlights').update({ note }).eq('id', id);
      },
      
      fetchBooks: async () => {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const [booksRes, flashcardsRes, highlightsRes] = await Promise.all([
          supabase.from('books').select('*').eq('user_id', session.user.id),
          supabase.from('flashcards').select('*').eq('user_id', session.user.id),
          supabase.from('highlights').select('*').eq('user_id', session.user.id)
        ]);

        if (booksRes.data) {
          const formattedBooks = booksRes.data.map((b: any) => ({
            id: b.id, title: b.title, author: b.author, format: b.format,
            progress: b.progress, addedAt: new Date(b.added_at).getTime(), content: b.content,
            category: b.category, cover: b.cover
          }));
          set({ books: formattedBooks });
        }
        
        if (flashcardsRes.data) {
          const formattedCards = flashcardsRes.data.map((c: any) => ({
            id: c.id, original: c.original, translated: c.translated, context: c.context,
            interval: c.interval, ease: c.ease, repetitions: c.repetitions,
            nextReview: new Date(c.next_review).getTime()
          }));
          set({ flashcards: formattedCards });
        }
        
        if (highlightsRes.data) {
          const formattedHighlights = highlightsRes.data.map((h: any) => ({
            id: h.id, bookId: h.book_id, segmentId: h.segment_id,
            text: h.text, color: h.color, note: h.note
          }));
          set({ highlights: formattedHighlights });
        }
      },
      enhanceBookWithAI: async (id) => {
        const state = get();
        const book = state.books.find(b => b.id === id);
        if (!book) return;

        try {
          // 1. Analyze Book
          const contentSample = book.content.slice(0, 5).map(s => s.content).join("\n");
          const analyzeRes = await fetch('http://localhost:8000/analyze-book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: book.title, author: book.author, content_sample: contentSample })
          });
          if (!analyzeRes.ok) throw new Error("Analysis failed");
          const analysis = await analyzeRes.json();
          
          state.updateBook(id, { category: analysis.category });

          // 2. Generate Cover (only if one doesn't exist)
          if (!book.cover) {
            const coverRes = await fetch('http://localhost:8000/generate-cover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: book.title, summary: analysis.summary, category: analysis.category })
            });
            if (coverRes.ok) {
              const { cover_url } = await coverRes.json();
              if (cover_url) {
                state.updateBook(id, { cover: cover_url });
              }
            }
          }
        } catch (e) {
          console.error("AI Enhancement failed for book:", id, e);
        }
      }
    }),
    {
      name: 'reader-storage',
      version: 1, // Bump version to clear previous empty cached state for testing
      partialize: (state) => ({
        theme: state.theme,
        font: state.font,
        fontSize: state.fontSize,
        apiKey: state.apiKey,
        books: state.books,
        playbackSpeed: state.playbackSpeed,
        autoNext: state.autoNext,
        zenMode: state.zenMode,
        showParallel: state.showParallel,
        flashcards: state.flashcards,
        ttsVoice: state.ttsVoice,
        ttsRate: state.ttsRate,
        ttsPitch: state.ttsPitch,
        translateToLang: state.translateToLang,
      }),
    }
  )
);
