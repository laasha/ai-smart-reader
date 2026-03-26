import httpx
import json
from dotenv import load_dotenv
import os
import hashlib
import edge_tts
import asyncio
import google.generativeai as genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    print("Warning: GEMINI_API_KEY is missing.")
    model = None

CACHE_DIR = os.getenv("AUDIO_CACHE_DIR", "audio_cache")
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)

audiobook_progress = {}

async def translate_text(text: str, target_lang: str = "ka", context: str = None) -> str:
    """
    Uses Google's free translation API.
    """
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "dt": "t",
            "sl": "auto",
            "tl": target_lang,
            "q": text
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            translated = "".join([item[0] for item in data[0]])
            return translated
    except Exception as e:
        print(f"Translation error: {e}")
        return text # Return original on failure

def prepare_text_for_tts(text: str) -> str:
    """Injects natural pauses for the TTS engine by modifying punctuation."""
    # TTS engines rush over dashes. We replace em-dashes marking dialogues with a dash and a comma to force a breathing pause.
    text = re.sub(r'([—-])\s*(?=[ა-ჰa-zA-Z])', r'\1, ', text)
    return text

async def generate_audio_stream(text: str, voice: str = "ka-GE-EkaNeural", rate: str = "+0%", pitch: str = "+0Hz", translate_to: str = None) -> str:
    """
    Uses edge-tts to generate audio. 
    Caches the audio locally.
    If translate_to is provided, translates the text first.
    """
    # Translate if requested
    if translate_to and translate_to != 'none':
        text = await translate_text(text, target_lang=translate_to)

    tts_ready_text = prepare_text_for_tts(text)

    cache_key = f"{tts_ready_text}_{voice}_{rate}_{pitch}_{translate_to}"
    text_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
    
    cache_path = os.path.join(CACHE_DIR, f"{text_hash}.mp3")
    
    if os.path.exists(cache_path):
        return f"http://localhost:8000/audio/{os.path.basename(cache_path)}"
        
    # Generate TTS using edge-tts
    communicate = edge_tts.Communicate(tts_ready_text, voice, rate=rate, pitch=pitch)
    await communicate.save(cache_path)

                
    return f"http://localhost:8000/audio/{os.path.basename(cache_path)}"

async def explain_text(text: str, context: str = "") -> str:
    """Uses Gemini to provide a smart, contextual literary explanation."""
    if not model:
        return "GEMINI_API_KEY არ არის მითითებული .env ფაილში. გთხოვთ დაამატოთ GEMINI_API_KEY."
    try:
        prompt = (
            "You are an expert literary assistant and linguist. Your job is to explain the meaning, "
            "nuance, and context of the selected text within its surrounding paragraph. "
            "Do not just translate. Explain idiomatically if it's an idiom, historically if it's a historical term. "
            "Respond ONLY in beautifully formatted Georgian (using markdown if needed). Be concise but insightful.\n\n"
            f"Selected text to explain: '{text}'\n\nSurrounding Context:\n'{context}'"
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text
    except Exception as e:
        print(f"Explain error: {e}")
        return "შეცდომა განმარტების გენერაციისას. გთხოვთ სცადოთ მოგვიანებით."

async def analyze_book(title: str, author: str, content_sample: str) -> dict:
    """Uses Gemini to analyze a book's genre and provide a short summary."""
    if not model:
        return {"category": "Uncategorized", "summary": "No AI analysis available."}
    try:
        prompt = (
            f"Analyze the book '{title}' by '{author}' based on this snippet: '{content_sample[:2000]}'.\n"
            "Return a JSON with 'category' (one word like 'Fantasy', 'History', 'Fiction') and 'summary' (max 20 words)."
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        clean_text = response.text.strip('` \n').replace('json', '', 1).strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Analyze error: {e}")
        return {"category": "Fiction", "summary": f"A book by {author}."}

async def generate_book_cover(title: str, summary: str, category: str) -> str:
    """Placeholder for book cover generation (Gemini Flash doesn't support images)."""
    return ""

async def generate_ai_flashcard(text: str, context: str) -> dict:
    """Uses Gemini to generate a smart flashcard question and answer based on context."""
    if not model:
        return {"question": text, "answer": "Translation not available."}
    try:
        prompt = (
            f"Create a language learning flashcard for the word '{text}' in this context: '{context}'.\n"
            "Return a JSON with 'question' (the word in a fill-in-the-blank sentence or a direct question) and 'answer' (the meaning in Georgian). Respond ONLY in JSON."
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        clean_text = response.text.strip('` \n').replace('json', '', 1).strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Flashcard AI error: {e}")
        return {"question": text, "answer": "Error generating answer."}

async def generate_full_audiobook(book_id: str, title: str, sections: list, voice: str, rate: str, pitch: str):
    """Background task to generate all MP3 chunks for a book."""
    try:
        audiobook_progress[book_id] = 0
        book_dir = os.path.join(CACHE_DIR, "audiobooks", book_id)
        if not os.path.exists(book_dir):
            os.makedirs(book_dir)

        total = len(sections)
        for i, section in enumerate(sections):
            text = section.get("content", "")
            if not text.strip():
                continue
            
            # Use existing TTS logic (with dialogue pacing)
            ready_text = prepare_text_for_tts(text)
            
            # Clean filename-safe hash for the chunk
            chunk_hash = hashlib.md5(f"{book_id}_{i}_{voice}_{rate}_{pitch}".encode()).hexdigest()
            chunk_path = os.path.join(book_dir, f"chunk_{i:04d}_{chunk_hash}.mp3")
            
            if not os.path.exists(chunk_path):
                communicate = edge_tts.Communicate(ready_text, voice, rate=rate, pitch=pitch)
                await communicate.save(chunk_path)
            
            # Update progress
            audiobook_progress[book_id] = int(((i + 1) / total) * 100)
            
        # Mark as complete
        audiobook_progress[book_id] = 100
    except Exception as e:
        print(f"Audiobook generation failed for {book_id}: {e}")
        audiobook_progress[book_id] = -1 # Error state

async def chat_with_book(query: str, context: str) -> str:
    """Uses Gemini to answer questions based on a specific paragraph or context."""
    if not model:
        return "GEMINI_API_KEY არ არის მითითებული .env ფაილში. გთხოვთ დაამატოთ GEMINI_API_KEY."
    try:
        prompt = f"Context from the book:\n{context}\n\nQuestion: {query}\n\nRespond in clear, natural Georgian."
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text
    except Exception as e:
        print(f"Chat error: {e}")
        return "შეცდომა პასუხის გენერაციისას. გთხოვთ სცადოთ მოგვიანებით."
