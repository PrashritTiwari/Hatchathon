"""
Full FastAPI server (server.py) — returns merged history object for follow-ups.

Endpoints:
 - GET  /health
 - POST /submit_feedback      (score + audio_data) -> initial analysis + history
 - POST /submit_followup      (score + conversation_history + transcription OR audio_data)
"""
import os
import json
import re
import tempfile
import traceback
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# make sure google.generativeai is installed and compatible with your env
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

# --- Config ---
CONVERSATIONS_DIR = "conversations"
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

app = FastAPI(title="Audio Feedback API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY or GOOGLE_API_KEY env variable not set. "
        "Set with: export GEMINI_API_KEY='your-key'"
    )

genai.configure(api_key=api_key)
print("✅ Gemini API configured")

generation_config = GenerationConfig(response_mime_type="application/json")

# --- Prompts (kept from your original) ---
AI_PROMPT = """You are a conversational customer feedback analyst. Your job is to analyze 
NPS (Net Promoter Score) feedback and decide the correct response.

The user gave a score of: {NPS_SCORE}/10
Here is their audio feedback:

Instructions:
1.  Transcribe the user's audio feedback exactly.
2.  Provide a single-word sentiment (e.g., "Positive", "Negative", "Frustrated", "Confused").
3.  Extract the key feedback points or action items as a list of strings.

4.  **Decide the Next Step:**
    -   **IF score is 0-6 (Detractor):** The user is unhappy. Generate an empathetic response that *asks a follow-up question* to get more detail. Set `requiresFollowUp` to `true`.
        (Example response: "I'm very sorry to hear that. To help us improve, could you tell me more about what part was slow?")
    -   **IF score is 7-8 (Passive) AND feedback is vague:** Ask a clarifying question. Set `requiresFollowUp` to `true`.
        (Example response: "Thanks for the feedback. What's one thing we could do to make that a 10 for you?")
    -   **IF score is 9-10 (Promoter) OR score is 7-8 and feedback is clear:** The user is happy or satisfied. Just say thank you. **Do not ask a question.** Set `requiresFollowUp` to `false`.
        (Example response: "That's wonderful to hear! We've noted your feedback and really appreciate you sharing.")
    -   **IF audio is unclear:** Ask them to type their feedback. Set `requiresFollowUp` to `true`.
        (Example response: "Sorry, I couldn't quite catch that. Could you please type your feedback instead?")

5.  **Respond ONLY with a valid JSON object in this exact format:**
    {{
      "transcription": "...",
      "sentiment": "...",
      "feedback": ["..."],
      "conversationalResponse": "...",
      "requiresFollowUp": true
    }}"""

FOLLOWUP_PROMPT = """You are continuing a customer feedback conversation. Here is the full conversation history:

**Initial Feedback:**
- NPS Score: {NPS_SCORE}/10
- User said: "{INITIAL_TRANSCRIPTION}"

**Conversation History:**
{CONVERSATION_HISTORY}

Now the user is responding with this new audio feedback:

Instructions:
1. Transcribe their audio response exactly.
2. Understand the context of their response in relation to the ENTIRE conversation history above.
3. Generate an appropriate conversational response:
   - If they provided helpful details and you have enough information: Acknowledge their response and thank them. Set `conversationComplete` to `true` and `requiresFollowUp` to `false`.
   - If you need ONE more specific detail to help them better: Ask ONE more targeted follow-up question. Set `conversationComplete` to `false` and `requiresFollowUp` to `true`.
   - If the response is unclear: Politely ask them to clarify. Set `conversationComplete` to `false` and `requiresFollowUp` to `true`.
   - If they seem satisfied or you have enough information: Thank them and close the conversation. Set `conversationComplete` to `true` and `requiresFollowUp` to `false`.
   - **Important:** After 3-4 follow-ups, try to close the conversation gracefully even if some details are missing.

4. **Respond ONLY with a valid JSON object in this exact format:**
    {{
      "transcription": "...",
      "conversationalResponse": "...",
      "requiresFollowUp": false,
      "conversationComplete": true
    }}"""

# --- Helpers ---

def extract_json_from_text(text: str) -> Dict[str, Any]:
    """
    Extract and parse a JSON object from model text output.
    Raises ValueError if parsing fails.
    """
    if not text:
        raise ValueError("Empty model response")

    # Try fenced json block first
    m = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if m:
        candidate = m.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # fallthrough to other strategies
            pass

    # Try to find the first {...} block
    m = re.search(r'\{.*\}', text, re.DOTALL)
    if m:
        candidate = m.group(0)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # best-effort: replace single quotes -> double quotes
            fixed = candidate.replace("'", '"')
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass

    raise ValueError("No valid JSON found in model output")


def save_conversation_file(payload: dict) -> str:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"conversation_{ts}.json"
    path = os.path.join(CONVERSATIONS_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return filename


def safe_delete_temp(path: Optional[str]):
    if not path:
        return
    try:
        if os.path.exists(path):
            os.unlink(path)
    except Exception as e:
        print("Warning deleting temp file:", e)


async def safe_delete_genai_file(handle):
    if not handle:
        return
    try:
        if hasattr(handle, "name"):
            genai.delete_file(handle.name)
        elif isinstance(handle, str):
            genai.delete_file(handle)
        elif hasattr(handle, "delete"):
            handle.delete()
    except Exception as e:
        print("Warning deleting genai file:", e)


# --- Endpoints ---

@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat() + "Z"}


@app.post("/submit_feedback")
async def submit_feedback(
    score: int = Form(..., description="NPS score from 0-10"),
    audio_data: UploadFile = File(..., description="Audio file (mp3, wav, webm, etc.)")
):
    audio_file_handle = None
    temp_path = None
    try:
        if score < 0 or score > 10:
            raise HTTPException(status_code=400, detail="Score must be 0-10")

        audio_bytes = await audio_data.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        # write temp audio file
        ext = os.path.splitext(audio_data.filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tf:
            tf.write(audio_bytes)
            temp_path = tf.name

        try:
            audio_file_handle = genai.upload_file(path=temp_path, mime_type=audio_data.content_type or "audio/webm")
        except Exception as e:
            print("Upload error:", e)
            raise HTTPException(status_code=500, detail=f"Failed to upload audio to Gemini: {e}")

        model = genai.GenerativeModel(model_name="gemini-2.5-flash-preview-09-2025", generation_config=generation_config)
        prompt = AI_PROMPT.format(NPS_SCORE=score)

        try:
            response = await model.generate_content_async([prompt, audio_file_handle])
        except Exception as e:
            print("Model error:", e)
            raise HTTPException(status_code=500, detail=f"Error calling model: {e}")

        text = getattr(response, "text", None) or getattr(response, "content", None) or str(response)
        print("Raw model response (truncated):", text[:800])

        try:
            parsed = extract_json_from_text(text)
        except ValueError as e:
            print("JSON parse error:", e)
            print("Full model response:", text[:4000])
            raise HTTPException(status_code=500, detail=f"Failed to parse model response as JSON: {e}")

        # Safety: do not assume False when key missing (safer default = True)
        if "requiresFollowUp" not in parsed:
            parsed["requiresFollowUp"] = True
        if "conversationComplete" not in parsed:
            parsed["conversationComplete"] = not parsed["requiresFollowUp"]

        # Validate types
        if not isinstance(parsed["requiresFollowUp"], bool):
            raise HTTPException(status_code=500, detail="Model returned invalid requiresFollowUp type")
        if not isinstance(parsed["conversationComplete"], bool):
            raise HTTPException(status_code=500, detail="Model returned invalid conversationComplete type")

        # fill missing supportive fields
        parsed.setdefault("transcription", "")
        parsed.setdefault("sentiment", "")
        parsed.setdefault("feedback", [])
        parsed.setdefault("conversationalResponse", "")

        parsed["score"] = score

        # Build history object to return
        history = {
            "initial_transcription": parsed["transcription"],
            "score": score,
            "sentiment": parsed["sentiment"],
            "feedback": parsed["feedback"],
            "turns": []
        }

        result = {
            **parsed,
            "history": history
        }

        return result

    except HTTPException:
        raise
    except Exception as e:
        print("Unhandled submit_feedback error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        safe_delete_temp(temp_path)
        await safe_delete_genai_file(audio_file_handle)


@app.post("/submit_followup")
async def submit_followup(
    score: int = Form(..., description="Original NPS score from 0-10"),
    conversation_history: str = Form(..., description="Full conversation history as JSON string"),
    transcription: str = Form(None, description="Pre-transcribed text (faster, optional)"),
    audio_data: UploadFile = File(None, description="Follow-up audio file (fallback if no transcription)")
):
    audio_file_handle = None
    temp_path = None
    try:
        if score < 0 or score > 10:
            raise HTTPException(status_code=400, detail="Score must be 0-10")

        try:
            history = json.loads(conversation_history)
        except Exception:
            raise HTTPException(status_code=400, detail="conversation_history must be valid JSON string")

        initial_transcription = history.get("initial_transcription", "")
        turns = history.get("turns", [])
        # Extract sentiment and feedback from initial response (key features)
        initial_sentiment = history.get("sentiment", "")
        initial_feedback = history.get("feedback", [])

        user_transcription = None

        if transcription:
            user_transcription = transcription
            print("Using frontend transcription")
        elif audio_data:
            audio_bytes = await audio_data.read()
            if not audio_bytes:
                raise HTTPException(status_code=400, detail="Audio file empty")

            ext = os.path.splitext(audio_data.filename)[1] or ".webm"
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tf:
                tf.write(audio_bytes)
                temp_path = tf.name

            try:
                audio_file_handle = genai.upload_file(path=temp_path, mime_type=audio_data.content_type or "audio/webm")
            except Exception as e:
                print("Upload error:", e)
                raise HTTPException(status_code=500, detail=f"Failed to upload follow-up audio: {e}")
        else:
            raise HTTPException(status_code=400, detail="Either transcription or audio_data must be provided")

        # build conversation history text for prompt
        history_text = ""
        for i, t in enumerate(turns, 1):
            ai_text = t.get("ai", "")
            user_text = t.get("user", "")
            history_text += f"\nTurn {i}:\n AI: {ai_text}\n User: {user_text}\n"

        model = genai.GenerativeModel(model_name="gemini-2.5-flash-preview-09-2025", generation_config=generation_config)

        if user_transcription:
            prompt = FOLLOWUP_PROMPT.format(
                NPS_SCORE=score,
                INITIAL_TRANSCRIPTION=initial_transcription,
                CONVERSATION_HISTORY=history_text if history_text else "No previous follow-ups yet."
            )
            prompt_with = f"{prompt}\n\nUser's current response: \"{user_transcription}\""
            try:
                response = await model.generate_content_async(prompt_with)
            except Exception as e:
                print("Model call error (text followup):", e)
                raise HTTPException(status_code=500, detail=f"Model error: {e}")
        else:
            prompt = FOLLOWUP_PROMPT.format(
                NPS_SCORE=score,
                INITIAL_TRANSCRIPTION=initial_transcription,
                CONVERSATION_HISTORY=history_text if history_text else "No previous follow-ups yet."
            )
            try:
                response = await model.generate_content_async([prompt, audio_file_handle])
            except Exception as e:
                print("Model call error (audio followup):", e)
                raise HTTPException(status_code=500, detail=f"Model error: {e}")

        text = getattr(response, "text", None) or getattr(response, "content", None) or str(response)
        print("Raw model response (followup, truncated):", text[:1000])

        try:
            parsed = extract_json_from_text(text)
        except ValueError as e:
            print("JSON extraction error for followup:", e)
            print("Full model response:", text[:4000])
            raise HTTPException(status_code=500, detail=f"Failed to parse model response: {e}")

        # Safety defaults
        if "requiresFollowUp" not in parsed:
            parsed["requiresFollowUp"] = True
        if "conversationComplete" not in parsed:
            parsed["conversationComplete"] = not parsed["requiresFollowUp"]

        # Validate boolean types
        if not isinstance(parsed["requiresFollowUp"], bool):
            raise HTTPException(status_code=500, detail="Model returned invalid requiresFollowUp type")
        if not isinstance(parsed["conversationComplete"], bool):
            raise HTTPException(status_code=500, detail="Model returned invalid conversationComplete type")

        parsed.setdefault("transcription", user_transcription or parsed.get("transcription", ""))
        parsed.setdefault("conversationalResponse", parsed.get("conversationalResponse", ""))

        parsed["score"] = score

        # append the new turn to turns
        turns.append({
            "ai": parsed.get("conversationalResponse", ""),
            "user": parsed.get("transcription", user_transcription or "")
        })

        # update history object
        history["turns"] = turns
        history["conversationComplete"] = parsed.get("conversationComplete", False)
        history["last_updated"] = datetime.utcnow().isoformat() + "Z"
        history.setdefault("initial_transcription", initial_transcription)
        history.setdefault("score", score)

        # If conversation done, save to disk
        if not parsed.get("requiresFollowUp", True):
            try:
                # Build complete conversation data with sentiment
                complete_conversation = {
                    "score": score,
                    "sentiment": initial_sentiment,  # Key feature: user's sentiment
                    "initial_transcription": initial_transcription,
                    "initial_feedback_points": initial_feedback,  # Key feedback points
                    "turns": turns,
                    "final_analysis": parsed,
                    "metadata": {
                        "total_turns": len(turns),
                        "completed_at": datetime.utcnow().isoformat() + "Z"
                    },
                    "saved_at": datetime.utcnow().isoformat() + "Z"
                }
                
                saved_filename = save_conversation_file(complete_conversation)
                parsed["saved_conversation_file"] = saved_filename
                print("💾 Conversation saved with sentiment:", saved_filename)
            except Exception as e:
                print("Failed saving conversation file:", e)

        # Build return object (merged updated history + analysis)
        result = {
            "transcription": parsed.get("transcription", ""),
            "conversationalResponse": parsed.get("conversationalResponse", ""),
            "requiresFollowUp": parsed.get("requiresFollowUp", True),
            "conversationComplete": parsed.get("conversationComplete", False),
            "score": score,
            "history": history
        }

        return result

    except HTTPException:
        raise
    except Exception as e:
        print("Unhandled submit_followup error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        safe_delete_temp(temp_path)
        await safe_delete_genai_file(audio_file_handle)


if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://127.0.0.1:8000")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
