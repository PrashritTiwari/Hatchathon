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
from collections import Counter
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
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
customer feedback and decide the correct response.

The user gave a score of: {NPS_SCORE}/10
Here is their feedback (either audio or text):

Instructions:
1.  Transcribe the user's feedback exactly (if audio) or use the text as-is (if text).
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
- Rating: {NPS_SCORE}/10
- User said: "{INITIAL_TRANSCRIPTION}"

**Conversation History:**
{CONVERSATION_HISTORY}

Now the user is responding with new feedback (either audio or text):

Instructions:
1. Transcribe their response exactly (if audio) or use the text as-is (if text).
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


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    """
    Parse ISO date/datetime strings, returning timezone-aware datetime.
    Accepts formats like '2025-01-01' or '2025-01-01T12:00:00Z'.
    """
    if not value:
        return None

    try:
        # Handle trailing Z
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        dt = datetime.fromisoformat(value)
    except ValueError:
        try:
            dt = datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Invalid date format. Use ISO format YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt


def filter_records_by_date(records: List[Dict[str, Any]], start: Optional[str], end: Optional[str]) -> List[Dict[str, Any]]:
    """
    Filter conversation records by saved_at timestamp using optional start/end strings.
    """
    start_dt = parse_iso_datetime(start) if start else None
    end_dt = parse_iso_datetime(end) if end else None

    if end_dt:
        # include entire day if only date provided (no time component)
        if end_dt.hour == 0 and end_dt.minute == 0 and end_dt.second == 0 and end_dt.microsecond == 0:
            end_dt = end_dt + timedelta(days=1) - timedelta(microseconds=1)

    filtered = []
    for record in records:
        saved_at = record.get("saved_at")
        saved_dt = parse_iso_datetime(saved_at) if saved_at else None
        if saved_dt is None:
            continue

        if start_dt and saved_dt < start_dt:
            continue
        if end_dt and saved_dt > end_dt:
            continue
        filtered.append(record)

    return filtered


def load_conversation_records(directory: str = CONVERSATIONS_DIR) -> List[Dict[str, Any]]:
    """
    Read all JSON files from conversations directory and return list of records.
    """
    if not os.path.isdir(directory):
        return []

    records: List[Dict[str, Any]] = []
    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".json"):
            continue

        path = os.path.join(directory, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            print(f"Failed reading {filename}: {exc}")
            continue

        final_analysis = data.get("final_analysis", {})
        turns = data.get("turns", [])

        record = {
            "filename": filename,
            "saved_at": data.get("saved_at"),
            "score": data.get("score"),
            "sentiment": data.get("sentiment") or final_analysis.get("sentiment"),
            "requires_followup": final_analysis.get("requiresFollowUp"),
            "conversation_complete": final_analysis.get("conversationComplete"),
            "total_turns": len(turns),
            "initial_transcription": data.get("initial_transcription"),
            "final_transcription": final_analysis.get("transcription"),
            "final_response": final_analysis.get("conversationalResponse"),
            "initial_feedback_points": data.get("initial_feedback_points")
            or data.get("initial_feedback")
            or [],
        }
        records.append(record)

    return records


def compute_analytics(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute summary stats + top feedback themes.
    """
    if not records:
        return {}

    # Scores
    numeric_scores = [r["score"] for r in records if isinstance(r["score"], (int, float))]
    avg_score = round(sum(numeric_scores) / len(numeric_scores), 2) if numeric_scores else None
    median_score = None
    if numeric_scores:
        sorted_scores = sorted(numeric_scores)
        mid = len(sorted_scores) // 2
        if len(sorted_scores) % 2 == 0:
            median_score = round((sorted_scores[mid - 1] + sorted_scores[mid]) / 2, 2)
        else:
            median_score = round(sorted_scores[mid], 2)

    # Sentiment breakdown
    sentiment_counter = Counter(
        (r.get("sentiment") or "Unknown") for r in records
    )

    # Follow-up stats
    followup_flags = [bool(r.get("requires_followup")) for r in records if r.get("requires_followup") is not None]
    followup_pct = round(100 * sum(followup_flags) / len(followup_flags), 2) if followup_flags else 0.0

    completion_flags = [bool(r.get("conversation_complete")) for r in records if r.get("conversation_complete") is not None]
    completed_pct = round(100 * sum(completion_flags) / len(completion_flags), 2) if completion_flags else 0.0

    # Turns
    turns_list = [r.get("total_turns", 0) for r in records]
    avg_turns = round(sum(turns_list) / len(turns_list), 2) if turns_list else 0.0
    max_turns = max(turns_list) if turns_list else 0

    # Feedback themes
    feedback_counter = Counter()
    for r in records:
        points = r.get("initial_feedback_points") or []
        if isinstance(points, list):
            feedback_counter.update([p.strip() for p in points if p])

    top_feedback = [{"text": text, "count": count} for text, count in feedback_counter.most_common(5)]

    return {
        "total_conversations": len(records),
        "avg_score": avg_score,
        "median_score": median_score,
        "sentiment_breakdown": sentiment_counter,
        "followup_required_pct": followup_pct,
        "completed_pct": completed_pct,
        "avg_turns": avg_turns,
        "max_turns": max_turns,
        "top_feedback": top_feedback,
    }


# --- Endpoints ---

@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat() + "Z"}


TOP_FOCUS_PROMPT = """You are a customer feedback analyst. Analyze the negative and frustrated customer feedback provided below and identify the TOP 3 most important things the company should focus on to improve customer satisfaction and address these issues.

**Note:** All feedback below is from customers with negative or frustrated sentiment. Focus on actionable improvements.

Consider:
- Frequency of mentions
- Severity/impact on customer experience
- Actionability
- Urgency of addressing the issue

**All Negative/Frustrated Customer Feedback:**

{ALL_FEEDBACK}

**Instructions:**
1. Analyze all the negative/frustrated feedback above
2. Identify the 3 most critical areas that need immediate attention to address customer dissatisfaction
3. For each area, provide:
   - A clear, actionable focus area title (e.g., "Improve Response Time", "Enhance Product Quality", "Fix Billing Issues")
   - A brief explanation (1-2 sentences) of why this is important based on the negative feedback and how addressing it will improve customer satisfaction

**Respond ONLY with a valid JSON object in this exact format:**
{{
  "top_focus_areas": [
    {{
      "title": "...",
      "explanation": "..."
    }},
    {{
      "title": "...",
      "explanation": "..."
    }},
    {{
      "title": "...",
      "explanation": "..."
    }}
  ]
}}"""


@app.get("/analytics/top-focus-areas")
async def top_focus_areas(
    start_date: Optional[str] = Query(None, description="ISO date or datetime (inclusive)"),
    end_date: Optional[str] = Query(None, description="ISO date or datetime (inclusive)"),
):
    """
    Returns the top 3 things to focus on based on negative/frustrated customer feedback, analyzed by Gemini AI.
    Only analyzes feedback from conversations with negative or frustrated sentiment.
    """
    records = load_conversation_records(CONVERSATIONS_DIR)
    if not records:
        raise HTTPException(status_code=404, detail="No saved conversations found")

    filtered_records = filter_records_by_date(records, start_date, end_date) if (start_date or end_date) else records

    if not filtered_records:
        raise HTTPException(status_code=404, detail="No conversations found for the selected timeframe")

    # Filter to only include negative or frustrated sentiment
    negative_sentiments = ["negative", "frustrated", "angry", "disappointed", "unhappy"]
    negative_records = [
        record for record in filtered_records
        if record.get("sentiment") and record.get("sentiment").lower() in [s.lower() for s in negative_sentiments]
    ]

    if not negative_records:
        raise HTTPException(
            status_code=404, 
            detail="No negative or frustrated feedback found in the selected timeframe. Focus areas are only generated from negative feedback."
        )

    # Collect all feedback from negative/frustrated conversations only
    all_feedback_text = []
    for record in negative_records:
        # Add initial transcription
        if record.get("initial_transcription"):
            all_feedback_text.append(f"Initial feedback: {record['initial_transcription']}")
        
        # Add initial feedback points
        feedback_points = record.get("initial_feedback_points", [])
        if feedback_points:
            for point in feedback_points:
                if point:
                    all_feedback_text.append(f"Feedback point: {point}")
        
        # Add final transcription if different
        if record.get("final_transcription") and record.get("final_transcription") != record.get("initial_transcription"):
            all_feedback_text.append(f"Follow-up feedback: {record['final_transcription']}")
        
        # Add conversation turns
        # Note: turns are stored in the full conversation file, not in the record summary
        # We'll need to load the full files to get turns
        filename = record.get("filename")
        if filename:
            try:
                path = os.path.join(CONVERSATIONS_DIR, filename)
                with open(path, "r", encoding="utf-8") as f:
                    full_data = json.load(f)
                    turns = full_data.get("turns", [])
                    for turn in turns:
                        user_text = turn.get("user", "")
                        if user_text:
                            all_feedback_text.append(f"User said: {user_text}")
            except Exception as e:
                print(f"Warning: Could not load full conversation file {filename}: {e}")

    if not all_feedback_text:
        raise HTTPException(status_code=404, detail="No feedback text found in conversations")

    # Combine all feedback into a single text
    combined_feedback = "\n\n".join(all_feedback_text)

    # Send to Gemini
    try:
        model = genai.GenerativeModel(model_name="gemini-2.5-flash-preview-09-2025", generation_config=generation_config)
        prompt = TOP_FOCUS_PROMPT.format(ALL_FEEDBACK=combined_feedback)
        response = await model.generate_content_async(prompt)
        
        text = getattr(response, "text", None) or getattr(response, "content", None) or str(response)
        print("Raw Gemini response for top focus areas (truncated):", text[:800])
        
        parsed = extract_json_from_text(text)
        
        # Validate structure
        if "top_focus_areas" not in parsed or not isinstance(parsed["top_focus_areas"], list):
            raise HTTPException(status_code=500, detail="Invalid response format from AI model")
        
        # Ensure we have exactly 3 items (or pad/truncate)
        focus_areas = parsed["top_focus_areas"][:3]
        while len(focus_areas) < 3:
            focus_areas.append({
                "title": "Insufficient feedback data",
                "explanation": "Not enough feedback available to identify this focus area."
            })
        
        return {
            "top_focus_areas": focus_areas,
            "total_feedback_items": len(all_feedback_text),
            "total_conversations": len(negative_records),
            "total_negative_conversations": len(negative_records),
            "total_conversations_analyzed": len(filtered_records),
        }
    except HTTPException:
        raise
    except Exception as e:
        print("Error calling Gemini for top focus areas:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze feedback: {str(e)}")


@app.get("/analytics/summary")
async def analytics_summary(
    start_date: Optional[str] = Query(None, description="ISO date or datetime (inclusive)"),
    end_date: Optional[str] = Query(None, description="ISO date or datetime (inclusive)"),
):
    """
    Returns summarized analytics for all saved conversations.
    """
    records = load_conversation_records(CONVERSATIONS_DIR)
    if not records:
        raise HTTPException(status_code=404, detail="No saved conversations found")

    filtered_records = filter_records_by_date(records, start_date, end_date) if (start_date or end_date) else records

    if not filtered_records:
        raise HTTPException(status_code=404, detail="No conversations found for the selected timeframe")

    summary = compute_analytics(filtered_records)
    top_feedback = summary.pop("top_feedback", [])
    sentiment_breakdown = summary.get("sentiment_breakdown", {})
    return {
        "summary": {
            **summary,
            "sentiment_breakdown": dict(sentiment_breakdown),
        },
        "top_feedback": top_feedback,
        "conversations": filtered_records,
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "total_available": len(records),
        },
    }


@app.post("/submit_feedback")
async def submit_feedback(
    score: int = Form(..., description="NPS score from 0-10"),
    transcription: str = Form(None, description="Pre-transcribed text (faster, optional)"),
    audio_data: UploadFile = File(None, description="Audio file (fallback if no transcription)")
):
    audio_file_handle = None
    temp_path = None
    user_transcription = None
    try:
        if score < 0 or score > 10:
            raise HTTPException(status_code=400, detail="Score must be 0-10")

        # Check if transcription or audio provided
        if transcription:
            user_transcription = transcription.strip()
            print("Using frontend transcription for initial feedback")
        elif audio_data:
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
        else:
            raise HTTPException(status_code=400, detail="Either transcription or audio_data must be provided")

        model = genai.GenerativeModel(model_name="gemini-2.5-flash-preview-09-2025", generation_config=generation_config)
        prompt = AI_PROMPT.format(NPS_SCORE=score)

        try:
            if user_transcription:
                # Use text transcription
                prompt_with = f"{prompt}\n\nUser's feedback: \"{user_transcription}\""
                response = await model.generate_content_async(prompt_with)
            else:
                # Use audio file
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
        # Use transcription from frontend if provided, otherwise use parsed transcription
        parsed.setdefault("transcription", user_transcription or parsed.get("transcription", ""))
        if user_transcription and not parsed.get("transcription"):
            parsed["transcription"] = user_transcription
        
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
    score: int = Form(..., description="Original rating score from 0-10"),
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