export const API_URL = 'http://localhost:8000';

export async function translateText(text: string, context?: string) {
    const response = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context })
    });
    if (!response.ok) throw new Error('Translation failed');
    return response.json();
}

export async function getTTS(text: string, voiceId: string = 'georgian_male_1') {
    const response = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: voiceId })
    });
    if (!response.ok) throw new Error('TTS failed');
    return response.json();
}
