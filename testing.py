import os
from google import genai

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

nps_score = 7

AI_PROMPT = f"""
You are a senior customer feedback analyst. Your job is to analyze this 
NPS (Net Promoter Score) feedback.

The user gave a score of: {nps_score}/10
Here is their audio feedback:

Instructions:
1.  Transcribe the user's audio feedback exactly.
2.  Provide a single-word sentiment (e.g., "Positive", "Negative", "Frustrated", "Confused").
3.  Extract the key feedback points or action items as a list of strings.
4.  If the audio is silent or unclear, set sentiment to "Unknown" and transcription to "Audio unclear".

Respond ONLY with a valid JSON object in this exact format:
{{
  "transcription": "...",
  "sentiment": "...",
  "feedback": ["..."]
}}
"""

# 1. Upload the file
myfile = client.files.upload(file="sample.mp3")

# 2. Call the model with the prompt and the file object
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[AI_PROMPT, myfile],
)

print(response.text)
