-- AI Smart Reader & Audio Library - Database Schema

-- Users Table (Extends Supabase Auth)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    preferences JSONB DEFAULT '{"theme": "sepia", "font": "Sylfaen", "font_size": 18, "default_voice": "georgian_male_1"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books Table
CREATE TYPE book_status AS ENUM ('unread', 'reading', 'completed');

CREATE TABLE public.books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    language TEXT DEFAULT 'en',
    file_url TEXT NOT NULL, -- S3/Supabase Storage Path
    cover_url TEXT,
    status book_status DEFAULT 'unread',
    progress_percent FLOAT DEFAULT 0,
    last_read_position JSONB, -- JSON representation of the last paragraph/page locator
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collections (Playlists)
CREATE TABLE public.collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Book_Collections (Many-to-Many)
CREATE TABLE public.book_collections (
    book_id UUID REFERENCES public.books ON DELETE CASCADE,
    collection_id UUID REFERENCES public.collections ON DELETE CASCADE,
    PRIMARY KEY (book_id, collection_id)
);

-- Flashcards
CREATE TABLE public.flashcards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    book_id UUID REFERENCES public.books ON DELETE SET NULL,
    original_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    context_sentence TEXT,
    review_status INT DEFAULT 0, -- For Spaced Repetition (SRS)
    next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audio Cache
CREATE TABLE public.audio_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text_hash TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(text_hash, voice_id)
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified example for user-own-data)
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can manage their own books" ON public.books FOR ALL USING (auth.uid() = user_id);
