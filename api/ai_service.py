import httpx
import json
from dotenv import load_dotenv
import os
import hashlib
import edge_tts
import asyncio
import re
import google.generativeai as genai

load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    print("Warning: GEMINI_API_KEY is missing.")
    model = None

# Use /tmp for Vercel serverless environment
CACHE_DIR = "/tmp/audio_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)

# Keep track of progress in memory
audiobook_progress = {}

# Bot Personas Definitions
PERSONAS = {
    "linguist": {
        "name": "Linguist Bot",
        "description": "Expert in Georgian grammar, etymology, and idiom origins.",
        "prompt_prefix": "You are an expert Georgian Linguist and Etymologist. Focus on word origins, grammar nuances, and help the user master the Georgian language."
    },
    "philosopher": {
        "name": "Philosopher Bot",
        "description": "Deep thinker focusing on existential themes and subtext.",
        "prompt_prefix": "You are a contemplative Literary Philosopher. Focus on the subtext, moral dilemmas, and existential themes in the selected text."
    },
    "librarian": {
        "name": "Librarian Bot",
        "description": "Historical context and literary categorization expert.",
        "prompt_prefix": "You are a professional Historical Librarian. Focus on the historical context, author's background, and literary era influences."
    },
    "storyteller": {
        "name": "Storyteller Bot",
        "description": "Simple, engaging, and imaginative explanations for any age.",
        "prompt_prefix": "You are a friendly Storyteller. Explain the text in a simple, engaging, and imaginative way that anyone (including children) can enjoy."
    }
}

async def translate_text(text: str, target_lang: str = "ka", context: str = None) -> str:
    """Uses Google's free translation API for speed."""
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {"client": "gtx", "dt": "t", "sl": "auto", "tl": target_lang, "q": text}
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return "".join([item[0] for item in data[0]])
    except Exception as e:
        print(f"Translation error: {e}")
        return text

def prepare_text_for_tts(text: str) -> str:
    """Injects natural pauses for the TTS engine."""
    text = re.sub(r'([—-])\s*(?=[ა-ჰa-zA-Z])', r'\1, ', text)
    return text

async def generate_audio_stream(text: str, voice: str = "ka-GE-EkaNeural", rate: str = "+0%", pitch: str = "+0Hz", translate_to: str = None) -> str:
    if translate_to and translate_to != 'none':
        text = await translate_text(text, target_lang=translate_to)

    tts_ready_text = prepare_text_for_tts(text)
    cache_key = f"{tts_ready_text}_{voice}_{rate}_{pitch}_{translate_to}"
    text_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
    cache_path = os.path.join(CACHE_DIR, f"{text_hash}.mp3")
    audio_url = f"/api/audio/{os.path.basename(cache_path)}"
    
    if os.path.exists(cache_path):
        return audio_url
        
    communicate = edge_tts.Communicate(tts_ready_text, voice, rate=rate, pitch=pitch)
    await communicate.save(cache_path)
    return audio_url

async def explain_text(text: str, context: str = "", persona_id: str = "linguist") -> str:
    """Uses Gemini to provide persona-based literary explanations."""
    if not model:
        return "GEMINI_API_KEY არ არის მითითებული .env ფაილში."
    
    persona = PERSONAS.get(persona_id, PERSONAS["linguist"])
    
    try:
        prompt = (
            f"{persona['prompt_prefix']}\n\n"
            f"Explain this text: '{text}' within this context: '{context}'.\n\n"
            "RESPOND ONLY IN BEAUTIFUL GEORGIAN (using markdown). Be concise but insightful."
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text
    except Exception as e:
        print(f"Gemini Explain error: {e}")
        return "შეცდომა განმარტებისას. გთხოვთ სცადოთ მოგვიანებით."

async def analyze_book(title: str, author: str, content_sample: str) -> dict:
    if not model:
        return {"category": "Fiction", "summary": "Gemini API unavailable."}
    try:
        prompt = (
            f"Analyze the book '{title}' by '{author}' based on this snippet: '{content_sample[:2000]}'.\n"
            "Return a JSON with 'category' (one word) and 'summary' (max 20 words)."
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        # Clean JSON from markdown if Gemini wraps it
        clean_text = response.text.strip('` \n').replace('json', '', 1).strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Gemini Analyze error: {e}")
        return {"category": "Fiction", "summary": f"A book by {author}."}

async def generate_ai_flashcard(text: str, context: str) -> dict:
    if not model:
        return {"question": text, "answer": "API Error"}
    try:
        prompt = (
            f"Create a language learning flashcard for '{text}' in this context: '{context}'.\n"
            "Return JSON with 'question' (fill-in-the-blank) and 'answer' (meaning in Georgian)."
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        clean_text = response.text.strip('` \n').replace('json', '', 1).strip()
        return json.loads(clean_text)
    except Exception as e:
        return {"question": text, "answer": "Error"}

async def generate_full_audiobook(book_id: str, title: str, sections: list, voice: str, rate: str, pitch: str):
    try:
        audiobook_progress[book_id] = 0
        book_dir = os.path.join(CACHE_DIR, "audiobooks", book_id)
        os.makedirs(book_dir, exist_ok=True)
        total = len(sections)
        for i, section in enumerate(sections):
            text = section.get("content", "")
            if not text.strip(): continue
            ready_text = prepare_text_for_tts(text)
            chunk_hash = hashlib.md5(f"{book_id}_{i}_{voice}_{rate}_{pitch}".encode()).hexdigest()
            chunk_path = os.path.join(book_dir, f"chunk_{i:04d}_{chunk_hash}.mp3")
            if not os.path.exists(chunk_path):
                communicate = edge_tts.Communicate(ready_text, voice, rate=rate, pitch=pitch)
                await communicate.save(chunk_path)
            audiobook_progress[book_id] = int(((i + 1) / total) * 100)
        audiobook_progress[book_id] = 100
    except Exception as e:
        audiobook_progress[book_id] = -1

async def chat_with_book(query: str, context: str) -> str:
    if not model: return "API Error."
    try:
        prompt = f"Context from book: {context}\n\nUser Question: {query}\n\nRespond in clear Georgian."
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text
    except Exception as e:
        return "Error."
