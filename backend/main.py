from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
from typing import List, Optional
import httpx
import uuid

# Local imports
from processing import extract_text_from_pdf, extract_text_from_epub, extract_text_from_docx, extract_text_from_txt, extract_text_from_html, extract_text_from_md
from ai_service import translate_text, generate_audio_stream, explain_text, analyze_book, generate_book_cover, generate_full_audiobook, audiobook_progress, generate_ai_flashcard


load_dotenv()

app = FastAPI(title="AI Smart Reader API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3030",
        "http://127.0.0.1:3030",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://mkitkhavi.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve cached audio
if not os.path.exists("audio_cache"):
    os.makedirs("audio_cache")
app.mount("/audio", StaticFiles(directory="audio_cache"), name="audio")

class TranslationRequest(BaseModel):
    text: str
    target_lang: str = "Georgian"
    context: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "ka-GE-EkaNeural"
    rate: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"
    translate_to: Optional[str] = None

class URLImportRequest(BaseModel):
    url: str

class ExplainRequest(BaseModel):
    text: str
    context: str

class AnalyzeBookRequest(BaseModel):
    title: str
    author: str
    content_sample: str

class GenerateCoverRequest(BaseModel):
    title: str
    summary: str
    category: str

class AudiobookRequest(BaseModel):
    book_id: str
    title: str
    sections: list
    voice: Optional[str] = "ka-GE-EkaNeural"
    rate: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"

class FlashcardAIRequest(BaseModel):
    text: str
    context: str

@app.post("/explain")
async def explain(request: ExplainRequest):
    try:
        explanation = await explain_text(request.text, request.context)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-book")
async def analyze(request: AnalyzeBookRequest):
    try:
        analysis = await analyze_book(request.title, request.author, request.content_sample)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-cover")
async def generate_cover(request: GenerateCoverRequest):
    try:
        cover_url = await generate_book_cover(request.title, request.summary, request.category)
        return {"cover_url": cover_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-audiobook")
async def generate_audiobook_endpoint(request: AudiobookRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        generate_full_audiobook, 
        request.book_id, 
        request.title, 
        request.sections, 
        request.voice, 
        request.rate, 
        request.pitch
    )
    return {"message": "Audiobook generation started in background."}

@app.get("/audiobook-status/{book_id}")
async def get_audiobook_status(book_id: str):
    progress = audiobook_progress.get(book_id, 0)
    return {"progress": progress}

@app.post("/generate-flashcard-ai")
async def generate_flashcard_ai_endpoint(request: FlashcardAIRequest):
    try:
        flashcard = await generate_ai_flashcard(request.text, request.context)
        return flashcard
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "AI Smart Reader API is running"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    extension = file.filename.split(".")[-1].lower()
    content = await file.read()
    
    # Temporarily save and process
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(content)
        
    try:
        if extension == "pdf":
            sections = extract_text_from_pdf(temp_path)
        elif extension == "epub":
            sections = extract_text_from_epub(temp_path)
        elif extension == "docx":
            sections = extract_text_from_docx(temp_path)
        elif extension == "txt":
            sections = extract_text_from_txt(temp_path)
        elif extension == "html" or extension == "htm":
            sections = extract_text_from_html(temp_path)
        elif extension == "md":
            sections = extract_text_from_md(temp_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        return {"filename": file.filename, "sections": sections}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/translate")
async def translate(request: TranslationRequest):
    try:
        translated_text = await translate_text(request.text, request.target_lang, request.context)
        return {"translated_text": translated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    try:
        audio_url = await generate_audio_stream(
            request.text, 
            voice=request.voice, 
            rate=request.rate, 
            pitch=request.pitch, 
            translate_to=request.translate_to
        )
        return {"audio_url": audio_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import-url")
async def import_url(request: URLImportRequest):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ka;q=0.8",
        }
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(request.url, headers=headers)
            response.raise_for_status()
            
        temp_path = f"temp_url_{uuid.uuid4().hex}"
        # Determine extension based on content-type or URL
        content_type = response.headers.get("content-type", "").lower()
        if "application/pdf" in content_type or request.url.lower().endswith(".pdf"):
            temp_path += ".pdf"
        elif "application/epub" in content_type or request.url.lower().endswith(".epub"):
            temp_path += ".epub"
        elif "text/plain" in content_type or request.url.lower().endswith(".txt"):
            temp_path += ".txt"
        else:
            temp_path += ".html"

        with open(temp_path, "wb") as f:
            f.write(response.content)
            
        try:
            if temp_path.endswith(".pdf"):
                sections = extract_text_from_pdf(temp_path)
            elif temp_path.endswith(".epub"):
                sections = extract_text_from_epub(temp_path)
            elif temp_path.endswith(".txt"):
                sections = extract_text_from_txt(temp_path)
            else:
                sections = extract_text_from_html(temp_path)
                
            if not sections:
                raise HTTPException(status_code=422, detail="ვერ მოხერხდა ტექსტის ამოღება ამ ლინკიდან")

            filename = request.url.split("/")[-1].split("?")[0] or "Web Article"
            if len(filename) > 50 or not filename: filename = "Web Article"
            
            return {"filename": filename, "sections": sections}
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except Exception as e:
        print(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search-books")
async def search_books(query: str):
    try:
        # Using Gutendex API for Project Gutenberg
        url = f"https://gutendex.com/books/?search={query}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
        results = []
        for book in data.get("results", [])[:10]:
            formats = book.get("formats", {})
            # Prefer plain text or html
            download_url = formats.get("text/html") or formats.get("text/plain; charset=utf-8") or formats.get("application/epub+zip")
            if download_url:
                results.append({
                    "id": str(book["id"]),
                    "title": book["title"],
                    "author": book["authors"][0]["name"] if book.get("authors") else "Unknown",
                    "download_url": download_url,
                    "cover": formats.get("image/jpeg")
                })
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search-web-deep")
async def search_web_deep(query: str):
    try:
        from bs4 import BeautifulSoup
        
        # Search query for finding documents
        search_query = f"{query} filetype:pdf OR filetype:epub"
        url = f"https://html.duckduckgo.com/html/?q={search_query}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html = response.text
            
        soup = BeautifulSoup(html, "html.parser")
        results = []
        
        # DuckDuckGo HTML result parsing
        for idx, result in enumerate(soup.find_all("div", class_="result")[:15]):
            title_tag = result.find("a", class_="result__a")
            snippet_tag = result.find("a", class_="result__snippet")
            
            if title_tag:
                title = title_tag.get_text()
                link = title_tag["href"]
                
                # DuckDuckGo redirect clean up
                if "/l/?kh=" in link:
                    try:
                        import urllib.parse
                        parsed = urllib.parse.urlparse(link)
                        params = urllib.parse.parse_qs(parsed.query)
                        if "uddg" in params:
                            link = params["uddg"][0]
                    except: pass
                
                snippet = snippet_tag.get_text() if snippet_tag else ""
                
                # Check if it looks like a document
                is_doc = any(ext in link.lower() for ext in [".pdf", ".epub", ".docx", ".txt"])
                
                results.append({
                    "id": f"web-{idx}",
                    "title": title,
                    "author": "Web Result",
                    "download_url": link,
                    "snippet": snippet,
                    "is_direct_doc": is_doc,
                    "category": "Deep Web"
                })
        
        return {"results": results}
    except Exception as e:
        print(f"Web search error: {e}")
        return {"results": []}

@app.get("/search-google-books")
async def search_google_books(query: str):
    try:
        url = f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=10"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
        results = []
        for item in data.get("items", []):
            vol = item.get("volumeInfo", {})
            acc = item.get("accessInfo", {})
            
            # Prefer direct download links, fallback to web reader
            download_url = (
                acc.get("epub", {}).get("downloadLink") or 
                acc.get("pdf", {}).get("downloadLink") or 
                acc.get("webReaderLink")
            )
            
            results.append({
                "id": item.get("id"),
                "title": vol.get("title", "Unknown Title"),
                "author": vol.get("authors", ["Unknown"])[0],
                "cover": vol.get("imageLinks", {}).get("thumbnail", "").replace("http:", "https:"),
                "category": vol.get("categories", ["Uncategorized"])[0],
                "download_url": download_url
            })
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
