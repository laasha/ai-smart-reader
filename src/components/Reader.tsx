import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, Languages, Volume2, Bookmark, X, Home, Navigation, Sun, Moon, Coffee, 
  Play, Pause, SkipForward, SkipBack, Square, Zap, Info, Search, Headphones, Mic2, Activity, BookOpen, Loader2
} from 'lucide-react';
import { useReaderStore } from '../store/useReaderStore';
import { useTextSelection } from '../hooks/useTextSelection';
import { translateText, API_URL, explainText } from '../services/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface ReaderProps {
  content: { id: string; content: string; page: number }[];
  bookId: string;
  onBack: () => void;
}

const Reader: React.FC<ReaderProps> = ({ content, bookId, onBack }) => {
  const { 
    theme, font, fontSize, setTheme, setFont, setFontSize, 
    updateBookProgress, books, playbackSpeed, autoNext, 
    setPlaybackSpeed, setAutoNext, zenMode, setZenMode, 
    showParallel, setShowParallel, addFlashcard,
    highlights, addHighlight, updateHighlightNote, removeHighlight,
    ttsVoice, ttsRate, ttsPitch, translateToLang, aiPersona,
    setTtsVoice, setTtsRate, setTtsPitch, setTranslateToLang, setAiPersona,
    updateBook, addExplanation
  } = useReaderStore();
  const book = books.find(b => b.id === bookId);
  const initialScroll = book?.progress || 0;
  
  const isGeorgianBook = book && book.content.length > 0 ? /[\u10A0-\u10FF]/.test(book.content[0].content) : false;
  const effectiveLang = translateToLang === 'none' ? (isGeorgianBook ? 'ka' : 'en') : translateToLang;


  const { selection, setSelection } = useTextSelection();
  const [showTuner, setShowTuner] = useState(false);
  const [tunerTab, setTunerTab] = useState<'style' | 'audio'>('style');
  const [showToc, setShowToc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(initialScroll);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const [audiobookProgress, setAudiobookProgress] = useState<number | null>(null);
  const [isGeneratingAudiobook, setIsGeneratingAudiobook] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; content: string }[]>([]);
  const [visibleCount, setVisibleCount] = useState(50);
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollTrackerRef = useRef(initialScroll);

  // Auto-fallback voice when effective language shifts
  useEffect(() => {
    if (effectiveLang === 'ka' && !ttsVoice.startsWith('ka-')) setTtsVoice('ka-GE-EkaNeural');
    else if (effectiveLang === 'en' && !ttsVoice.startsWith('en-')) setTtsVoice('en-US-AriaNeural');
    else if (effectiveLang === 'fr' && !ttsVoice.startsWith('fr-')) setTtsVoice('fr-FR-DeniseNeural');
    else if (effectiveLang === 'es' && !ttsVoice.startsWith('es-')) setTtsVoice('es-ES-ElviraNeural');
    else if (effectiveLang === 'de' && !ttsVoice.startsWith('de-')) setTtsVoice('de-DE-KatjaNeural');
  }, [effectiveLang, ttsVoice, setTtsVoice]);

  // Scroll to saved progress on initial load
  useEffect(() => {
    if (initialScroll > 0) {
      setTimeout(() => {
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        window.scrollTo({ top: (initialScroll / 100) * height, behavior: 'instant' });
      }, 100);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowTuner(false);
      }
    };
    if (showTuner) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTuner]);

  useEffect(() => {
    if (searchQuery.length >= 3) {
      const term = searchQuery.toLowerCase();
      const results = content.filter(s => s.content.toLowerCase().includes(term));
      setSearchResults(results.slice(0, 50));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, content]);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      setScrollProgress(scrolled);
      scrollTrackerRef.current = scrolled;

      if (document.documentElement.scrollHeight - winScroll - document.documentElement.clientHeight < 2000) {
        setVisibleCount(prev => Math.min(prev + 20, content.length));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handleAudioUpdate = () => {
      if (audioPlayerRef.current) {
        const progress = (audioPlayerRef.current.currentTime / audioPlayerRef.current.duration) * 100;
        setAudioProgress(progress || 0);
      }
    };
    if (audioPlayerRef.current) {
      audioPlayerRef.current.addEventListener('timeupdate', handleAudioUpdate);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.removeEventListener('timeupdate', handleAudioUpdate);
      }
      window.speechSynthesis.cancel();
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      // Save progress to global store on unmount
      updateBookProgress(bookId, scrollTrackerRef.current);
    };
  }, [bookId, updateBookProgress]);

  useEffect(() => {
    if (showSearch) { setShowTuner(false); setShowToc(false); }
  }, [showSearch]);

  const calculateTimeRemaining = () => {
    if (!content.length || !activeSegment) return null;
    const currentIndex = content.findIndex(s => s.id === activeSegment);
    const remainingSections = content.length - currentIndex - 1;
    
    // Parse ttsRate like "+20%" or "-10%" into a multiplier
    let multiplier = 1.0;
    try {
      const rateNum = parseInt(ttsRate.replace('%', ''));
      // +100% means double speed (0.5x time), -50% means half speed (2x time)
      // For simplicity, we can use: speed = 1 + (rate / 100)
      // time = baseTime / speed
      const speed = 1 + (rateNum / 100);
      multiplier = speed > 0 ? 1 / speed : 1;
    } catch(e) {}

    const baseSecondsPerSection = 15;
    const totalSeconds = remainingSections * baseSecondsPerSection * multiplier;
    const mins = Math.ceil(totalSeconds / 60);
    return mins;
  };

  // Polling for audiobook generation status
  useEffect(() => {
    let interval: any;
    if (isGeneratingAudiobook && bookId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/audiobook-status/${bookId}`);
          if (res.ok) {
            const data = await res.json();
            setAudiobookProgress(data.progress);
            if (data.progress === 100) {
              setIsGeneratingAudiobook(false);
              clearInterval(interval);
            } else if (data.progress === -1) {
              setIsGeneratingAudiobook(false);
              setErrorMsg("აუდიოწიგნის გენერირება ვერ მოხერხდა.");
              clearInterval(interval);
            }
          }
        } catch (e) { console.error(e); }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isGeneratingAudiobook, bookId]);

  // Global Keyboard Power-User Accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key === 'Escape') {
        setShowTuner(false);
        setShowToc(false);
        setShowSearch(false);
        setTranslation(null);
        setActiveHighlightId(null);
      }
      
      if (e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTranslate = async () => {
    if (!selection) return;
    if (!navigator.onLine) {
      setErrorMsg('თარგმნა ვერ მოხერხდა. ინტერნეტთან კავშირი გაწყვეტილია.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      // Try backend first (GPT-4o)
      try {
        const { translated_text } = await translateText(selection.text);
        setTranslation(translated_text);
      } catch (backendErr) {
        console.warn('Backend translation failed, falling back to client-side:', backendErr);
        // 100% Free Frontend Translation fallback
        const q = encodeURIComponent(selection.text);
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=ka&q=${q}`);
        const data = await res.json();
        const translated = data[0].map((item: any) => item[0]).join('');
        setTranslation(translated);
      }
    } catch (err) {
      console.error(err);
      setTranslation("თარგმანის შეცდომა. დარწმუნდით რომ API წვდომა გაქვთ.");
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!selection) return;
    setExplainLoading(true);
    try {
      const data = await explainText(
        selection.text, 
        selection.context || selection.text,
        aiPersona
      );
      setExplainResult(data.explanation);
      
      // Save for Insights tab
      addExplanation({
        id: crypto.randomUUID(),
        bookId,
        text: selection.text,
        explanation: data.explanation,
        timestamp: Date.now()
      });

      setSelection(null);
    } catch (e) {
      console.error("Explanation error:", e);
      setExplainResult("შეცდომა განმარტების მიღებისას. დარწმუნდით რომ OPENAI_API_KEY გაწერილია .env-ში.");
    } finally {
      setExplainLoading(false);
    }
  };

  const handleGenerateAudiobook = async () => {
    if (!bookId || !content.length) return;
    setIsGeneratingAudiobook(true);
    setAudiobookProgress(0);
    try {
      const response = await fetch(`${API_URL}/generate-audiobook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          title: book?.title || "Unknown",
          sections: content,
          voice: ttsVoice,
          rate: ttsRate,
          pitch: ttsPitch
        })
      });
      if (!response.ok) throw new Error("Generation failed");
      
      // Mark as having an audiobook
      const audioUrl = `${API_URL}/audiobooks/${bookId}/index.mp3`;
      updateBook(bookId, { audiobookUrl: audioUrl });
    } catch (e) {
      console.error(e);
      setIsGeneratingAudiobook(false);
      setErrorMsg("გენერირება ვერ დაიწყო.");
    }
  };

  const handleNext = () => {
    if (!activeSegment) return;
    const currentIndex = content.findIndex(s => s.id === activeSegment);
    if (currentIndex < content.length - 1) {
      handleListen(content[currentIndex + 1].content, content[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (!activeSegment) return;
    const currentIndex = content.findIndex(s => s.id === activeSegment);
    if (currentIndex > 0) {
      handleListen(content[currentIndex - 1].content, content[currentIndex - 1].id);
    }
  };

  const handleTogglePlay = () => {
    if (!audioPlayerRef.current) return;
    if (audioPlayerRef.current.paused) {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    } else {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setActiveSegment(null);
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const handleListen = async (text?: string, id?: string) => {
    const targetText = text || selection?.text;
    if (!targetText) return;
    
    if (!navigator.onLine) {
      setErrorMsg('გახმოვანება ვერ მოხერხდა. ინტერნეტთან კავშირი შეამოწმეთ.');
      return;
    }
    
    // Stop any ongoing speech
    handleStop();

    const hasGeorgian = /[\u10A0-\u10FF]/.test(targetText);
    
    if (hasGeorgian || translateToLang !== 'none') {
      if (id) setActiveSegment(id);
      setIsPlaying(true);
      try {
        const res = await fetch(`${API_URL}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: targetText.slice(0, 1000), 
            voice: ttsVoice,
            rate: ttsRate,
            pitch: ttsPitch,
            translate_to: translateToLang !== 'none' ? translateToLang : null
          })
        });
        const { audio_url } = await res.json();
        
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = audio_url;
          audioPlayerRef.current.playbackRate = playbackSpeed;
          audioPlayerRef.current.onended = () => {
            setIsPlaying(false);
            if (autoNext && id) {
              const nextIdx = content.findIndex(s => s.id === id) + 1;
              if (nextIdx < content.length) {
                handleListen(content[nextIdx].content, content[nextIdx].id);
              } else {
                setActiveSegment(null);
              }
            } else {
              setActiveSegment(null);
            }
          };
          audioPlayerRef.current.onerror = () => {
            setActiveSegment(null);
            setIsPlaying(false);
            setErrorMsg('ქართულ ენაზე გახმოვანება დროებით მიუწვდომელია.');
          };
          audioPlayerRef.current.play().catch(console.error);
        }
      } catch (err) {
        console.error(err);
        setActiveSegment(null);
        setIsPlaying(false);
        setErrorMsg('სერვერთან კავშირი ვერ მოხერხდა.');
      }
    } else {
      const utterance = new SpeechSynthesisUtterance(targetText);
      utterance.lang = 'en-US';
      utterance.rate = playbackSpeed;
      if (id) setActiveSegment(id);
      setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        if (autoNext && id) {
          const nextIdx = content.findIndex(s => s.id === id) + 1;
          if (nextIdx < content.length) {
            handleListen(content[nextIdx].content, content[nextIdx].id);
          } else {
            setActiveSegment(null);
          }
        } else {
          setActiveSegment(null);
        }
      };
      window.speechSynthesis.speak(utterance);
    }
    setSelection(null);
  };

  const handleSaveToFlashcard = async (customText?: string, customTranslation?: string) => {
    const textToSave = customText || selection?.text || (activeSegment ? content.find(s => s.id === activeSegment)?.content : null);
    const translationToSave = customTranslation || translation;
    
    if (!textToSave || !translationToSave) return;
    
    setLoading(true);
    try {
      addFlashcard({
        id: crypto.randomUUID(),
        original: textToSave,
        translated: translationToSave,
        context: book?.title || 'Unknown Book',
      });
      
      // Success visual feedback
      setTranslation('ბარათი წარმატებით დაემატა!');
      setTimeout(() => setTranslation(null), 1500);
    } catch (err) {
      console.error(err);
      setErrorMsg('ბარათის შენახვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
      setSelection(null);
    }
  };

  // Parallel translation effect
  useEffect(() => {
    if (showParallel && activeSegment) {
      const segment = content.find(s => s.id === activeSegment);
      if (segment) {
        (async () => {
          try {
            const { translated_text } = await translateText(segment.content);
            setTranslation(translated_text);
          } catch (e) {
            console.error('Parallel translation failed', e);
          }
        })();
      }
    } else if (!showParallel) {
      setTranslation(null);
    }
  }, [activeSegment, showParallel]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegment) {
      const element = document.getElementById(`segment-${activeSegment}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegment]);

  const themeClasses = {
    light: 'theme-light',
    dark: 'theme-dark',
    sepia: 'theme-sepia',
  };

  const fontClasses = {
    Inter: 'font-inter',
    Sylfaen: 'font-sylfaen',
    Merriweather: 'font-merriweather',
  };

  const handleAddHighlight = (color: 'yellow' | 'green' | 'blue' | 'pink') => {
    if (!selection?.text) return;
    
    // Find segment containing this text
    const segment = content.find(s => s.content.includes(selection.text));
    if (!segment) {
      setErrorMsg('მონიშვნა ვერ მოხერხდა (ტექსტი ვერ მოიძებნა სეგმენტში).');
      return;
    }

    addHighlight({
      id: crypto.randomUUID(),
      bookId,
      segmentId: segment.id,
      text: selection.text,
      color,
    });
    setSelection(null);
  };

  const renderSegmentContent = (sectionId: string, contentStr: string) => {
    const sectionHls = highlights.filter(h => h.bookId === bookId && h.segmentId === sectionId);
    if (!sectionHls || sectionHls.length === 0) return contentStr;
    
    let parts: { text: string; hlColor: string | null; hlId: string | null; note: string | null }[] = [{ text: contentStr, hlColor: null, hlId: null, note: null }];
    
    sectionHls.forEach(hl => {
      const newParts: { text: string; hlColor: string | null; hlId: string | null; note: string | null }[] = [];
      parts.forEach(p => {
        if (p.hlColor) {
          newParts.push(p);
          return;
        }
        const idx = p.text.indexOf(hl.text);
        if (idx === -1) {
          newParts.push(p);
        } else {
          newParts.push({ text: p.text.substring(0, idx), hlColor: null, hlId: null, note: null });
          newParts.push({ text: hl.text, hlColor: hl.color, hlId: hl.id, note: hl.note || null });
          newParts.push({ text: p.text.substring(idx + hl.text.length), hlColor: null, hlId: null, note: null });
        }
      });
      parts = newParts.filter(p => p.text !== '');
    });

    const colorClasses: Record<string, string> = {
      yellow: 'bg-yellow-400/40 text-yellow-900 dark:text-yellow-100',
      green: 'bg-green-400/40 text-green-900 dark:text-green-100',
      blue: 'bg-blue-400/40 text-blue-900 dark:text-blue-100',
      pink: 'bg-pink-400/40 text-pink-900 dark:text-pink-100',
    };

    return parts.map((p, i) => 
      p.hlColor ? (
        <mark 
          key={i} 
          onClick={(e) => { e.stopPropagation(); setActiveHighlightId(p.hlId); setNoteText(p.note || ''); }}
          className={cn("px-1.5 py-0.5 rounded-md cursor-pointer transition-all shadow-sm mx-0.5 relative inline-block", colorClasses[p.hlColor])} 
          title={p.note ? `ნოტა: ${p.note}` : "შენახული მონიშვნა (Highlight)"}
        >
          {p.text}
          {p.note && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900" />}
        </mark>
      ) : (
        <span key={i}>{p.text}</span>
      )
    );
  };

  return (
    <div className={cn('min-h-screen w-full relative selection:bg-indigo-300/40', themeClasses[theme])}>
      
      {/* Hidden audio player for reliable playing of gtx endpoints */}
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Sleek Top Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 z-[60] bg-black/5 dark:bg-white/5"
        animate={{ opacity: zenMode ? 0.3 : 1, y: zenMode ? -2 : 0 }}
      >
        <motion.div 
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
          animate={{ width: `${scrollProgress}%` }}
          transition={{ ease: "easeOut", duration: 0.1 }}
        />
      </motion.div>

      {/* Zen Mode Exit Button */}
      <AnimatePresence>
        {zenMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-8 right-8 z-[100] flex flex-col items-end gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setZenMode(false)}
              className="p-4 rounded-full bg-black/20 dark:bg-white/10 text-zinc-900 dark:text-white backdrop-blur-xl shadow-2xl border border-white/20 transition-all group"
              title="Zen Mode-დან გამოსვლა (ESC)"
            >
              <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
            </motion.button>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 0.5, x: 0 }}
              className="bg-black/40 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10"
            >
              ESC გამოსასვლელად
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-2xl mx-auto pt-16 pb-40 px-6 sm:px-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            fontClasses[font],
            'leading-[1.8] text-justify space-y-8 select-text text-zinc-800 dark:text-zinc-200 theme-transition'
          )}
          style={{ fontSize: `${fontSize}px` }}
        >
          {content.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-60">
              <BookOpen className="w-12 h-12 mb-4 text-zinc-400" />
              <p className="text-xl font-bold text-center">წიგნის ტექსტი ვერ მოიძებნა</p>
              <p className="text-sm mt-2 text-center max-w-sm">ეს წიგნი სავარაუდოდ დაზიანებულია. გთხოვთ, წაშალოთ ის და თავიდან დაამატოთ კატალოგიდან ან ფაილით.</p>
            </div>
          ) : (
            content.slice(0, visibleCount).map((section, idx) => (
            <motion.div 
              key={section.id} 
              id={`segment-${section.id}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: activeSegment === section.id ? 1 : 0.85, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: idx % 10 * 0.05 }}
              onClick={() => handleListen(section.content, section.id)}
              className={cn(
                "paragraph transition-all duration-500 rounded-3xl -mx-6 px-6 py-4 cursor-pointer relative group",
                activeSegment === section.id 
                  ? "bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-500/20 shadow-[0_4px_30px_rgba(99,102,241,0.1)] scale-[1.02] z-10 text-zinc-900 dark:text-white" 
                  : "hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100",
                zenMode && activeSegment !== section.id && "opacity-40 blur-[0.5px]"
              )}
            >
              {activeSegment === section.id && isPlaying && (
                 <motion.div 
                   className="absolute -left-2 top-12 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full"
                   animate={{ scaleY: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                   transition={{ repeat: Infinity, duration: 1 }}
                 />
              )}
              {activeSegment === section.id && (
                <motion.div 
                  layoutId="activeGlow"
                  className="absolute inset-0 rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"
                />
              )}
              <div className={cn("relative z-10 drop-shadow-sm", section.isHeading && "text-2xl md:text-3xl font-black my-4 text-indigo-600 dark:text-indigo-400 bg-transparent")}>
                {renderSegmentContent(section.id, section.content)}
              </div>
              
              {/* Parallel Translation Inline */}
              <AnimatePresence>
                {showParallel && activeSegment === section.id && translation && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: 5 }}
                    animate={{ opacity: 1, height: 'auto', y: 10 }}
                    exit={{ opacity: 0, height: 0, y: 5 }}
                    className="text-indigo-600 dark:text-indigo-400 font-sylfaen italic border-t border-indigo-500/20 pt-3 mt-1 text-lg leading-relaxed"
                  >
                    {translation}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )))}
        </motion.div>
      </main>

      {/* Floating Bottom Nav (Zen UI) */}
      <motion.nav 
        initial={{ y: 100, opacity: 0 }}
        animate={{ 
          y: zenMode && !showTuner && !activeSegment ? 150 : 0, 
          opacity: zenMode && !showTuner && !activeSegment ? 0 : 1 
        }}
        whileHover={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring", damping: 20 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-white/60 dark:bg-black/40 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.1)] z-50 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex-wrap w-[90%] md:w-auto justify-center"
      >
        <button 
          onClick={onBack}
          className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95 text-zinc-600 dark:text-zinc-300"
        >
          <Home className="w-5 h-5" />
        </button>
        
        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1" />
        
        <button 
          onClick={() => { setShowSearch(!showSearch); setShowToc(false); setShowTuner(false); }}
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-95",
            showSearch ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
          )}
          title="ძებნა"
        >
          <Search className="w-5 h-5" />
        </button>

        <button 
          onClick={() => { setShowToc(!showToc); setShowSearch(false); setShowTuner(false); }}
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-95",
            showToc ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
          )}
          title="სარჩევი"
        >
          <Navigation className="w-5 h-5" />
        </button>
        
        <button 
          onClick={() => { setShowTuner(!showTuner); setTunerTab('audio'); setShowSearch(false); setShowToc(false); }}
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-95",
            (showTuner && tunerTab === 'audio') ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
          )}
          title="აუდიო პარამეტრები"
        >
          <Headphones className="w-5 h-5" />
        </button>

        <button 
          onClick={() => { setShowTuner(!showTuner); setTunerTab('style'); setShowSearch(false); setShowToc(false); }}
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-95",
            (showTuner && tunerTab === 'style') ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
          )}
          title="სტილის პარამეტრები"
        >
          <Settings className={cn("w-5 h-5 transition-transform duration-500", (showTuner && tunerTab === 'style') && "rotate-90")} />
        </button>

        <button 
          onClick={() => setZenMode(!zenMode)}
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-95",
            zenMode ? "bg-emerald-500 text-white shadow-lg" : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
          )}
          title="Zen Mode"
        >
          <Sun className={cn("w-5 h-5", zenMode && "animate-pulse")} />
        </button>

        {activeSegment && (
           <div className="flex items-center gap-1.5 px-2 ml-1">
              <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mr-1" />
              <button 
                onClick={handlePrev}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button 
                onClick={handleTogglePlay}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all active:scale-90"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <button 
                onClick={handleNext}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
              <button 
                onClick={handleStop}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-500/10 text-red-500 transition-colors active:scale-90"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>

              {/* Segment Progress Mini-Bar */}
              <div className="absolute -top-4 left-4 right-4 h-0.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-indigo-500"
                  animate={{ width: `${audioProgress}%` }}
                />
              </div>
           </div>
        )}
      </motion.nav>

      {/* Master Tuner Popover */}
      <AnimatePresence>
        {showTuner && (
          <motion.div
            ref={settingsRef}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[360px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] rounded-[2.5rem] border border-white/20 dark:border-white/10 z-[100] flex flex-col overflow-hidden"
          >
            {/* Header / Tabs */}
            <div className="bg-black/5 dark:bg-white/5 p-2 flex gap-1">
              <button 
                onClick={() => setTunerTab('style')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all",
                  tunerTab === 'style' ? "bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                )}
              >
                <Zap className="w-4 h-4" /> სტილი
              </button>
              <button 
                onClick={() => setTunerTab('audio')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all",
                  tunerTab === 'audio' ? "bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                )}
              >
                <Headphones className="w-4 h-4" /> აუდიო
              </button>
              <button onClick={() => setShowTuner(false)} className="p-3 text-zinc-400 hover:text-red-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-7 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {tunerTab === 'style' ? (
                <div className="space-y-8">
                  {/* Theme Section */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 block">თემა</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', icon: Sun, label: 'ნათელი' },
                        { id: 'dark', icon: Moon, label: 'ბნელი' },
                        { id: 'sepia', icon: Coffee, label: 'სეპია' }
                      ].map((t) => (
                        <button key={t.id} onClick={() => setTheme(t.id as any)} className={cn('flex flex-col items-center justify-center gap-2 h-20 rounded-3xl border transition-all', theme === t.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500' : 'border-black/5 dark:border-white/10 hover:bg-black/5')}>
                          <t.icon className="w-5 h-5" /> <span className="text-[10px] font-bold uppercase">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Section */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 block">შრიფტი</label>
                    <div className="bg-black/5 dark:bg-white/5 p-1 rounded-2xl flex gap-1">
                      {['Inter', 'Sylfaen', 'Merriweather'].map((f) => (
                        <button key={f} onClick={() => setFont(f as any)} className={cn('flex-1 py-3 rounded-xl text-xs font-bold transition-all', font === f ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-zinc-500')}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <div className="flex justify-between mb-4"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ზომა</label><span className="text-xs font-black text-indigo-500">{fontSize}px</span></div>
                    <input type="range" min="14" max="32" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full accent-indigo-500" />
                  </div>

                  {/* Parallel Switch */}
                  <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Languages className="w-5 h-5 text-indigo-500" />
                      <div className="text-xs font-bold">გვერდი-გვერდ თარგმანი</div>
                    </div>
                    <button onClick={() => setShowParallel(!showParallel)} className={cn("w-10 h-6 rounded-full relative transition-all", showParallel ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700")}>
                      <motion.div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" animate={{ x: showParallel ? 16 : 0 }} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Voice Selection */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 block">AI ხმა</label>
                    <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="w-full bg-indigo-500/5 border border-indigo-500/10 rounded-2xl px-5 py-4 text-sm font-black outline-none appearance-none">
                      {effectiveLang === 'ka' && (
                        <optgroup label="Georgian">
                          <option value="ka-GE-EkaNeural">ეკა (ქალი)</option>
                          <option value="ka-GE-GiorgiNeural">გიორგი (კაცი)</option>
                        </optgroup>
                      )}
                      {effectiveLang === 'en' && (
                        <optgroup label="English">
                          <option value="en-US-AriaNeural">Aria (Female)</option>
                          <option value="en-US-DavisNeural">Davis (Male)</option>
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Rate & Pitch */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">სიჩქარე</label><span className="text-xs font-black text-amber-500">{ttsRate}</span></div>
                      <input type="range" min="-50" max="100" value={parseInt(ttsRate.replace('%',''))} onChange={(e) => setTtsRate(`${parseInt(e.target.value)>=0?'+':''}${e.target.value}%`)} className="w-full accent-amber-500" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ტონი</label><span className="text-xs font-black text-emerald-500">{ttsPitch}</span></div>
                      <input type="range" min="-50" max="50" value={parseInt(ttsPitch.replace('Hz',''))} onChange={(e) => setTtsPitch(`${parseInt(e.target.value)>=0?'+':''}${e.target.value}Hz`)} className="w-full accent-emerald-500" />
                    </div>
                  </div>

                  {/* AI Persona Selection */}
                  <div className="pt-4 border-t border-black/5 dark:border-white/5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-4 block">აქტიური AI ბოტი</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'linguist', name: 'ლინგვისტი', icon: Languages },
                        { id: 'philosopher', name: 'ფილოსოფოსი', icon: Coffee },
                        { id: 'librarian', name: 'ბიბლიოთეკარი', icon: Bookmark },
                        { id: 'storyteller', name: 'მთხრობელი', icon: Zap }
                      ].map((p) => (
                        <button 
                          key={p.id} 
                          onClick={() => setAiPersona(p.id)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-1",
                            aiPersona === p.id 
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-500 shadow-sm" 
                              : "border-black/5 dark:border-white/10 hover:bg-black/5 text-zinc-500"
                          )}
                        >
                          <p.icon className="w-4 h-4" />
                          <span className="text-[10px] font-bold">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audiobook Factory Button */}
                  <div className="pt-4 border-t border-black/5 dark:border-white/5">
                    <button 
                      onClick={handleGenerateAudiobook}
                      disabled={isGeneratingAudiobook}
                      className={cn(
                        "w-full py-4 rounded-3xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg",
                        isGeneratingAudiobook ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : "bg-indigo-500 text-white shadow-indigo-500/20"
                      )}
                    >
                      {isGeneratingAudiobook ? (
                        <div className="flex flex-col items-center gap-1">
                           <div className="flex items-center gap-2">
                             <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                             <span>გენერირება: {audiobookProgress}%</span>
                           </div>
                        </div>
                      ) : (
                        <><Headphones className="w-5 h-5" /> სრული აუდიოწიგნი</>
                      )}
                    </button>
                    {isGeneratingAudiobook && <div className="mt-2 w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden"><motion.div className="h-full bg-indigo-500" animate={{ width: `${audiobookProgress}%` }} /></div>}
                  </div>
                </div>
              )}
            </div>

            {/* Book Metadata Footer */}
            <div className="bg-indigo-500/5 dark:bg-white/5 p-6 border-t border-black/5 dark:border-white/10">
              <div className="flex justify-between items-end">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">პროგრესი</p>
                   <h4 className="text-sm font-black italic">{content.findIndex(s => s.id === activeSegment) + 1} / {content.length} თავი</h4>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">დარჩენილია</p>
                   <h4 className="text-sm font-black text-indigo-500 italic">~{calculateTimeRemaining()} წუთი</h4>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Premium Selection Popover */}
      <AnimatePresence>
        {selection && selection.rect && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            style={{
              position: 'fixed',
              left: Math.max(160, Math.min(window.innerWidth - 160, selection.rect.left + selection.rect.width / 2)),
              top: Math.max(20, selection.rect.top - 70),
              transform: 'translateX(-50%)',
            }}
            className="flex items-center gap-1 bg-zinc-900/90 dark:bg-white/90 backdrop-blur-xl text-white dark:text-zinc-900 rounded-full px-5 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.3)] z-[70] border border-white/10 dark:border-black/10 whitespace-nowrap"
          >
            <button 
              onClick={handleTranslate}
              className="flex items-center gap-2 px-2 py-1 hover:text-indigo-400 dark:hover:text-indigo-600 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Languages className="w-4 h-4" />}
              <span className="text-sm font-bold">თარგმნა</span>
            </button>
            <div className="w-[1px] h-5 bg-white/20 dark:bg-black/10 mx-1.5" />
            <button 
              onClick={handleExplain}
              className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-amber-400/20 to-orange-500/20 hover:from-amber-400/40 hover:to-orange-500/40 text-amber-500 dark:text-amber-400 rounded-full transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
              disabled={explainLoading}
            >
              {explainLoading ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4 shadow-amber-400 drop-shadow-lg" />}
              <span className="text-sm font-black tracking-wide">AI ახსნა</span>
            </button>
            <div className="w-[1px] h-5 bg-white/20 dark:bg-black/10 mx-1.5" />
            <button 
              onClick={() => handleListen()}
              className="flex items-center gap-2 px-2 py-1 hover:text-emerald-400 dark:hover:text-emerald-600 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span className="text-sm font-bold">მოსმენა</span>
            </button>
            <div className="w-[1px] h-5 bg-white/20 dark:bg-black/10 mx-1.5" />
            <button 
              onClick={() => handleSaveToFlashcard(selection.text)}
              className="flex items-center gap-2 px-2 py-1 hover:text-amber-400 dark:hover:text-amber-600 transition-colors"
            >
              <Bookmark className="w-4 h-4" />
              <span className="text-sm font-bold truncate max-w-[80px]">შენახვა</span>
            </button>
            <div className="w-[1px] h-5 bg-white/20 dark:bg-black/10 mx-1.5" />
            <div className="flex items-center gap-1.5 px-1 py-1">
              {[
                { id: 'yellow', class: 'bg-yellow-400 hover:bg-yellow-300' },
                { id: 'green', class: 'bg-green-400 hover:bg-green-300' },
                { id: 'blue', class: 'bg-blue-400 hover:bg-blue-300' },
                { id: 'pink', class: 'bg-pink-400 hover:bg-pink-300' }
              ].map(color => (
                <button
                  key={color.id}
                  onClick={() => handleAddHighlight(color.id as any)}
                  className={cn("w-5 h-5 rounded-full transition-transform hover:scale-125 shadow-sm border border-black/10 dark:border-white/10", color.class)}
                  title="ფერით მონიშვნა"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Translation Result Modal */}
      <AnimatePresence>
        {translation && (
          <div className="fixed inset-0 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative border border-white/50 dark:border-white/10"
            >
              <button 
                onClick={() => setTranslation(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Languages className="w-5 h-5 text-indigo-500" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">თარგმანი</h2>
              </div>
              <div className="font-sylfaen text-xl leading-relaxed text-zinc-800 dark:text-zinc-200">
                {translation}
              </div>
              <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex justify-end gap-3">
                <button 
                  onClick={() => setTranslation(null)}
                  className="px-6 py-3 rounded-2xl font-bold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  დახურვა
                </button>
                <button 
                  onClick={() => handleSaveToFlashcard()}
                  className="px-6 py-3 rounded-2xl bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Bookmark className="w-4 h-4" /> შენახვა
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Explanation Result Modal */}
      <AnimatePresence>
        {explainResult && (
          <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 max-h-[85vh] overflow-y-auto w-full max-w-2xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative border border-amber-500/20"
            >
              <button 
                onClick={() => setExplainResult(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="დახურვა (Esc)"
              >
                <X className="w-5 h-5 opacity-50 hover:opacity-100" />
              </button>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-amber-500 mb-1">AI ენციკლოპედია</h2>
                  <p className="text-xs text-zinc-400 font-bold tracking-wider">კონტექსტური ახსნა</p>
                </div>
              </div>
              <div className="prose prose-zinc dark:prose-invert prose-p:leading-loose prose-a:text-amber-500 font-sylfaen text-lg text-zinc-800 dark:text-zinc-200">
                {/* Basic markdown rendering by replacing \n with <br/> and using bold tags */}
                <div dangerouslySetInnerHTML={{ __html: explainResult.replace(/\n/g, '<br/>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>') }} />
              </div>
              <div className="mt-10 pt-6 border-t border-black/5 dark:border-white/5 flex gap-3">
                <button 
                  onClick={() => setExplainResult(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  გასაგებია
                </button>
                <button 
                  onClick={() => handleSaveToFlashcard(explainResult)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Bookmark className="w-5 h-5" /> ბარათებში შენახვა
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Error Message */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed top-8 left-1/2 bg-red-500/90 backdrop-blur-xl text-white px-6 py-3.5 rounded-2xl shadow-[0_20px_40px_rgba(239,68,68,0.3)] z-[100] font-medium flex items-center justify-between min-w-[300px] border border-red-400"
          >
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-4 opacity-70 hover:opacity-100 p-1">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note Modal */}
      <AnimatePresence>
        {activeHighlightId && (
          <div className="fixed inset-0 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6" onClick={() => setActiveHighlightId(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative border border-white/50 dark:border-white/10"
            >
              <button 
                onClick={() => setActiveHighlightId(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-6">პერსონალური ნოტა</h2>
              
              <textarea 
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="ჩაწერეთ თქვენი კომენტარი..."
                className="w-full h-32 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-zinc-900 dark:text-white font-sylfaen outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
              />
              
              <div className="mt-6 flex justify-between gap-3">
                <button 
                  onClick={() => {
                    removeHighlight(activeHighlightId);
                    setActiveHighlightId(null);
                  }}
                  className="px-6 py-3 rounded-2xl font-bold text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  მონიშვნის წაშლა
                </button>
                <button 
                  onClick={() => {
                    updateHighlightNote(activeHighlightId, noteText);
                    setActiveHighlightId(null);
                  }}
                  className="px-8 py-3 rounded-2xl bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:bg-indigo-600 active:scale-95 transition-all"
                >
                  შენახვა
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Table of Contents Sidebar */}
      <AnimatePresence>
        {showToc && !zenMode && (
          <motion.div
            initial={{ x: -350, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -350, opacity: 0 }}
            className="fixed top-0 left-0 bottom-0 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl shadow-2xl z-[80] border-r border-black/5 dark:border-white/10 flex flex-col pt-10"
          >
            <div className="px-6 flex items-center justify-between mb-8">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-500" /> სარჩევი
              </h2>
              <button onClick={() => setShowToc(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-20 space-y-1">
              {content.filter(s => s.isHeading).length > 0 ? (
                content.filter(s => s.isHeading).map((heading, idx) => (
                  <button
                    key={heading.id}
                    onClick={() => {
                      const headingIdx = content.findIndex(s => s.id === heading.id);
                      if (headingIdx >= visibleCount) {
                        setVisibleCount(headingIdx + 20);
                      }
                      setTimeout(() => {
                        const el = document.getElementById(`segment-${heading.id}`);
                        if (el) {
                          const y = el.getBoundingClientRect().top + window.scrollY - 100;
                          window.scrollTo({ top: y, behavior: 'smooth' });
                          if (window.innerWidth < 1024) setShowToc(false);
                        }
                      }, 50);
                    }}
                    className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-all text-sm line-clamp-2"
                  >
                    {heading.content}
                  </button>
                ))
              ) : (
                 <div className="px-6 py-8 text-center bg-black/5 dark:bg-white/5 rounded-2xl mx-2">
                   <Navigation className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                   <p className="text-sm text-zinc-500 font-medium">სარჩევი ამ წიგნისთვის ვერ მოიძებნა.</p>
                 </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Sidebar */}
      <AnimatePresence>
        {showSearch && !zenMode && (
          <motion.div
            initial={{ x: -350, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -350, opacity: 0 }}
            className="fixed top-0 left-0 bottom-0 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl shadow-2xl z-[80] border-r border-black/5 dark:border-white/10 flex flex-col pt-10"
          >
            <div className="px-6 flex items-center justify-between mb-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-500" /> ძებნა წიგნში
              </h2>
              <button onClick={() => setShowSearch(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-6 mb-4">
              <input
                type="text"
                autoFocus
                placeholder="ჩაწერეთ სიტყვა..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sylfaen"
              />
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-20 space-y-2">
              {searchQuery.length < 3 ? (
                <div className="px-6 py-8 text-center bg-black/5 dark:bg-white/5 rounded-2xl mx-2 mt-4">
                  <Search className="w-6 h-6 mx-auto text-zinc-400 mb-3" />
                  <p className="text-sm text-zinc-500 font-medium">ჩაწერეთ მინიმუმ 3 ასო საძიებლად.</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      const el = document.getElementById(`segment-${result.id}`);
                      if (el) {
                        const y = el.getBoundingClientRect().top + window.scrollY - 150;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                        setActiveSegment(result.id);
                        if (window.innerWidth < 1024) setShowSearch(false);
                      }
                    }}
                    className="w-full text-left px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 transition-all group"
                  >
                    <p className="text-xs text-zinc-400 mb-1 group-hover:text-indigo-500 transition-colors">სეგმენტი</p>
                    <p className="text-sm line-clamp-3 font-sylfaen">
                      {/* Highlight the matching keyword */}
                      {result.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                        part.toLowerCase() === searchQuery.toLowerCase() 
                          ? <mark key={i} className="bg-yellow-400/40 text-inherit px-0.5 rounded-sm">{part}</mark>
                          : part
                      )}
                    </p>
                  </button>
                ))
              ) : (
                <div className="px-6 py-8 text-center mx-2 mt-4">
                  <p className="text-sm text-zinc-500 font-medium">ვერ მოიძებნა: "{searchQuery}"</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};



export default Reader;
