import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Reader from './components/Reader';
import { Auth } from './components/Auth';
import { useReaderStore } from './store/useReaderStore';
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';

function App() {
  const { currentBookId, books, setCurrentBook, fetchBooks } = useReaderStore();
  const currentBook = books.find(b => b.id === currentBookId);
  const [session, setSession] = useState<Session | null>(null);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    // Expose a bypass for testing (Available in production for current verification phase)
    (window as any).bypassAuth = () => {
      setIsMock(true);
      fetchBooks();
    };

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchBooks();
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchBooks();
      });

      return () => subscription.unsubscribe();
    } else if (!import.meta.env.DEV) {
      console.error("Supabase client failed to initialize. Check your environment variables.");
    }
  }, [fetchBooks]);

  const isLoggedIn = session || isMock;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-inter selection:bg-indigo-500/30">
      <div className="absolute top-0 right-0 p-3 text-[10px] sm:text-xs font-mono text-zinc-500/40 pointer-events-none z-50 flex flex-col items-end">
        <div>v2.0 (Serverless Edge) {isMock && <span className="text-yellow-500/50">[MOCK MODE]</span>}</div>
        {!supabase && <div className="text-red-500/50 animate-pulse">[SUPABASE MISSING]</div>}
      </div>
      {!isLoggedIn ? (
        <Auth />
      ) : currentBook ? (
        <Reader content={currentBook.content} bookId={currentBook.id} onBack={() => setCurrentBook(null)} />
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
