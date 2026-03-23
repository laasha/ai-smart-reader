export const API_URL = '/api';

export async function translateText(text: string, context?: string) {
    const response = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context })
    });
    if (!response.ok) throw new Error('Translation failed');
    return response.json();
}

export async function explainText(text: string, context: string, persona: string = "linguist") {
    const response = await fetch(`${API_URL}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context, persona })
    });
    if (!response.ok) throw new Error('Explanation failed');
    return response.json();
}

export async function fetchPersonas() {
    const response = await fetch(`${API_URL}/personas`);
    if (!response.ok) throw new Error('Failed to fetch personas');
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
