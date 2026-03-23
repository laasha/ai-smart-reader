import fitz  # PyMuPDF
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from typing import List, Dict
import re
import logging
import docx  # python-docx
import os
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_text(text: str) -> str:
    """Removes extra whitespaces but preserves sentence structures and adds logical spacing for dialogues."""
    # Ensure dialogue dashes have spaces to allow TTS to breathe if missing
    text = re.sub(r'([—-])([^\s])', r'\1 \2', text)
    # Replace multiple spaces with a single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def chunk_large_text(text: str, max_length: int = 500) -> List[str]:
    """Splits a very long paragraph into smaller logical chunks based on sentence endings."""
    if len(text) <= max_length:
        return [text]
    
    # Split by common sentence endings (. ! ?) keeping the delimiter
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""
    for s in sentences:
        if len(current_chunk) + len(s) > max_length and len(current_chunk) > 0:
            chunks.append(current_chunk.strip())
            current_chunk = s + " "
        else:
            current_chunk += s + " "
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    if not chunks:
        chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
            
    return chunks

def extract_text_from_pdf(file_path: str) -> List[Dict[str, str]]:
    try:
        doc = fitz.open(file_path)
        sections = []
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text("text")
            
            paragraphs = text.split("\n\n")
            for i, p in enumerate(paragraphs):
                p = clean_text(p)
                is_heading = len(p) > 0 and len(p) < 80 and p[0].isupper() and not p.endswith(('.', ':', '!', '?'))
                if len(p) > 10 or is_heading: 
                    if not is_heading and len(p) > 500:
                        sub_chunks = chunk_large_text(p, 500)
                        for j, chunk in enumerate(sub_chunks):
                            sections.append({
                                "id": f"p_{page_num}_{i}_{j}",
                                "content": chunk,
                                "page": page_num + 1,
                                "isHeading": False
                            })
                    else:
                        sections.append({
                            "id": f"p_{page_num}_{i}",
                            "content": p,
                            "page": page_num + 1,
                            "isHeading": is_heading
                        })
        return sections
    except Exception as e:
        logger.error(f"Error extracting PDF: {e}")
        return []


def extract_text_from_epub(file_path: str) -> List[Dict[str, str]]:
    """
    Extracts text from EPUB and splits it into logical sections.
    """
    book = epub.read_epub(file_path)
    sections = []
    
    chapter_num = 0
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            chapter_num += 1
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            paragraphs = soup.find_all(['p', 'div', 'h1', 'h2', 'h3'])
            for i, p in enumerate(paragraphs):
                text = clean_text(p.get_text())
                is_heading = p.name in ['h1', 'h2', 'h3']
                if text and (len(text) > 20 or is_heading):
                    if not is_heading and len(text) > 500:
                        sub_chunks = chunk_large_text(text, 500)
                        for j, chunk in enumerate(sub_chunks):
                            sections.append({
                                "id": f"ep_{chapter_num}_{i}_{j}",
                                "content": chunk,
                                "chapter": chapter_num,
                                "isHeading": False
                            })
                    else:
                        sections.append({
                            "id": f"ep_{chapter_num}_{i}",
                            "content": text,
                            "chapter": chapter_num,
                            "isHeading": is_heading
                        })
                
    return sections

def extract_text_from_docx(file_path: str) -> List[Dict[str, str]]:
    """
    Extracts text from Word documents.
    """
    try:
        doc = docx.Document(file_path)
        sections = []
        
        current_chunk = ""
        chunk_idx = 0
        
        for p in doc.paragraphs:
            text = clean_text(p.text)
            if not text:
                continue
                
            is_heading = getattr(p.style, 'name', '').startswith('Heading')
            
            if is_heading:
                if current_chunk.strip():
                    sections.append({
                        "id": f"docx_{chunk_idx}",
                        "content": current_chunk.strip(),
                        "page": chunk_idx + 1,
                        "isHeading": False
                    })
                    current_chunk = ""
                    chunk_idx += 1
                    
                sections.append({
                    "id": f"docx_{chunk_idx}_h",
                    "content": text,
                    "page": chunk_idx + 1,
                    "isHeading": True
                })
                chunk_idx += 1
            else:
                current_chunk += text + " "
                if len(current_chunk) > 400:
                    sections.append({
                        "id": f"docx_{chunk_idx}",
                        "content": current_chunk.strip(),
                        "page": chunk_idx + 1,
                        "isHeading": False
                    })
                    current_chunk = ""
                    chunk_idx += 1
                
        if current_chunk.strip():
            sections.append({
                "id": f"docx_{chunk_idx}",
                "content": current_chunk.strip(),
                "page": chunk_idx + 1,
                "isHeading": False
            })
            
        return sections
    except Exception as e:
        logger.error(f"Error extracting DOCX: {e}")
        return []

def extract_text_from_txt(file_path: str) -> List[Dict[str, str]]:
    """
    Extracts text from plain text files.
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        # Split by double newlines (paragraphs)
        paragraphs = re.split(r'\n\s*\n', content)
        sections = []
        
        for i, text in enumerate(paragraphs):
            text = clean_text(text)
            is_heading = len(text) > 0 and len(text) < 60 and text.isupper()
            if len(text) > 10 or is_heading:
                sections.append({
                    "id": f"txt_{i}",
                    "content": text,
                    "page": (i // 5) + 1,
                    "isHeading": is_heading
                })
        return sections
    except Exception as e:
        logger.error(f"Error extracting TXT: {e}")
        return []

def extract_text_from_html(file_path: str) -> List[Dict[str, str]]:
    """
    Extracts main text from HTML files using BeautifulSoup.
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            soup = BeautifulSoup(f, 'html.parser')
            
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content|article|story|post', re.I)) or soup.body or soup
        
        paragraphs = main_content.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'])
        
        sections = []
        for i, p in enumerate(paragraphs):
            if p.name == 'div' and len(p.find_all(['div', 'p'])) > 0:
                continue
                
            text = clean_text(p.get_text())
            is_heading = p.name.startswith('h')
            if len(text) > 30 or is_heading:
                sections.append({
                    "id": f"html_{i}",
                    "content": text,
                    "page": (i // 5) + 1,
                    "isHeading": is_heading
                })
        
        if not sections and soup.body:
            full_text = clean_text(soup.body.get_text(separator="\n\n"))
            parts = re.split(r'\n\s*\n', full_text)
            for i, part in enumerate(parts):
                if len(part) > 20:
                    sections.append({
                        "id": f"html_fb_{i}",
                        "content": part,
                        "page": (i // 5) + 1,
                        "isHeading": False
                    })
                    
        return sections
    except Exception as e:
        logger.error(f"Error extracting HTML: {e}")
        return []

def extract_text_from_md(file_path: str) -> List[Dict[str, str]]:
    """
    Extracts text from Markdown files.
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        content = re.sub(r'[*_]{1,3}([^*_]+)[*_]{1,3}', r'\1', content) 
        content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)     
        content = re.sub(r'^[#>\-\*\s]+', '', content, flags=re.MULTILINE) 
        
        paragraphs = re.split(r'\n\s*\n', content)
        sections = []
        
        for i, text in enumerate(paragraphs):
            text = clean_text(text)
            is_heading = len(text) > 0 and len(text) < 60 and text.isupper()
            if len(text) > 10 or is_heading:
                sections.append({
                    "id": f"md_{i}",
                    "content": text,
                    "page": (i // 5) + 1,
                    "isHeading": is_heading
                })
        return sections
    except Exception as e:
        logger.error(f"Error extracting MD: {e}")
        return []
