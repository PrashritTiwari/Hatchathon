# Audio Feedback API Server

Standalone FastAPI server for processing audio feedback with Gemini AI.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set your Gemini API key:**
   ```bash
   export GEMINI_API_KEY='your-api-key-here'
   ```
   
   Or create a `.env` file (if using python-dotenv):
   ```
   GEMINI_API_KEY=your-api-key-here
   ```

3. **Run the server:**
   ```bash
   python server.py
   ```
   
   Or using uvicorn directly:
   ```bash
   uvicorn server:app --host 127.0.0.1 --port 8000 --reload
   ```

The server will start on `http://127.0.0.1:8000`

## API Endpoints

### `GET /`
Health check endpoint

### `POST /submit_feedback`
Submit audio feedback with NPS score

**Request:**
- `score` (form data): Integer from 0-10
- `audio_data` (file): Audio file (mp3, wav, webm, etc.)

**Response:**
```json
{
  "transcription": "...",
  "sentiment": "Positive",
  "feedback": ["..."],
  "conversationalResponse": "...",
  "requiresFollowUp": true,
  "score": 8
}
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

