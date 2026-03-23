import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite URL imports are not typed by default
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { v4 as uuidv4 } from 'uuid';
import { BookSection } from '../store/useReaderStore';

// Initialize PDF.js worker using a local Vite URL to avoid CORS/Iframe security errors
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function extractTextFromPDF(file: File): Promise<BookSection[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const sections: BookSection[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Process text items, joining them reasonably
    const strings = textContent.items.map(item => ('str' in item ? item.str : ''));
    let fullText = strings.join(' ').replace(/\s+/g, ' ').trim();
    
    // Split into pseudo-paragraphs to maintain readable segments for TTS
    if (fullText.length > 0) {
      // Split roughly by sentences to keep formatting reasonable
      const paragraphs = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
      
      let currentParagraph = "";
      for(const p of paragraphs) {
        currentParagraph += p + " ";
        // Create a new section if the chunk is getting too big (around 200 chars is good for TTS)
        if(currentParagraph.length > 250) {
            sections.push({
                id: uuidv4(),
                content: currentParagraph.trim(),
                page: i
            });
            currentParagraph = "";
        }
      }
      if(currentParagraph.trim().length > 0) {
        sections.push({
            id: uuidv4(),
            content: currentParagraph.trim(),
            page: i
        });
      }
    }
  }
  
  return sections;
}
