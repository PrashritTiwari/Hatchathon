# Follow-up Conversation Implementation Guide

## Overview

This guide explains how the follow-up conversation system works, including API calls, prompts, and frontend handling.

## Architecture

### 1. Initial Feedback Flow

**Endpoint:** `POST /submit_feedback`

**Request:**
```javascript
FormData {
  score: "5",           // NPS score (0-10)
  audio_data: File      // Audio file
}
```

**Response:**
```json
{
  "transcription": "The service was slow...",
  "sentiment": "Negative",
  "feedback": ["Slow service", "Poor experience"],
  "conversationalResponse": "I'm sorry to hear that. Could you tell me more about what was slow?",
  "requiresFollowUp": true,
  "score": 5
}
```

**Prompt Used:** `AI_PROMPT` (Initial analysis prompt)

### 2. Follow-up Conversation Flow

**Endpoint:** `POST /submit_followup`

**Request:**
```javascript
FormData {
  score: "5",                              // Original NPS score
  previous_transcription: "The service...", // What user said initially
  previous_question: "Could you tell...",   // AI's follow-up question
  audio_data: File                          // User's follow-up audio
}
```

**Response:**
```json
{
  "transcription": "The checkout process took too long...",
  "conversationalResponse": "Thank you for that detail. We'll look into improving our checkout process.",
  "requiresFollowUp": false,
  "conversationComplete": true,
  "score": 5
}
```

**Prompt Used:** `FOLLOWUP_PROMPT` (Context-aware follow-up prompt)

## Prompts

### Initial Prompt (`AI_PROMPT`)

**Purpose:** Analyze initial feedback and decide if follow-up is needed

**Key Features:**
- Transcribes audio
- Analyzes sentiment
- Extracts feedback points
- Decides if follow-up is needed based on:
  - Score 0-6 (Detractor): Always ask follow-up
  - Score 7-8 (Passive): Ask if feedback is vague
  - Score 9-10 (Promoter): Thank and close
  - Unclear audio: Ask to clarify

**Output Format:**
```json
{
  "transcription": "...",
  "sentiment": "...",
  "feedback": ["..."],
  "conversationalResponse": "...",
  "requiresFollowUp": true/false
}
```

### Follow-up Prompt (`FOLLOWUP_PROMPT`)

**Purpose:** Continue conversation with context awareness

**Key Features:**
- Includes previous conversation context:
  - Original NPS score
  - Previous user transcription
  - Previous AI question
- Transcribes new audio
- Generates contextually appropriate response
- Decides if conversation should continue or end

**Output Format:**
```json
{
  "transcription": "...",
  "conversationalResponse": "...",
  "requiresFollowUp": true/false,
  "conversationComplete": true/false
}
```

## Frontend State Management

### State Variables

```javascript
const [conversationHistory, setConversationHistory] = useState([]);
const [isFollowUp, setIsFollowUp] = useState(false);
const [response, setResponse] = useState(null);
```

### Conversation History Structure

```javascript
[
  {
    type: "initial",
    score: 5,
    transcription: "The service was slow...",
    aiResponse: "I'm sorry to hear that...",
    sentiment: "Negative",
    feedback: ["Slow service"]
  },
  {
    type: "followup",
    transcription: "The checkout process...",
    aiResponse: "Thank you for that detail..."
  }
]
```

## API Call Examples

### Initial Feedback

```javascript
const formData = new FormData();
formData.append("score", rating.toString());
formData.append("audio_data", audioFile);

const res = await fetch(`${BACKEND_URL}/submit_feedback`, {
  method: "POST",
  body: formData,
});

const data = await res.json();
// data.requiresFollowUp determines if follow-up is needed
```

### Follow-up Response

```javascript
const formData = new FormData();
formData.append("score", initialResponse.score.toString());
formData.append("previous_transcription", initialResponse.transcription);
formData.append("previous_question", initialResponse.aiResponse);
formData.append("audio_data", audioFile);

const res = await fetch(`${BACKEND_URL}/submit_followup`, {
  method: "POST",
  body: formData,
});

const data = await res.json();
// data.conversationComplete indicates if conversation should end
```

## UI Flow

1. **User submits initial feedback**
   - Shows analysis response
   - If `requiresFollowUp: true`, shows follow-up prompt

2. **Follow-up Mode Activated**
   - Button changes to "Send Follow-up"
   - Yellow highlight box shows the follow-up question
   - User can record/upload response

3. **User submits follow-up**
   - Adds to conversation history
   - Shows latest response
   - If `conversationComplete: true`, conversation ends
   - If `requiresFollowUp: true`, continues conversation

4. **Conversation History**
   - Shows all exchanges in chronological order
   - Displays initial feedback and all follow-ups
   - Visual timeline with borders

## Decision Logic

### When to Ask Follow-up (Initial)

- Score 0-6: Always ask
- Score 7-8 + vague feedback: Ask
- Score 7-8 + clear feedback: Don't ask
- Score 9-10: Don't ask
- Unclear audio: Ask

### When to Continue/End (Follow-up)

- User provided helpful details: End conversation
- User needs clarification: Continue with one more question
- Response unclear: Ask to clarify
- User satisfied: End conversation

## Testing

1. **Test Initial Feedback:**
   - Submit low score (0-6) → Should ask follow-up
   - Submit high score (9-10) → Should thank and close

2. **Test Follow-up:**
   - Respond to follow-up question → Should acknowledge and close
   - Give unclear response → Should ask for clarification

3. **Test Conversation History:**
   - Verify all exchanges are recorded
   - Check that history persists during conversation

## Error Handling

- If follow-up fails, show error message
- Maintain conversation history even on errors
- Allow user to retry follow-up
- Clear state when starting new conversation

