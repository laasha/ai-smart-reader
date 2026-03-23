import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateText, getTTS } from './api';

// Mock global fetch
global.fetch = vi.fn();

describe('API Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('translateText makes correct fetch call', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ translated_text: "ტესტი" })
        });
        
        const result = await translateText("test", "context");
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/translate', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ text: "test", context: "context" })
        }));
        expect(result.translated_text).toBe("ტესტი");
    });

    it('getTTS makes correct fetch call', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ audio_url: "/audio/test.mp3" })
        });
        
        const result = await getTTS("ტესტი", "voice1");
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/tts', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ text: "ტესტი", voice_id: "voice1" })
        }));
        expect(result.audio_url).toBe("/audio/test.mp3");
    });
});
