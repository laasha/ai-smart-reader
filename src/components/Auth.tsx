import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Mail, Lock, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error('Supabase კავშირი ვერ დამყარდა. გთხოვთ შეამოწმოთ გარემო ცვლადები (VITE_SUPABASE_URL და VITE_SUPABASE_ANON_KEY).');
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      let errorMsg = err.message || 'დაფიქსირდა შეცდომა';
      if (errorMsg.includes('invalid') && errorMsg.includes('Email')) {
        errorMsg = 'არასწორი ელ.ფოსტის ფორმატი ან შეზღუდულია სისტემის მიერ.';
      } else if (errorMsg.includes('Password should be at least')) {
        errorMsg = 'პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს.';
      } else if (errorMsg.includes('User already registered')) {
        errorMsg = 'მომხმარებელი ამ ელ.ფოსტით უკვე არსებობს.';
      } else if (errorMsg.includes('Invalid login credentials')) {
        errorMsg = 'ელ.ფოსტა ან პაროლი არასწორია.';
      } else if (errorMsg.includes('rate limit')) {
        errorMsg = 'ძალიან ბევრი მცდელობა. გთხოვთ სცადოთ მოგვიანებით.';
      } else if (errorMsg.includes('missing email')) {
        errorMsg = 'გთხოვთ შეიყვანოთ ელ.ფოსტა.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-300/40 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full point-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full point-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-indigo-600/30 rotate-12 hover:rotate-0 transition-all duration-500"
        >
          <BookOpen className="w-10 h-10 text-white" />
        </motion.div>
        
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-center text-4xl font-black text-zinc-900 dark:text-white tracking-tight"
        >
          მკითხავი 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 ml-2 relative">
            AI <Sparkles className="inline-block w-5 h-5 absolute -top-4 -right-4 text-purple-400" />
          </span>
        </motion.h2>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto font-medium"
        >
          ჭკვიანი, ინტუიციური და თქვენზე მორგებული საკითხავი პლატფორმა.
        </motion.p>
      </div>

      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 25 }}
        className="mt-10 sm:mx-auto sm:w-full sm:max-w-[440px] relative z-10"
      >
        <div className="bg-white/80 dark:bg-black/50 py-10 px-8 sm:rounded-[2.5rem] sm:px-12 backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.05)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-white/40 dark:border-white/5">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-medium"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                ელ. ფოსტა
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-zinc-900 dark:text-white transition-all outline-none"
                  placeholder="თქვენი ელ. ფოსტა"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                პაროლი
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-zinc-900 dark:text-white transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-indigo-500/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95",
                  loading && "opacity-70 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'შესვლა' : 'რეგისტრაცია'}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white dark:bg-[#121214] text-zinc-500 font-medium tracking-wide rounded-full">ან</span>
              </div>
            </div>

            <div className="text-center pt-2 flex flex-col gap-4">
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
              >
                {isLogin ? 'არ გაქვთ ანგარიში? დარეგისტრირდით' : 'უკვე გაქვთ ანგარიში? შემოხვედით'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if ((window as any).bypassAuth) {
                    (window as any).bypassAuth();
                  }
                }}
                className="text-[10px] font-black uppercase tracking-widest text-white hover:text-white transition-all bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 rounded-xl py-3 shadow-lg shadow-indigo-500/10"
              >
                სწრაფი შესვლა (Bypass Auth - TESTING ONLY)
              </button>
            </div>

          </form>
        </div>
      </motion.div>
    </div>
  );
};
