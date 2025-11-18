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
AI_PROMPT_BASE = """You are talking to a friend about their experience. Be REAL and PERSONAL - like you're actually interested. No business talk, no ratings mentioned, just genuine conversation.

Here is their feedback (either audio or text):

{business_context}

**CRITICAL - Talk like a REAL PERSON:**
1. NEVER mention the rating/score they gave - completely ignore it in your response
2. **MOST IMPORTANT: Use the EXACT WORDS they used** - if they say "product", you say "product". If they say "service", you say "service". If they say "delivery", you say "delivery". ECHO their words back to show you're actually listening
3. Use "you" - make it personal, like you're actually talking to them
4. ALWAYS acknowledge what they said first - show you're listening
5. Be genuinely interested - ask follow-up questions like a friend would
6. Keep it SHORT - 1-2 sentences, max
7. Use natural language - contractions, casual words, real talk
8. NO business jargon, NO formal language, NO customer service speak

Instructions:
1.  Transcribe the user's feedback exactly (if audio) or use the text as-is (if text).
2.  **IDENTIFY the key words/nouns they used** - product, service, delivery, food, staff, website, etc. - you MUST use these same words in your response
3.  Provide a single-word sentiment (e.g., "Positive", "Negative", "Frustrated", "Confused").
4.  Extract the key feedback points or action items as a list of strings.

5.  **Respond naturally like a real person who cares - USE THEIR EXACT WORDS:**
    -   **IF they said something negative/unhappy:** Show you hear them using their words, then ask what happened. Set `requiresFollowUp` to `true`.
        - If they said "product": "Oh no, that sucks. What happened with the product exactly?"
        - If they said "service": "I hear you. What happened with the service?"
        - Generic: "Oh no, that sucks. What happened exactly?"
    -   **IF they said something positive but vague:** Acknowledge it using their words, then ask what specifically they like. Set `requiresFollowUp` to `true`.
        - If they said "product": "Cool! What is the thing that you like about the product?"
        - If they said "service": "Nice! What makes the service good for you?"
        - If they said "it": "Cool! What is the thing that you like about it?"
    -   **IF they gave detailed positive feedback:** Acknowledge it naturally. Set `requiresFollowUp` to `false`.
        (Example: "That's awesome! Thanks for sharing!" or "Nice! That really helps.")
    -   **IF they gave detailed negative feedback:** Acknowledge it and thank them. Set `requiresFollowUp` to `false`.
        (Example: "Got it, thanks for telling me about that.")
    -   **IF audio is unclear:** Ask casually to type. Set `requiresFollowUp` to `true`.
        (Example: "Sorry, couldn't catch that. Could you type it for me?")

5.  **Respond ONLY with a valid JSON object in this exact format:**
    {{
      "transcription": "...",
      "sentiment": "...",
      "feedback": ["..."],
      "conversationalResponse": "...",
      "requiresFollowUp": true
    }}"""

BUSINESS_CONTEXTS = {
    "medical": """**Business Context:** This feedback is for a medical/healthcare business. 
Your responses should be professional, empathetic, and use medical/healthcare terminology appropriately. 
Focus on patient care, medical services, treatment quality, wait times, staff professionalism, facility cleanliness, 
and overall healthcare experience. Be particularly sensitive to patient concerns and privacy.""",
    
    "ecommerce": """**Business Context:** This feedback is for an e-commerce/online retail business. 
Your responses should focus on online shopping experiences, product quality, website usability, shipping/delivery, 
customer service, return policies, product descriptions accuracy, checkout process, and overall shopping satisfaction. 
Use e-commerce friendly language and address common online shopping concerns.""",
    
    "restaurant": """**Business Context:** This feedback is for a restaurant/food service business. 
Your responses should focus on food quality, taste, presentation, service speed, staff friendliness, 
ambiance, cleanliness, value for money, menu variety, and overall dining experience. 
Use warm, hospitality-focused language that reflects the food service industry."""
}

def get_business_context(category: str) -> str:
    """Get business-specific context for the prompt."""
    if category and category.lower() in BUSINESS_CONTEXTS:
        return BUSINESS_CONTEXTS[category.lower()]
    return ""

FOLLOWUP_PROMPT_BASE = """You are talking to a friend about their experience. Be REAL and PERSONAL - like you're actually interested in what they have to say. No business talk, no ratings mentioned, just genuine conversation.

**What they initially told you:**
"{INITIAL_TRANSCRIPTION}"

**What you've talked about so far:**
{CONVERSATION_HISTORY}

**Number of turns so far:** {TURN_COUNT}

{business_context}

**CRITICAL - Talk like a REAL PERSON:**
1. NEVER mention ratings, scores, or numbers - just talk naturally
2. ALWAYS acknowledge what they JUST said first - show you're listening
3. **MOST IMPORTANT: Use the EXACT WORDS they used** - if they say "product", say "product". If they say "service", say "service". If they say "delivery", say "delivery". ECHO their words back to show you're actually listening
4. Use "you" - make it personal, like you're actually talking to them
5. **KEEP IT SUPER SHORT** - ONE sentence max, just acknowledge and ask ONE quick question
6. Use natural language - contractions, casual words, real talk
7. NO business jargon, NO formal language, NO customer service speak

**CONVERSATION LENGTH MANAGEMENT:**
- **If this is turn 1-2 (early conversation):** Ask ONE short follow-up question to get more detail. Set `requiresFollowUp` to `true` and `conversationComplete` to `false`.
- **If this is turn 3+ (conversation getting long):** WRAP IT UP! Thank them naturally and end the conversation. Set `requiresFollowUp` to `false` and `conversationComplete` to `true`.
  - Examples: "Got it, thanks for telling me about that!" or "Thanks! That really helps." or "Cool, appreciate you sharing!"
- **If they already gave good detail:** Thank them and end it - don't keep asking questions

**Examples of SHORT responses (USE THEIR EXACT WORDS):**
- Turn 1-2: "Cool! What is the thing that you like about the product?"
- Turn 1-2: "Oh no, what happened with the service exactly?"
- Turn 3+: "Got it, thanks for sharing!" (END CONVERSATION)
- Turn 3+: "Thanks! That really helps." (END CONVERSATION)

**Business context (just helps you understand what they're talking about - but stay PERSONAL):**
- Medical: Be caring and understanding, but still talk like a friend
- E-commerce: Talk naturally about products, shipping, shopping
- Restaurant: Talk naturally about food, service, the place

Now they're responding with new feedback (either audio or text):

Instructions:
1. Transcribe their response exactly (if audio) or use the text as-is (if text).
2. **Count how many turns you've already had** - this tells you if you should wrap up
3. **IDENTIFY the key words/nouns they used** - product, service, delivery, food, staff, website, etc.
4. **IF turn 1-2 (early):** 
   - Acknowledge what they said (like "Got it!", "Cool!", "I see!")
   - Ask ONE super short follow-up using THEIR EXACT WORDS: "What is the thing that you like about the [word they used]?"
   - Set `requiresFollowUp` to `true`, `conversationComplete` to `false`
5. **IF turn 3+ (time to wrap up):**
   - Acknowledge what they said briefly: "Got it!" or "Cool!" or "Thanks!"
   - Thank them naturally and END: "Thanks for sharing!" or "That really helps!"
   - Set `requiresFollowUp` to `false`, `conversationComplete` to `true`
6. **Keep responses SUPER SHORT** - ONE sentence only, like texting a friend

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
    audio_data: UploadFile = File(None, description="Audio file (fallback if no transcription)"),
    business_category: str = Form(None, description="Business category (medical, ecommerce, restaurant, etc.)")
):
    audio_file_handle = None
    temp_path = None
    user_transcription = None
    try:
        print(f"📥 Received feedback - Score: {score}, Business Category: {business_category}")
        
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
        business_context = get_business_context(business_category) if business_category else ""
        if business_category:
            print(f"✅ Using business category: {business_category}")
            print(f"📝 Business context: {business_context[:100]}...")
        else:
            print("⚠️ No business category provided, using generic context")
        prompt = AI_PROMPT_BASE.format(NPS_SCORE=score, business_context=business_context)

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
            "turns": [],
            "business_category": business_category  # Save business category in history
        }

        # Save initial conversation even if follow-up needed (like AskLet)
        try:
            initial_conversation = {
                "score": score,
                "sentiment": parsed["sentiment"],
                "initial_transcription": parsed["transcription"],
                "initial_feedback_points": parsed["feedback"],
                "business_category": business_category,  # Save business category
                "turns": [],
                "initial_analysis": parsed,
                "metadata": {
                    "total_turns": 0,
                    "requires_followup": parsed.get("requiresFollowUp", True),
                    "created_at": datetime.utcnow().isoformat() + "Z"
                },
                "saved_at": datetime.utcnow().isoformat() + "Z"
            }
            
            saved_filename = save_conversation_file(initial_conversation)
            parsed["saved_conversation_file"] = saved_filename
            print(f"💾 Initial conversation saved: {saved_filename} (Business: {business_category or 'None'})")
        except Exception as e:
            print(f"⚠️ Failed saving initial conversation: {e}")

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
    audio_data: UploadFile = File(None, description="Follow-up audio file (fallback if no transcription)"),
    business_category: str = Form(None, description="Business category (medical, ecommerce, restaurant, etc.)")
):
    audio_file_handle = None
    temp_path = None
    try:
        print(f"📥 Received followup - Score: {score}, Business Category: {business_category}")
        
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

        # Count total turns (this new response will be the next turn)
        turn_count = len(turns) + 1  # +1 because this is the next turn

        model = genai.GenerativeModel(model_name="gemini-2.5-flash-preview-09-2025", generation_config=generation_config)
        business_context = get_business_context(business_category) if business_category else ""
        if business_category:
            print(f"✅ Using business category for followup: {business_category}")
            print(f"📝 Business context: {business_context[:100]}...")
        else:
            print("⚠️ No business category provided for followup, using generic context")
        
        print(f"🔄 Conversation turn count: {turn_count} (will wrap up if >= 3)")

        if user_transcription:
            prompt = FOLLOWUP_PROMPT_BASE.format(
                NPS_SCORE=score,
                INITIAL_TRANSCRIPTION=initial_transcription,
                CONVERSATION_HISTORY=history_text if history_text else "No previous follow-ups yet.",
                TURN_COUNT=turn_count,
                business_context=business_context
            )
            prompt_with = f"{prompt}\n\nUser's current response: \"{user_transcription}\""
            try:
                response = await model.generate_content_async(prompt_with)
            except Exception as e:
                print("Model call error (text followup):", e)
                raise HTTPException(status_code=500, detail=f"Model error: {e}")
        else:
            prompt = FOLLOWUP_PROMPT_BASE.format(
                NPS_SCORE=score,
                INITIAL_TRANSCRIPTION=initial_transcription,
                CONVERSATION_HISTORY=history_text if history_text else "No previous follow-ups yet.",
                TURN_COUNT=turn_count,
                business_context=business_context
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
        history["business_category"] = business_category  # Keep business category in history for context

        # Always save follow-up conversation (like AskLet - save all interactions)
        try:
            # Build updated conversation data with sentiment
            updated_conversation = {
                "score": score,
                "sentiment": initial_sentiment,  # Key feature: user's sentiment
                "initial_transcription": initial_transcription,
                "initial_feedback_points": initial_feedback,  # Key feedback points
                "business_category": business_category,  # Save business category
                "turns": turns,
                "latest_analysis": parsed,
                "metadata": {
                    "total_turns": len(turns),
                    "requires_followup": parsed.get("requiresFollowUp", True),
                    "conversation_complete": parsed.get("conversationComplete", False),
                    "updated_at": datetime.utcnow().isoformat() + "Z"
                },
                "saved_at": datetime.utcnow().isoformat() + "Z"
            }
            
            saved_filename = save_conversation_file(updated_conversation)
            parsed["saved_conversation_file"] = saved_filename
            print(f"💾 Follow-up conversation saved: {saved_filename} (Business: {business_category or 'None'}, Turns: {len(turns)})")
        except Exception as e:
            print(f"⚠️ Failed saving follow-up conversation: {e}")

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
