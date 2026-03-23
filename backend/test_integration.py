import requests
import os
import time

BASE_URL = "http://localhost:8000"
TEST_FILE = "../test_georgian.txt"

def test_upload():
    print("Testing /upload endpoint...")
    if not os.path.exists(TEST_FILE):
        print(f"Error: {TEST_FILE} not found.")
        return False
        
    with open(TEST_FILE, "rb") as f:
        files = {"file": ("test_georgian.txt", f, "text/plain")}
        response = requests.post(f"{BASE_URL}/upload", files=files)
        
    if response.status_code == 200:
        data = response.json()
        print(f"Upload successful. Parsed sections: {len(data.get('sections', []))}")
        if len(data.get('sections', [])) > 0:
            print(f"Sample content: {data['sections'][0]['content'][:50]}...")
        return True
    else:
        print(f"Upload failed: {response.status_code} - {response.text}")
        return False

def test_tts():
    print("\nTesting /tts endpoint for Georgian text...")
    payload = {
        "text": "გამარჯობა, ეს არის ქართული ტექსტის წამკითხველის ტესტი.",
        "voice_id": "ka-GE-EkaNeural",
        "language": "ka"
    }
    response = requests.post(f"{BASE_URL}/tts", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        audio_url = data.get("audio_url")
        print(f"TTS successful. Audio URL: {audio_url}")
        
        # Verify if the audio file exists/is accessible
        audio_fetch = requests.get(audio_url)
        if audio_fetch.status_code == 200 and len(audio_fetch.content) > 1000:
            print(f"Audio file generated correctly and is {len(audio_fetch.content)} bytes.")
            return True
        else:
            print(f"Audio URL provided but file is inaccessible or empty. Code: {audio_fetch.status_code}")
            return False
    else:
        print(f"TTS failed: {response.status_code} - {response.text}")
        return False

if __name__ == "__main__":
    upload_ok = test_upload()
    tts_ok = test_tts()
    
    if upload_ok and tts_ok:
        print("\nAll integration tests passed successfully!")
    else:
        print("\nSome integration tests failed.")
