import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, Plus, Search, BrainCircuit, Library, Sparkles, BookOpen, Trash2, 
  Loader2, BookX, LogOut, Link as LinkIcon, Globe, X, Edit, ChevronDown, 
  Headphones, Play, Bookmark 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useReaderStore } from '../store/useReaderStore';
import { extractTextFromPDF } from '../utils/pdfParser';
import { supabase } from '../services/supabase';
import { API_URL } from '../services/api';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const gradients = [
  'from-amber-400 to-orange-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-pink-500 to-rose-600',
  'from-purple-500 to-fuchsia-600'
];


const Dashboard = () => {
  const { 
    books, addBook, removeBook, setCurrentBook, fetchBooks, flashcards, 
    updateFlashcard, highlights, explanations, removeExplanation 
  } = useReaderStore();
  
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);
  const [tab, setTab] = useState<'books' | 'audio' | 'insights' | 'flashcards'>('books');
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing' | 'finalizing'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQueryApi, setSearchQueryApi] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', author: '', category: '', cover: '' });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedExtensions = ['pdf', 'epub', 'docx', 'txt', 'html', 'htm', 'md'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(extension)) {
      showToast('მხოლოდ PDF, EPUB, DOCX, TXT, HTML, MD ფაილებია მხარდაჭერილი.');
      return;
    }

    setIsUploading(true);
    setUploadStage('uploading');
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Stage 1: Uploading to server
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('სერვერმა ვერ დაამუშავა ფაილი');

      // Stage 2: Processing (Backend does this synchronously now, but we simulate stage transitions)
      setUploadStage('processing');
      const data = await response.json();
      
      // Stage 3: Finalizing in local store
      setUploadStage('finalizing');
      addBook({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        author: 'ატვირთული ფაილი',
        format: extension.toUpperCase() as any,
        progress: 0,
        addedAt: Date.now(),
        content: data.sections,
      });
      showToast('ფაილი წარმატებით დაემატა!');
    } catch (err) {
      console.error(err);
      showToast('ფაილის ატვირთვა ვერ მოხერხდა. შეამოწმეთ სერვერთან კავშირი.');
    } finally {
      setIsUploading(false);
      setUploadStage('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlImport = async (urlToImport: string = importUrl) => {
    if (!urlToImport) return;
    setIsUploading(true);
    setShowUrlModal(false);
    setShowSearchModal(false);
    showToast('მიმდინარეობს იმპორტი...');
    try {
      const response = await fetch(`${API_URL}/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToImport })
      });
      if (!response.ok) throw new Error('იმპორტი ვერ მოხერხდა');
      const data = await response.json();
      
      addBook({
        id: crypto.randomUUID(),
        title: data.filename,
        author: 'ინტერნეტიდან',
        format: 'WEB' as any,
        progress: 0,
        addedAt: Date.now(),
        content: data.sections,
      });
      showToast('წიგნი წარმატებით დაემატა!');
      setImportUrl('');
    } catch (err) {
      console.error(err);
      showToast('იმპორტი ვერ მოხერხდა.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearchCatalog = async () => {
    if (!searchQueryApi) return;
    setIsSearching(true);
    try {
      const [gutenRes, googleRes, webRes] = await Promise.all([
        fetch(`${API_URL}/search-books?query=${encodeURIComponent(searchQueryApi)}`),
        fetch(`${API_URL}/search-google-books?query=${encodeURIComponent(searchQueryApi)}`),
        fetch(`${API_URL}/search-web-deep?query=${encodeURIComponent(searchQueryApi)}`)
      ]);
      
      let combined: any[] = [];
      if (gutenRes.ok) {
        const d = await gutenRes.json();
        combined = [...combined, ...(d.results || [])];
      }
      if (googleRes.ok) {
        const d = await googleRes.json();
        combined = [...combined, ...(d.results || [])];
      }
      if (webRes.ok) {
        const d = await webRes.json();
        combined = [...combined, ...(d.results || [])];
      }
      setSearchResults(combined);
    } catch (err) {
      console.error(err);
      showToast('ძიება ვერ მოხერხდა.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddCatalogBook = async (bookRes: any) => {
    const url = bookRes.download_url;
    if (!url) {
      showToast('ამ წიგნის ტექსტური ვერსია (URL) მიუწვდომელია.');
      return;
    }
    setIsUploading(true);
    setShowSearchModal(false);
    showToast('მიმდინარეობს ჩამოტვირთვა...');
    try {
      const response = await fetch(`${API_URL}/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: bookRes.download_url })
      });
      if (!response.ok) throw new Error('იმპორტი ვერ მოხერხდა');
      const data = await response.json();
      
      addBook({
        id: crypto.randomUUID(),
        title: bookRes.title,
        author: bookRes.author,
        format: 'WEB' as any,
        progress: 0,
        addedAt: Date.now(),
        cover: bookRes.cover,
        category: bookRes.category || 'კატალოგი',
        content: data.sections || [],
      });
      showToast('წიგნი კატალოგიდან წარმატებით დაემატა!');
    } catch (err) {
      console.error(err);
      showToast('წიგნის ტექსტის წამოღება ვერ მოხერხდა.');
    } finally {
      setIsUploading(false);
    }
  };

  const getGradientForBook = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  const filteredBooks = books
    .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.addedAt - a.addedAt);

  const booksByCategory = filteredBooks.reduce((acc, book) => {
    const cat = book.category || 'უნაკვეთო (Uncategorized)';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(book);
    return acc;
  }, {} as Record<string, typeof books>);

  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const dueCards = flashcards.filter(c => c.nextReview <= Date.now());
  const reviewedCardsCount = flashcards.length - dueCards.length;

  const handleReview = (performance: number) => {
    if (reviewIndex === null) return;
    const card = dueCards[reviewIndex];
    updateFlashcard(card.id, performance);
    
    if (reviewIndex < dueCards.length - 1) {
      setReviewIndex(reviewIndex + 1);
      setShowAnswer(false);
    } else {
      setReviewIndex(null);
      setShowAnswer(false);
      showToast('დღევანდელი სესია დასრულებულია! 🎉');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 overflow-hidden relative selection:bg-indigo-500/30">
      
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.epub,.docx,.txt,.html,.htm,.md" className="hidden" />

      {/* Premium Background Blurs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-purple-500/20 dark:bg-purple-600/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-[2rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="relative bg-white dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 p-5 rounded-[2rem] shadow-2xl">
                <Library className="w-10 h-10 text-indigo-500" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-1 sm:mb-2 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500 bg-clip-text text-transparent italic leading-[1.1]">
                მკითხავი<span className="text-indigo-500">.</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium tracking-wide flex items-center gap-2 text-xs sm:text-sm md:text-base leading-tight">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" /> თქვენი ინტელექტუალური ბაზა
              </p>
            </div>
          </motion.div>
          
          <motion.div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
            <div className="relative w-full sm:w-64">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
               <input 
                 type="text" 
                 placeholder="ძებნა წიგნებში..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-white/50 dark:bg-white/5 backdrop-blur-2xl border border-black/5 dark:border-white/10 text-zinc-900 dark:text-white rounded-full py-3.5 pl-12 pr-4 shadow-lg shadow-black/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium placeholder:text-zinc-400"
               />
            </div>
            
            <div className="relative z-50">
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                disabled={isUploading}
                className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3.5 rounded-full font-bold shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] active:scale-95 transition-all overflow-hidden shrink-0"
              >
                 {isUploading ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <Plus className={cn("w-5 h-5 transition-transform duration-300 shrink-0", showAddMenu && "rotate-45")} />}
                <span className="hidden sm:inline whitespace-nowrap">
                  {uploadStage === 'uploading' ? 'იტვირთება...' : 
                   uploadStage === 'processing' ? 'მუშავდება...' : 
                   uploadStage === 'finalizing' ? 'თითქმის მზადაა...' : 'ატვირთვა'}
                </span>
                {!isUploading && <ChevronDown className="w-4 h-4 opacity-70 hidden sm:inline shrink-0" />}
              </button>
              
              <AnimatePresence>
                {showAddMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                    className="absolute top-full lg:right-0 mt-3 w-64 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-2xl rounded-2xl p-2 flex flex-col gap-1 overflow-hidden"
                  >
                    <button onClick={() => { setShowAddMenu(false); fileInputRef.current?.click(); }} disabled={isUploading} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium">
                      <div className="p-2 bg-indigo-500/10 rounded-lg"><Upload className="w-4 h-4 text-indigo-500" /></div>
                      <div>
                        <div className="text-zinc-900 dark:text-zinc-100 text-sm">ფაილის ატვირთვა</div>
                        <div className="text-zinc-500 text-xs">PDF, EPUB, DOCX, TXT</div>
                      </div>
                    </button>
                    <button onClick={() => { setShowAddMenu(false); setShowUrlModal(true); }} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium">
                      <div className="p-2 bg-blue-500/10 rounded-lg"><LinkIcon className="w-4 h-4 text-blue-500" /></div>
                      <div>
                        <div className="text-zinc-900 dark:text-zinc-100 text-sm">ბმულით დამატება</div>
                        <div className="text-zinc-500 text-xs">სტატიის ან დოკუმენტის URL</div>
                      </div>
                    </button>
                    <button onClick={() => { setShowAddMenu(false); setShowSearchModal(true); }} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left font-medium">
                      <div className="p-2 bg-emerald-500/10 rounded-lg"><Globe className="w-4 h-4 text-emerald-500" /></div>
                      <div>
                        <div className="text-zinc-900 dark:text-zinc-100 text-sm">კატალოგში ძებნა</div>
                        <div className="text-zinc-500 text-xs">უფასო წიგნები (Gutenberg)</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center p-3.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
              title="გასვლა"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </motion.div>
        </header>

        {/* Premium Tab Switcher */}
        <div className="flex gap-8 border-b border-black/5 dark:border-white/5 mb-12 relative overflow-x-auto hide-scrollbar">
          {(['books', 'audio', 'insights', 'flashcards'] as const).map((t) => (
            <button 
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "pb-6 font-bold text-lg md:text-xl transition-all relative capitalize whitespace-nowrap flex items-center gap-2",
                tab === t ? "text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              )}
            >
              {t === 'books' && <Library className="w-5 h-5" />}
              {t === 'audio' && <Headphones className="w-5 h-5" />}
              {t === 'insights' && <Sparkles className="w-5 h-5" />}
              {t === 'flashcards' && <BrainCircuit className="w-5 h-5" />}
              
              {t === 'books' ? 'ბიბლიოთეკა' : 
               t === 'audio' ? 'აუდიო' : 
               t === 'insights' ? 'ინსაიტები' : 'ბარათები'}
              
              {tab === t && (
                <motion.div layoutId="activeTabBadge" className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-indigo-500 rounded-t-full shadow-[0_-4px_12px_rgba(99,102,241,0.5)]" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'books' ? (
            <motion.div key="books" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.5, staggerChildren: 0.1 }}>
              {filteredBooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 text-center">
                   <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                      <BookX className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                   </div>
                   <h3 className="text-xl font-bold mb-2">ცარიელია</h3>
                   <p className="text-zinc-400 font-medium">სიაში წიგნები ვერ მოიძებნა. სცადეთ PDF ფაილის ატვირთვა.</p>
                </div>
              ) : (
                <div className="space-y-16 pb-20 mt-8">
                  {Object.entries(booksByCategory).map(([category, shelfBooks]) => (
                    <div key={category} className="relative pt-6">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-black/5 dark:border-white/10">
                          <Library className="w-6 h-6 text-indigo-500" />
                        </div>
                        <h2 className="text-3xl font-black capitalize italic drop-shadow-sm">{category}</h2>
                        <div className="flex-1 h-px bg-gradient-to-r from-black/10 dark:from-white/10 to-transparent ml-4" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10 relative z-10 px-4">
                        {shelfBooks.map((book, idx) => (
                          <motion.div
                            key={book.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -12, scale: 1.02 }}
                            onClick={() => setCurrentBook(book.id)}
                            className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-2xl p-6 h-[400px] rounded-t-[2.5rem] rounded-b-xl border-x border-t border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgb(0,0,0,0.05)] cursor-pointer group flex flex-col relative overflow-hidden"
                          >
                            <div className={cn("absolute top-0 right-0 w-32 h-32 bg-gradient-to-br rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity duration-500", getGradientForBook(book.id))} />
                            
                            <div className="flex justify-between items-start mb-auto relative z-10">
                              <div className={cn("w-24 h-32 rounded-xl flex items-center justify-center shadow-2xl bg-gradient-to-br overflow-hidden border border-white/20 relative group-hover:scale-110 transition-transform duration-500", getGradientForBook(book.id))}>
                                {book.cover ? (
                                  <img src={book.cover} alt="cover" className="w-full h-full object-cover" />
                                ) : (
                                  <BookOpen className="w-10 h-10 text-white/80" />
                                )}
                                {book.category && (
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-white drop-shadow-lg" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="bg-zinc-100 dark:bg-black/50 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                                  {book.format}
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setEditingBook(book); 
                                      setEditForm({ title: book.title, author: book.author, category: book.category || '', cover: book.cover || '' }); 
                                    }}
                                    className="p-2 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); removeBook(book.id); showToast('წიგნი წაიშალა'); }}
                                    className="p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="relative z-10 mt-6">
                              <h3 className="text-xl font-black mb-1 leading-tight group-hover:text-indigo-500 transition-colors line-clamp-2">{book.title}</h3>
                              <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm line-clamp-1">{book.author}</p>
                            </div>

                            <div className="relative z-10 mt-6 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl mx-[-8px] mb-[-8px]">
                              <div className="flex justify-between text-xs font-bold text-zinc-400 mb-2">
                                <span className="uppercase tracking-wider">პროგრესი</span>
                                <span className="text-zinc-900 dark:text-white">{Math.round(book.progress)}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                  className={cn("h-full rounded-full bg-gradient-to-r", getGradientForBook(book.id))} 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${book.progress}%` }}
                                  transition={{ duration: 1.5, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Aesthetic 'Wooden/Glass' Shelf Line */}
                      <div className="absolute bottom-[-10px] left-0 right-0 h-4 bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 rounded-lg shadow-[0_15px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.4)] border-t border-white/50 dark:border-white/10" />
                      <div className="absolute bottom-[-20px] left-4 right-4 h-6 bg-black/5 dark:bg-black/40 blur-md rounded-full -z-10" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : tab === 'audio' ? (
            <motion.div key="audio" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {books.filter(b => b.audiobookUrl).length > 0 ? (
                    books.filter(b => b.audiobookUrl).map(book => (
                      <div key={book.id} className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/50 dark:border-white/10 flex items-center gap-6 group">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg shrink-0">
                          {book.cover ? <img src={book.cover} className="w-full h-full object-cover" /> : <div className={cn("w-full h-full flex items-center justify-center bg-gradient-to-br", getGradientForBook(book.id))}><BookOpen className="text-white/50" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-lg truncate mb-1">{book.title}</h3>
                          <p className="text-zinc-500 text-xs mb-4">{book.author}</p>
                          <button 
                            onClick={() => setCurrentBook(book.id)}
                            className="bg-indigo-500 text-white px-6 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all w-fit"
                          >
                            <Play className="w-3 h-3 fill-current" /> მოსმენა
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center opacity-50">
                      <Headphones className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-bold">აუდიოწიგნები არ არის. გახსენით წიგნი და გამოიყენეთ "Audiobook Factory".</p>
                    </div>
                  )}
               </div>
            </motion.div>
          ) : tab === 'insights' ? (
            <motion.div key="insights" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {explanations.length > 0 || highlights.length > 0 ? (
                    <>
                      {explanations.map(exp => (
                        <div key={exp.id} className="bg-indigo-50/50 dark:bg-indigo-500/5 p-8 rounded-[2rem] border border-indigo-500/10 relative group">
                           <div className="flex items-center gap-2 mb-4 opacity-60">
                              <Sparkles className="w-4 h-4 text-indigo-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{books.find(b => b.id === exp.bookId)?.title || 'Book'}</span>
                           </div>
                           <p className="text-zinc-500 italic text-sm mb-4 line-clamp-3">"{exp.text}"</p>
                           <div className="h-px bg-indigo-500/10 mb-4" />
                           <p className="text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed">{exp.explanation}</p>
                           <button onClick={(e) => { e.stopPropagation(); removeExplanation(exp.id); }} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                      {highlights.map(hl => (
                        <div key={hl.id} className="bg-white/60 dark:bg-zinc-900/40 p-8 rounded-[2rem] border border-black/5 dark:border-white/5 relative group">
                           <div className="flex items-center gap-2 mb-4 opacity-60">
                              <Bookmark className="w-4 h-4 text-zinc-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{books.find(b => b.id === hl.bookId)?.title || 'Book'}</span>
                           </div>
                           <p className={cn(
                             "font-bold leading-relaxed mb-4",
                             hl.color === 'yellow' ? 'text-amber-600' : hl.color === 'green' ? 'text-emerald-600' : hl.color === 'blue' ? 'text-blue-600' : 'text-pink-600'
                           )}>
                             {hl.text}
                           </p>
                           {hl.note && (
                             <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                               <p className="text-xs text-zinc-500 italic">{hl.note}</p>
                             </div>
                           )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="col-span-full py-20 text-center opacity-50">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-bold">ინსაიტები ჯერ არ არის. კითხვისას გამოიყენეთ "AI ახსნა" ან მონიშნეთ ტექსტი.</p>
                    </div>
                  )}
               </div>
            </motion.div>
          ) : (
            <motion.div key="flashcards" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
              
              {reviewIndex !== null ? (
                // Active Review Session
                <div className="max-w-xl mx-auto py-12">
                   <div className="flex justify-between items-center mb-12">
                      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">სესია: {reviewIndex + 1} / {dueCards.length}</h2>
                      <button onClick={() => setReviewIndex(null)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-bold text-sm">შეწყვეტა</button>
                   </div>
                   
                   <motion.div 
                     layoutId="card-review"
                     className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 rounded-[3rem] p-12 shadow-2xl min-h-[400px] flex flex-col items-center justify-center text-center relative overflow-hidden"
                   >
                     <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500/20">
                        <motion.div className="h-full bg-indigo-500" animate={{ width: `${((reviewIndex + 1) / dueCards.length) * 100}%` }} />
                     </div>

                     <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-8">{dueCards[reviewIndex].context}</p>
                     
                     <h3 className="text-3xl md:text-4xl font-bold mb-12 leading-tight">{dueCards[reviewIndex].original}</h3>
                     
                     <AnimatePresence>
                       {showAnswer ? (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                            <div className="h-px bg-black/5 dark:bg-white/5 w-full mb-8" />
                            <p className="text-4xl font-black font-sylfaen text-indigo-500 mb-12">{dueCards[reviewIndex].translated}</p>
                            
                            <div className="grid grid-cols-5 gap-2">
                               {[1, 2, 3, 4, 5].map((num) => (
                                 <button 
                                   key={num}
                                   onClick={() => handleReview(num)}
                                   className={cn(
                                     "h-12 rounded-2xl font-black text-sm transition-all active:scale-95",
                                     num <= 2 ? "bg-red-500 text-white" : num === 3 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                                   )}
                                 >
                                   {num}
                                 </button>
                               ))}
                            </div>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase mt-4 tracking-tighter">შეაფასეთ დამახსოვრების ხარისხი (1-5)</p>
                         </motion.div>
                       ) : (
                         <button 
                           onClick={() => setShowAnswer(true)}
                           className="px-12 py-4 bg-indigo-500 text-white rounded-full font-black shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
                         >
                           პასუხის ნახვა
                         </button>
                       )}
                     </AnimatePresence>
                   </motion.div>
                </div>
              ) : (
                // Flashcards Overview
                <div className="space-y-12">
                  {dueCards.length > 0 ? (
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-8">
                      <div>
                        <h2 className="text-4xl font-black tracking-tight mb-2 italic">დღიური გამეორება</h2>
                        <p className="opacity-80 font-medium">თქვენ გაქვთ {dueCards.length} სიტყვა გასამეორებელი დღეს.</p>
                      </div>
                      <button 
                        onClick={() => { setReviewIndex(0); setShowAnswer(false); }}
                        className="px-10 py-4 bg-white text-indigo-600 rounded-full font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                      >
                        <BrainCircuit className="w-5 h-5" /> დაწყება
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[3rem] p-10 text-center">
                       <h2 className="text-2xl font-black text-emerald-600 mb-2 italic">ყველაფერი ნასწავლია! 🎉</h2>
                       <p className="text-emerald-600/60 font-medium tracking-wide">დღეისთვის ყველა ბარათი გამეორებულია. დაბრუნდით ხვალ.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flashcards.map((card, idx) => (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={card.id} className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-2xl transition-all group">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-xl">
                              <BrainCircuit className="w-5 h-5 text-purple-500" />
                            </div>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest line-clamp-1">{card.context}</span>
                          </div>
                          {card.nextReview > Date.now() && (
                             <div className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-1 rounded-md">
                                მზადაა
                             </div>
                          )}
                        </div>
                        <div className="space-y-6">
                          <div>
                            <p className="text-zinc-400 uppercase text-[10px] font-black tracking-widest mb-1">ორიგინალი</p>
                            <p className="text-xl font-bold leading-snug line-clamp-2">{card.original}</p>
                          </div>
                          <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/10 to-transparent" />
                          <div>
                            <p className="text-indigo-500 uppercase text-[10px] font-black tracking-widest mb-1">თარგმანი</p>
                            <p className="text-2xl font-bold font-sylfaen text-zinc-900 dark:text-white line-clamp-2">{card.translated}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {showUrlModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-[calc(100vw-2rem)] mx-auto bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl max-w-md shadow-2xl border border-black/5 dark:border-white/10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">ბმულით დამატება</h3>
                  <button onClick={() => setShowUrlModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                <input 
                  type="url" 
                  autoFocus
                  placeholder="ჩასვით სტატიის ან PDF/EPUB-ის ბმული..." 
                  value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none p-4 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  onClick={() => handleUrlImport()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-colors"
                >
                  იმპორტირება
                </button>
              </motion.div>
            </motion.div>
          )}

          {showSearchModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-[calc(100vw-2rem)] mx-auto bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl max-w-2xl shadow-2xl border border-black/5 dark:border-white/10 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3"><Globe className="text-indigo-500"/> კატალოგში ძებნა</h3>
                  <button onClick={() => setShowSearchModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                <div className="flex gap-4 mb-6">
                  <input 
                    type="text" 
                    placeholder="ძებნა სათაურით ან ავტორით (Gutenberg)..." 
                    value={searchQueryApi} onChange={(e) => setSearchQueryApi(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchCatalog()}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none p-4 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={handleSearchCatalog}
                    disabled={isSearching}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl transition-colors shrink-0"
                  >
                    {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 pr-2 space-y-4">
                  {searchResults.map((res: any) => (
                    <div key={res.id} className="flex gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/5 dark:border-white/5">
                      {res.cover ? <img src={res.cover} alt="cover" className="w-16 h-24 object-cover rounded-lg shrink-0" /> : <div className="w-16 h-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg shrink-0 flex items-center justify-center"><BookOpen className="w-6 h-6 text-zinc-400"/></div>}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-base sm:text-lg leading-tight truncate">{res.title}</h4>
                          {res.category === 'Deep Web' && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shrink-0">WEB</span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate mb-2">{res.author}</p>
                        {res.snippet && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 mb-3 leading-relaxed italic opacity-80">{res.snippet}</p>
                        )}
                        <button 
                          onClick={() => handleAddCatalogBook(res)}
                          className="self-start text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors"
                        >
                          ბიბლიოთეკაში დამატება
                        </button>
                      </div>
                    </div>
                  ))}
                  {!isSearching && searchResults.length === 0 && searchQueryApi && (
                    <p className="text-center text-zinc-500 py-10">შედეგები ვერ მოიძებნა</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editingBook && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-[calc(100vw-2rem)] mx-auto bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl max-w-md shadow-2xl border border-black/5 dark:border-white/10 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-2xl font-bold flex items-center gap-2"><Edit className="w-6 h-6 text-indigo-500"/> რედაქტირება</h3>
                  <button onClick={() => setEditingBook(null)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">სათაური</label>
                  <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800 border-none p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">ავტორი</label>
                  <input type="text" value={editForm.author} onChange={e => setEditForm({...editForm, author: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800 border-none p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">კატეგორია</label>
                  <input type="text" placeholder="მაგ: კლასიკა, ფანტასტიკა..." value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800 border-none p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 block">ყდის (Cover) ბმული</label>
                  <input type="url" placeholder="https://..." value={editForm.cover} onChange={e => setEditForm({...editForm, cover: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800 border-none p-3 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={() => setEditingBook(null)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-bold transition-colors">გაუქმება</button>
                  <button 
                    onClick={() => {
                      useReaderStore.getState().updateBook(editingBook.id, editForm);
                      setEditingBook(null);
                      showToast('წიგნი განახლდა!');
                    }} 
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors"
                  >
                    შენახვა
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.9 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900/90 dark:bg-white/90 backdrop-blur-xl text-white dark:text-zinc-900 px-6 py-3.5 rounded-2xl shadow-2xl z-50 font-medium whitespace-nowrap border border-white/10">
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;
