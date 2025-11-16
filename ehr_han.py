import os
import json
import re
import asyncio
import aiofiles
import datetime
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from typing import List

# --- 1. Configuration ---
app = FastAPI(title="AI Feedback API")

# Add CORS middleware to allow our frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (for a hackathon)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# --- 2. Gemini API Setup ---
# Check for API key in environment variables (try both common names)
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("Error: API key not found!")
    print("Please set either GEMINI_API_KEY or GOOGLE_API_KEY environment variable.")
    print("You can set it with: export GEMINI_API_KEY='your-api-key-here'")
    exit(1)

try:
    genai.configure(api_key=api_key)
    print("Gemini API configured successfully.")
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    exit(1)

# File to store our feedback (acting as a simple DB for the hackathon)
DB_FILE = "dashboard_data.jsonl"
# An "async" lock to prevent race conditions when writing to the file
file_lock = asyncio.Lock()

# --- 3. The AI Prompt (The "Brain") ---
# This is the instruction that tells Gemini to do the sentiment analysis
AI_PROMPT = """
You are a senior customer feedback analyst. Your job is to analyze this 
NPS (Net Promoter Score) feedback.

The user gave a score of: {NPS_SCORE}/10
Here is their audio feedback:

Instructions:
1.  Transcribe the user's audio feedback exactly.
2.  Provide a single-word sentiment (e.g., "Positive", "Negative", "Frustrated", "Confused").
3.  Extract the key feedback points or action items as a list of strings.
4.  If the audio is silent or unclear, set sentiment to "Unknown" and transcription to "Audio unclear".

Respond ONLY with a valid JSON object in this exact format:
{
  "transcription": "...",
  "sentiment": "...",
  "feedback": ["..."]
}
"""

# We tell Gemini to guarantee it only returns JSON
generation_config = GenerationConfig(response_mime_type="application/json")


# --- 4. The API Endpoints ---

@app.get("/")
async def hello():
    """A simple route to test that the server is running."""
    return {"message": "AI Feedback Backend is running!"}


@app.post("/submit_feedback")
async def handle_feedback(
    score: str = Form(...), 
    audio_data: UploadFile = File(...)
):
    """
    This is the main endpoint.
    The frontend will send the NPS score and audio file here.
    """
    audio_file_handle = None # Initialize handle
    try:
        print(f"Received feedback: score={score}, file={audio_data.filename}")

        # --- Gemini AI Analysis (Async) ---
        
        # 1. Read the audio file's bytes asynchronously
        audio_bytes = await audio_data.read()
        
        # 2. Upload the audio file to the Gemini API
        # This gives us a "file handle" to use in the prompt.
        # We need to save bytes to a temporary file first
        print("Uploading audio file to Google...")
        temp_file_path = None
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_data.filename)[1]) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            audio_file_handle = genai.upload_file(
                path=temp_file_path,
                mime_type=audio_data.content_type
            )
        finally:
            # Clean up the temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
        # 3. Prepare the model and prompt
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-preview-09-2025",
            generation_config=generation_config
        )
        prompt = AI_PROMPT.format(NPS_SCORE=score)
        
        # 4. Make the API call asynchronously
        print("Sending audio and prompt to Gemini Flash for analysis...")
        # We send both the text prompt AND the audio file handle
        response = await model.generate_content_async([prompt, audio_file_handle])
        
        print("Received analysis from Gemini.")
        # Parse JSON response, handling potential formatting issues
        response_text = response.text.strip()
        
        # Try to extract JSON from markdown code blocks if present
        # Look for JSON in code blocks (```json ... ``` or ``` ... ```)
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(1).strip()
        else:
            # If no code blocks, try to find JSON object in the text
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(0).strip()
        
        # Debug: print the response we're trying to parse
        print(f"Parsing JSON response (first 500 chars): {response_text[:500]}")
        
        try:
            analysis_data = json.loads(response_text)
        except json.JSONDecodeError as json_error:
            print(f"Full response text: {response_text}")
            print(f"JSON parsing error: {json_error}")
            raise ValueError(f"Invalid JSON response from Gemini: {json_error}. Response: {response_text[:500]}")
        
        # 5. Add our own data (score and timestamp)
        analysis_data['score'] = score
        analysis_data['timestamp'] = datetime.datetime.now().isoformat()
        
        # 6. Save to our "Database" (Async)
        async with file_lock:
            async with aiofiles.open(DB_FILE, 'a') as f:
                # 'jsonl' format means one JSON object per line
                await f.write(json.dumps(analysis_data) + "\n")
                
        print(f"Analysis complete: {analysis_data}")
        
        # 7. Clean up the file we uploaded to Google
        try:
            # Try to delete the uploaded file (file handle might have different attributes)
            file_name = getattr(audio_file_handle, 'name', None) or str(audio_file_handle)
            if hasattr(genai, 'delete_file'):
                await asyncio.to_thread(genai.delete_file, file_name)
            elif hasattr(audio_file_handle, 'delete'):
                await asyncio.to_thread(audio_file_handle.delete)
        except Exception as cleanup_error:
            print(f"Warning: Could not delete uploaded file: {cleanup_error}")

        # 8. Send the successful analysis back to the frontend
        return analysis_data

    except Exception as e:
        print(f"An error occurred: {e}")
        # Clean up the uploaded file if it exists
        if audio_file_handle:
            try:
                file_name = getattr(audio_file_handle, 'name', None) or str(audio_file_handle)
                if hasattr(genai, 'delete_file'):
                    await asyncio.to_thread(genai.delete_file, file_name)
                elif hasattr(audio_file_handle, 'delete'):
                    await asyncio.to_thread(audio_file_handle.delete)
            except Exception as cleanup_error:
                print(f"Warning: Could not delete uploaded file during error cleanup: {cleanup_error}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard", response_model=List[dict])
async def get_dashboard_data():
    """
    This endpoint powers our demo dashboard.
    It reads all the feedback we've ever saved, asynchronously.
    """
    all_feedback = []
    if not os.path.exists(DB_FILE):
        return all_feedback  # Send empty list if no file
        
    try:
        # Use a lock to safely read the file
        async with file_lock:
            async with aiofiles.open(DB_FILE, 'r') as f:
                async for line in f:
                    if line.strip():  # Avoid blank lines
                        all_feedback.append(json.loads(line))
        
        # Send all feedback, sorted with newest first
        all_feedback.reverse()
        return all_feedback
        
    except Exception as e:
        print(f"Error reading dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 5. Run the Server (using uvicorn) ---
if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI Backend API on http://127.0.0.1:5000")
    # This line allows you to run "python app.py" directly
    # Note: For the hackathon, you'll probably run:
    # uvicorn app:app --host 127.0.0.1 --port 5000 --reload
    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)